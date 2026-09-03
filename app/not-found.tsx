import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-grid">
      <div className="text-center max-w-sm">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-ink-soft">404</span>
        <h1 className="font-display italic text-4xl mt-3">Nothing to verify here.</h1>
        <p className="text-ink-soft text-sm mt-4 leading-relaxed">
          This page doesn&apos;t exist, or the link is broken.
        </p>
        <Link
          href="/"
          className="inline-block mt-8 px-7 py-3 text-sm font-medium text-paper rounded-full transition-all duration-300 hover:-translate-y-0.5"
          style={{ background: "var(--ink)" }}
        >
          Back to TrustLayer
        </Link>
      </div>
    </div>
  );
}
