"use client";

import { useState } from "react";
import { Claim, DecisionModeResult } from "@/lib/types";

function riskColor(risk: DecisionModeResult["risk"]): string {
  if (risk === "HIGH") return "var(--trust-low)";
  if (risk === "MEDIUM") return "var(--trust-mid)";
  return "var(--trust-high)";
}

export default function DecisionMode({
  claims,
  overallScore,
}: {
  claims: Claim[];
  overallScore: number;
}) {
  const [active, setActive] = useState(false);
  const [decisionText, setDecisionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionModeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!decisionText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionText, claims, overallScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assess decision risk.");
    } finally {
      setLoading(false);
    }
  }

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="w-full surface surface-hover py-5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5"
      >
        I&apos;m making a decision based on this →
      </button>
    );
  }

  return (
    <div className="surface p-8 sm:p-10">
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-4">Decision Mode</div>

      {!result && (
        <>
          <label className="block text-sm mb-3">What decision are you considering?</label>
          <textarea
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            placeholder="e.g. Whether to share this article, invest based on this claim, change a policy because of this..."
            className="w-full rounded-2xl p-4 text-sm min-h-24 outline-none bg-transparent resize-none input-soft"
            style={{ background: "var(--hairline-soft)" }}
          />
          {error && <p className="text-sm mt-2" style={{ color: "var(--trust-low)" }}>{error}</p>}
          <button
            onClick={submit}
            disabled={loading || !decisionText.trim()}
            className="mt-4 px-6 py-2.5 text-sm font-medium text-paper disabled:opacity-40 rounded-full transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "var(--ink)" }}
          >
            {loading ? "Assessing risk…" : "Assess Decision Risk"}
          </button>
        </>
      )}

      {result && (
        <div>
          <p className="text-sm text-ink-soft italic mb-5">&ldquo;{result.decisionText}&rdquo;</p>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs uppercase tracking-widest text-ink-soft font-mono">Decision Risk</span>
            <span
              className="px-3 py-1.5 rounded-full text-sm font-mono font-medium"
              style={{ color: riskColor(result.risk), background: `color-mix(in srgb, ${riskColor(result.risk)} 12%, transparent)` }}
            >
              {result.risk}
            </span>
          </div>
          <p className="text-sm mb-7 leading-relaxed">{result.riskReason}</p>

          <div className="grid sm:grid-cols-2 gap-8">
            <Section title="What we know" items={result.whatWeKnow} />
            <Section title="What we don't know" items={result.whatWeDontKnow} />
            <Section title="What to verify" items={result.whatToVerify} />
            <Section title="Potential consequences" items={result.potentialConsequences} />
          </div>

          <button
            onClick={() => {
              setResult(null);
              setDecisionText("");
            }}
            className="mt-7 text-sm text-ink-soft hover:text-ink underline"
          >
            Assess a different decision
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-2.5">{title}</div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm flex gap-2 leading-relaxed">
            <span className="text-ink-soft">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
