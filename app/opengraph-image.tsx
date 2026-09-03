import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: "#14161A", display: "flex" }} />
          <div style={{ fontSize: 30, color: "#55585F", letterSpacing: 2 }}>TRUSTLAYER</div>
        </div>
        <div style={{ fontSize: 66, fontStyle: "italic", color: "#14161A", display: "flex", lineHeight: 1.15 }}>
          Know what to trust
        </div>
        <div style={{ fontSize: 66, fontStyle: "italic", color: "#14161A", display: "flex", lineHeight: 1.15 }}>
          before you act.
        </div>
        <div style={{ fontSize: 26, color: "#55585F", marginTop: 30, maxWidth: 800, display: "flex" }}>
          Real evidence. Transparent scoring. Never fabricated.
        </div>
      </div>
    ),
    { ...size }
  );
}
