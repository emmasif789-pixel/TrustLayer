# TrustLayer

Know what to trust before you act.

Paste a claim, URL, article, or message. TrustLayer extracts the checkable
claims, retrieves real evidence via web search, compares supporting vs.
contradicting sources, and computes a transparent trust score — never an
invented number.

## How the trust score works

The score is **not** an LLM guess. The model estimates five sub-scores
(evidence strength, source quality, corroboration, contradiction severity,
context completeness) tied to specific retrieved sources. The app then
computes the final 0-100 score with a fixed, documented weighted formula
(`lib/trustScore.ts`). If fewer than 2 relevant sources are found, the
result is always "Insufficient Evidence" - the app will not fabricate a
score.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind v4
- Groq (Llama 3.3 70B via OpenAI-compatible API) - claim extraction, evidence classification, reasoning
- Tavily - real web search for evidence retrieval
- Supabase (Postgres) - analysis history (optional for local dev)

## Setup

1. Install dependencies: `npm install`

2. Get API keys:
   - Groq: https://console.groq.com (free API key)
   - Tavily: https://tavily.com (free tier, 1000 searches/month, no card required)
   - Supabase (optional): https://supabase.com - create a project, then run
     `supabase/schema.sql` in the SQL editor to create the `analyses` table.

3. Configure environment: `cp .env.example .env.local` and fill in
   `GROQ_API_KEY`, `TAVILY_API_KEY`, and (optionally) the two
   `NEXT_PUBLIC_SUPABASE_*` values.

4. Run locally: `npm run dev`

5. Deploy: push to GitHub, import into Vercel, add the same env vars in
   Vercel project settings. No other config needed.

## What's real vs. what's MVP-scoped

- Evidence, sources, and scores are always real - retrieved live from
  Tavily, never fabricated. If evidence is insufficient, the product says so.
- History has no user accounts yet - it's tied to an anonymous device ID
  in localStorage, stored in Supabase with a permissive RLS policy. Fine
  for a demo/MVP; add real auth (Supabase Auth) before handling multiple
  real users on shared infrastructure.
- Screenshot input is accepted as pasted/OCR'd text for now - no image
  upload/OCR pipeline is wired yet.

## Architecture

```
app/api/analyze/route.ts   -> orchestrates: extract claims -> search each
                               claim (Tavily) -> classify evidence (Claude)
                               -> aggregate deterministic trust score
app/api/decision/route.ts  -> Decision Mode: risk assessment reusing
                               already-retrieved evidence
lib/groq.ts                 -> Groq calls, forced structured JSON output (tool calling)
lib/tavily.ts               -> web search client
lib/trustScore.ts           -> the actual scoring math (documented, fixed weights)
components/                 -> TrustScoreGauge, EvidenceMap, DecisionMode, HistorySidebar
```
