import { ImageResponse } from "next/og";
import { supabase } from "@/lib/supabase";
import { verdictHeadline } from "@/lib/verdict";
import { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS: Record<string, string> = {
  "High Trust": "#1A8754",
  "Moderate Trust": "#C9A227",
  "Sources Disagree": "#C9A227",
  "Low Trust": "#C1372E",
  "Insufficient Evidence": "#C1372E",
};

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let headline = "TrustLayer";
  let score = "";
  let color = "#14161A";
  let claim = "Know what to trust before you act.";

  if (supabase) {
    const { data } = await supabase.from("analyses").select("result").eq("id", id).maybeSingle();
    const result = data?.result as AnalysisResult | undefined;
    if (result) {
      headline = verdictHeadline(result.trust);
      score = `${result.trust.overallScore}/100`;
      color = COLORS[result.trust.verdictLabel] ?? "#14161A";
      claim = result.inputRaw.length > 120 ? result.inputRaw.slice(0, 120) + "…" : result.inputRaw;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#F7F7F5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <div style={{ width: 28, height: 28, background: "#14161A", display: "flex" }} />
          <div style={{ fontSize: 28, color: "#55585F", letterSpacing: 2 }}>TRUSTLAYER</div>
        </div>
        <div style={{ fontSize: 76, fontStyle: "italic", color, display: "flex" }}>{headline}</div>
        <div style={{ fontSize: 40, color: "#14161A", marginTop: 10, display: "flex" }}>{score}</div>
        <div style={{ fontSize: 26, color: "#55585F", marginTop: 30, maxWidth: 900, display: "flex" }}>
          {claim}
        </div>
      </div>
    ),
    { ...size }
  );
}
