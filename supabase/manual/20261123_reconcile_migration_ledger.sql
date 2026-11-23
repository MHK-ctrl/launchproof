-- MANUAL OWNER ACTION — do not run automatically and do not run from `supabase db push`.
--
-- The hosted project currently has no supabase_migrations.schema_migrations ledger because
-- 202611230001 and 202611230002 were applied in the SQL editor. This script verifies the expected
-- schema first, then records those two versions without re-running either migration.
--
-- Before running:
--   1. Read supabase/MIGRATION_TRACKING.md.
--   2. Run the verification queries below separately and compare the output with the expected state.
--   3. Confirm the database is the intended project (ypqpqgnviphwxddrpieq), not a local or branch DB.
--   4. Take a provider backup/snapshot if available and authorized.
--
-- This script is additive. It does not drop, truncate, update, or delete application data.

begin;

do $$
declare
  missing text[] := array[]::text[];
begin
  if to_regclass('public.profiles') is null then missing := array_append(missing, 'public.profiles'); end if;
  if to_regclass('public.repositories') is null then missing := array_append(missing, 'public.repositories'); end if;
  if to_regclass('public.scans') is null then missing := array_append(missing, 'public.scans'); end if;
  if to_regclass('public.findings') is null then missing := array_append(missing, 'public.findings'); end if;
  if to_regclass('public.cli_auth_requests') is null then missing := array_append(missing, 'public.cli_auth_requests'); end if;
  if to_regclass('public.cli_tokens') is null then missing := array_append(missing, 'public.cli_tokens'); end if;
  if to_regclass('public.repository_scan_stats') is null then missing := array_append(missing, 'public.repository_scan_stats'); end if;
  if array_length(missing, 1) is not null then
    raise exception 'Refusing to record migrations; missing objects: %', array_to_string(missing, ', ');
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'profiles', 'repositories', 'scans', 'findings', 'cli_auth_requests', 'cli_tokens'
      )
      and c.relrowsecurity = false
  ) then
    raise exception 'Refusing to record migrations; RLS is not enabled on every tenant table';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scans_repository_id_user_id_fkey'
  ) then
    raise exception 'Refusing to record migrations; expected composite scan foreign key is missing';
  end if;
end;
$$;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key
);
alter table supabase_migrations.schema_migrations
  add column if not exists statements text[];
alter table supabase_migrations.schema_migrations
  add column if not exists name text;

insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('202611230001', 'cloud_dashboard', '{}'::text[]),
  ('202611230002', 'revoke_default_table_privileges', '{}'::text[])
on conflict (version) do nothing;

do $$
begin
  if (
    select count(*)
    from supabase_migrations.schema_migrations
    where version in ('202611230001', '202611230002')
  ) <> 2 then
    raise exception 'Migration ledger reconciliation did not produce both expected versions';
  end if;
end;
$$;

commit;
