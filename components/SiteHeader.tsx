"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import AccountMenu from "./AccountMenu";
import { useAuth } from "@/lib/useAuth";

export default function SiteHeader({ onLogoClick }: { onLogoClick?: () => void }) {
  const { session } = useAuth();

  const logo = (
    <>
      <svg width="20" height="20" viewBox="0 0 32 32" className="shrink-0">
        <rect width="32" height="32" rx="8" style={{ fill: "var(--ink)" }} />
        <rect x="7" y="9" width="18" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} />
        <rect x="7" y="14.8" width="13" height="2.4" rx="1.2" style={{ fill: "var(--signal-blue)" }} className="animate-pulse-dot" />
        <rect x="7" y="20.6" width="8" height="2.4" rx="1.2" style={{ fill: "var(--paper)" }} opacity="0.5" />
      </svg>
      <span className="font-display text-lg italic">TrustLayer</span>
    </>
  );

  return (
    <header
      style={{ borderBottom: "1px solid var(--hairline-soft)" }}
      className="sticky top-0 bg-paper/80 backdrop-blur-md z-10"
    >
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        {onLogoClick ? (
          <button onClick={onLogoClick} className="flex items-center gap-2.5">
            {logo}
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            {logo}
          </Link>
        )}

        <div className="flex items-center gap-4">
          <Link
            href="/trending"
            className="text-xs font-mono px-3 py-1.5 rounded-full text-ink-soft hover:text-ink transition-colors"
            style={{ background: "var(--hairline-soft)" }}
          >
            Trending
          </Link>
          <span className="hidden sm:block text-xs font-mono text-ink-soft">
            Evidence-backed. Never fabricated.
          </span>
          <ThemeToggle />
          <AccountMenu session={session} />
        </div>
      </div>
    </header>
  );
}
