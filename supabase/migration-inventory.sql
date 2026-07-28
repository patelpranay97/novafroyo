-- Nightly stock counts: run once in the Supabase SQL Editor.
-- Whole units only (a bottle of kefir, a tub of yogurt, a bag of sugar).

create table public.inventory (
  work_date date primary key,
  batches_made integer not null default 0 check (batches_made >= 0),
  batches_left integer not null default 0 check (batches_left >= 0),
  kefir integer not null default 0 check (kefir >= 0),
  yogurt integer not null default 0 check (yogurt >= 0),
  milk integer not null default 0 check (milk >= 0),
  stabilizer integer not null default 0 check (stabilizer >= 0),
  milk_powder integer not null default 0 check (milk_powder >= 0),
  sugar integer not null default 0 check (sugar >= 0),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.inventory enable row level security;
create policy "authenticated full access" on public.inventory
  for all to authenticated using (true) with check (true);
