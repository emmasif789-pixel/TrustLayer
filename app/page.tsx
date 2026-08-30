"use client";

import { useEffect, useState } from "react";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import EvidenceMap from "@/components/EvidenceMap";
import DecisionMode from "@/components/DecisionMode";
import HistorySidebar from "@/components/HistorySidebar";
import { AnalysisResult } from "@/lib/types";
import { supabase, getDeviceId } from "@/lib/supabase";

const LOADING_STAGES = [
  "Extracting claims…",
  "Searching for independent evidence…",
  "Comparing supporting and contradicting sources…",
  "Scoring evidence…",
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

  async function analyze() {
    if (!input.trim()) return;
    setStage(0);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-2xl italic">TrustLayer</h1>
            <p className="text-xs text-ink-soft mt-0.5">Know what to trust before you act.</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-[1fr_260px] gap-10">
          <div>
            <div className="border border-hairline bg-paper-raised p-6">
              <label className="text-xs uppercase tracking-widest text-ink-soft font-mono">
                Claim, URL, article, message, or screenshot text
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste what you want to check…"
                className="w-full mt-3 border border-hairline p-3 text-sm min-h-32 focus:border-ink outline-none bg-transparent font-body"
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-ink-soft">
                  {error && <span style={{ color: "var(--trust-low)" }}>{error}</span>}
                </span>
                <button
                  onClick={analyze}
                  disabled={loading || !input.trim()}
                  className="px-6 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
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
              <div className="mt-8 space-y-10">
                <TrustScoreGauge trust={result.trust} />

                <div className="grid sm:grid-cols-3 gap-6">
                  <SummaryList title="What we know" items={result.whatWeKnow} />
                  <SummaryList title="What we don't know" items={result.whatWeDontKnow} />
                  <SummaryList title="Missing context" items={result.missingContext} />
                </div>

                <div>
                  <h2 className="font-display text-lg italic mb-4">Evidence Map</h2>
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
    <div className="border border-hairline p-4">
      <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">None noted.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-ink-soft">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
