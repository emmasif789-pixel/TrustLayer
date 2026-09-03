"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-grid">
      <div className="text-center max-w-sm">
        <span className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--trust-low)" }}>
          Something went wrong
        </span>
        <h1 className="font-display italic text-4xl mt-3">That check didn&apos;t go through.</h1>
        <p className="text-ink-soft text-sm mt-4 leading-relaxed">
          An unexpected error interrupted this. Your evidence pipeline is fine — try again.
        </p>
        <button
          onClick={reset}
          className="inline-block mt-8 px-7 py-3 text-sm font-medium text-paper rounded-full transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: "var(--ink)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
