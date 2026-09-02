import { Claim } from "@/lib/types";
import SourceCard from "./SourceCard";

export default function EvidenceMap({ claims }: { claims: Claim[] }) {
  return (
    <div className="space-y-12">
      {claims.map((claim, i) => {
        const supports = claim.sources.filter((s) => s.stance === "supports").length;
        const contradicts = claim.sources.filter((s) => s.stance === "contradicts").length;

        return (
          <div key={claim.id}>
            <div className="flex items-baseline justify-between gap-3 pb-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-ink-soft">CLAIM {i + 1}</span>
                <h3 className="font-display text-xl">{claim.text}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                {supports > 0 && <span style={{ color: "var(--trust-high)" }}>{supports} supporting</span>}
                {contradicts > 0 && <span style={{ color: "var(--trust-low)" }}>{contradicts} contradicting</span>}
              </div>
            </div>

            <div className="surface overflow-hidden divide-hairline-soft">
              {claim.sources.length === 0 && claim.missingEvidenceNotes.length === 0 && (
                <p className="text-sm text-ink-soft py-4 px-6">No sources found.</p>
              )}

              {claim.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}

              {claim.missingEvidenceNotes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-3 py-4 px-5 sm:px-6">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "var(--hairline)" }} />
                  <div>
                    <span className="text-[10px] font-mono font-medium text-ink-soft uppercase tracking-wide">
                      Missing evidence
                    </span>
                    <p className="text-sm text-ink-soft mt-1">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
