-- Nova Portal schema
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).

-- Employees
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hourly_rate numeric(8,2) not null default 0 check (hourly_rate >= 0),
  color text not null default '#2d4f9e',
  active boolean not null default true,
  phone text,
  is_owner boolean not null default false,
  target_rate numeric(8,2),
  created_at timestamptz not null default now()
);

-- Shifts: one row per employee per day worked.
-- `rate` is snapshotted from the employee at logging time, so changing an
-- employee's rate later never rewrites what past weeks were owed.
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  rate numeric(8,2) not null check (rate >= 0),
  start_time time,
  end_time time,
  note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index shifts_work_date_idx on public.shifts (work_date);
create index shifts_employee_idx on public.shifts (employee_id);

-- Tips: one row per day.
create table public.tips (
  work_date date primary key,
  amount numeric(8,2) not null check (amount >= 0),
  note text,
  updated_at timestamptz not null default now()
);

-- Scheduled (future) shifts: planning, separate from worked shifts.
create table public.schedule (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now()
);

create index schedule_date_idx on public.schedule (work_date);
-- Multiple blocks per person per day are allowed (prep + evening);
-- identical start times are not (double-tap guard).
create unique index schedule_emp_day_start_idx
  on public.schedule (employee_id, work_date, start_time);

-- Daily sales from the end-of-day Square email, plus unit-cost settings.
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

-- Lock everything down: only a signed-in user (you) can touch any of it.
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.tips enable row level security;
alter table public.schedule enable row level security;
alter table public.daily_sales enable row level security;
alter table public.settings enable row level security;

create policy "authenticated full access" on public.employees
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.shifts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.tips
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.schedule
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.daily_sales
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.settings
  for all to authenticated using (true) with check (true);
