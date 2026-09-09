import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/groq";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";

export const maxDuration = 30;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB — comfortably under Groq's 25MB limit

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Provide an audio recording." }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "That recording is too long — keep it under a couple minutes." },
        { status: 413 }
      );
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

    const text = await transcribeAudio(file, "recording.webm");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't transcribe that clearly. Try speaking closer to the mic." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Transcribe error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't process that recording: ${message}` }, { status: 500 });
  }
}
