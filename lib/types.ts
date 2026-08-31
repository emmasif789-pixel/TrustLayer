export type SourceStance = "supports" | "contradicts" | "insufficient" | "irrelevant";

export interface EvidenceSource {
  id: string;
  url: string;
  title: string;
  domain: string;
  snippet: string; // short excerpt from Tavily, used as evidence text
  publishedDate?: string;
  stance: SourceStance;
  supportsWhat: string; // what this source actually supports/contradicts, in plain terms
  reliabilityNote: string; // e.g. "independent outlet", "primary source", "aggregator, cites no original reporting"
}

export interface Claim {
  id: string;
  text: string;
  sources: EvidenceSource[];
  missingEvidenceNotes: string[]; // what evidence would be needed but wasn't found
}

export interface TrustSubScores {
  evidenceStrength: number; // 0-100
  sourceQuality: number; // 0-100
  corroboration: number; // 0-100
  contradictionSeverity: number; // 0-100, HIGHER = worse (more/severe contradiction)
  contextCompleteness: number; // 0-100
}

export interface TrustBreakdown {
  overallScore: number; // 0-100, computed deterministically from subScores
  subScores: TrustSubScores;
  verdictLabel: "High Trust" | "Moderate Trust" | "Low Trust" | "Insufficient Evidence" | "Sources Disagree";
  summary: string;
}

export interface AnalysisResult {
  id: string;
  inputType: "text" | "url" | "claim";
  inputRaw: string;
  claims: Claim[];
  trust: TrustBreakdown;
  whatWeKnow: string[];
  whatWeDontKnow: string[];
  missingContext: string[];
  createdAt: string;
  fromCache?: boolean;
}

export type DecisionRisk = "HIGH" | "MEDIUM" | "LOW";

export interface DecisionModeResult {
  decisionText: string;
  risk: DecisionRisk;
  riskReason: string;
  whatWeKnow: string[];
  whatWeDontKnow: string[];
  whatToVerify: string[];
  potentialConsequences: string[];
}
