import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { verdictHeadline } from "@/lib/verdict";
import { AnalysisResult } from "@/lib/types";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import EvidenceMap from "@/components/EvidenceMap";

async function fetchAnalysis(id: string): Promise<AnalysisResult | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("analyses").select("result").eq("id", id).maybeSingle();
  return (data?.result as AnalysisResult) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchAnalysis(id);
  if (!result) return { title: "TrustLayer" };

  const headline = verdictHeadline(result.trust);
  const title = `${headline} (${result.trust.overallScore}/100) — TrustLayer`;
  const description =
    result.inputRaw.length > 140 ? result.inputRaw.slice(0, 140) + "…" : result.inputRaw;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/analysis/${id}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/analysis/${id}/opengraph-image`],
    },
  };
}

export default async function SharedAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchAnalysis(id);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-display italic text-2xl">Analysis not found</p>
          <p className="text-ink-soft text-sm mt-2">
            This link may have expired or the result was never saved.
          </p>
          <Link href="/" className="inline-block mt-6 text-sm underline" style={{ color: "var(--signal-blue)" }}>
            Run a new analysis
          </Link>
        </div>
      </div>
    );
  }

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
            Analyze something else →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">Claim checked</div>
          <p className="text-base leading-relaxed pl-4" style={{ borderLeft: "2px solid var(--hairline)" }}>
            {result.inputRaw}
          </p>
        </div>

        <TrustScoreGauge trust={result.trust} />

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="surface-flat p-6">
            <div className="text-xs uppercase tracking-widest text-ink-soft font-mono mb-3">What we know</div>
            <ul className="space-y-2.5">
              {result.whatWeKnow.map((item, i) => (
                <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
                  <span className="text-ink-soft">–</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-flat p-6" style={{ background: "color-mix(in srgb, var(--trust-mid) 5%, var(--paper-raised))" }}>
            <div className="text-xs uppercase tracking-widest font-mono mb-3" style={{ color: "var(--trust-mid)" }}>
              Uncertainty
            </div>
            <ul className="space-y-2.5">
              {[...result.whatWeDontKnow, ...result.missingContext].map((item, i) => (
                <li key={i} className="text-sm flex gap-2.5 leading-relaxed">
                  <span className="text-ink-soft">–</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl italic mb-5">Full Evidence</h2>
          <EvidenceMap claims={result.claims} />
        </div>

        <div className="text-center pt-8" style={{ borderTop: "1px solid var(--hairline-soft)" }}>
          <p className="text-sm text-ink-soft mb-4">Know what to trust before you act.</p>
          <Link
            href="/"
            className="inline-block px-7 py-3 text-sm font-medium text-paper rounded-full transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "var(--ink)" }}
          >
            Check your own claim
          </Link>
        </div>
      </main>
    </div>
  );
}
