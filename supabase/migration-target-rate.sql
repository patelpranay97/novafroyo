-- Per-employee wage-guarantee override: run once in the Supabase SQL Editor.
-- Blank = the default target on the Week tab; set e.g. 13 for under-18
-- staff so tips top them up to $13/hr instead of the default.

alter table public.employees add column target_rate numeric(8,2);
