"use client";

import { useState } from "react";
import { EvidenceSource, SourceStance } from "@/lib/types";

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

export default function SourceCard({
  source,
  defaultOpen = false,
}: {
  source: EvidenceSource;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { color, label } = stanceMeta(source.stance);

  return (
    <div style={{ borderColor: "var(--hairline-soft)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3.5 py-4 px-5 sm:px-6 text-left transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span
          className="text-[10px] font-mono font-medium uppercase tracking-wide shrink-0 w-[76px]"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{source.title}</span>
        <span className="text-xs text-ink-soft shrink-0 hidden sm:inline">{source.domain}</span>
        <span
          className="text-ink-soft text-xs shrink-0 transition-transform duration-300"
          style={{ transitionTimingFunction: "var(--ease-apple)", transform: open ? "rotate(180deg)" : "none" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="pl-5 sm:pl-6 pr-5 sm:pr-6 pb-5 -mt-1 animate-fade-up">
          <div className="sm:hidden text-xs text-ink-soft mb-2 pl-[38px]">{source.domain}</div>
          <div className="pl-[38px]">
            <p className="text-sm text-ink-soft leading-relaxed">
              <span className="font-medium text-ink">What it supports: </span>
              {source.supportsWhat}
            </p>
            {source.snippet && (
              <p
                className="text-sm mt-3 text-ink-soft italic leading-relaxed pl-4"
                style={{ borderLeft: "2px solid var(--hairline)" }}
              >
                &ldquo;{source.snippet}&rdquo;
              </p>
            )}
            <div className="flex items-center justify-between mt-4 gap-3">
              <span className="text-xs text-ink-soft italic">{source.reliabilityNote}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono shrink-0 hover:underline"
                style={{ color: "var(--signal-blue)" }}
              >
                Read source ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
