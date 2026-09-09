import { tavilySearch } from "./tavily";
import { extractClaims, analyzeClaimEvidence, summarizeFindings } from "./groq";
import { aggregateClaims } from "./trustScore";
import { AnalysisResult, Claim } from "./types";
import { getCachedAnalysis, setCachedAnalysis } from "./cache";
import { fetchArticleContent } from "./urlFetch";
import { randomUUID } from "crypto";

export class NoClaimsFoundError extends Error {
  constructor() {
    super("Could not extract a checkable claim from this input.");
  }
}

function detectInputType(input: string): "url" | "text" | "claim" {
  try {
    new URL(input.trim());
    return "url";
  } catch {
    return input.trim().split(/\s+/).length <= 25 ? "claim" : "text";
  }
}

/**
 * The full pipeline: cache check -> claim extraction (with real article
 * fetch for URLs) -> per-claim evidence retrieval + analysis -> aggregate
 * trust score -> summary. Every entry point (web UI, Discord bot, future
 * integrations) should call this rather than reimplementing it.
 */
export async function runFullAnalysis(input: string): Promise<AnalysisResult> {
  const inputType = detectInputType(input);

  const cached = await getCachedAnalysis(input);
  if (cached) {
    return { ...cached, id: randomUUID(), fromCache: true };
  }

  let extractionSource = input;
  let articleFetchFailed = false;
  if (inputType === "url") {
    const article = await fetchArticleContent(input.trim());
    if (article) {
      extractionSource = `Article title: ${article.title}\n\nArticle content:\n${article.text}`;
    } else {
      articleFetchFailed = true;
    }
  }

  const extracted = await extractClaims(extractionSource);
  if (extracted.length === 0) {
    throw new NoClaimsFoundError();
  }

  // Sequential, not parallel: Groq's free tier is capped at 8000 tokens/minute
  // shared across all calls, so bursting requests in parallel blows past it.
  const claimResults = [];
  for (const c of extracted) {
    const rawResults = await tavilySearch(c.searchQuery, { maxResults: 5 });
    const analysis = await analyzeClaimEvidence(c.text, rawResults);
    const claim: Claim = {
      id: randomUUID(),
      text: c.text,
      sources: analysis.sources,
      missingEvidenceNotes: analysis.missingEvidenceNotes,
    };
    claimResults.push({ claim, subScores: analysis.subScores, hasSufficientEvidence: analysis.hasSufficientEvidence });
  }

  const claims = claimResults.map((r) => r.claim);
  const trust = aggregateClaims(
    claimResults.map((r) => ({ subScores: r.subScores, hasSufficientEvidence: r.hasSufficientEvidence }))
  );

  const { whatWeKnow, whatWeDontKnow, missingContext } = await summarizeFindings(claims);
  if (articleFetchFailed) {
    missingContext.unshift(
      "Could not fetch the full article text from this URL (paywall, blocked, or requires JavaScript) — claims were inferred from the link and title only."
    );
  }

  const result: AnalysisResult = {
    id: randomUUID(),
    inputType,
    inputRaw: input,
    claims,
    trust,
    whatWeKnow,
    whatWeDontKnow,
    missingContext,
    createdAt: new Date().toISOString(),
  };

  await setCachedAnalysis(input, result);
  return result;
}
