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
 * Same mapping as verdictColor, but as a literal hex value for contexts
 * that can't use CSS custom properties (Discord embeds, generated images).
 */
export function verdictColorHex(label: TrustBreakdown["verdictLabel"]): string {
  switch (label) {
    case "High Trust":
      return "#1A8754";
    case "Moderate Trust":
    case "Sources Disagree":
      return "#C9A227";
    case "Low Trust":
    case "Insufficient Evidence":
      return "#C1372E";
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
