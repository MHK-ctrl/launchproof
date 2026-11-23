-- Pre-production security hardening.
--
-- This migration is additive and idempotent. It does not alter or delete any existing rows.
-- Apply it only after the migration ledger has been reconciled (see supabase/manual/).

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
  if p_limit < 1 or p_window_seconds < 1 then
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

-- Called after a valid CLI token is resolved. It removes only this user's expired or revoked
-- tokens; the active token used for the request has neither property and is preserved.
create or replace function public.cleanup_cli_tokens(p_user_id uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.cli_tokens
    where user_id = p_user_id
      and (expires_at <= now() or revoked_at is not null)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.cleanup_cli_tokens(uuid) from public, anon, authenticated;
grant execute on function public.cleanup_cli_tokens(uuid) to service_role;
