import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "@/lib/tavily";
import { extractClaims, analyzeClaimEvidence, summarizeFindings } from "@/lib/groq";
import { aggregateClaims } from "@/lib/trustScore";
import { AnalysisResult, Claim } from "@/lib/types";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache";
import { fetchArticleContent } from "@/lib/urlFetch";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

export const maxDuration = 120;

function detectInputType(input: string): "url" | "text" | "claim" {
  try {
    new URL(input.trim());
    return "url";
  } catch {
    return input.trim().split(/\s+/).length <= 25 ? "claim" : "text";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || input.trim().length < 3) {
      return NextResponse.json({ error: "Provide a claim, URL, or text to analyze." }, { status: 400 });
    }

    const identifier = getClientIdentifier(req.headers);
    const rateLimit = await checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many analyses from this connection. Try again in about ${Math.ceil(
            (rateLimit.retryAfterSeconds ?? 60) / 60
          )} minute(s).`,
        },
        { status: 429 }
      );
    }

    const inputType = detectInputType(input);

    // Identical input, still-fresh result — skip the whole pipeline.
    const cached = await getCachedAnalysis(input);
    if (cached) {
      return NextResponse.json({ ...cached, id: randomUUID(), fromCache: true });
    }

    // 1. Extract claims + search queries. For URL input, fetch the real
    // article text first — claims should come from what's actually
    // written, not a guess based on the link/title alone.
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
      return NextResponse.json({ error: "Could not extract a checkable claim from this input." }, { status: 422 });
    }

    // 2. Retrieve + analyze evidence per claim, sequentially.
    // Groq's free tier is capped at 8000 tokens/minute shared across all
    // calls — running claims in parallel bursts past that immediately.
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

    // 3. Overall summary
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

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analyze error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
