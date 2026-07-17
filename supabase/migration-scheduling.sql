-- Scheduling update: run once in the Supabase SQL Editor.
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

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

alter table public.schedule enable row level security;
create policy "authenticated full access" on public.schedule
  for all to authenticated using (true) with check (true);

-- Phone numbers for shift-reminder texts
alter table public.employees add column phone text;
