import { NextRequest, NextResponse } from "next/server";
import { assessDecisionRisk } from "@/lib/groq";
import { Claim } from "@/lib/types";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { decisionText, claims, overallScore } = (await req.json()) as {
      decisionText: string;
      claims: Claim[];
      overallScore: number;
    };

    if (!decisionText || !claims) {
      return NextResponse.json({ error: "Missing decisionText or claims." }, { status: 400 });
    }

    const identifier = getClientIdentifier(req.headers);
    const rateLimit = await checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many requests from this connection. Try again in about ${Math.ceil(
            (rateLimit.retryAfterSeconds ?? 60) / 60
          )} minute(s).`,
        },
        { status: 429 }
      );
    }

    const result = await assessDecisionRisk(decisionText, claims, overallScore);
    return NextResponse.json({ decisionText, ...result });
  } catch (err) {
    console.error("Decision mode error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Decision analysis failed: ${message}` }, { status: 500 });
  }
}
