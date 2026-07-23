# Nova Portal — one-time setup

The employee portal lives at `novafroyo.com/portal`. It needs a (free) Supabase
project behind it. This takes about 10 minutes, once.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) -> New project.
2. Name it anything (e.g. `nova-portal`), pick a strong database password
   (you won't need it day-to-day), region `East US` is closest to Chicago.

## 2. Create the tables

1. In the project: **SQL Editor -> New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and hit **Run**.

## 3. Make it owner-only

1. **Authentication -> Sign In / Up**: turn **OFF** "Allow new users to sign up".
2. **Authentication -> Users -> Add user -> Create new user**: your email +
   a strong password. Check "Auto confirm user". This is your portal login.

## 4. Give the site the keys

In the project: **Settings -> API Keys**. You need two values:

- **Project URL** (looks like `https://xxxx.supabase.co`)
- The key labeled **anon / public** (newer projects call it **publishable**,
  starting `sb_publishable_...`). This one is safe to ship to the browser —
  row-level security does the real protection. **Never** use the
  **service_role** / **secret** key here: it bypasses RLS and would expose
  everything.

Add them in **two** places:

**Locally** — create a file `.env.local` in the repo root (it's gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Vercel** — Project -> Settings -> Environment Variables -> add both for
Production (and Preview), then **redeploy**.

## 5. Log in

Visit `novafroyo.com/portal`, sign in with the email + password from step 3.
Add your employees in the Team tab and you're off.

## Updates

**Scheduling + reminder texts** (added July 2026): run
[`supabase/migration-scheduling.sql`](supabase/migration-scheduling.sql) once
in the SQL Editor. It adds the `schedule` table and a `phone` column on
employees. Until it runs, the portal works as before — the Scheduled section
just shows a reminder to run it.

Already ran an earlier version of that migration? Just run this one line to
add the duplicate guard:

```sql
create unique index if not exists schedule_emp_day_idx
  on public.schedule (employee_id, work_date);
```

**Owner flag** (added July 2026): run
[`supabase/migration-owner-flag.sql`](supabase/migration-owner-flag.sql) once,
then tap "Set owner" on the owner's card in the Team tab. Owners are excluded
from the wage guarantee — tips top up staff first, and the leftover is the
owner's to distribute.

**Split days / multiple shifts per person** (added July 2026): run
[`supabase/migration-multi-shift.sql`](supabase/migration-multi-shift.sql)
once. The same person can then be scheduled more than once per day (e.g.
morning prep + evening shift); overlapping times are still rejected.

**Per-person wage guarantee** (added July 2026): run
[`supabase/migration-target-rate.sql`](supabase/migration-target-rate.sql)
once, then set a custom "Wage guarantee" on any Team card (e.g. 13 for
under-18 staff). Blank means the default target on the Week tab.

**Daily sales + Profit tab** (added July 2026): run
[`supabase/migration-daily-sales.sql`](supabase/migration-daily-sales.sql)
once. After close, open the Profit tab, tap the day on its calendar, and
paste the whole Square sales-report email into the box — every field (net
sales, tax, fees, item counts, even tips) fills in automatically via plain
pattern matching, no AI. The tab shows netish profit per day (sales − cup
costs − wages − fees), the landlord share separately, and the month's sales
tax to set aside. Unit costs are editable under "Cost settings".
