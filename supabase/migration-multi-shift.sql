-- Allow the same person to be scheduled more than once per day (e.g.
-- morning prep + evening shift). Run once in the Supabase SQL Editor.
-- The old one-per-day guard is replaced by a same-start-time guard, so
-- accidental double-taps are still blocked but split days work.

drop index if exists public.schedule_emp_day_idx;

create unique index if not exists schedule_emp_day_start_idx
  on public.schedule (employee_id, work_date, start_time);
