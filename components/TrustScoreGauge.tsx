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
    <div className="border border-hairline bg-paper-raised">
      {/* Verdict — the one thing a reader must see in half a second */}
      <div className="p-8 pb-7 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-2">
            Verdict
          </div>
          <h2 className="font-display italic text-4xl sm:text-5xl leading-tight" style={{ color }}>
            {headline}
          </h2>
          <p className="mt-4 text-ink-soft text-sm leading-relaxed max-w-lg">{trust.summary}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end gap-2">
            <span className="font-mono text-4xl font-medium" style={{ color }}>
              {displayScore}
            </span>
            <span className="font-mono text-base text-ink-soft">/100</span>
          </div>
          <div
            className="mt-2 inline-block px-2.5 py-1 text-xs font-mono uppercase tracking-wide border"
            style={{ color, borderColor: color }}
          >
            {trust.verdictLabel}
          </div>
        </div>
      </div>

      {/* Scoring breakdown — the transparency detail, one level down */}
      <div className="border-t border-hairline">
        <button
          onClick={() => setBreakdownOpen((v) => !v)}
          className="w-full flex items-center justify-between px-8 py-3 text-xs font-mono uppercase tracking-widest text-ink-soft hover:text-ink transition-colors"
        >
          <span>Scoring breakdown</span>
          <span className={`transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`}>▾</span>
        </button>

        {breakdownOpen && (
          <div className="px-8 pb-7 space-y-3 animate-fade-up">
            {subScoreLabels.map(({ key, label, invert }) => {
              const value = trust.subScores[key];
              const barColor = invert && value > 40 ? "var(--trust-low)" : "var(--ink)";
              return (
                <div key={key} className="grid grid-cols-[150px_1fr_36px] items-center gap-3">
                  <span className="text-xs text-ink-soft font-body">{label}</span>
                  <div className="h-1 bg-hairline">
                    <div
                      className="h-full transition-all duration-700 ease-out"
                      style={{ width: barsIn ? `${value}%` : "0%", background: barColor }}
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
