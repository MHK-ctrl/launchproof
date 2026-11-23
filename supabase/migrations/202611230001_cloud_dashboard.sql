-- LaunchProof cloud dashboard schema.
--
-- Ownership model: every private row carries user_id = auth.uid(). Composite foreign keys make
-- it impossible to attach a scan to another user's repository, or a finding to another user's
-- scan, even if an application query is wrong. RLS is the primary access boundary.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  github_user_id bigint unique,
  github_username text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  github_repository_id bigint not null check (github_repository_id > 0),
  owner text not null,
  name text not null,
  full_name text not null,
  html_url text not null,
  default_branch text,
  visibility text not null check (visibility in ('public', 'private', 'internal')),
  connection_status text not null default 'active'
    check (connection_status in ('active', 'disconnected')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, github_repository_id),
  unique (user_id, full_name),
  unique (id, user_id)
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  repository_id uuid not null,
  client_scan_id text not null,
  scan_status text not null default 'completed'
    check (scan_status in ('completed', 'partial', 'failed')),
  security_gate text not null
    check (security_gate in ('passed', 'failed', 'not-verified')),
  scanner_version text not null,
  commit_sha text,
  branch text,
  started_at timestamptz,
  completed_at timestamptz,
  uploaded_at timestamptz not null default now(),
  total_checks integer not null default 0 check (total_checks >= 0),
  pass_count integer not null default 0 check (pass_count >= 0),
  fail_count integer not null default 0 check (fail_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  not_verified_count integer not null default 0 check (not_verified_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  total_findings integer not null default 0 check (total_findings >= 0),
  severity_counts jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  checks jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  report_format_version integer not null default 1 check (report_format_version = 1),
  created_at timestamptz not null default now(),
  unique (user_id, client_scan_id),
  unique (id, user_id),
  foreign key (repository_id, user_id)
    references public.repositories (id, user_id) on delete cascade
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scan_id uuid not null,
  finding_key text not null,
  rule_id text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  title text not null,
  description text not null,
  category text,
  remediation text,
  relative_file_path text,
  line_number integer check (line_number is null or line_number > 0),
  created_at timestamptz not null default now(),
  unique (scan_id, finding_key),
  foreign key (scan_id, user_id)
    references public.scans (id, user_id) on delete cascade
);

-- CLI authorization is short-lived and single-use. Only a hash of the one-time code is stored.
create table public.cli_auth_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  state text not null unique,
  code_hash text not null unique,
  code_challenge text not null,
  redirect_port integer not null check (redirect_port between 1024 and 65535),
  expires_at timestamptz not null,
  approved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only token hashes are stored. Revocation and expiry are checked on every CLI request.
create table public.cli_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index repositories_user_id_idx on public.repositories (user_id);

-- Per-repository aggregates. security_invoker makes the underlying RLS policies apply to the view.
create view public.repository_scan_stats
with (security_invoker = true)
as
select
  r.id as repository_id,
  r.user_id,
  count(s.id)::bigint as scan_count,
  max(s.uploaded_at) as last_scan_at,
  max(s.uploaded_at) filter (where s.security_gate = 'passed') as last_successful_scan_at,
  (array_agg(s.security_gate order by s.uploaded_at desc))[1] as latest_gate
from public.repositories r
left join public.scans s
  on s.repository_id = r.id and s.user_id = r.user_id
group by r.id, r.user_id;

grant select on public.repository_scan_stats to authenticated;
create index repositories_user_status_idx on public.repositories (user_id, connection_status);
create index scans_user_id_uploaded_at_idx on public.scans (user_id, uploaded_at desc);
create index scans_repository_id_uploaded_at_idx on public.scans (repository_id, uploaded_at desc);
create index scans_user_gate_idx on public.scans (user_id, security_gate);
create index findings_user_id_idx on public.findings (user_id);
create index findings_scan_severity_idx on public.findings (scan_id, severity);
create index cli_tokens_user_id_idx on public.cli_tokens (user_id);
create index cli_auth_requests_expiry_idx on public.cli_auth_requests (expires_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger repositories_touch_updated_at
before update on public.repositories
for each row execute function public.touch_updated_at();

-- Supabase creates auth.users rows during OAuth. This trigger creates the matching profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, github_username, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.repositories enable row level security;
alter table public.scans enable row level security;
alter table public.findings enable row level security;
alter table public.cli_auth_requests enable row level security;
alter table public.cli_tokens enable row level security;

revoke all on public.profiles from anon;
revoke all on public.repositories from anon;
revoke all on public.scans from anon;
revoke all on public.findings from anon;
revoke all on public.cli_auth_requests from anon, authenticated;
revoke all on public.cli_tokens from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.repositories to authenticated;
grant select, insert, update, delete on public.scans to authenticated;
grant select, insert, update, delete on public.findings to authenticated;
grant insert on public.cli_auth_requests to authenticated;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "repositories_select_own"
on public.repositories for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "repositories_insert_own"
on public.repositories for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "repositories_update_own"
on public.repositories for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "repositories_delete_own"
on public.repositories for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "scans_select_own"
on public.scans for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "scans_insert_own"
on public.scans for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "scans_update_own"
on public.scans for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "scans_delete_own"
on public.scans for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "findings_select_own"
on public.findings for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "findings_insert_own"
on public.findings for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "findings_update_own"
on public.findings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "findings_delete_own"
on public.findings for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "cli_auth_requests_insert_own"
on public.cli_auth_requests for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- No policies are defined for cli_tokens or for reading/updating cli_auth_requests. Those
-- operations are server-only and use the service role after hashing and validating credentials.
