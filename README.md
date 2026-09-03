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
     For accounts (magic-link sign-in) to work, also go to Authentication ->
     URL Configuration in the Supabase dashboard and add your deployed URL
     (e.g. `https://your-app.vercel.app`) to both "Site URL" and "Redirect
     URLs" - otherwise the sign-in link will redirect to the wrong place.

3. Configure environment: `cp .env.example .env.local` and fill in
   `GROQ_API_KEY`, `TAVILY_API_KEY`, and (optionally) the two
   `NEXT_PUBLIC_SUPABASE_*` values.

4. Run locally: `npm run dev`

5. Deploy: push to GitHub, import into Vercel, add the same env vars in
   Vercel project settings. No other config needed.

- **Accounts** (optional, Supabase Auth magic-link): sign in with just an
  email - no password. History is tied to your account and follows you
  across devices. Signing in for the first time automatically claims any
  anonymous history already made on that browser. Deleting a history item
  requires being signed in (row-level security enforces this - anonymous
  rows genuinely can't be deleted, by design). If you don't configure
  Supabase, the app still works fully anonymously as before.

## Additional features

- **Source quality grounding**: sourceQuality is no longer a pure LLM guess.
  `lib/domainReputation.ts` is a small curated dataset (wire services,
  gov/edu, major outlets, aggregators, social media, known-unreliable
  domains). Each source's tier is passed to the model as ground truth, and
  the final score blends the model's contextual judgment 50/50 with the
  deterministic domain baseline.
- **Shareable results**: every analysis gets a public read-only page at
  `/analysis/[id]`, with a dynamically generated Open Graph image showing
  the verdict and score — so links posted to social/Slack/etc. render a
  real preview card, not a bare URL. Requires Supabase (the share ID is the
  `analyses` table row id).
- **Result caching**: identical inputs (normalized, case-insensitive) skip
  the full Groq + Tavily pipeline for 24h and return instantly from the
  `analysis_cache` table. Also protects the Groq free-tier rate limit from
  duplicate work.

## What's real vs. what's MVP-scoped

- Evidence, sources, and scores are always real - retrieved live from
  Tavily, never fabricated. If evidence is insufficient, the product says so.
- History has no user accounts yet - it's tied to an anonymous device ID
  in localStorage, stored in Supabase with a permissive RLS policy. Fine
  for a demo/MVP; add real auth (Supabase Auth) before handling multiple
  real users on shared infrastructure.
- Screenshot input is real: upload an image via the button next to the input
  box, and it goes through Groq's vision model (`GROQ_VISION_MODEL`, default
  `qwen/qwen3.6-27b` — currently a preview-tier model on Groq) to extract the
  text, which then feeds the normal claim pipeline.

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
