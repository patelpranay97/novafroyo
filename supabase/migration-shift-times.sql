-- Exact start/end times on worked shifts: run once in the SQL Editor.
-- Times are optional — older hour-only entries keep working; new entries
-- record the exact range and derive hours from it.

alter table public.shifts add column start_time time;
alter table public.shifts add column end_time time;
