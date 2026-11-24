-- Pre-production security hardening.
--
-- This migration is additive and idempotent. It does not alter or delete existing application
-- rows. Apply it only after the expected 001/002 schema has been verified (see supabase/manual/).

-- Refuse to continue if the reviewed 001/002 schema is absent. This prevents a partial or
-- mis-targeted database from receiving a ledger-style "applied" state by accident.
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
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    missing := array_append(missing, 'role service_role');
  end if;
  if array_length(missing, 1) is not null then
    raise exception 'Refusing security hardening; missing prerequisites: %', array_to_string(missing, ', ');
  end if;
end;
$$;

-- The application's server-only credential performs the DML for CLI authentication, uploads,
-- downloads, and account deletion. The hosted catalog audit found that the 001/002 migrations
-- left service_role without SELECT/INSERT/UPDATE/DELETE on these tables, so every admin query
-- would fail with 42501. Grant only the DML the application uses; RLS still applies to every
-- client role, and service_role remains server-only.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.repositories to service_role;
grant select, insert, update, delete on public.scans to service_role;
grant select, insert, update, delete on public.findings to service_role;
grant select, insert, update, delete on public.cli_auth_requests to service_role;
grant select, insert, update, delete on public.cli_tokens to service_role;
grant select on public.repository_scan_stats to service_role;

-- Supabase's bootstrap default privileges still grant broad table access to anon/authenticated
-- (including TRUNCATE and MAINTAIN) for future tables. Harden the defaults for the migration role
-- (postgres), then grant only deliberate DML to service_role. This does not affect existing table
-- grants. Supabase's internal supabase_admin role has separate defaults; application objects must
-- remain owned by postgres so these defaults apply.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

-- Atomic fixed-window rate limiting. Keys are application-generated (user UUIDs or hashed client
-- addresses), never raw IPs. The table is server-only; RLS is enabled with no client policies.
create table if not exists public.rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  count integer not null check (count >= 0),
  expires_at timestamptz not null
);

create index if not exists rate_limits_expires_at_idx on public.rate_limits (expires_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_expires_at timestamptz;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 200 then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'Invalid rate-limit configuration';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.rate_limits as current_window (bucket, window_start, count, expires_at)
  values (p_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
    set count = case
          when current_window.expires_at <= v_now then 1
          else current_window.count + 1
        end,
        window_start = case
          when current_window.expires_at <= v_now then v_now
          else current_window.window_start
        end,
        expires_at = case
          when current_window.expires_at <= v_now
            then v_now + make_interval(secs => p_window_seconds)
          else current_window.expires_at
        end
  returning count, expires_at into v_count, v_expires_at;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    case
      when v_count > p_limit
        then greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
      else 0
    end;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- Expired buckets are safe to remove. Deletion is explicitly bounded so a maintenance call
-- cannot hold a large lock or remove an unbounded number of rows.
create or replace function public.cleanup_rate_limits(p_max_rows integer default 1000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_max_rows is null or p_max_rows < 1 or p_max_rows > 10000 then
    raise exception 'Invalid cleanup bound';
  end if;

  with doomed as (
    select bucket
    from public.rate_limits
    where expires_at <= clock_timestamp()
    order by expires_at
    limit p_max_rows
  ),
  deleted as (
    delete from public.rate_limits as r
    using doomed
    where r.bucket = doomed.bucket
    returning 1
  )
  select count(*)::integer into v_deleted from deleted;

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_rate_limits(integer) from public, anon, authenticated;
grant execute on function public.cleanup_rate_limits(integer) to service_role;

-- Called after a valid CLI token is resolved. It removes only this user's expired or revoked
-- tokens; the active token used for the request is preserved. Each call is capped at 100 rows so
-- an account with a large token history cannot turn authentication into an unbounded delete.
create or replace function public.cleanup_cli_tokens(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with doomed as (
    select id
    from public.cli_tokens
    where user_id = p_user_id
      and (expires_at <= now() or revoked_at is not null)
    order by created_at, id
    limit 100
  ),
  deleted as (
    delete from public.cli_tokens as t
    using doomed
    where t.id = doomed.id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.cleanup_cli_tokens(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_cli_tokens(uuid) to service_role;
