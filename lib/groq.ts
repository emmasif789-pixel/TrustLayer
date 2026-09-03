import { EvidenceSource, Claim, TrustSubScores, DecisionModeResult } from "./types";
import { TavilyResult, domainFromUrl } from "./tavily";
import { classifyDomain } from "./domainReputation";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(errorText: string): number {
  const match = errorText.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  return 5000;
}

/**
 * Groq's free tier caps at 8000 tokens/minute across all requests. Under
 * load this pipeline will hit 429s — wait out the model-reported delay
 * and retry rather than failing the whole analysis.
 */
async function groqFetch(body: Record<string, unknown>): Promise<Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const text = await res.text();
      if (attempt === 2) {
        throw new Error(
          `Groq rate limit reached and retries exhausted. Free tier is 8000 tokens/minute — wait a moment and try again, or upgrade at console.groq.com/settings/billing. (${text})`
        );
      }
      await sleep(parseRetryDelayMs(text));
      continue;
    }

    return res;
  }

  throw new Error("Groq request failed after retries.");
}

async function callGroqTool<T>(
  userContent: string,
  tool: OpenAITool
): Promise<T | null> {
  // Attempt 1 & 2: forced tool call. gpt-oss-120b on Groq sometimes ignores
  // tool_choice and writes free text instead (documented Groq issue) — retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await groqFetch({
      model: MODEL,
      messages: [{ role: "user", content: userContent }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
      temperature: 0.2,
    });

    if (res.ok) {
      const data = await res.json();
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      if (call) {
        try {
          return JSON.parse(call.function.arguments) as T;
        } catch {
          // fall through to next attempt / fallback
        }
      }
    } else {
      const text = await res.text();
      const isToolFailure = res.status === 400 && text.includes("tool_use_failed");
      if (!isToolFailure) {
        throw new Error(`Groq request failed (${res.status}): ${text}`);
      }
      // tool_use_failed — retry once, then fall back to plain JSON prompting
    }
  }

  // Fallback: plain JSON-mode prompt, no forced tool call.
  return callGroqJsonFallback<T>(userContent, tool);
}

async function callGroqJsonFallback<T>(
  userContent: string,
  tool: OpenAITool
): Promise<T | null> {
  const res = await groqFetch({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `${userContent}\n\nRespond with ONLY a single valid JSON object, no other text, no markdown code fences, matching exactly this schema:\n${JSON.stringify(
          tool.function.parameters
        )}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ---------- Step 1: extract claims + search queries ----------

const extractTool: OpenAITool = {
  type: "function",
  function: {
    name: "extract_claims",
    description: "Extract the key checkable claims from the input and a search query for each.",
    parameters: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The specific, checkable claim, stated plainly." },
              searchQuery: { type: "string", description: "A short web search query to find evidence for/against this claim." },
            },
            required: ["text", "searchQuery"],
          },
        },
      },
      required: ["claims"],
    },
  },
};

export async function extractClaims(input: string): Promise<{ text: string; searchQuery: string }[]> {
  const result = await callGroqTool<{ claims: { text: string; searchQuery: string }[] }>(
    `Extract 1-4 distinct, checkable factual claims from the following input. If it's a URL, treat it as "a claim made in this URL" and extract the claim(s) it likely asserts based on framing. Keep claims specific and neutral (no loaded language). Input:\n\n${input}`,
    extractTool
  );
  return result?.claims ?? [];
}

// ---------- Step 2: analyze evidence for a claim ----------

const analyzeTool: OpenAITool = {
  type: "function",
  function: {
    name: "analyze_evidence",
    description: "Classify each source's stance on the claim and score the overall evidence.",
    parameters: {
      type: "object",
      properties: {
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sourceId: { type: "string" },
              stance: { type: "string", enum: ["supports", "contradicts", "insufficient", "irrelevant"] },
              supportsWhat: { type: "string", description: "Plainly, what this source actually supports or contradicts. Empty string if irrelevant." },
              reliabilityNote: { type: "string", description: "Short note on source type/independence, e.g. 'primary source', 'aggregator citing no original reporting', 'independent outlet'." },
            },
            required: ["sourceId", "stance", "supportsWhat", "reliabilityNote"],
          },
        },
        missingEvidenceNotes: {
          type: "array",
          items: { type: "string" },
          description: "What evidence would be needed to properly verify this claim but was not found.",
        },
        subScores: {
          type: "object",
          properties: {
            evidenceStrength: { type: "number", description: "0-100: how directly and thoroughly the found evidence addresses the claim." },
            sourceQuality: { type: "number", description: "0-100: independence and credibility of the sources actually found." },
            corroboration: { type: "number", description: "0-100: how many independent (non-syndicated) sources agree." },
            contradictionSeverity: { type: "number", description: "0-100: HIGHER means more/stronger contradicting evidence exists." },
            contextCompleteness: { type: "number", description: "0-100: how complete the picture is; lower if key context is missing." },
          },
          required: ["evidenceStrength", "sourceQuality", "corroboration", "contradictionSeverity", "contextCompleteness"],
        },
        hasSufficientEvidence: { type: "boolean", description: "False if fewer than 2 relevant sources were found." },
      },
      required: ["sources", "missingEvidenceNotes", "subScores", "hasSufficientEvidence"],
    },
  },
};

export async function analyzeClaimEvidence(
  claimText: string,
  rawResults: TavilyResult[]
): Promise<{
  sources: EvidenceSource[];
  missingEvidenceNotes: string[];
  subScores: TrustSubScores;
  hasSufficientEvidence: boolean;
}> {
  const sourcesForPrompt = rawResults.map((r, i) => {
    const reputation = classifyDomain(r.url);
    return {
      sourceId: `s${i}`,
      url: r.url,
      title: r.title,
      content: r.content.slice(0, 700),
      publishedDate: r.published_date,
      knownReputationTier: reputation.tier,
      knownReputationNote: reputation.description,
    };
  });

  const result = await callGroqTool<{
    sources: { sourceId: string; stance: EvidenceSource["stance"]; supportsWhat: string; reliabilityNote: string }[];
    missingEvidenceNotes: string[];
    subScores: TrustSubScores;
    hasSufficientEvidence: boolean;
  }>(
    `Claim to evaluate: "${claimText}"\n\nRetrieved sources (real web search results — do not invent anything beyond what's here). Each source includes "knownReputationTier"/"knownReputationNote" from a curated domain-reputation dataset — this is ground truth about the publisher, not your own judgment. Use it directly when writing reliabilityNote and when scoring sourceQuality; do not contradict it based on how a source "feels."\n\n${JSON.stringify(
      sourcesForPrompt,
      null,
      2
    )}\n\nFor each source, classify its stance on the claim. Be strict: "irrelevant" if it doesn't actually address the claim, "insufficient" if it's related but too vague/weak to count as support or contradiction. Then score the overall evidence. Be honest and conservative — do not inflate scores when evidence is thin.`,
    analyzeTool
  );

  if (!result) {
    return {
      sources: [],
      missingEvidenceNotes: ["Analysis failed to return a result."],
      subScores: { evidenceStrength: 0, sourceQuality: 0, corroboration: 0, contradictionSeverity: 0, contextCompleteness: 0 },
      hasSufficientEvidence: false,
    };
  }

  const sources: EvidenceSource[] = result.sources
    .map((s) => {
      const raw = sourcesForPrompt.find((r) => r.sourceId === s.sourceId);
      if (!raw) return null;
      const source: EvidenceSource = {
        id: s.sourceId,
        url: raw.url,
        title: raw.title,
        domain: domainFromUrl(raw.url),
        snippet: raw.content.slice(0, 280),
        publishedDate: raw.publishedDate,
        stance: s.stance,
        supportsWhat: s.supportsWhat,
        reliabilityNote: s.reliabilityNote,
      };
      return source;
    })
    .filter((s): s is EvidenceSource => s !== null && s.stance !== "irrelevant");

  // sourceQuality is blended, not a pure LLM guess: half the model's contextual
  // judgment, half a deterministic average of the curated domain-reputation
  // baselines for the sources actually used. Keeps the number honest even if
  // the model is generous.
  const relevantForReputation = sources.filter((s) => s.stance !== "insufficient");
  const reputationScores = relevantForReputation.map((s) => classifyDomain(s.url).baseline);
  const deterministicQuality =
    reputationScores.length > 0
      ? reputationScores.reduce((a, b) => a + b, 0) / reputationScores.length
      : result.subScores.sourceQuality;
  const blendedSourceQuality = Math.round(result.subScores.sourceQuality * 0.5 + deterministicQuality * 0.5);

  return {
    sources,
    missingEvidenceNotes: result.missingEvidenceNotes ?? [],
    subScores: { ...result.subScores, sourceQuality: blendedSourceQuality },
    hasSufficientEvidence: result.hasSufficientEvidence,
  };
}

// ---------- Step 3: what we know / don't know ----------

const summaryTool: OpenAITool = {
  type: "function",
  function: {
    name: "summarize_findings",
    description: "Summarize what is known, unknown, and missing across all claims.",
    parameters: {
      type: "object",
      properties: {
        whatWeKnow: { type: "array", items: { type: "string" } },
        whatWeDontKnow: { type: "array", items: { type: "string" } },
        missingContext: { type: "array", items: { type: "string" } },
      },
      required: ["whatWeKnow", "whatWeDontKnow", "missingContext"],
    },
  },
};

export async function summarizeFindings(claims: Claim[]): Promise<{
  whatWeKnow: string[];
  whatWeDontKnow: string[];
  missingContext: string[];
}> {
  const result = await callGroqTool<{
    whatWeKnow: string[];
    whatWeDontKnow: string[];
    missingContext: string[];
  }>(
    `Based on this evidence analysis across all claims, give plain-language "what we know", "what we don't know", and "missing context" lists (3-5 items each, short sentences):\n\n${JSON.stringify(
      claims,
      null,
      2
    )}`,
    summaryTool
  );
  return result ?? { whatWeKnow: [], whatWeDontKnow: [], missingContext: [] };
}

// ---------- Decision Mode ----------

const decisionTool: OpenAITool = {
  type: "function",
  function: {
    name: "decision_risk",
    description: "Assess the risk of making a decision based on this evidence.",
    parameters: {
      type: "object",
      properties: {
        risk: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        riskReason: { type: "string" },
        whatWeKnow: { type: "array", items: { type: "string" } },
        whatWeDontKnow: { type: "array", items: { type: "string" } },
        whatToVerify: { type: "array", items: { type: "string" } },
        potentialConsequences: { type: "array", items: { type: "string" } },
      },
      required: ["risk", "riskReason", "whatWeKnow", "whatWeDontKnow", "whatToVerify", "potentialConsequences"],
    },
  },
};

export async function assessDecisionRisk(
  decisionText: string,
  claims: Claim[],
  overallScore: number
): Promise<Omit<DecisionModeResult, "decisionText">> {
  const result = await callGroqTool<Omit<DecisionModeResult, "decisionText">>(
    `A user is considering this decision: "${decisionText}"\n\nIt's based on evidence with an overall trust score of ${overallScore}/100. Full evidence:\n${JSON.stringify(
      claims,
      null,
      2
    )}\n\nAssess the risk of making this decision now. Be direct — if evidence is thin or contradicted, say HIGH risk and say why. List concrete things to verify before deciding, and realistic potential consequences of being wrong.`,
    decisionTool
  );

  return (
    result ?? {
      risk: "HIGH",
      riskReason: "Analysis failed to complete.",
      whatWeKnow: [],
      whatWeDontKnow: [],
      whatToVerify: [],
      potentialConsequences: [],
    }
  );
}

// ---------- Screenshot / image input: OCR via Groq vision ----------

/**
 * Extracts visible text from an image (screenshot of a post, article, message,
 * etc.) using a Groq vision model. Plain text out — no forced JSON/tool call,
 * since this is a preview-tier vision model and forcing structured output on
 * it is unreliable. Returns null on any failure so the caller can show a
 * clear "couldn't read this image" message rather than guessing.
 */
export async function extractTextFromImage(imageDataUrl: string): Promise<string | null> {
  try {
    const res = await groqFetch({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all visible text from this image exactly as written — this is a screenshot of a post, article, or message the user wants fact-checked. Return ONLY the extracted text, no commentary, no markdown, no quotes around it. If there is no readable text, respond with exactly: NO_TEXT_FOUND",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 1024,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const trimmed = content.trim();
    if (!trimmed || trimmed === "NO_TEXT_FOUND") return null;
    return trimmed;
  } catch {
    return null;
  }
}
