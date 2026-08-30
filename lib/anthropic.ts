import Anthropic from "@anthropic-ai/sdk";
import { EvidenceSource, Claim, TrustSubScores, DecisionModeResult } from "./types";
import { TavilyResult, domainFromUrl } from "./tavily";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// ---------- Step 1: extract claims + search queries ----------

const extractTool: Anthropic.Tool = {
  name: "extract_claims",
  description: "Extract the key checkable claims from the input and a search query for each.",
  input_schema: {
    type: "object",
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "The specific, checkable claim, stated plainly." },
            searchQuery: { type: "string", description: "A short web search query to find evidence for/against this claim." },
          },
          required: ["text", "searchQuery"],
        },
        maxItems: 4,
      },
    },
    required: ["claims"],
  },
};

export async function extractClaims(input: string): Promise<{ text: string; searchQuery: string }[]> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [extractTool],
    tool_choice: { type: "tool", name: "extract_claims" },
    messages: [
      {
        role: "user",
        content: `Extract 1-4 distinct, checkable factual claims from the following input. If it's a URL, treat it as "a claim made in this URL" and extract the claim(s) it likely asserts based on framing. Keep claims specific and neutral (no loaded language). Input:\n\n${input}`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) return [];
  const parsed = block.input as { claims: { text: string; searchQuery: string }[] };
  return parsed.claims ?? [];
}

// ---------- Step 2: analyze evidence for a claim ----------

const analyzeTool: Anthropic.Tool = {
  name: "analyze_evidence",
  description: "Classify each source's stance on the claim and score the overall evidence.",
  input_schema: {
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

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [analyzeTool],
    tool_choice: { type: "tool", name: "analyze_evidence" },
    messages: [
      {
        role: "user",
        content: `Claim to evaluate: "${claimText}"\n\nRetrieved sources (real web search results — do not invent anything beyond what's here):\n${JSON.stringify(
          sourcesForPrompt,
          null,
          2
        )}\n\nFor each source, classify its stance on the claim. Be strict: "irrelevant" if it doesn't actually address the claim, "insufficient" if it's related but too vague/weak to count as support or contradiction. Then score the overall evidence. Be honest and conservative — do not inflate scores when evidence is thin.`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) {
    return {
      sources: [],
      missingEvidenceNotes: ["Analysis failed to return a result."],
      subScores: { evidenceStrength: 0, sourceQuality: 0, corroboration: 0, contradictionSeverity: 0, contextCompleteness: 0 },
      hasSufficientEvidence: false,
    };
  }

  const parsed = block.input as {
    sources: { sourceId: string; stance: EvidenceSource["stance"]; supportsWhat: string; reliabilityNote: string }[];
    missingEvidenceNotes: string[];
    subScores: TrustSubScores;
    hasSufficientEvidence: boolean;
  };

  const sources: EvidenceSource[] = parsed.sources
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
    missingEvidenceNotes: parsed.missingEvidenceNotes ?? [],
    subScores: parsed.subScores,
    hasSufficientEvidence: parsed.hasSufficientEvidence,
  };
}

// ---------- Step 3: what we know / don't know ----------

const summaryTool: Anthropic.Tool = {
  name: "summarize_findings",
  description: "Summarize what is known, unknown, and missing across all claims.",
  input_schema: {
    type: "object",
    properties: {
      whatWeKnow: { type: "array", items: { type: "string" } },
      whatWeDontKnow: { type: "array", items: { type: "string" } },
      missingContext: { type: "array", items: { type: "string" } },
    },
    required: ["whatWeKnow", "whatWeDontKnow", "missingContext"],
  },
};

export async function summarizeFindings(claims: Claim[]): Promise<{
  whatWeKnow: string[];
  whatWeDontKnow: string[];
  missingContext: string[];
}> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [summaryTool],
    tool_choice: { type: "tool", name: "summarize_findings" },
    messages: [
      {
        role: "user",
        content: `Based on this evidence analysis across all claims, give plain-language "what we know", "what we don't know", and "missing context" lists (3-5 items each, short sentences):\n\n${JSON.stringify(
          claims,
          null,
          2
        )}`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) return { whatWeKnow: [], whatWeDontKnow: [], missingContext: [] };
  return block.input as { whatWeKnow: string[]; whatWeDontKnow: string[]; missingContext: string[] };
}

// ---------- Decision Mode ----------

const decisionTool: Anthropic.Tool = {
  name: "decision_risk",
  description: "Assess the risk of making a decision based on this evidence.",
  input_schema: {
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
};

export async function assessDecisionRisk(
  decisionText: string,
  claims: Claim[],
  overallScore: number
): Promise<Omit<DecisionModeResult, "decisionText">> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    tools: [decisionTool],
    tool_choice: { type: "tool", name: "decision_risk" },
    messages: [
      {
        role: "user",
        content: `A user is considering this decision: "${decisionText}"\n\nIt's based on evidence with an overall trust score of ${overallScore}/100. Full evidence:\n${JSON.stringify(
          claims,
          null,
          2
        )}\n\nAssess the risk of making this decision now. Be direct — if evidence is thin or contradicted, say HIGH risk and say why. List concrete things to verify before deciding, and realistic potential consequences of being wrong.`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) {
    return {
      risk: "HIGH",
      riskReason: "Analysis failed to complete.",
      whatWeKnow: [],
      whatWeDontKnow: [],
      whatToVerify: [],
      potentialConsequences: [],
    };
  }
  return block.input as Omit<DecisionModeResult, "decisionText">;
}
