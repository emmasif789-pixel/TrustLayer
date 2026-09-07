import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { verdictHeadline } from "@/lib/verdict";
import { AnalysisResult } from "@/lib/types";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import EvidenceMap from "@/components/EvidenceMap";
import SiteHeader from "@/components/SiteHeader";

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
  if (!result) return { title: "Analysis not found" };

  const headline = verdictHeadline(result.trust);
  const title = `${headline} (${result.trust.overallScore}/100)`;
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
      <div className="min-h-screen flex items-center justify-center px-6 bg-grid">
        <div className="text-center max-w-sm">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-soft">Not found</span>
          <h1 className="font-display italic text-4xl mt-3">Nothing to show here.</h1>
          <p className="text-ink-soft text-sm mt-4 leading-relaxed">
            This link may have expired or the result was never saved.
          </p>
          <Link
            href="/"
            className="inline-block mt-8 px-7 py-3 text-sm font-medium text-paper rounded-full transition-all duration-300 hover:-translate-y-0.5"
            style={{ background: "var(--ink)" }}
          >
            Run a new analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-10 animate-fade-up">
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
