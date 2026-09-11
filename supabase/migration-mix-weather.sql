-- Two additions, both per-day:
--   1. Which mix a day ran on. The co-packer's mix costs more per ounce, so
--      profit on those days has to be computed differently.
--   2. The day's weather, to see how conditions move sales.
--
-- Run once in the Supabase SQL Editor. Existing rows become 'own' mix with no
-- weather logged, which is what they were.

alter table public.daily_sales
  add column mix_source text not null default 'own'
    check (mix_source in ('own', 'copacker')),
  add column weather text
    check (weather is null or weather in ('sunny', 'cloudy', 'rain', 'snow')),
  add column temp_f integer
    check (temp_f is null or (temp_f > -60 and temp_f < 130));

-- Mix cost per ounce, and how many ounces each cup holds. Kept separate from
-- the per-cup costs so the co-packer difference can be applied on top of them
-- without re-deriving what a cup costs.
alter table public.settings
  add column mix_own_cost numeric(6,3) not null default 0.11,
  add column mix_copacker_cost numeric(6,3) not null default 0.22,
  add column mini_oz numeric(5,2) not null default 6,
  add column regular_oz numeric(5,2) not null default 8,
  add column super_oz numeric(5,2) not null default 10;
