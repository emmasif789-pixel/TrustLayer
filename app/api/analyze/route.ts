import { NextRequest, NextResponse } from "next/server";
import { tavilySearch } from "@/lib/tavily";
import { extractClaims, analyzeClaimEvidence, summarizeFindings } from "@/lib/groq";
import { aggregateClaims } from "@/lib/trustScore";
import { AnalysisResult, Claim } from "@/lib/types";
import { randomUUID } from "crypto";

export const maxDuration = 60;

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

    const inputType = detectInputType(input);

    // 1. Extract claims + search queries
    const extracted = await extractClaims(input);
    if (extracted.length === 0) {
      return NextResponse.json({ error: "Could not extract a checkable claim from this input." }, { status: 422 });
    }

    // 2. Retrieve + analyze evidence per claim, in parallel
    const claimResults = await Promise.all(
      extracted.map(async (c) => {
        const rawResults = await tavilySearch(c.searchQuery, { maxResults: 6 });
        const analysis = await analyzeClaimEvidence(c.text, rawResults);
        const claim: Claim = {
          id: randomUUID(),
          text: c.text,
          sources: analysis.sources,
          missingEvidenceNotes: analysis.missingEvidenceNotes,
        };
        return { claim, subScores: analysis.subScores, hasSufficientEvidence: analysis.hasSufficientEvidence };
      })
    );

    const claims = claimResults.map((r) => r.claim);
    const trust = aggregateClaims(
      claimResults.map((r) => ({ subScores: r.subScores, hasSufficientEvidence: r.hasSufficientEvidence }))
    );

    // 3. Overall summary
    const { whatWeKnow, whatWeDontKnow, missingContext } = await summarizeFindings(claims);

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

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analyze error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
