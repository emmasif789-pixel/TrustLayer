"use client";

import { useEffect, useState } from "react";
import { TrustBreakdown } from "@/lib/types";

function verdictColor(label: TrustBreakdown["verdictLabel"]): string {
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

const subScoreLabels: { key: keyof TrustBreakdown["subScores"]; label: string; invert?: boolean }[] = [
  { key: "evidenceStrength", label: "Evidence Strength" },
  { key: "sourceQuality", label: "Source Quality" },
  { key: "corroboration", label: "Corroboration" },
  { key: "contradictionSeverity", label: "Contradictions", invert: true },
  { key: "contextCompleteness", label: "Context Completeness" },
];

export default function TrustScoreGauge({ trust }: { trust: TrustBreakdown }) {
  const color = verdictColor(trust.verdictLabel);
  const [displayScore, setDisplayScore] = useState(0);
  const [barsIn, setBarsIn] = useState(false);

  useEffect(() => {
    const target = trust.overallScore;
    const duration = 700;
    let raf: number;

    function start(startTime: number) {
      setDisplayScore(0);
      setBarsIn(false);

      function tick(now: number) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Math.round(eased * target));
        if (progress < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setBarsIn(true);
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(start);
    return () => cancelAnimationFrame(raf);
  }, [trust.overallScore]);

  return (
    <div className="border border-hairline bg-paper-raised p-8">
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft font-mono">Trust Score</div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-mono text-6xl font-medium" style={{ color }}>
              {displayScore}
            </span>
            <span className="font-mono text-xl text-ink-soft">/100</span>
          </div>
        </div>
        <div
          className="px-3 py-1 text-sm font-medium border"
          style={{ color, borderColor: color }}
        >
          {trust.verdictLabel}
        </div>
      </div>

      <p className="mt-4 text-ink-soft text-sm leading-relaxed max-w-xl">{trust.summary}</p>

      <div className="mt-8 space-y-3">
        {subScoreLabels.map(({ key, label, invert }) => {
          const value = trust.subScores[key];
          const barColor = invert && value > 40 ? "var(--trust-low)" : "var(--ink)";
          return (
            <div key={key} className="grid grid-cols-[160px_1fr_44px] items-center gap-3">
              <span className="text-xs text-ink-soft font-body">{label}</span>
              <div className="h-1.5 bg-hairline">
                <div
                  className="h-full transition-all duration-700 ease-out"
                  style={{ width: barsIn ? `${value}%` : "0%", background: barColor }}
                />
              </div>
              <span className="text-xs font-mono text-right">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
