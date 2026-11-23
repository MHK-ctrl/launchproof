-- Supabase grants broad table privileges to `anon` and `authenticated` by default through its
-- bootstrap default privileges. `TRUNCATE` bypasses RLS, so leaving it granted would let any
-- signed-in user erase every tenant's rows even though row policies are correct.
--
-- Revoke the bootstrap privileges explicitly, then grant only the operations the application uses.
-- This migration is intentionally idempotent so it is safe after the initial schema migration.

revoke all on public.profiles from anon, authenticated;
revoke all on public.repositories from anon, authenticated;
revoke all on public.scans from anon, authenticated;
revoke all on public.findings from anon, authenticated;
revoke all on public.cli_auth_requests from anon, authenticated;
revoke all on public.cli_tokens from anon, authenticated;
revoke all on public.repository_scan_stats from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.repositories to authenticated;
grant select, insert, update, delete on public.scans to authenticated;
grant select, insert, update, delete on public.findings to authenticated;
grant insert on public.cli_auth_requests to authenticated;
grant select on public.repository_scan_stats to authenticated;

-- cli_tokens and reads/updates of cli_auth_requests remain server-only. The service role is not
-- affected by these grants and continues to bypass RLS for narrowly scoped server operations.
