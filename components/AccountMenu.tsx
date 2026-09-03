"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AccountMenu({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabase) return null;

  async function sendMagicLink() {
    if (!email.trim() || !supabase) return;
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the link.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
  }

  if (session) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
          style={{ background: "var(--signal-blue)", color: "white" }}
          title={session.user.email ?? "Account"}
        >
          {(session.user.email ?? "?")[0].toUpperCase()}
        </button>
        {open && (
          <div className="absolute right-0 top-11 surface p-4 w-56 z-20 animate-fade-up">
            <p className="text-xs text-ink-soft truncate mb-3">{session.user.email}</p>
            <button
              onClick={signOut}
              className="text-xs font-mono px-3 py-2 rounded-full w-full text-left transition-colors hover:text-ink"
              style={{ background: "var(--hairline-soft)" }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-mono px-3.5 py-1.5 rounded-full text-ink-soft hover:text-ink transition-colors"
        style={{ background: "var(--hairline-soft)" }}
      >
        Sign in
      </button>
      {open && (
        <div className="absolute right-0 top-11 surface p-5 w-72 z-20 animate-fade-up">
          {sent ? (
            <p className="text-sm text-ink-soft leading-relaxed">
              Check <span className="text-ink font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-soft mb-3">
                Sign in to sync your history across devices.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                placeholder="you@example.com"
                className="w-full rounded-xl p-3 text-sm outline-none bg-transparent input-soft"
                style={{ background: "var(--hairline-soft)" }}
              />
              {error && <p className="text-xs mt-2" style={{ color: "var(--trust-low)" }}>{error}</p>}
              <button
                onClick={sendMagicLink}
                disabled={sending || !email.trim()}
                className="mt-3 w-full px-4 py-2.5 text-sm font-medium text-paper rounded-full disabled:opacity-40 transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: "var(--ink)" }}
              >
                {sending ? "Sending…" : "Send sign-in link"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
