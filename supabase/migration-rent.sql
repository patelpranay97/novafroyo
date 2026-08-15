-- Monthly rent, so the Profit tab can show a true bottom line.
-- Run once in the Supabase SQL Editor. Editable under Cost settings.

alter table public.settings
  add column monthly_rent numeric(10,2) not null default 3500;
