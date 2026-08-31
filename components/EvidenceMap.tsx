import { Claim } from "@/lib/types";
import SourceCard from "./SourceCard";

export default function EvidenceMap({ claims }: { claims: Claim[] }) {
  return (
    <div className="space-y-10">
      {claims.map((claim, i) => {
        const supports = claim.sources.filter((s) => s.stance === "supports").length;
        const contradicts = claim.sources.filter((s) => s.stance === "contradicts").length;

        return (
          <div key={claim.id}>
            <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3 flex-wrap">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-ink-soft">CLAIM {i + 1}</span>
                <h3 className="font-display text-xl">{claim.text}</h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                {supports > 0 && <span style={{ color: "var(--trust-high)" }}>{supports} supporting</span>}
                {contradicts > 0 && <span style={{ color: "var(--trust-low)" }}>{contradicts} contradicting</span>}
              </div>
            </div>

            <div className="mt-2 border border-hairline">
              {claim.sources.length === 0 && claim.missingEvidenceNotes.length === 0 && (
                <p className="text-sm text-ink-soft py-3 px-4">No sources found.</p>
              )}

              {claim.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}

              {claim.missingEvidenceNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 py-3 pl-4 pr-3 border-t border-hairline first:border-0"
                  style={{ borderLeft: "3px dashed var(--hairline)" }}
                >
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
