-- ============================================================================
-- CARA personalised-suggestion cache — for the SHARED project
-- (https://cnunojxtlnqadxdbtqxw.supabase.co).
--
-- The CARA app generates AI "For {name} today" suggestions (multilingual) from
-- the care recipient's profile + the current hazard situation. This table caches
-- them per situation so the app loads them instantly instead of regenerating on
-- every visit; the in-app reload button forces a fresh generation that overwrites
-- the cached row.
--
-- Safe to run once / re-runnable. Service-role only (CARA's server route uses the
-- service-role key); never readable from a client/anon key.
--
-- Run: Supabase Dashboard → SQL Editor → paste → Run.
-- ============================================================================

begin;

create table if not exists public.suggestion_cache (
  situation_key text primary key,          -- "covid:2023-11-13" | "dengue:live"
  hazard        text not null,
  data          jsonb not null,            -- { en: { suggestions, why }, zh: {…}, ms, id, tl, my }
  updated_at    timestamptz not null default now()
);

alter table public.suggestion_cache enable row level security;
revoke all on public.suggestion_cache from anon, authenticated;

commit;
