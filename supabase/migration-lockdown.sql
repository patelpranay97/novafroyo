-- SECURITY LOCKDOWN — run once in the Supabase SQL Editor.
--
-- Problem this fixes: every table's policy said "any AUTHENTICATED user has
-- full access". Combined with open signups, anyone could create an account
-- and read/write everything. This restricts access to an explicit allowlist
-- of owner accounts, so even if someone gets an account they see nothing.
--
-- ⚠️ STEP 1 — put YOUR portal login email on the line marked below.
--    If it doesn't match a real user, the whole script aborts and NOTHING
--    changes (safe: you can't lock yourself out by typo).
--    To see your users: select email from auth.users;

begin;

-- Allowlist of accounts permitted to use the portal.
create table if not exists public.portal_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.portal_owners enable row level security;
-- Deliberately NO policies: unreachable through the public API.

-- Membership check. SECURITY DEFINER so policies can read the allowlist.
create or replace function public.is_portal_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.portal_owners where user_id = auth.uid()
  );
$$;

revoke all on function public.is_portal_owner() from public, anon;
grant execute on function public.is_portal_owner() to authenticated;

-- Seed the allowlist with your account.
do $$
declare
  owner_email text := 'REPLACE-WITH-YOUR-PORTAL-LOGIN-EMAIL';  -- ⚠️ STEP 1
  owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception
      'No user found with email %. Nothing was changed — fix the email and re-run.',
      owner_email;
  end if;
  insert into public.portal_owners (user_id) values (owner_id)
    on conflict (user_id) do nothing;
end $$;

-- Swap every permissive policy for an owner-only one.
do $$
declare t text;
begin
  foreach t in array array[
    'employees','shifts','tips','schedule','daily_sales','settings','inventory'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'authenticated full access', t);
    execute format('drop policy if exists %I on public.%I', 'owner only', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_portal_owner()) with check (public.is_portal_owner())',
      'owner only', t
    );
  end loop;
end $$;

commit;

-- Verify: should list 7 tables, each with a single "owner only" policy.
select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename;
