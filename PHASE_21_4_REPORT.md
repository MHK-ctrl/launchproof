# Phase 21.4 — Hosted Migration Reconciliation, Migration 003 Review, and Rate-Limit Validation

> **Phase 21.5 update (2026-11-23):** the hosted operations marked BLOCKED in this report were
> explicitly authorized and completed in Phase 21.5. The ledger now contains 001/002/003, migration
> 003 is applied, the `service_role` 403 defect is resolved, and 60/60 low-volume synthetic hosted
> checks passed with zero synthetic rows or identities left. The body below is retained as the
> pre-mutation Phase 21.4 record. See [`PHASE_21_5_REPORT.md`](PHASE_21_5_REPORT.md) for the actual
> hosted results. Vercel deployment remains separately blocked.

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Phase 21.3 checkpoint:** `d15ea3c1044c03e88935fc3a90c070aad19a46fb`
**Hosted project:** `launchproof` (`ypqpqgnviphwxddrpieq`)
**Status:** hosted schema re-audited read-only; migration 003 revised and locally verified;
**no hosted mutation, no migration 003 application, no deployment, no merge, no tag, no release.**

> **Critical finding:** the hosted `service_role` has `bypassrls` but no DML privileges on the
> application tables. A real PostgREST read with the service-role key returned HTTP 403
> `permission denied for table profiles` (SQLSTATE 42501). Every server-side admin query would fail
> in a deployment. The revised migration 003 grants the required DML. This is **not fixed hosted**
> until the owner authorizes and applies 003.

## A. Summary

| Item                                                  | Status                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| Hosted 001/002 schema effects and RLS/grants          | **VERIFIED — HOSTED** by read-only catalog audit           |
| Hosted `service_role` application DML                 | **BLOCKED** — verified absent; 003 supplies it             |
| Hosted migration ledger                               | **BLOCKED** — still absent                                 |
| Migration 003 SQL and regression tests                | **COMPLETED — LOCAL**                                      |
| Migration 003 hosted application                      | **BLOCKED** — owner approval required                      |
| Ledger reconciliation SQL                             | **COMPLETED — LOCAL**; verified on temporary PostgreSQL    |
| Guarded 003 ledger-record SQL                         | **COMPLETED — LOCAL**; refuses false records               |
| Atomic rate limiter, real multi-connection contention | **VERIFIED — LOCAL** (40 requests, 5 permits)              |
| Hosted rate-limiter behavior                          | **NOT TESTED** — requires 003 and a controlled call path   |
| CLI token cleanup bound and active-token preservation | **VERIFIED — LOCAL**                                       |
| Hosted token cleanup                                  | **BLOCKED / NOT TESTED** — requires 003                    |
| Hosted RLS runtime regression                         | **NOT TESTED** in 21.4; Phase 21.2 result was 17/17 hosted |
| Full repository verification                          | **VERIFIED — LOCAL** — 20 files / 109 tests                |
| Vercel deployment                                     | **BLOCKED** — not authorized                               |

## B. Exact hosted schema state

The audit was read-only, run through the authenticated Supabase SQL editor. No Supabase CLI, database
password, or access token is configured locally. No row was inserted, updated, or deleted. No auth
identity was created.

Findings:

- Exactly seven relations in `public`, all owned by `postgres`: `profiles`, `repositories`, `scans`,
  `findings`, `cli_auth_requests`, `cli_tokens`, and the `repository_scan_stats` view. No extra public
  tables or views.
- RLS enabled on all six application tables. The view has `security_invoker=true`.
- Exactly 16 policies: `profiles` 3, `repositories` 4, `scans` 4, `findings` 4,
  `cli_auth_requests` 1, `cli_tokens` 0.
- Three non-internal triggers: `auth.users.on_auth_user_created`, `profiles_touch_updated_at`,
  `repositories_touch_updated_at`.
- Functions `handle_new_user()` (security definer) and `touch_updated_at()` exist, both with
  `search_path=""`.
- Columns, types, defaults, nullability, primary keys, composite tenant foreign keys, unique/check
  constraints, and indexes match migration 001.
- `authenticated` grants match the intended application DML; `anon` has no table grants; neither has
  `TRUNCATE`.
- No `supabase_migrations.schema_migrations` ledger, no `public.rate_limits`, no
  `consume_rate_limit`, and no `cleanup_cli_tokens`.
- Zero auth users and zero rows in every application table.

Migration-state matrix:

| Migration    | Expected changes                                                                     | Hosted state                                        | Confidence                      | Action                                     |
| ------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| 202611230001 | Six tables, view, RLS, 16 policies, triggers, functions, composite FKs, indexes      | Effects present and matching; zero rows             | High — catalog inspection       | Record in ledger after approval            |
| 202611230002 | Revoke client defaults; grant intended authenticated DML                             | anon absent; authenticated DML present; no TRUNCATE | High — catalog inspection       | Record in ledger after approval            |
| 202611230003 | Service-role grants, default-ACL hardening, `rate_limits`, limiter, bounded cleanups | **Absent**                                          | High — objects/functions absent | Review; apply only after explicit approval |

### B.1 Service-role privilege defect

Catalog evidence:

- `service_role` has `rolbypassrls = true` but no `SELECT`/`INSERT`/`UPDATE`/`DELETE` on
  `public.profiles` or the other application tables.
- `has_table_privilege('service_role','public.profiles','SELECT')` returned false.
- A real PostgREST request with the service-role key returned HTTP 403:

  ```text
  code: 42501
  message: permission denied for table profiles
  hint: Grant the required privileges ... GRANT SELECT ON public.profiles TO service_role;
  ```

- Cause: the bootstrap default ACL gave `service_role` only `MAINTAIN, REFERENCES, TRIGGER,
TRUNCATE`; migrations 001/002 revoked client privileges but never granted service-role DML.

This affects every admin-client path: dashboard pages, CLI token resolution/update/cleanup, CLI
authorization requests, scan storage, repository operations, account deletion, and the Postgres rate
limiter RPC. The code can pass local mocks while failing hosted because the defect is a grant, not an
RLS policy.

### B.2 Default ACL finding

The hosted `public` schema has separate default ACLs for `postgres` and `supabase_admin`:

- `postgres`: `anon`/`authenticated` had `TRUNCATE, REFERENCES, TRIGGER, MAINTAIN` on future tables;
  `service_role` had the same non-DML set.
- `supabase_admin`: `anon`/`authenticated`/`service_role` had full table rights on objects created by
  that internal role.

Migration 003 hardens the `postgres` defaults and keeps application objects under `postgres`
ownership. It does not alter Supabase's internal `supabase_admin` defaults; that would be a
provider-level change. Future application tables must be created by `postgres` for the hardened
defaults to apply. This limitation is documented in `supabase/MIGRATION_TRACKING.md`.

## C. Migration ledger reconciliation

The hosted project has no ledger because 001/002 were applied manually. Recording them is safe only
because their actual effects were verified; object existence alone was not treated as proof.

`supabase/manual/20261123_reconcile_migration_ledger.sql` now verifies:

- all six tables, the view, `handle_new_user()`, and `touch_updated_at()`;
- RLS on all six tables;
- both composite tenant foreign keys;
- exactly 16 policies, with no `cli_tokens` client policy;
- all three triggers;
- `security_invoker=true`;
- no `anon` grants and no `authenticated` `TRUNCATE`;
- `service_role` exists and bypasses RLS.

Only then does it create `supabase_migrations.schema_migrations` and insert 001/002. It does not
record 003.

Local verification on a temporary PostgreSQL instance with the exact 001/002/003 schema:

- first run inserted exactly 001 and 002;
- second run was idempotent and changed nothing;
- ledger contents: `202611230001:cloud_dashboard,202611230002:revoke_default_table_privileges`.

**Hosted status: BLOCKED — not executed.** The ledger is still absent.

## D. Migration 003 review

File: `supabase/migrations/202611230003_security_hardening.sql`.

The reviewed migration is additive and idempotent. It begins with a preflight that raises before any
change if an expected 001/002 object or `service_role` is missing.

| Statement group                   | What it changes                                                         | Reversible?         | Rerunnable?           | Failure / verification                    |
| --------------------------------- | ----------------------------------------------------------------------- | ------------------- | --------------------- | ----------------------------------------- |
| Preflight `DO`                    | Nothing; validates prerequisites                                        | N/A                 | Yes                   | Raises with a missing-object list         |
| Grants on six tables + view       | `service_role` gets DML needed by server code                           | `revoke` only       | Yes                   | Check `has_table_privilege`               |
| Default privileges                | Future postgres-owned tables: no anon/authenticated grants; service DML | Yes                 | Yes                   | Create a throwaway table and inspect ACLs |
| `rate_limits` table/index         | Server-only fixed-window storage                                        | `drop` if unused    | Yes (`if not exists`) | Inspect table/index; expired cleanup test |
| `consume_rate_limit`              | Atomic upsert, reset, bounded inputs, empty `search_path`               | `create or replace` | Yes                   | Concurrency and invalid-input tests       |
| `cleanup_rate_limits`             | Bounded delete of expired buckets (1–10,000)                            | `create or replace` | Yes                   | Insert expired/live rows, count batches   |
| `cleanup_cli_tokens`              | At most 100 expired/revoked tokens per user per call                    | `create or replace` | Yes                   | 105 expired + 1 active test               |
| Function privilege revokes/grants | Only `service_role` can execute the three functions                     | Yes                 | Yes                   | `has_function_privilege`                  |

Security properties:

- No `DROP`, `TRUNCATE`, data rewrite, or destructive command.
- `security definer` functions use `set search_path = ''` and schema-qualified objects.
- Keys are application-generated, never raw IPs; the table is closed to client roles.
- Input bounds reject missing/oversized keys and invalid limits/windows.
- Token cleanup preserves the active token by deleting only expired/revoked rows, capped at 100.
- `rate_limits` has an expiry index; no cleanup job is scheduled. Scheduling is **PROPOSED / NOT
  CONFIGURED** and is a separate hosted change.

Rollback expectation: because the change is additive, the new functions/index/table can be dropped
only after confirming nothing depends on them. Do not reset the database. Existing application rows
are untouched.

## E. Rate limiter verification

Implementation reviewed: `apps/web/lib/rate-limit.ts`, callers in scan upload, repository connect,
CLI start/exchange, and related APIs.

Local results:

- `rate-limit.test.ts`: 11 tests passed — single/under/over limit, window reset, isolation,
  fallback, invalid configuration (including limits/windows the SQL would reject), spoofed headers,
  Vercel-only trusted header, hashed key, CLI expiry/revocation/cleanup failure.
- `security-hardening-sql.test.ts`: atomic function tests passed, including window reset, bucket
  isolation, invalid input, client denial, and bounded bucket cleanup.
- Temporary PostgreSQL, 40 concurrent client connections against a 5-permit bucket:
  **5 allowed, 35 denied, counter = 40**. This is true multi-connection contention, not PGlite’s
  single-connection `Promise.all`.
- Outside a verified Vercel runtime, `x-forwarded-for` and `x-real-ip` are ignored. On Vercel only
  `x-vercel-forwarded-for` is trusted; the address is SHA-256 hashed before use as a key.

Hosted rate-limiter behavior: **NOT TESTED**. Migration 003 is not applied. Hosted calls require
either the migration plus a controlled synthetic key path, or a separately authorized PostgREST
test. A local test is not labeled hosted evidence.

## F. CLI token cleanup verification

Reviewed `apps/web/lib/cli-auth.ts` and the SQL function.

- Only SHA-256 token hashes are stored; raw tokens are never stored in PostgreSQL.
- Expiry is enforced server-side; malformed expiry dates are rejected; revoked tokens are denied.
- Cleanup is opportunistic after a valid token resolution and failure is non-fatal.
- `cleanup_cli_tokens` deletes only that user’s expired/revoked rows, ordered and limited to 100.
- Test with 105 expired tokens and one active token: first call deleted 100, second deleted 5, active
  token remained. A user with a large history cannot cause an unbounded delete in one call.
- Function execution is revoked from `anon`/`authenticated` and granted only to `service_role`.

Hosted cleanup: **BLOCKED / NOT TESTED** until migration 003 is applied. No real user or token was
created.

## G. Hosted RLS results

- Phase 21.2 hosted RLS/PostgREST suite: **17/17 passed** with two disposable identities, both
  deleted. This was not re-run in Phase 21.4 because it requires synthetic identities and database
  mutations that were not authorized.
- Phase 21.4 read-only audit re-confirmed: RLS on six tables, 16 policies, admin-only `cli_tokens`,
  `security_invoker` view, no anon grants, no authenticated `TRUNCATE`.
- Post-003 hosted RLS regression: **BLOCKED** until the migration is approved and applied. Migration
  003 adds no client policies, so it should not change tenant isolation, but that must be verified,
  not assumed.

## H. Test results

| Check                                                 | Result                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                      | Exit 0; format, lint, builds, typecheck, 20 test files / 109 tests, production web build                |
| Focused migration/rate-limit/RLS tests                | 32 passed (12 migration SQL, 11 rate limit, 9 RLS)                                                      |
| True concurrency on temporary PostgreSQL              | 40 requests, 5 allowed, 35 denied, counter 40                                                           |
| Ledger reconciliation + guarded record sequence       | Passed on temporary PostgreSQL; false 003 record refused                                                |
| Duplicate migration application                       | Passed; 003 rerun is idempotent                                                                         |
| `npm audit --audit-level=high`                        | 0 vulnerabilities                                                                                       |
| Secret scan (project scanner, 216 tracked files)      | 0 hardcoded-secret findings; one expected medium `.env` hygiene finding (gitignored; no value recorded) |
| Hosted rate limiter / cleanup / service-role REST     | **NOT TESTED** — 003 not applied                                                                        |
| `supabase` CLI `migration list` / `db push --dry-run` | **NOT TESTED** — CLI not installed/configured; ledger absent                                            |

## I. Files changed

- `supabase/migrations/202611230003_security_hardening.sql` — service-role DML grants, postgres
  default-ACL hardening, bounded cleanup, `cleanup_rate_limits`, stricter input checks, preflight.
- `packages/core/test/security-hardening-sql.test.ts` — grant/default-ACL tests, bounded token and
  rate-limit cleanup tests, null-input rejection.
- `apps/web/lib/rate-limit.ts` — reject limits/windows outside the SQL function's bounds so a caller
  cannot silently fall back to the per-process limiter by passing an invalid configuration.
- `packages/core/test/rate-limit.test.ts` — cover the new upper bounds.
- `supabase/manual/20261123_reconcile_migration_ledger.sql` — stronger pre-write guards.
- `supabase/manual/20261123_record_security_hardening.sql` — guarded 003 ledger record (new).
- `supabase/MIGRATION_TRACKING.md` — current hosted state, defect, exact approval sequence.
- `PROJECT_EXECUTION_STATUS.md`, `DEPLOYMENT_READINESS.md`, `LIVE_DEPLOYMENT_REPORT.md`,
  `PHASE_21_3_REPORT.md` — Phase 21.4 corrections and status.
- `PHASE_21_4_REPORT.md` — this report.

No secret, credential, token, or `.env` value was written.

## J. Commits and push status

No commit or push has been made at the time this report was written. The existing branch is
`feat/cloud-dashboard`; the Phase 21.3 checkpoint remains `d15ea3c`. Commit/push, if performed, is
limited to this feature branch after the final diff, secret scan, SQL, and documentation review. No
merge to `main`, tag, release, npm publication, or Vercel deployment.

## K. Risks remaining

1. Hosted `service_role` cannot read/write application tables until 003 is applied.
2. The hosted ledger remains absent; the CLI cannot be trusted to infer migration state.
3. Migration 003 has not run against hosted PostgreSQL. Local PostgreSQL/PGlite is strong evidence,
   not hosted proof.
4. Hosted rate-limiter concurrency, `Retry-After`, and token cleanup remain unverified.
5. Hosted RLS regression after 003 remains unverified.
6. Supabase internal `supabase_admin` default ACL remains broad for objects created by that role;
   application objects must stay `postgres`-owned.
7. No scheduled cleanup job exists for `rate_limits` or expired `cli_auth_requests`; this is a
   proposed follow-up, not a completed control.
8. Vercel deployment and deployed CSP/OAuth/CLI behavior remain **NOT TESTED**.
9. No external penetration test, monitoring, alerting, MFA requirement, or audit log exists.

## L. Exact owner approval required

The owner must explicitly authorize these three exact hosted operations, in this order, before any
database mutation:

1. Run `supabase/manual/20261123_reconcile_migration_ledger.sql` against
   `ypqpqgnviphwxddrpieq`. It creates `supabase_migrations.schema_migrations` and records only
   `202611230001` and `202611230002` after its guards pass.
2. Run `supabase/migrations/202611230003_security_hardening.sql` against the same project. It adds
   postgres-owned server objects, grants service-role DML, and hardens only postgres-owned default
   ACLs; it does not alter existing rows.
3. Run `supabase/manual/20261123_record_security_hardening.sql`. It verifies all 003 effects and
   grants, then records `202611230003`; it refuses a false record.

Expected hosted result: ledger with exactly three versions; `rate_limits` and three functions
present; service-role reads/writes work; anon/authenticated remain denied; existing 16 policies and
all tenant rows unchanged (currently zero).

Risk level: medium — additive DDL, no row rewrite, but it changes server privileges and creates a
new table. Recovery: roll back only the new functions/index/table after confirming no dependency;
revoke the new grants if necessary; do not reset or delete the project. Take a provider
backup/snapshot first if available and authorized.

This phase does **not** authorize a Vercel deployment, merge, tag, release, npm publication, OAuth
secret change, or deletion of real data. Authorization of the database operations above does not
authorize deployment.

## M. Next phase recommendation

After explicit database approval: apply the three reviewed SQL operations, verify the hosted ledger
and service-role PostgREST path, run low-volume synthetic hosted limiter/cleanup checks, and re-run
the hosted RLS suite. Then update this report with actual hosted results.

Do not deploy merely to finish the checklist. Deployment remains a separate owner decision because
Vercel’s first deployment is Production.

## N. Phase 21.5 outcome — hosted operations completed

Phase 21.5 executed the three reviewed SQL operations in the authorized order, with exact-file hash
checks before each run:

1. Ledger reconciliation recorded only 001/002 (HTTP 201).
2. Migration 003 applied (HTTP 201); `rate_limits`, the expiry index, the three security-definer
   functions, service-role DML, client denials, and the hardened postgres default ACL were verified.
3. The guarded record script recorded 003 (HTTP 201); the ledger contains exactly 001/002/003 with
   zero unexpected versions.

The hosted synthetic suite passed **60/60** checks: service-role PostgREST reads, anonymous and
authenticated denials, profile-trigger creation, repository/scan/finding tenant isolation, the
`security_invoker` view, rate-limit counting/window reset/isolation, bounded rate-limit cleanup
(2 then 1), and CLI token cleanup (2 removed, 1 active preserved). Cleanup left zero application
rows and zero auth users. Artifacts:
`supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` and
`supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json`.

The original service-role defect is resolved. Residual nuance: `service_role` also retains Supabase
bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE` privileges and the postgres default ACL gives it
`arwdDxtm` for future tables; this is server-only but broader than strict DML least privilege. The
`supabase_admin` defaults remain broad, so application objects must stay `postgres`-owned. No
provider backup exists; the baseline is catalog evidence, not a data backup. No Vercel deployment,
merge, tag, release, npm publication, OAuth secret change, reset, drop, truncate, or real-data
deletion occurred. The initial Production deployment still requires separate explicit authorization.
