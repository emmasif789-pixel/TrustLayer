import { supabase } from "./supabase";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 8; // per identifier per window

export async function checkRateLimit(
  identifier: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // No Supabase configured — fail open rather than blocking a working demo.
  if (!supabase) return { allowed: true };

  const now = new Date();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("window_start, count")
    .eq("identifier", identifier)
    .maybeSingle();

  if (!existing) {
    await supabase.from("rate_limits").insert({
      identifier,
      window_start: now.toISOString(),
      count: 1,
    });
    return { allowed: true };
  }

  const windowStart = new Date(existing.window_start);
  const elapsed = now.getTime() - windowStart.getTime();

  if (elapsed > WINDOW_MS) {
    // Window expired — reset.
    await supabase
      .from("rate_limits")
      .update({ window_start: now.toISOString(), count: 1 })
      .eq("identifier", identifier);
    return { allowed: true };
  }

  if (existing.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  await supabase
    .from("rate_limits")
    .update({ count: existing.count + 1 })
    .eq("identifier", identifier);
  return { allowed: true };
}

export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
