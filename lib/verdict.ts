import { TrustBreakdown } from "./types";

export function verdictColor(label: TrustBreakdown["verdictLabel"]): string {
  switch (label) {
    case "High Trust":
      return "var(--trust-high)";
    case "Moderate Trust":
      return "var(--trust-mid)";
    case "Sources Disagree":
      return "var(--trust-mid)";
    case "Low Trust":
    case "Insufficient Evidence":
      return "var(--trust-low)";
  }
}

/**
 * A punchier, plainer-language headline derived from the same verdictLabel
 * and sub-scores the rest of the UI already shows — no new judgment, just
 * a scannable restatement of what the score already means.
 */
export function verdictHeadline(trust: TrustBreakdown): string {
  switch (trust.verdictLabel) {
    case "Insufficient Evidence":
      return "Unverified";
    case "Sources Disagree":
      return "Disputed";
    case "High Trust":
      return "Likely True";
    case "Moderate Trust":
      return "Partially Supported";
    case "Low Trust":
      return trust.subScores.contradictionSeverity >= 50 ? "Likely False" : "Unsupported";
  }
}
