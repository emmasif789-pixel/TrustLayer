import { EvidenceSource, Claim, TrustSubScores, DecisionModeResult } from "./types";
import { TavilyResult, domainFromUrl } from "./tavily";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

async function callGroqTool<T>(
  userContent: string,
  tool: OpenAITool
): Promise<T | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: userContent }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;

  try {
    return JSON.parse(call.function.arguments) as T;
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
          maxItems: 4,
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
  const sourcesForPrompt = rawResults.map((r, i) => ({
    sourceId: `s${i}`,
    url: r.url,
    title: r.title,
    content: r.content.slice(0, 1200),
    publishedDate: r.published_date,
  }));

  const result = await callGroqTool<{
    sources: { sourceId: string; stance: EvidenceSource["stance"]; supportsWhat: string; reliabilityNote: string }[];
    missingEvidenceNotes: string[];
    subScores: TrustSubScores;
    hasSufficientEvidence: boolean;
  }>(
    `Claim to evaluate: "${claimText}"\n\nRetrieved sources (real web search results — do not invent anything beyond what's here):\n${JSON.stringify(
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

  return {
    sources,
    missingEvidenceNotes: result.missingEvidenceNotes ?? [],
    subScores: result.subScores,
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
