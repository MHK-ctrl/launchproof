# Phase 21.5 — Authorized Hosted Migration Application and Synthetic Validation

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Hosted project:** `launchproof` (`ypqpqgnviphwxddrpieq`), Production database `postgres`
**Authorization:** explicit owner authorization to proceed without a provider backup, accepting the
limited risk for the verified-empty project.
**Status:** **VERIFIED — HOSTED.** Migrations 001, 002, and 003 are applied and recorded; the hosted
ledger is accurate; 60/60 low-volume synthetic hosted checks passed; all synthetic rows and
identities were removed. **No Vercel deployment, merge, tag, release, npm publication, OAuth secret
change, database reset, table drop, truncation, or real-data deletion occurred.**

## A. Status summary

| Area                                                            | Status                | Evidence                                                                                                    |
| --------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Project identity, database, and SQL hashes                      | **VERIFIED — HOSTED** | `ypqpqgnviphwxddrpieq`; `postgres`; all three reviewed SHA-256 hashes matched before execution              |
| Read-only rollback baseline                                     | **VERIFIED — LOCAL**  | `supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json`; 63,394 bytes; SHA-256 `6eab8579…d875233`               |
| Ledger reconciliation (001/002)                                 | **VERIFIED — HOSTED** | HTTP 201; exactly `202611230001` and `202611230002` recorded                                                |
| Migration 003 application                                       | **VERIFIED — HOSTED** | HTTP 201; `rate_limits`, index, three functions, grants, default ACLs, and RLS verified                     |
| 003 ledger record                                               | **VERIFIED — HOSTED** | HTTP 201; exactly three ledger rows, zero unexpected versions                                               |
| Service-role PostgREST access                                   | **VERIFIED — HOSTED** | `service_role` SELECT succeeded on all eight application relations                                          |
| Rate limiter, isolation, window reset, bounded cleanup          | **VERIFIED — HOSTED** | 60/60 synthetic checks passed; cleanup bound 2 then 1; no expired synthetic rows remained                   |
| CLI token cleanup                                               | **VERIFIED — HOSTED** | Expired and revoked tokens removed (2); active token preserved (1)                                          |
| Hosted RLS and tenant isolation                                 | **VERIFIED — HOSTED** | Two disposable identities; own-row access, cross-tenant reads/writes denied, view isolation, cleanup zero   |
| Synthetic data cleanup                                          | **VERIFIED — HOSTED** | Zero auth users and zero rows in all application tables and the view after teardown                         |
| Local repository verification                                   | **VERIFIED — LOCAL**  | `npm run verify` exit 0 after documentation updates; 20 test files / 109 tests; build, lint, typecheck pass |
| Hosted concurrency/load testing                                 | **NOT TESTED**        | Phase 21.5 was deliberately low-volume; the prior 40-connection local PostgreSQL test is not hosted proof   |
| `supabase` CLI `migration list` / `db push --dry-run`           | **NOT TESTED**        | CLI is not installed/configured for this project; no CLI mutation was used                                  |
| Vercel runtime, live OAuth, live CLI, deployed CSP, two-browser | **NOT TESTED**        | No deployment exists                                                                                        |
| Initial Vercel Production deployment                            | **BLOCKED**           | Separate explicit owner authorization remains required; not requested or performed in this phase            |

## B. Pre-mutation safeguards

Before any hosted mutation, the project was reconfirmed as `launchproof`
(`ypqpqgnviphwxddrpieq`), Production, database `postgres`, session user `postgres`, with
`is_db_owner=true` and `can_create_public=true`. The reviewed files were re-hashed in the browser and
matched the approved hashes:

| File                                                      | SHA-256                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase/manual/20261123_reconcile_migration_ledger.sql` | `47b4389fb811ee7782de6cb2c76d4b6647c7dc328b6f97cda9b3ea2a743df8cf` |
| `supabase/migrations/202611230003_security_hardening.sql` | `7baac8daf18ef6d5e7c0368cb38144666d79bb14ae3817fcf9d45832fbbdebf6` |
| `supabase/manual/20261123_record_security_hardening.sql`  | `d7a81f2d2ef4e558f5a4149cd0b3dd632fc90abb3df9662cf8d90ae636c39fc5` |

The read-only baseline was captured at `2026-11-23T16:52:46.204107+00:00` and saved before mutation.
It recorded seven public relations, 82 columns, 39 constraints, 25 indexes, 16 policies, two
functions, three triggers, 87 table grants, four routine privileges, 24 default ACLs, an absent
migration ledger, zero auth users, and zero rows in every application table.

Supabase Free provides no provider backup/snapshot for this project. The owner explicitly
acknowledged that limitation, confirmed the project was empty, and authorized proceeding with the
reviewed additive operations. The baseline is a read-only catalog snapshot, not a full data backup.

## C. Exact execution outcomes

The scripts were executed in the authorized order, one at a time. Each was read as the exact
committed file, hash-checked in-browser, and submitted unchanged. No guard was bypassed, no reviewed
SQL was altered hosted, and no operation was combined with another.

### A. Migration ledger reconciliation — HTTP 201

`supabase/manual/20261123_reconcile_migration_ledger.sql` created
`supabase_migrations.schema_migrations` and recorded only:

| Version      | Name                            |
| ------------ | ------------------------------- |
| 202611230001 | cloud_dashboard                 |
| 202611230002 | revoke_default_table_privileges |

The ledger contained exactly two rows after this step. Migration 003 was not recorded yet.

### B. Migration 003 application — HTTP 201

`supabase/migrations/202611230003_security_hardening.sql` applied without error. Independent
catalog verification immediately afterward confirmed:

- `public.rate_limits` exists, owned by `postgres`, with RLS enabled;
- primary key `rate_limits_pkey (bucket)`, check `rate_limits_count_check (count >= 0)`, and index
  `rate_limits_expires_at_idx (expires_at)`;
- `consume_rate_limit`, `cleanup_rate_limits`, and `cleanup_cli_tokens` exist as security-definer
  functions with `search_path=""`; only `postgres` and `service_role` have EXECUTE;
- `service_role` has SELECT/INSERT/UPDATE/DELETE on the seven tables and SELECT on the view;
- `anon` has no table grants; `authenticated` has its intended DML but no SELECT on
  `cli_tokens`, `cli_auth_requests`, or `rate_limits`; no `authenticated` TRUNCATE;
- the `postgres` public-table default ACL no longer contains `anon` or `authenticated`.

The ledger still contained only 001/002 at this point.

### C. Migration 003 record — HTTP 201

`supabase/manual/20261123_record_security_hardening.sql` ran only after those effects were verified.
Its guards passed and it recorded `202611230003:security_hardening`. The final ledger contains
exactly:

| Version      | Name                            |
| ------------ | ------------------------------- |
| 202611230001 | cloud_dashboard                 |
| 202611230002 | revoke_default_table_privileges |
| 202611230003 | security_hardening              |

Unexpected ledger versions: **0**.

### D. Hosted synthetic validation — 60/60 passed

The sanitized results are stored in `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json`. Run
timestamp: `2026-11-23T17:00:23.785Z`. No credential, token, key, or service-role secret is present in
that file.

## E. Hosted schema and permission readback

Final independent readback after cleanup:

| Check                        | Hosted result                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Public relations             | Seven tables (`profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`, `rate_limits`) plus the view  |
| Ownership                    | All owned by `postgres`                                                                                                         |
| RLS                          | Enabled on all seven tables; `repository_scan_stats` has `security_invoker=true`                                                |
| Policies                     | 16 total: profiles 3, repositories 4, scans 4, findings 4, `cli_auth_requests` 1; `cli_tokens` 0; `rate_limits` 0               |
| Functions                    | `handle_new_user`, `touch_updated_at`, `consume_rate_limit`, `cleanup_rate_limits`, `cleanup_cli_tokens`; new three are definer |
| New function ACLs            | `{postgres=X/postgres,service_role=X/postgres}`; anon/authenticated EXECUTE = false                                             |
| `service_role` table access  | DML on all seven tables; SELECT on the view; `bypassrls=true`; real PostgREST SELECTs returned 200                              |
| `anon` access                | No table grants; no EXECUTE on the three functions; hosted requests returned 401                                                |
| `authenticated` access       | Intended DML only; no SELECT on `cli_tokens`, `cli_auth_requests`, or `rate_limits`; no EXECUTE on the three functions; 403     |
| `authenticated` TRUNCATE     | false                                                                                                                           |
| `postgres` default table ACL | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` — anon/authenticated absent                                       |
| Data after cleanup           | Zero auth users; zero rows in all seven tables and the view                                                                     |

### E.1 Service-role privilege nuance

The original 403 defect is resolved: server-side PostgREST reads now succeed. However,
`information_schema.role_table_grants` shows that `service_role` also retains Supabase bootstrap
privileges `REFERENCES`, `TRIGGER`, and `TRUNCATE` (and `MAINTAIN` where the server reports it) in
addition to DML, and the `postgres` default ACL grants `service_role=arwdDxtm` for future tables. This is broader than strict DML-only least
privilege. `service_role` is a server-only secret role that bypasses RLS, so this is not a new
client-reachable path; it is documented as a residual hardening item rather than changed
improvisationally in this phase.

The separate `supabase_admin` default ACL remains broad for objects created by that internal role.
Application objects are owned by `postgres`, whose defaults are hardened. Future application tables
must continue to be created by `postgres`.

## F. Synthetic hosted checks

The suite created only disposable fixtures and removed them in a `finally` cleanup path.

| Test group                   | Checks | Result                                                                                                        |
| ---------------------------- | -----: | ------------------------------------------------------------------------------------------------------------- |
| Preflight and identity setup |      6 | Empty tables/users; two auth users created; profile trigger created both profiles; both signed in             |
| Service-role PostgREST       |      8 | SELECT 200 on profiles, repositories, scans, findings, `cli_auth_requests`, `cli_tokens`, `rate_limits`, view |
| Anonymous denial             |      7 | 401 for profiles, `cli_tokens`, `rate_limits`, view, and all three RPCs                                       |
| Authenticated denial         |      6 | 403 for `cli_tokens`, `rate_limits`, `cli_auth_requests`, and all three RPCs                                  |
| CLI auth request             |      4 | Own insert 201; server-only read 1; forged `user_id` insert 403                                               |
| Tenant isolation             |     13 | Own repository/scan/finding inserts; cross-tenant reads empty; forged inserts 403; own view row 1; other 0    |
| Rate limiter                 |      7 | Limit 2: allowed, allowed, denied with `retry_after=60`; independent key isolated; expired window reset to 1  |
| Bounded rate-limit cleanup   |      4 | Deleted 2 of 3 expired rows, then 1; zero synthetic expired rows remained                                     |
| CLI token cleanup            |      4 | Expired/revoked deleted (2); active preserved (1)                                                             |
| Cleanup verification         |      2 | Zero application rows; zero synthetic auth users                                                              |
| **Total**                    | **60** | **60 passed, 0 failed**                                                                                       |

Tenant isolation covered repository, scan, and finding rows, the aggregate view, direct-UUID reads,
forged `user_id` inserts, and cross-tenant scan attachment. Rate-limit cleanup was bounded at 2 rows
before the remaining expired row was removed. The limiter's `retry_after` was 60 seconds for a
60-second window.

After the suite, an independent SQL readback confirmed zero rows in all seven tables and the view,
zero auth users, and an unchanged three-row ledger.

## G. Local verification

Phase 21.5 changed only documentation, the read-only baseline artifact, the sanitized validation
artifact, and a temporary test harness that was removed. No application code or reviewed SQL was
changed. The local repository check was re-run after documentation formatting:

| Check                          | Result                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| `npm run verify`               | Exit 0; format, lint, builds, typecheck, 20 files / 109 tests, web build |
| `npm audit --audit-level=high` | 0 vulnerabilities (re-run in 21.5; no dependency change)                 |
| Hosted validation artifact     | `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json`, 60/60               |
| Rollback baseline artifact     | `supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json`, 63,394 bytes        |

No local test is labeled hosted evidence, and no hosted check is labeled local evidence.

## H. Rollback and recovery

The provider backup is unavailable on the Free plan. The saved baseline records the pre-mutation
schema, grants, default ACLs, policies, functions, triggers, constraints, indexes, migration state,
and row counts. Manual recovery, if ever needed, would be limited to additive-object rollback:
confirm no dependency, then drop the three new functions, the expiry index, and `rate_limits`, and
revoke the new service-role grants only if the application no longer needs them. Do **not** reset the
database, drop existing application tables, truncate application tables, or delete real data. The
ledger rows are bookkeeping; do not remove them to disguise an applied migration.

The migration is additive; existing application rows were untouched. There were no real users or
application rows before or after this phase.

## I. Remaining risks

1. `service_role` retains broad inherited table privileges (`REFERENCES`, `TRIGGER`, `TRUNCATE`, and
   `MAINTAIN` where supported) and the default ACL grants it `arwdDxtm` for future postgres-owned
   tables. It is server-only, but a
   future least-privilege migration should decide whether to revoke the non-DML privileges.
2. `supabase_admin` defaults remain broad for objects created by that internal role. Keep application
   objects `postgres`-owned.
3. No scheduled cleanup job exists for `rate_limits` or expired CLI authorization rows. The bounded
   cleanup functions are present, but scheduling is **PROPOSED / NOT CONFIGURED**.
4. No provider backup exists. The baseline is catalog evidence, not a data backup; manual rollback is
   the only recovery path for this empty project.
5. Hosted validation was low-volume and synthetic. It does not prove behavior under concurrent load,
   abuse, or a real Vercel runtime. The 40-connection test in Phase 21.4 was local PostgreSQL evidence.
6. Vercel deployment, live GitHub OAuth, live CLI login/upload, deployed CSP/HSTS/cookies, and
   two-browser isolation remain **NOT TESTED**.
7. No monitoring, alerting, audit logging, MFA requirement, or external penetration test exists.

## J. Deployment readiness

The hosted database gate is complete for this phase: the ledger is accurate, migrations 001/002/003
are applied, server-side DML works, client denials hold, and synthetic RLS/limiter/cleanup checks
passed. The application is **not deployed**.

The initial Vercel Production deployment remains a separate, explicit owner authorization gate. This
phase did not deploy, merge, tag, release, publish npm, change OAuth secrets, or modify unrelated
infrastructure. A deployment must not be inferred from database readiness.

## K. Artifacts and files changed

| File                                                | Purpose                                               |
| --------------------------------------------------- | ----------------------------------------------------- |
| `supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` | Read-only pre-mutation catalog and row-count baseline |
| `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json` | Sanitized 60/60 hosted validation results             |
| `PHASE_21_5_REPORT.md`                              | This report                                           |
| `PHASE_21_4_REPORT.md`                              | Superseded-by-21.5 banner and outcome addendum        |
| `PROJECT_EXECUTION_STATUS.md`                       | Phase 21.5 execution record                           |
| `DEPLOYMENT_READINESS.md`                           | Current database-ready/deployment-blocked state       |
| `LIVE_DEPLOYMENT_REPORT.md`                         | Hosted results and no-deployment state                |
| `supabase/MIGRATION_TRACKING.md`                    | Canonical migration/ledger/verification record        |
| `CLOUD_DASHBOARD_ARCHITECTURE.md`                   | Applied migration and three-function description      |
| `CLOUD_DASHBOARD_SETUP.md`                          | Current ledger/application guidance                   |
| `PRIVACY_DATA_FLOW.md`                              | Hosted CLI-token cleanup status                       |
| `.prettierignore`                                   | Preserves the original baseline JSON checksum         |

The temporary validation harness under `.tmp/` was removed and is not part of the repository. No
secret, credential, token, or `.env` value was written to any artifact, report, or commit.
