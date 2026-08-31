import { createHash } from "crypto";
import { supabase } from "./supabase";
import { AnalysisResult } from "./types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function getCachedAnalysis(input: string): Promise<AnalysisResult | null> {
  if (!supabase) return null;
  const key = cacheKey(input);

  const { data } = await supabase
    .from("analysis_cache")
    .select("result, created_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (!data) return null;

  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > CACHE_TTL_MS) return null;

  return data.result as AnalysisResult;
}

export async function setCachedAnalysis(input: string, result: AnalysisResult): Promise<void> {
  if (!supabase) return;
  const key = cacheKey(input);

  await supabase.from("analysis_cache").upsert({
    cache_key: key,
    input_raw: input,
    result,
    created_at: new Date().toISOString(),
  });
}
