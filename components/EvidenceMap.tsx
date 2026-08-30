import { Claim, SourceStance } from "@/lib/types";

function stanceMeta(stance: SourceStance): { color: string; label: string } {
  switch (stance) {
    case "supports":
      return { color: "var(--trust-high)", label: "Supports" };
    case "contradicts":
      return { color: "var(--trust-low)", label: "Contradicts" };
    case "insufficient":
      return { color: "var(--trust-mid)", label: "Insufficient" };
    default:
      return { color: "var(--ink-soft)", label: "Irrelevant" };
  }
}

export default function EvidenceMap({ claims }: { claims: Claim[] }) {
  return (
    <div className="space-y-10">
      {claims.map((claim, i) => (
        <div key={claim.id}>
          <div className="flex items-baseline gap-3 border-b border-hairline pb-3">
            <span className="font-mono text-xs text-ink-soft">CLAIM {i + 1}</span>
            <h3 className="font-display text-xl">{claim.text}</h3>
          </div>

          <div className="mt-4 space-y-0">
            {claim.sources.length === 0 && claim.missingEvidenceNotes.length === 0 && (
              <p className="text-sm text-ink-soft py-3">No sources found.</p>
            )}

            {claim.sources.map((source) => {
              const { color, label } = stanceMeta(source.stance);
              return (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-4 py-4 border-b border-hairline last:border-0 group hover:bg-black/[0.02] transition-colors"
                  style={{ borderLeft: `3px solid ${color}`, paddingLeft: "1rem" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium" style={{ color }}>
                        {label.toUpperCase()}
                      </span>
                      <span className="text-xs text-ink-soft">{source.domain}</span>
                      {source.publishedDate && (
                        <span className="text-xs text-ink-soft">· {source.publishedDate}</span>
                      )}
                    </div>
                    <div className="font-body text-sm font-medium mt-1 group-hover:underline">
                      {source.title}
                    </div>
                    <p className="text-sm text-ink-soft mt-1">
                      <span className="font-medium text-ink">What it supports: </span>
                      {source.supportsWhat}
                    </p>
                    <p className="text-xs text-ink-soft mt-1 italic">{source.reliabilityNote}</p>
                  </div>
                </a>
              );
            })}

            {claim.missingEvidenceNotes.map((note, idx) => (
              <div
                key={idx}
                className="flex gap-4 py-3 border-b border-hairline last:border-0 border-dashed"
                style={{ borderLeft: "3px dashed var(--hairline)", paddingLeft: "1rem" }}
              >
                <div>
                  <span className="text-xs font-mono font-medium text-ink-soft">MISSING EVIDENCE</span>
                  <p className="text-sm text-ink-soft mt-1">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
