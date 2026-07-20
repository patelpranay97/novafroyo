-- Owner flag: run once in the Supabase SQL Editor.
-- Owners (e.g. Ruby) are excluded from the wage guarantee — tips top up
-- staff first, and owners take from whatever is left, at their discretion.

alter table public.employees add column is_owner boolean not null default false;
