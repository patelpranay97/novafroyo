-- Daily sales + cost settings: run once in the Supabase SQL Editor.
-- Numbers come from the end-of-day Square email; unit costs seed from the
-- owner's cost model and are editable on the Profit tab.

create table public.daily_sales (
  work_date date primary key,
  net_sales numeric(10,2) not null default 0 check (net_sales >= 0),
  tax numeric(10,2) not null default 0 check (tax >= 0),
  fees numeric(10,2) not null default 0 check (fees >= 0),
  mini_cups integer not null default 0 check (mini_cups >= 0),
  regular_cups integer not null default 0 check (regular_cups >= 0),
  super_cups integer not null default 0 check (super_cups >= 0),
  toppings integer not null default 0 check (toppings >= 0),
  updated_at timestamptz not null default now()
);

create table public.settings (
  id integer primary key check (id = 1),
  mini_cost numeric(6,3) not null default 1.18,
  regular_cost numeric(6,3) not null default 1.89,
  super_cost numeric(6,3) not null default 2.61,
  topping_cost numeric(6,3) not null default 0.50,
  landlord_pct numeric(5,2) not null default 10,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1);

alter table public.daily_sales enable row level security;
alter table public.settings enable row level security;

create policy "authenticated full access" on public.daily_sales
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.settings
  for all to authenticated using (true) with check (true);
