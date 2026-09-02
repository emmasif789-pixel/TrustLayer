"use client";

import { useEffect, useState } from "react";
import { TrustBreakdown } from "@/lib/types";
import { verdictColor, verdictHeadline } from "@/lib/verdict";

const subScoreLabels: { key: keyof TrustBreakdown["subScores"]; label: string; invert?: boolean }[] = [
  { key: "evidenceStrength", label: "Evidence Strength" },
  { key: "sourceQuality", label: "Source Quality" },
  { key: "corroboration", label: "Corroboration" },
  { key: "contradictionSeverity", label: "Contradictions", invert: true },
  { key: "contextCompleteness", label: "Context Completeness" },
];

export default function TrustScoreGauge({ trust }: { trust: TrustBreakdown }) {
  const color = verdictColor(trust.verdictLabel);
  const headline = verdictHeadline(trust);
  const [displayScore, setDisplayScore] = useState(0);
  const [barsIn, setBarsIn] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

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
    <div className="surface overflow-hidden">
      {/* Verdict — the one thing a reader must see in half a second */}
      <div className="p-8 sm:p-10 pb-8 flex items-start justify-between gap-8 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">
            Verdict
          </div>
          <h2 className="font-display italic text-5xl sm:text-6xl leading-tight" style={{ color }}>
            {headline}
          </h2>
          <p className="mt-5 text-ink-soft text-base leading-relaxed max-w-lg">{trust.summary}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-2">
            <span className="font-mono text-5xl font-medium" style={{ color }}>
              {displayScore}
            </span>
            <span className="font-mono text-lg text-ink-soft">/100</span>
          </div>
          <div
            className="mt-3 inline-block px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {trust.verdictLabel}
          </div>
        </div>
      </div>

      {/* Scoring breakdown — the transparency detail, one level down */}
      <div style={{ borderTop: "1px solid var(--hairline-soft)" }}>
        <button
          onClick={() => setBreakdownOpen((v) => !v)}
          className="w-full flex items-center justify-between px-8 sm:px-10 py-4 text-xs font-mono uppercase tracking-widest text-ink-soft hover:text-ink transition-colors"
        >
          <span>Scoring breakdown</span>
          <span
            className="transition-transform duration-300"
            style={{ transitionTimingFunction: "var(--ease-apple)", transform: breakdownOpen ? "rotate(180deg)" : "none" }}
          >
            ▾
          </span>
        </button>

        {breakdownOpen && (
          <div className="px-8 sm:px-10 pb-8 space-y-4 animate-fade-up">
            {subScoreLabels.map(({ key, label, invert }) => {
              const value = trust.subScores[key];
              const barColor = invert && value > 40 ? "var(--trust-low)" : "var(--ink)";
              return (
                <div key={key} className="grid grid-cols-[150px_1fr_36px] items-center gap-3">
                  <span className="text-xs text-ink-soft font-body">{label}</span>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--hairline-soft)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: barsIn ? `${value}%` : "0%", background: barColor, transitionTimingFunction: "var(--ease-apple)" }}
                    />
                  </div>
                  <span className="text-xs font-mono text-right text-ink-soft">{Math.round(value)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
