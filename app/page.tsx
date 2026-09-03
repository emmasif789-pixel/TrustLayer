"use client";

import { useEffect, useRef, useState } from "react";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import EvidenceMap from "@/components/EvidenceMap";
import SourceCard from "@/components/SourceCard";
import DecisionMode from "@/components/DecisionMode";
import HistorySidebar from "@/components/HistorySidebar";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
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
  const [shareId, setShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const verdictRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (result && verdictRef.current) {
      verdictRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  async function analyze(overrideInput?: string) {
    const text = overrideInput ?? input;
    if (!text.trim()) return;
    setStage(0);
    setLoading(true);
    setError(null);
    setResult(null);
    setShareId(null);
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
        const { data: row } = await supabase
          .from("analyses")
          .insert({
            device_id: deviceId,
            input_type: data.inputType,
            input_raw: data.inputRaw,
            overall_score: data.trust.overallScore,
            verdict_label: data.trust.verdictLabel,
            result: data,
          })
          .select("id")
          .single();
        if (row?.id) setShareId(row.id);
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
      setShareId(id);
    }
  }

  async function copyShareLink() {
    if (!shareId) return;
    const url = `${window.location.origin}/analysis/${shareId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const showHero = !result && !loading;
  const strongestEvidence = result ? pickStrongestEvidence(result.claims) : [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-paper/80 backdrop-blur-md z-10" style={{ borderBottom: "1px solid var(--hairline-soft)" }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <button
            onClick={() => {
              setResult(null);
              setInput("");
              setError(null);
            }}
            className="flex items-center gap-2.5"
          >
            <svg width="20" height="20" viewBox="0 0 32 32" className="shrink-0">
              <rect width="32" height="32" rx="8" style={{ fill: "var(--ink)" }} />
              <rect x="7" y="9" width="18" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} />
              <rect x="7" y="14.8" width="13" height="2.4" rx="1.2" style={{ fill: "var(--signal-blue)" }} className="animate-pulse-dot" />
              <rect x="7" y="20.6" width="8" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} opacity="0.5" />
            </svg>
            <span className="font-display text-lg italic">TrustLayer</span>
          </button>
          <div className="flex items-center gap-4">
            <Link
              href="/trending"
              className="text-xs font-mono px-3 py-1.5 rounded-full text-ink-soft hover:text-ink transition-colors"
              style={{ background: "var(--hairline-soft)" }}
            >
              Trending
            </Link>
            <span className="hidden sm:block text-xs font-mono text-ink-soft">
              Evidence-backed. Never fabricated.
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {showHero && (
        <section className="bg-grid">
          <div className="max-w-4xl mx-auto px-6 pt-16 sm:pt-24 pb-14 sm:pb-20 text-center">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-soft animate-fade-up">
              Trust Verification
            </span>
            <h2 className="font-display italic text-4xl sm:text-5xl md:text-6xl mt-5 leading-[1.15] sm:leading-[1.1] animate-fade-up animate-fade-up-1">
              Know what to trust
              <br />
              before you act.
            </h2>
            <p className="text-ink-soft text-lg mt-6 max-w-lg mx-auto leading-relaxed animate-fade-up animate-fade-up-2">
              Paste a claim, URL, article, or message. TrustLayer weighs
              supporting against contradicting evidence — transparently, or
              not at all.
            </p>

            <div className="mt-16 grid sm:grid-cols-3 gap-10 max-w-3xl mx-auto text-left animate-fade-up animate-fade-up-3">
              {PRINCIPLES.map((p) => (
                <div key={p.label}>
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-sm text-ink-soft mt-1.5 leading-relaxed">{p.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main className="max-w-5xl mx-auto px-6 pb-16" style={{ paddingTop: "2.5rem" }}>
        <div className="grid lg:grid-cols-[1fr_260px] gap-10">
          <div>
            <div className="surface p-6 sm:p-10">
              <label className="text-xs uppercase tracking-widest text-ink-soft font-mono">
                Claim, URL, article, message, or screenshot text
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    analyze();
                  }
                }}
                placeholder="Paste what you want to check… (Enter to analyze, Shift+Enter for a new line)"
                className="w-full mt-4 text-base min-h-32 outline-none bg-transparent font-body leading-relaxed resize-none input-soft -m-1 p-1"
              />

              {showHero && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="text-xs px-3.5 py-2 rounded-full text-ink-soft hover:text-ink transition-colors"
                      style={{ background: "var(--hairline-soft)" }}
                    >
                      {ex.length > 44 ? ex.slice(0, 44) + "…" : ex}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-6 gap-4">
                <span className="text-xs">
                  {error && <span style={{ color: "var(--trust-low)" }}>{error}</span>}
                </span>
                <button
                  onClick={() => analyze()}
                  disabled={loading || !input.trim()}
                  className="group shrink-0 pl-8 pr-6 py-3.5 text-sm font-semibold text-paper disabled:opacity-40 rounded-full transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, var(--ink), color-mix(in srgb, var(--ink) 82%, var(--signal-blue)))",
                    boxShadow: "0 8px 24px -8px color-mix(in srgb, var(--signal-blue) 45%, transparent)",
                  }}
                >
                  {loading ? "Analyzing…" : "Analyze Trust"}
                  {!loading && (
                    <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                  )}
                </button>
              </div>
            </div>

            {loading && (
              <div className="mt-6 surface p-7 sm:p-8 animate-fade-up overflow-hidden">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping-slow"
                      style={{ background: "var(--signal-blue)" }}
                    />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "var(--signal-blue)" }} />
                  </span>
                  <p className="font-mono text-sm text-ink-soft">{LOADING_STAGES[stage]}</p>
                </div>
                <div className="h-1 rounded-full mt-4 overflow-hidden" style={{ background: "var(--hairline-soft)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${((stage + 1) / LOADING_STAGES.length) * 100}%`,
                      background: "var(--signal-blue)",
                      transitionTimingFunction: "var(--ease-apple)",
                    }}
                  />
                </div>

                {/* Skeleton preview of the result taking shape */}
                <div className="mt-8 space-y-4">
                  <div className="shimmer h-10 w-2/3 rounded-xl" />
                  <div className="shimmer h-4 w-full rounded-lg" />
                  <div className="shimmer h-4 w-4/5 rounded-lg" />
                  <div className="flex gap-3 pt-2">
                    <div className="shimmer h-16 flex-1 rounded-2xl" />
                    <div className="shimmer h-16 flex-1 rounded-2xl" />
                    <div className="shimmer h-16 flex-1 rounded-2xl" />
                  </div>
                </div>
              </div>
            )}

            {result && !loading && (
              <div ref={verdictRef} className="mt-8 animate-fade-up scroll-mt-24">
                {(result.fromCache || shareId) && (
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                    {result.fromCache ? (
                      <span className="text-xs font-mono text-ink-soft">
                        ⚡ Instant result — matches a check from the last 24h
                      </span>
                    ) : (
                      <span />
                    )}
                    {shareId && (
                      <button
                        onClick={copyShareLink}
                        className="text-xs font-mono px-4 py-2 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                        style={{ background: "var(--hairline-soft)" }}
                      >
                        {copied ? "Link copied ✓" : "Share this result ↗"}
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-10">
                  <TrustScoreGauge trust={result.trust} />

                  {strongestEvidence.length > 0 && (
                    <div>
                      <h2 className="font-display text-xl italic mb-5">Strongest Evidence</h2>
                      <div className="surface overflow-hidden divide-hairline-soft">
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
                    <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                      <h2 className="font-display text-xl italic">Full Evidence</h2>
                      <span className="text-xs font-mono text-ink-soft">
                        {result.claims.reduce((n, c) => n + c.sources.length, 0)} sources across{" "}
                        {result.claims.length} claim{result.claims.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <EvidenceMap claims={result.claims} />
                  </div>

                  <DecisionMode claims={result.claims} overallScore={result.trust.overallScore} />
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-4">History</div>
            <HistorySidebar items={history} onSelect={loadHistoryItem} />
          </aside>
        </div>
      </main>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="surface-flat p-6">
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">None noted.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
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
    <div className="surface-flat p-6" style={{ background: "color-mix(in srgb, var(--trust-mid) 5%, var(--paper-raised))" }}>
      <div className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "var(--trust-mid)" }}>
        Uncertainty
      </div>

      <div className="text-xs font-medium text-ink-soft mb-2">What we don&apos;t know</div>
      {dontKnow.length === 0 ? (
        <p className="text-sm text-ink-soft mb-4">None noted.</p>
      ) : (
        <ul className="space-y-2.5 mb-5">
          {dontKnow.map((item, i) => (
            <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="text-xs font-medium text-ink-soft mb-2">Missing context</div>
      {missingContext.length === 0 ? (
        <p className="text-sm text-ink-soft">None noted.</p>
      ) : (
        <ul className="space-y-2.5">
          {missingContext.map((item, i) => (
            <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
