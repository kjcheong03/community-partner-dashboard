-- ============================================================================
-- CARA Authority Dashboard schema — consolidated into the SHARED project
-- (the same Supabase project the CARA caregiver webapp + community dashboard use:
--  https://cnunojxtlnqadxdbtqxw.supabase.co).
--
-- WHY THIS FILE LIVES HERE
-- The authority dashboard previously wrote to its own isolated Supabase project,
-- so an "approved broadcast" only ever became an audit row nobody downstream
-- could read. Moving its schema here lets the CARA webapp read the `broadcasts`
-- table (server-side, service-role) and actually surface real broadcasts.
--
-- SAFE TO RUN ONCE, RE-RUNNABLE. None of these table/function/view names collide
-- with the community-dashboard schema (request_*, inventory_*, workspace*,
-- schedule_*, organisations, set_updated_at, rollup_request_status, …).
--
-- SECURITY POSTURE
-- Every table has RLS ENABLED with NO policies → only the service_role key can
-- read/write. The CARA + authority Next.js servers use the service-role client;
-- the browser never queries these tables directly.
--
-- IMPORTANT — the community schema (db/001) ran:
--   grant select, insert, update, delete on all tables in schema public to authenticated;
-- That is a one-time snapshot (it does NOT cover tables created later, i.e. these),
-- but to be safe this script ALSO revokes anon/authenticated access on every
-- authority object, and creates the one view as security_invoker so it cannot be
-- used to read base-table rows past RLS. Net result: authority data stays
-- service-role-only even though it now shares the project.
--
-- ── How to run on Supabase ─────────────────────────────────────────────────
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste this entire file → Run
-- 3. Then repoint the Authority Dashboard .env.local at this project's URL +
--    service-role (sb_secret_…) key. The CARA webapp reads `broadcasts` via its
--    own server route using the same service-role key.
-- ────────────────────────────────────────────────────────────────────────────

begin;

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- runs ─ the root entity. One row per research investigation.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.runs (
  id              uuid primary key default gen_random_uuid(),
  topic           text not null,
  region          text not null default '',
  audience        text not null default 'Caregivers',
  mode            text not null default 'live'
                    check (mode in ('live', 'replay')),
  status          text not null default 'running'
                    check (status in ('running', 'complete', 'failed', 'stopped')),
  phase           text,                              -- ingest | misinfo | draft | done
  pct             smallint not null default 0,
  error           text,
  streaming_url   text,                              -- TinyFish live stream URL
  officer_id      text,                              -- nullable until auth wired
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists idx_runs_created_at on public.runs (created_at desc);
create index if not exists idx_runs_topic_lc   on public.runs (lower(topic));
create index if not exists idx_runs_status     on public.runs (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- findings ─ verified facts extracted from official sources during ingest.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.findings (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.runs (id) on delete cascade,
  agency           text not null,                    -- "MOH", "NEA", "WHO", "data.gov.sg"
  stat             text,                             -- short figure ("5 clusters")
  text             text not null,                    -- the verified finding
  url              text,                             -- source URL
  time_ago         text,                             -- "12 mins ago" / "as of …"
  ordinal          int not null default 0,           -- preserve emit order
  tinyfish_run_id  text,
  tinyfish_step_id text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_findings_run on public.findings (run_id, ordinal);

-- ─────────────────────────────────────────────────────────────────────────────
-- claims ─ misinformation claims detected from public channels.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.claims (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.runs (id) on delete cascade,
  client_id        text,                             -- "claim_0", "claim_1" (the SSE id)
  text             text not null,
  severity         text not null default 'UNVERIFIED'
                     check (severity in ('UNVERIFIED', 'MINOR_DISCREPANCY')),
  where_seen       text,                             -- "WhatsApp", "r/singapore" …
  shares           text,                             -- spread indicator if any
  contradicts      text,
  analysis         text,
  fix              text,                             -- suggested clarification
  velocity         text,                             -- SURGING / RISING / …
  ordinal          int not null default 0,
  tinyfish_run_id  text,
  tinyfish_step_id text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_claims_run        on public.claims (run_id, ordinal);
create index if not exists idx_claims_run_client on public.claims (run_id, client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_origins ─ origin / amplification / debunk timeline per claim.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.claim_origins (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null references public.claims (id) on delete cascade,
  single_source boolean,                             -- claim-level flag
  date_str      text,                                -- "2026-05-19"
  outlet        text not null,                       -- "WhatsApp", "WHO", …
  event         text not null,                       -- short clause
  type          text not null
                  check (type in ('origin', 'amplification', 'debunk', 'investigation')),
  url           text,
  ordinal       int not null default 0
);
create index if not exists idx_origins_claim on public.claim_origins (claim_id, ordinal);

-- ─────────────────────────────────────────────────────────────────────────────
-- claim_factchecks ─ published fact-checks corroborating a claim.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.claim_factchecks (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references public.claims (id) on delete cascade,
  publisher  text not null,                          -- "AFP Fact Check"
  rating     text not null,                          -- "False", "Misleading"
  title      text,
  url        text not null
);
create index if not exists idx_factchecks_claim on public.claim_factchecks (claim_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- spread ─ GDELT coverage signal. One row per run.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.spread (
  run_id              uuid primary key references public.runs (id) on delete cascade,
  velocity_label      text,                          -- SURGING / RISING / …
  total_articles      int,
  top_countries       jsonb,
  singapore_articles  int,
  singapore_velocity  text,
  tone_label          text,                          -- ALARMIST / NEGATIVE / NEUTRAL / POSITIVE
  avg_tone            numeric,
  source              text check (source in ('bigquery', 'doc')),
  timeline            jsonb                          -- daily {date, global, sg, tone}
);

-- ─────────────────────────────────────────────────────────────────────────────
-- assessments ─ broadcast triage verdict. One per run.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.assessments (
  run_id          uuid primary key references public.runs (id) on delete cascade,
  verdict         text not null check (verdict in ('BROADCAST', 'MONITOR', 'NO ACTION')),
  rationale       text not null,
  urgency         text not null check (urgency in ('HIGH', 'NORMAL')),
  audience        text not null,
  signal_local    text,
  signal_spread   text,
  signal_misinfo  text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- drafts ─ the AI-generated advisory. One per run. Editable post-completion.
-- This is the row a "Load run" feature reads to autofill the broadcast panel.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.drafts (
  run_id        uuid primary key references public.runs (id) on delete cascade,
  title         text not null,
  body          text not null,                       -- markdown w/ **bold** + [text](url)
  target        text not null,
  urgency       text not null check (urgency in ('HIGH', 'NORMAL')),
  checklist     jsonb,                               -- array of strings, optional
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcasts ─ immutable record of every approved broadcast (audit-grade).
-- This is the table the CARA caregiver webapp reads to surface real broadcasts.
-- A run can produce 0..n broadcasts; each one snapshots the draft at send time.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.runs (id) on delete cascade,
  draft_snapshot  jsonb not null,                    -- full draft frozen at send time
  title           text not null,
  body            text not null,
  urgency         text not null check (urgency in ('HIGH', 'NORMAL')),
  audience_mode   text not null default 'all'
                    check (audience_mode in ('all', 'selected')),
  target_profiles jsonb,                             -- ["Diabetes", "Heart", …]
  reach_estimate  int,                               -- e.g. 380000
  confirmation_id text not null,                     -- "BCST-2026-06-04-A7F3"
  status          text not null default 'sent'
                    check (status in ('sent', 'failed', 'pending')),
  sent_at         timestamptz not null default now(),
  sent_by         text                               -- officer_id, nullable
);
create index if not exists idx_broadcasts_run     on public.broadcasts (run_id);
create index if not exists idx_broadcasts_sent_at on public.broadcasts (sent_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- sources ─ consulted source list per run (drives the source chips).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sources (
  id        uuid primary key default gen_random_uuid(),
  run_id    uuid not null references public.runs (id) on delete cascade,
  name      text not null,
  url       text not null,
  ordinal   int not null default 0
);
create index if not exists idx_sources_run on public.sources (run_id, ordinal);

-- ─────────────────────────────────────────────────────────────────────────────
-- run_logs ─ every SSE log line from a run. Drives the /audit page.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.run_logs (
  id        bigserial primary key,
  run_id    uuid not null references public.runs (id) on delete cascade,
  level     text not null check (level in ('info', 'warn', 'ok')),
  message   text not null,
  ts        timestamptz not null default now()
);
create index if not exists idx_run_logs_run on public.run_logs (run_id, ts);

-- ─────────────────────────────────────────────────────────────────────────────
-- channel_sessions ─ one row per (research run × TinyFish channel).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.channel_sessions (
  run_id            uuid not null references public.runs (id) on delete cascade,
  channel_id        text not null,                       -- "moh", "reddit", …
  lane              text not null                        -- "verified" | "online"
                      check (lane in ('verified', 'online')),
  tinyfish_run_id   text,                                -- the upstream session id
  last_step_id      text,                                -- drives snapshot proxy
  start_url         text,
  goal              text,
  status            text not null default 'pending'
                      check (status in ('pending', 'ok', 'failed', 'cancelled')),
  item_count        int not null default 0,              -- findings or claims produced
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  primary key (run_id, channel_id)
);
create index if not exists idx_channel_sessions_run on public.channel_sessions (run_id);
create index if not exists idx_channel_sessions_tf  on public.channel_sessions (tinyfish_run_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- hazard_gdelt ─ pre-cached GDELT signal per topic (COVID-19, Dengue, etc.).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.hazard_gdelt (
  topic       text primary key,
  spread      jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Defensive: ensure the per-finding / per-claim TinyFish provenance columns exist
-- even if an older version of these tables was created before they were added.
alter table public.findings add column if not exists tinyfish_run_id  text;
alter table public.findings add column if not exists tinyfish_step_id text;
alter table public.claims   add column if not exists tinyfish_run_id  text;
alter table public.claims   add column if not exists tinyfish_step_id text;

-- ─────────────────────────────────────────────────────────────────────────────
-- View ─ latest completed run per topic. Created as security_invoker so it
-- respects the caller's RLS on `runs` (it cannot be used to bypass the lockdown).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.latest_complete_runs_per_topic
with (security_invoker = true)
as
select distinct on (lower(topic)) *
from public.runs
where status = 'complete'
order by lower(topic), completed_at desc nulls last, created_at desc;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-bump drafts.updated_at on every UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bump_drafts_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_drafts_bump_updated_at on public.drafts;
create trigger trg_drafts_bump_updated_at
  before update on public.drafts
  for each row
  execute function public.bump_drafts_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security — lock every authority table to service-role only.
-- RLS enabled + zero policies = anon/authenticated keys get no rows, regardless
-- of any table-level GRANT. The Next.js servers use the service-role client,
-- which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.runs              enable row level security;
alter table public.findings          enable row level security;
alter table public.claims            enable row level security;
alter table public.claim_origins     enable row level security;
alter table public.claim_factchecks  enable row level security;
alter table public.spread            enable row level security;
alter table public.assessments       enable row level security;
alter table public.drafts            enable row level security;
alter table public.broadcasts        enable row level security;
alter table public.sources           enable row level security;
alter table public.run_logs          enable row level security;
alter table public.channel_sessions  enable row level security;
alter table public.hazard_gdelt      enable row level security;

-- Belt-and-suspenders: revoke any access the client roles may have inherited from
-- a project-wide GRANT, so these objects are never reachable with anon/auth keys.
revoke all on public.runs              from anon, authenticated;
revoke all on public.findings          from anon, authenticated;
revoke all on public.claims            from anon, authenticated;
revoke all on public.claim_origins     from anon, authenticated;
revoke all on public.claim_factchecks  from anon, authenticated;
revoke all on public.spread            from anon, authenticated;
revoke all on public.assessments       from anon, authenticated;
revoke all on public.drafts            from anon, authenticated;
revoke all on public.broadcasts        from anon, authenticated;
revoke all on public.sources           from anon, authenticated;
revoke all on public.run_logs          from anon, authenticated;
revoke all on public.channel_sessions  from anon, authenticated;
revoke all on public.hazard_gdelt      from anon, authenticated;
revoke all on public.latest_complete_runs_per_topic from anon, authenticated;

commit;
