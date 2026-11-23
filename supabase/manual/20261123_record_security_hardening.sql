-- MANUAL OWNER ACTION — run only after 202611230003_security_hardening.sql has been applied
-- successfully to project ypqpqgnviphwxddrpieq and the objects below have been verified.
--
-- This script does not apply the migration. It verifies the 003 effects first, then records the
-- version in the reconciled ledger. It refuses to write a false record if any effect is missing.
-- Safe to re-run: the insert is on conflict do nothing.

begin;

do $$
declare
  missing text[] := array[]::text[];
  app_tables text[] := array[
    'profiles', 'repositories', 'scans', 'findings', 'cli_auth_requests', 'cli_tokens'
  ];
  table_name text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'Run 20261123_reconcile_migration_ledger.sql first; the ledger is absent';
  end if;
  if to_regclass('public.rate_limits') is null then missing := array_append(missing, 'public.rate_limits'); end if;
  if to_regprocedure('public.consume_rate_limit(text,integer,integer)') is null then
    missing := array_append(missing, 'public.consume_rate_limit(text,integer,integer)');
  end if;
  if to_regprocedure('public.cleanup_cli_tokens(uuid)') is null then
    missing := array_append(missing, 'public.cleanup_cli_tokens(uuid)');
  end if;
  if to_regprocedure('public.cleanup_rate_limits(integer)') is null then
    missing := array_append(missing, 'public.cleanup_rate_limits(integer)');
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'rate_limits_expires_at_idx'
  ) then
    missing := array_append(missing, 'public.rate_limits_expires_at_idx');
  end if;
  if array_length(missing, 1) is not null then
    raise exception 'Refusing to record migration 003; missing effects: %', array_to_string(missing, ', ');
  end if;

  foreach table_name in array app_tables loop
    if not (
      has_table_privilege('service_role', 'public.' || table_name, 'SELECT')
      and has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
      and has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
      and has_table_privilege('service_role', 'public.' || table_name, 'DELETE')
    ) then
      raise exception 'Refusing to record migration 003; service_role lacks DML on %', table_name;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.repository_scan_stats', 'SELECT') then
    raise exception 'Refusing to record migration 003; service_role cannot read repository_scan_stats';
  end if;
  if not (
    has_table_privilege('service_role', 'public.rate_limits', 'SELECT')
    and has_table_privilege('service_role', 'public.rate_limits', 'INSERT')
    and has_table_privilege('service_role', 'public.rate_limits', 'UPDATE')
    and has_table_privilege('service_role', 'public.rate_limits', 'DELETE')
  ) then
    raise exception 'Refusing to record migration 003; service_role lacks DML on rate_limits';
  end if;
  if has_table_privilege('anon', 'public.rate_limits', 'SELECT') then
    raise exception 'Refusing to record migration 003; anon can read rate_limits';
  end if;
  if has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') then
    raise exception 'Refusing to record migration 003; anon can execute the limiter';
  end if;
  if has_function_privilege('authenticated', 'public.cleanup_cli_tokens(uuid)', 'EXECUTE') then
    raise exception 'Refusing to record migration 003; authenticated can execute token cleanup';
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('202611230003', 'security_hardening', '{}'::text[])
on conflict (version) do nothing;

do $$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations where version = '202611230003'
  ) then
    raise exception 'Migration ledger does not contain 202611230003 after the guarded insert';
  end if;
end;
$$;

commit;
