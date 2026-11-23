# Supabase Migration Tracking — Safe Reconciliation Workflow

**Status (Phase 21.4, 2026-11-23):** migrations 001 and 002 are applied manually and their hosted
effects were re-audited read-only. The migration ledger is still **absent**. Migration 003
(`security_hardening`) is revised in the repository and **not applied** to the hosted database. No
hosted database mutation, deployment, merge, tag, or release occurred in Phase 21.4.

**Critical hosted finding:** the hosted catalog's grants for `service_role` are incomplete. The
role has `bypassrls` but no `SELECT`/`INSERT`/`UPDATE`/`DELETE` on the application tables. A real
PostgREST request using the server-only service-role key returned HTTP 403
`permission denied for table profiles` (SQLSTATE 42501). Migration 003 now supplies those grants.
Until 003 is applied, every server-side admin query would fail in a deployment.

Do not run `supabase db push`, `db reset`, or any destructive command against the hosted project.
Do not record a version whose effects are not present. Do not replay 001 or 002 to "repair" anything.

## 1. Hosted state

Read-only audit target: project `launchproof`, ref `ypqpqgnviphwxddrpieq`, on 2026-11-23.

| Version      | Name                            | Hosted state                       | Evidence                                                                  | Repository file                                                        |
| ------------ | ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 202611230001 | cloud_dashboard                 | Applied manually; effects verified | 6 tables, view, 16 policies, 3 triggers, 2 functions, constraints/indexes | `supabase/migrations/202611230001_cloud_dashboard.sql`                 |
| 202611230002 | revoke_default_table_privileges | Applied manually; effects verified | anon grants absent; authenticated TRUNCATE absent; intended DML present   | `supabase/migrations/202611230002_revoke_default_table_privileges.sql` |
| 202611230003 | security_hardening              | **Not applied**                    | `rate_limits` and its functions are absent hosted                         | `supabase/migrations/202611230003_security_hardening.sql`              |

The audit found exactly the seven expected relations in `public` (six tables and
`repository_scan_stats`), owned by `postgres`, with no extra public tables or views. All six tables
have RLS enabled; the view has `security_invoker=true`. There are exactly 16 policies:
`profiles` 3, `repositories` 4, `scans` 4, `findings` 4, `cli_auth_requests` 1, `cli_tokens` 0. The
three application triggers are `auth.users.on_auth_user_created`, `profiles_touch_updated_at`, and
`repositories_touch_updated_at`. Functions `handle_new_user` and `touch_updated_at` exist with empty
`search_path`. Columns, types, defaults, nullability, primary keys, composite tenant foreign keys,
unique/check constraints, and indexes match migration 001. Hosted auth users and all application
rows were zero.

`anon` has no table grants and `authenticated` has no `TRUNCATE`. The service-role defect is not
visible from table existence or RLS policy counts; it required a privilege check and a real REST
request. This is why migrations are never inferred from object names alone.

**The absence of `supabase_migrations.schema_migrations` means the CLI cannot know what is applied.**
Do not infer the schema is empty. Do not use the CLI against this project until the exact ledger
reconciliation below is authorized and run.

## 2. Ledger reconciliation safety

Recording 001/002 is bookkeeping; it does not run migration SQL. It is safe to record both **only
after** verifying their actual effects. The hosted audit did verify those effects, including the
composite tenant foreign keys, 16 policies, triggers, view, and grants.

`supabase/manual/20261123_reconcile_migration_ledger.sql` now refuses to write unless all of the
following hold:

- all six tables, the view, `handle_new_user()`, and `touch_updated_at()` exist;
- RLS is enabled on all six tables;
- both `(repository_id, user_id)` and `(scan_id, user_id)` composite foreign keys exist;
- exactly 16 application policies exist and `cli_tokens` has no client policy;
- all three expected triggers exist;
- `repository_scan_stats` has `security_invoker=true`;
- `anon` has no grants on the seven relations;
- `authenticated` has no `TRUNCATE`;
- `service_role` exists and has `bypassrls`.

It then creates the ledger if needed and inserts 001/002 with `on conflict do nothing`. It does not
alter application data and does not record 003.

**Local validation:** on a temporary PostgreSQL instance with the exact 001/002/003 schema, the
script passed twice (idempotent) and produced only `202611230001` and `202611230002`. It does not
claim the hosted reconciliation has run.

## 3. Owner execution sequence — requires explicit approval

The exact hosted mutation requires a later, explicit owner authorization. The reviewed sequence is:

1. Confirm the dashboard URL contains project ref `ypqpqgnviphwxddrpieq`.
2. If available and authorized, take a provider backup/snapshot.
3. Run `supabase/manual/20261123_reconcile_migration_ledger.sql` as one transaction.
4. Verify exactly the two expected rows:

   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```

5. Run `supabase/migrations/202611230003_security_hardening.sql` as one transaction.
6. Run `supabase/manual/20261123_record_security_hardening.sql`, which verifies the 003 objects and
   grants before inserting the 003 ledger row.
7. Verify all three rows and the hosted behavior described in section 5.

Do not run steps 3, 5, or 6 in one combined statement. Do not continue if any guard raises.

## 4. Migration 003 — reviewed effects

The migration begins with a preflight that refuses to continue if any expected 001/002 object or the
`service_role` role is missing. It is additive and idempotent.

| Statement group                    | Effect                                                                                          | Reversible / rerunnable           | Failure and verification                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| Preflight `DO` block               | Refuses a partial/wrong database                                                                | Read-only; rerunnable             | Fails before changes if objects are missing; compare the exception list   |
| Grants on six tables and view      | Restores server-only DML for admin paths                                                        | `revoke` only; rerunnable         | Fails if a table is absent; check `has_table_privilege`                   |
| Default privileges                 | Future **postgres-owned** public tables grant neither anon/authenticated; service_role gets DML | Rerunnable                        | Requires schema ownership; create a throwaway future table and check ACLs |
| `rate_limits` table + expiry index | Server-only fixed-window storage                                                                | `drop` only if unused; rerunnable | Table/index already exists is a notice; inspect columns/index             |
| `consume_rate_limit`               | Atomic upsert and window reset; bounded inputs; empty `search_path`                             | `create or replace`; rerunnable   | Invalid key/limit/window raises; run the concurrency check                |
| `cleanup_rate_limits`              | Deletes expired buckets, at most the requested 1–10,000 rows                                    | `create or replace`; rerunnable   | Invalid bound raises; insert synthetic expired/live rows                  |
| `cleanup_cli_tokens`               | Deletes at most 100 expired/revoked tokens for one user                                         | `create or replace`; rerunnable   | Requires `created_at`; test 105 expired + 1 active                        |
| Function revokes/grants            | Only `service_role` may execute the three functions                                             | Rerunnable                        | Client execution must fail; check `has_function_privilege`                |

The table grants cover account deletion, the dashboard, and CLI paths: `profiles`, `repositories`,
`scans`, `findings`, `cli_auth_requests`, `cli_tokens`. `rate_limits` is not readable by
`anon`/`authenticated`, and its functions are revoked from both roles. All security-definer
functions use `set search_path = ''` and schema-qualified objects.

The hosted default ACL audit found two owners: `postgres` (anon/authenticated had
`TRUNCATE, REFERENCES, TRIGGER, MAINTAIN`) and Supabase's internal `supabase_admin` (anon/authenticated
had full table rights). The migration hardens only `postgres` defaults, because application objects
are owned by `postgres`. Changing `supabase_admin` platform defaults is out of scope and would be a
provider-level change. Future application tables must therefore be created by `postgres`.

The migration does **not** create a scheduled cleanup job. `cleanup_rate_limits` and
`cleanup_cli_tokens` are bounded helpers; scheduling them is a separate hosted change and remains
**PROPOSED / NOT CONFIGURED**.

## 5. Hosted verification after approval

Run only read-only checks before and after the authorized mutation.

```sql
-- Ledger: expected 001, 002, 003 after the guarded record script
select version, name from supabase_migrations.schema_migrations order by version;

-- New objects
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('consume_rate_limit', 'cleanup_cli_tokens', 'cleanup_rate_limits');

select indexname from pg_indexes
where schemaname = 'public' and indexname = 'rate_limits_expires_at_idx';

-- Service-role DML restored (all must be true)
select has_table_privilege('service_role', 'public.profiles', 'SELECT') as profiles_select,
       has_table_privilege('service_role', 'public.profiles', 'INSERT') as profiles_insert,
       has_table_privilege('service_role', 'public.cli_tokens', 'UPDATE') as tokens_update,
       has_table_privilege('service_role', 'public.repository_scan_stats', 'SELECT') as view_select;

-- Client roles must remain denied
select has_table_privilege('anon', 'public.rate_limits', 'SELECT') as anon_rate_limit,
       has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as anon_limiter;
```

Hosted runtime checks still require an application origin or a separately authorized PostgREST test.
Do not create a production endpoint merely to satisfy a checklist. Local concurrency evidence is not
hosted evidence.

## 6. Future migration rules

- Every schema change is a new timestamped file under `supabase/migrations/`; never edit an applied
  migration's SQL (a comment-only correction is still a change and must be treated as such).
- Apply through the linked CLI, or SQL editor only when the CLI is unavailable, and record the
  version with a guard that verifies the effects.
- Before pushing, inspect `supabase migration list --linked` and `supabase db push --dry-run`.
- Never use `supabase db reset`, `drop schema`, `truncate`, or a migration that rewrites production
  tables without an explicit, reviewed backup and authorization.
- Add a local PGlite test for tenant-isolation, grant, and idempotency effects before applying.
- Test real concurrency only against a temporary local PostgreSQL cluster, not the hosted free tier.
- Hosted verification is a separate step; a local pass is not hosted evidence.

## 7. Honest status labels

- **VERIFIED — HOSTED:** 001/002 schema effects and the existing RLS/grant posture, as re-audited
  read-only in Phase 21.4.
- **VERIFIED — LOCAL:** migration 003 idempotency, service-role grants, bounded cleanup, and true
  multi-connection atomicity.
- **COMPLETED — LOCAL:** reconciliation SQL, guarded 003 record SQL, and the documentation.
- **BLOCKED / OWNER ACTION:** creating the hosted ledger, applying 003, and recording 003.
- **NOT TESTED:** hosted rate-limit calls, hosted token cleanup, hosted service-role PostgREST
  success, `supabase` CLI dry run/list, deployed CSP/OAuth/CLI, and any Vercel runtime behavior.
