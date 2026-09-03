"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, getDeviceId } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => !!supabase);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_IN" && newSession) {
        claimAnonymousHistory(newSession.user.id);
      }
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// Idempotent: only rows still unclaimed (user_id is null) for this device
// get updated, so calling this on every sign-in is harmless after the first.
async function claimAnonymousHistory(userId: string) {
  if (!supabase) return;
  const deviceId = getDeviceId();
  await supabase.from("analyses").update({ user_id: userId }).eq("device_id", deviceId).is("user_id", null);
}
