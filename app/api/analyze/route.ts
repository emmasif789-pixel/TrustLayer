import { NextRequest, NextResponse } from "next/server";
import { runFullAnalysis, NoClaimsFoundError } from "@/lib/runAnalysis";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";

export const maxDuration = 120;

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

    const result = await runFullAnalysis(input);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NoClaimsFoundError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Analyze error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
