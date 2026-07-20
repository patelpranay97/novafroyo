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
create unique index schedule_emp_day_idx
  on public.schedule (employee_id, work_date);

-- Lock everything down: only a signed-in user (you) can touch any of it.
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.tips enable row level security;
alter table public.schedule enable row level security;

create policy "authenticated full access" on public.employees
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.shifts
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.tips
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.schedule
  for all to authenticated using (true) with check (true);
