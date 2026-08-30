import { TrustSubScores, TrustBreakdown } from "./types";

/**
 * Weights are fixed and documented — this is the whole point of the product.
 * The LLM only estimates the five sub-scores (with reasoning tied to real
 * retrieved sources). The final number is arithmetic, not a model guess.
 */
export const WEIGHTS = {
  evidenceStrength: 0.3,
  sourceQuality: 0.25,
  corroboration: 0.2,
  contradictionPenalty: 0.15, // subtracted, not added
  contextCompleteness: 0.1,
} as const;

export function computeTrustScore(
  sub: TrustSubScores,
  hasSufficientEvidence: boolean
): TrustBreakdown {
  if (!hasSufficientEvidence) {
    return {
      overallScore: 0,
      subScores: sub,
      verdictLabel: "Insufficient Evidence",
      summary:
        "Not enough independent evidence was found to evaluate this claim. Treat it as unverified.",
    };
  }

  const raw =
    sub.evidenceStrength * WEIGHTS.evidenceStrength +
    sub.sourceQuality * WEIGHTS.sourceQuality +
    sub.corroboration * WEIGHTS.corroboration +
    sub.contextCompleteness * WEIGHTS.contextCompleteness -
    sub.contradictionSeverity * WEIGHTS.contradictionPenalty;

  const overallScore = Math.max(0, Math.min(100, Math.round(raw)));

  let verdictLabel: TrustBreakdown["verdictLabel"];
  if (sub.contradictionSeverity >= 55 && sub.corroboration >= 40) {
    // meaningful evidence on both sides
    verdictLabel = "Sources Disagree";
  } else if (overallScore >= 75) {
    verdictLabel = "High Trust";
  } else if (overallScore >= 45) {
    verdictLabel = "Moderate Trust";
  } else {
    verdictLabel = "Low Trust";
  }

  const summary = summarize(sub, overallScore, verdictLabel);

  return { overallScore, subScores: sub, verdictLabel, summary };
}

/**
 * Combine per-claim sub-scores into one overall breakdown. Claims with
 * insufficient evidence are excluded from the average but still shown
 * to the user individually — a thin claim shouldn't be hidden by
 * averaging it away.
 */
export function aggregateClaims(
  claimScores: { subScores: TrustSubScores; hasSufficientEvidence: boolean }[]
): TrustBreakdown {
  const sufficient = claimScores.filter((c) => c.hasSufficientEvidence);

  if (sufficient.length === 0) {
    return computeTrustScore(
      { evidenceStrength: 0, sourceQuality: 0, corroboration: 0, contradictionSeverity: 0, contextCompleteness: 0 },
      false
    );
  }

  const n = sufficient.length;
  const avg: TrustSubScores = {
    evidenceStrength: sum(sufficient, "evidenceStrength") / n,
    sourceQuality: sum(sufficient, "sourceQuality") / n,
    corroboration: sum(sufficient, "corroboration") / n,
    contradictionSeverity: sum(sufficient, "contradictionSeverity") / n,
    contextCompleteness: sum(sufficient, "contextCompleteness") / n,
  };

  return computeTrustScore(avg, true);
}

function sum(
  arr: { subScores: TrustSubScores }[],
  key: keyof TrustSubScores
): number {
  return arr.reduce((acc, c) => acc + c.subScores[key], 0);
}

function summarize(
  sub: TrustSubScores,
  score: number,
  label: TrustBreakdown["verdictLabel"]
): string {
  const parts: string[] = [];
  if (label === "Sources Disagree") {
    parts.push("Credible sources contradict each other on this claim.");
  } else if (label === "High Trust") {
    parts.push("Multiple independent, credible sources corroborate this claim.");
  } else if (label === "Moderate Trust") {
    parts.push("Some credible support exists, but evidence is incomplete or thin.");
  } else {
    parts.push("Little credible, independent evidence supports this claim.");
  }
  if (sub.contextCompleteness < 50) {
    parts.push("Important context appears to be missing.");
  }
  return parts.join(" ");
}
