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
    <div
      className="border-b border-hairline last:border-0"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-3.5 pl-4 pr-3 text-left hover:bg-black/[0.02] transition-colors"
      >
        <span
          className="text-[10px] font-mono font-medium uppercase tracking-wide shrink-0 w-[76px]"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{source.title}</span>
        <span className="text-xs text-ink-soft shrink-0 hidden sm:inline">{source.domain}</span>
        <span
          className={`text-ink-soft text-xs shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="pl-4 pr-3 pb-4 -mt-1 animate-fade-up">
          <div className="sm:hidden text-xs text-ink-soft mb-2">{source.domain}</div>
          <p className="text-sm text-ink-soft leading-relaxed">
            <span className="font-medium text-ink">What it supports: </span>
            {source.supportsWhat}
          </p>
          {source.snippet && (
            <p className="text-sm mt-2 text-ink-soft italic leading-relaxed border-l-2 border-hairline pl-3">
              &ldquo;{source.snippet}&rdquo;
            </p>
          )}
          <div className="flex items-center justify-between mt-3 gap-3">
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
      )}
    </div>
  );
}
