-- The landlord's share changes over time (10% -> 8% on 2026-09-16). Storing a
-- single percentage means editing it rewrites every month already closed, so
-- the rate becomes a base plus a list of dated changes. A day is always priced
-- at whatever rate was in force on that day.
--
-- Run once in the Supabase SQL Editor. Existing rows are untouched: with an
-- empty list every day keeps using landlord_pct exactly as before.

alter table public.settings
  add column landlord_rate_changes jsonb not null default '[]'::jsonb;

-- The 8% change. landlord_pct stays 10 — that is the rate before this date.
update public.settings
   set landlord_rate_changes = '[{"from": "2026-09-16", "pct": 8}]'::jsonb
 where id = 1;
