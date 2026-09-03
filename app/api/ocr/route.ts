import { NextRequest, NextResponse } from "next/server";
import { extractTextFromImage } from "@/lib/groq";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";

export const maxDuration = 30;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = (await req.json()) as { imageDataUrl?: string };

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Provide a valid image." }, { status: 400 });
    }

    // Rough size check on the base64 payload (base64 is ~1.37x the raw bytes).
    const approxBytes = (imageDataUrl.length * 3) / 4;
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large — please use a file under 8MB." }, { status: 413 });
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

    const text = await extractTextFromImage(imageDataUrl);
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read any text from that image clearly. Try a clearer screenshot, or paste the text directly." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("OCR error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Couldn't process that image: ${message}` }, { status: 500 });
  }
}
