"use client";

import { useEffect, useState } from "react";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import EvidenceMap from "@/components/EvidenceMap";
import SourceCard from "@/components/SourceCard";
import DecisionMode from "@/components/DecisionMode";
import HistorySidebar from "@/components/HistorySidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { AnalysisResult, Claim, EvidenceSource } from "@/lib/types";
import { supabase, getDeviceId } from "@/lib/supabase";

/**
 * Surface the single most decision-relevant piece of evidence from the
 * primary claim: a contradicting source first (if the picture is disputed,
 * that's what a reader needs to see immediately), then a supporting one.
 * Pure derivation from data already returned by /api/analyze.
 */
function pickStrongestEvidence(claims: Claim[]): EvidenceSource[] {
  const primary = claims[0];
  if (!primary) return [];
  const contradicting = primary.sources.find((s) => s.stance === "contradicts");
  const supporting = primary.sources.find((s) => s.stance === "supports");
  return [contradicting, supporting].filter((s): s is EvidenceSource => Boolean(s));
}

const LOADING_STAGES = [
  "Extracting claims…",
  "Searching for independent evidence…",
  "Comparing supporting and contradicting sources…",
  "Scoring evidence…",
];

const EXAMPLES = [
  "Drinking lemon water every morning boosts your metabolism",
  "5G networks were rolled out to spread COVID-19",
  "This new law bans all gas stoves nationwide by 2027",
];

const PRINCIPLES = [
  { label: "Real evidence only", detail: "Every source is retrieved live, never invented." },
  { label: "Transparent scoring", detail: "The score is arithmetic on visible sub-scores, not a guess." },
  { label: "Says what it doesn't know", detail: "Thin evidence returns \u201cInsufficient Evidence,\u201d not a made-up number." },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<
    { id: string; input_raw: string; overall_score: number; verdict_label: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!supabase) return;
    const deviceId = getDeviceId();
    supabase
      .from("analyses")
      .select("id, input_raw, overall_score, verdict_label, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setHistory(data);
      });
  }, [result]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setStage((s) => Math.min(s + 1, LOADING_STAGES.length - 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  async function analyze(overrideInput?: string) {
    const text = overrideInput ?? input;
    if (!text.trim()) return;
    setStage(0);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);

      if (supabase) {
        const deviceId = getDeviceId();
        await supabase.from("analyses").insert({
          device_id: deviceId,
          input_type: data.inputType,
          input_raw: data.inputRaw,
          overall_score: data.trust.overallScore,
          verdict_label: data.trust.verdictLabel,
          result: data,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistoryItem(id: string) {
    if (!supabase) return;
    const { data } = await supabase.from("analyses").select("result").eq("id", id).single();
    if (data?.result) {
      setResult(data.result as AnalysisResult);
      setInput((data.result as AnalysisResult).inputRaw);
    }
  }

  const showHero = !result && !loading;
  const strongestEvidence = result ? pickStrongestEvidence(result.claims) : [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline sticky top-0 bg-paper/90 backdrop-blur-sm z-10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <button
            onClick={() => {
              setResult(null);
              setInput("");
              setError(null);
            }}
            className="flex items-center gap-2.5"
          >
            <svg width="20" height="20" viewBox="0 0 32 32" className="shrink-0">
              <rect width="32" height="32" style={{ fill: "var(--ink)" }} />
              <rect x="7" y="9" width="18" height="2.4" style={{ fill: "var(--paper)" }} />
              <rect x="7" y="14.8" width="13" height="2.4" style={{ fill: "var(--signal-blue)" }} className="animate-pulse-dot" />
              <rect x="7" y="20.6" width="8" height="2.4" style={{ fill: "var(--paper)" }} opacity="0.5" />
            </svg>
            <span className="font-display text-lg italic">TrustLayer</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-xs font-mono text-ink-soft">
              Evidence-backed. Never fabricated.
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {showHero && (
        <section className="border-b border-hairline bg-grid">
          <div className="max-w-5xl mx-auto px-6 pt-16 pb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-ink-soft animate-fade-up">
              Trust Verification
            </span>
            <h2 className="font-display italic text-4xl sm:text-5xl mt-3 max-w-2xl leading-[1.15] animate-fade-up animate-fade-up-1">
              Know what to trust before you act.
            </h2>
            <p className="text-ink-soft mt-5 max-w-xl leading-relaxed animate-fade-up animate-fade-up-2">
              Paste a claim, URL, article, or message. TrustLayer retrieves real
              evidence, weighs supporting against contradicting sources, and
              scores what it finds — transparently, or not at all.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-6 max-w-3xl animate-fade-up animate-fade-up-3">
              {PRINCIPLES.map((p) => (
                <div key={p.label} className="border-l-2 pl-3" style={{ borderColor: "var(--signal-blue)" }}>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-ink-soft mt-1 leading-relaxed">{p.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-[1fr_260px] gap-10">
          <div>
            <div className="border border-hairline bg-paper-raised p-6 sm:p-8">
              <label className="text-xs uppercase tracking-widest text-ink-soft font-mono">
                Claim, URL, article, message, or screenshot text
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste what you want to check…"
                className="w-full mt-3 border border-hairline p-4 text-sm min-h-32 focus:border-ink outline-none bg-transparent font-body leading-relaxed"
              />

              {showHero && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="text-xs px-3 py-1.5 border border-hairline text-ink-soft hover:border-ink hover:text-ink transition-colors"
                    >
                      {ex.length > 44 ? ex.slice(0, 44) + "…" : ex}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-5 gap-4">
                <span className="text-xs">
                  {error && <span style={{ color: "var(--trust-low)" }}>{error}</span>}
                </span>
                <button
                  onClick={() => analyze()}
                  disabled={loading || !input.trim()}
                  className="shrink-0 px-6 py-2.5 text-sm font-medium text-paper disabled:opacity-40 hover:opacity-90 transition-opacity"
                  style={{ background: "var(--ink)" }}
                >
                  {loading ? "Analyzing…" : "Analyze Trust"}
                </button>
              </div>
            </div>

            {loading && (
              <div className="mt-6 border border-hairline p-6">
                <p className="font-mono text-sm text-ink-soft">{LOADING_STAGES[stage]}</p>
                <div className="h-0.5 bg-hairline mt-3">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${((stage + 1) / LOADING_STAGES.length) * 100}%`,
                      background: "var(--signal-blue)",
                    }}
                  />
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="mt-8 space-y-10 animate-fade-up">
                <TrustScoreGauge trust={result.trust} />

                {strongestEvidence.length > 0 && (
                  <div>
                    <h2 className="font-display text-lg italic mb-4">Strongest Evidence</h2>
                    <div className="border border-hairline">
                      {strongestEvidence.map((source) => (
                        <SourceCard key={source.id} source={source} defaultOpen />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-6">
                  <SummaryList title="What we know" items={result.whatWeKnow} />
                  <UncertaintyList
                    dontKnow={result.whatWeDontKnow}
                    missingContext={result.missingContext}
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
                    <h2 className="font-display text-lg italic">Full Evidence</h2>
                    <span className="text-xs font-mono text-ink-soft">
                      {result.claims.reduce((n, c) => n + c.sources.length, 0)} sources across{" "}
                      {result.claims.length} claim{result.claims.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <EvidenceMap claims={result.claims} />
                </div>

                <DecisionMode claims={result.claims} overallScore={result.trust.overallScore} />
              </div>
            )}
          </div>

          <aside>
            <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">History</div>
            <HistorySidebar items={history} onSelect={loadHistoryItem} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-hairline p-5">
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">None noted.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm flex gap-2 leading-relaxed">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UncertaintyList({
  dontKnow,
  missingContext,
}: {
  dontKnow: string[];
  missingContext: string[];
}) {
  return (
    <div className="border border-hairline p-5" style={{ borderColor: "var(--trust-mid)" }}>
      <div className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "var(--trust-mid)" }}>
        Uncertainty
      </div>

      <div className="text-xs font-medium text-ink-soft mb-1.5">What we don&apos;t know</div>
      {dontKnow.length === 0 ? (
        <p className="text-sm text-ink-soft mb-4">None noted.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {dontKnow.map((item, i) => (
            <li key={i} className="text-sm flex gap-2 leading-relaxed">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="text-xs font-medium text-ink-soft mb-1.5">Missing context</div>
      {missingContext.length === 0 ? (
        <p className="text-sm text-ink-soft">None noted.</p>
      ) : (
        <ul className="space-y-2">
          {missingContext.map((item, i) => (
            <li key={i} className="text-sm flex gap-2 leading-relaxed">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
