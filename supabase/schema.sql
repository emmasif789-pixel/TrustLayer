-- TrustLayer: analysis history
-- Run this in the Supabase SQL editor once, after creating your project.

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  device_id text not null, -- anonymous client id, no auth required for MVP
  input_type text not null,
  input_raw text not null,
  overall_score int not null,
  verdict_label text not null,
  result jsonb not null, -- full AnalysisResult payload
  created_at timestamptz not null default now()
);

create index if not exists analyses_device_id_idx on analyses (device_id, created_at desc);

alter table analyses enable row level security;

-- MVP policy: anyone can insert/read their own device_id's rows.
-- This is intentionally permissive (no real auth yet) — tighten before
-- handling sensitive data or adding user accounts.
create policy "device can insert own analyses"
  on analyses for insert
  with check (true);

create policy "device can read own analyses"
  on analyses for select
  using (true);

-- Cache: identical inputs shouldn't re-run the full Groq + Tavily pipeline.
-- Keyed by a hash of the normalized input text, shared across all users.
create table if not exists analysis_cache (
  cache_key text primary key,
  input_raw text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table analysis_cache enable row level security;

create policy "anyone can read cache"
  on analysis_cache for select
  using (true);

create policy "anyone can write cache"
  on analysis_cache for insert
  with check (true);

create policy "anyone can update cache"
  on analysis_cache for update
  using (true);

-- Basic abuse protection: cap requests per IP in a rolling window.
create table if not exists rate_limits (
  identifier text primary key,
  window_start timestamptz not null,
  count int not null default 1
);

alter table rate_limits enable row level security;

create policy "anyone can read rate limits"
  on rate_limits for select
  using (true);

create policy "anyone can write rate limits"
  on rate_limits for insert
  with check (true);

create policy "anyone can update rate limits"
  on rate_limits for update
  using (true);
