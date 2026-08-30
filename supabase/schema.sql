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
