import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { verdictColor, verdictHeadline } from "@/lib/verdict";
import { AnalysisResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Trending Checks — TrustLayer",
  description: "See what people are fact-checking right now, and the evidence behind each verdict.",
};

export const revalidate = 30; // fresh-ish, not hammering the DB on every request

interface FeedRow {
  id: string;
  input_raw: string;
  created_at: string;
  result: AnalysisResult;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function fetchTrending(): Promise<FeedRow[]> {
  if (!supabase) return [];

  const { data } = await supabase
    .from("analyses")
    .select("id, input_raw, created_at, result")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) return [];

  // De-dupe by claim text so one viral check doesn't spam the feed.
  const seen = new Set<string>();
  const unique: FeedRow[] = [];
  for (const row of data as FeedRow[]) {
    const key = row.input_raw.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= 30) break;
  }
  return unique;
}

export default async function TrendingPage() {
  const rows = await fetchTrending();

  return (
    <div className="min-h-screen bg-grid">
      <header style={{ borderBottom: "1px solid var(--hairline-soft)" }} className="bg-paper/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 32 32" className="shrink-0">
              <rect width="32" height="32" rx="8" style={{ fill: "var(--ink)" }} />
              <rect x="7" y="9" width="18" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} />
              <rect x="7" y="14.8" width="13" height="2.4" rx="1.2" style={{ fill: "var(--signal-blue)" }} />
              <rect x="7" y="20.6" width="8" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} opacity="0.5" />
            </svg>
            <span className="font-display text-lg italic">TrustLayer</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-mono px-4 py-2 rounded-full transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "var(--hairline-soft)" }}
          >
            Check something new →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-soft">Live</span>
        <h1 className="font-display italic text-4xl sm:text-5xl mt-3 leading-tight">
          What people are checking
        </h1>
        <p className="text-ink-soft text-base mt-4 max-w-lg leading-relaxed">
          Every claim below was verified the same way yours would be — real
          evidence, transparent scoring, no exceptions.
        </p>

        <div className="mt-12 space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-ink-soft surface-flat p-6">
              No checks yet — be the first.
            </p>
          )}

          {rows.map((row) => {
            const trust = row.result.trust;
            const color = verdictColor(trust.verdictLabel);
            return (
              <Link
                key={row.id}
                href={`/analysis/${row.id}`}
                className="flex items-center gap-5 surface-flat surface-hover p-5 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="text-right shrink-0 w-16">
                  <div className="font-mono text-2xl font-medium" style={{ color }}>
                    {trust.overallScore}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color }}>
                      {verdictHeadline(trust)}
                    </span>
                    <span className="text-xs text-ink-soft">· {timeAgo(row.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink-soft mt-1 line-clamp-1">{row.input_raw}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
