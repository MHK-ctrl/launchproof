# Supabase Migration Tracking — Hosted State and Future Workflow

**Status (Phase 21.5, 2026-11-23):** migrations 001, 002, and 003 are applied to the hosted
`launchproof` project (`ypqpqgnviphwxddrpieq`) and are recorded in
`supabase_migrations.schema_migrations`. The ledger contains exactly three rows. The hosted
synthetic validation suite passed **60/60** checks with two disposable identities, and all synthetic
rows and identities were removed. No Vercel deployment, merge, tag, release, npm publication, OAuth
secret change, reset, drop, truncate, or real-data deletion occurred.

**Resolved in Phase 21.5:** the Phase 21.4 finding that `service_role` had `bypassrls` but no
application DML is fixed. Real service-role PostgREST SELECTs now return 200 on all eight
application relations.

**Residual hardening item:** `service_role` also retains Supabase bootstrap `REFERENCES`, `TRIGGER`,
`TRUNCATE`, and `MAINTAIN` (where supported) privileges in addition to DML, and the `postgres`
public-table default ACL is
`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. `service_role` is a server-only secret
role, so this is not a new client path, but it is broader than strict DML-only least privilege. Do not
change it in this phase; evaluate a future least-privilege migration separately.

Do not run `supabase db push`, `db reset`, or any destructive command against the hosted project.
Do not replay 001–003 to "repair" anything.

## 1. Hosted migration state

Read-only and post-apply audit target: project `launchproof`, ref `ypqpqgnviphwxddrpieq`,
Production database `postgres`, 2026-11-23.

| Version      | Name                            | Hosted state                       | Evidence                                                                                       | Repository file                                                        |
| ------------ | ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 202611230001 | cloud_dashboard                 | Applied manually; effects verified | Six tables, view, 16 policies, three triggers, two functions, composite tenant FKs, indexes    | `supabase/migrations/202611230001_cloud_dashboard.sql`                 |
| 202611230002 | revoke_default_table_privileges | Applied manually; effects verified | `anon` grants absent; `authenticated` TRUNCATE absent; intended authenticated DML present      | `supabase/migrations/202611230002_revoke_default_table_privileges.sql` |
| 202611230003 | security_hardening              | Applied and recorded in Phase 21.5 | `rate_limits`, expiry index, three functions, service-role DML, default-ACL hardening verified | `supabase/migrations/202611230003_security_hardening.sql`              |

Final ledger:

| Version      | Name                            |
| ------------ | ------------------------------- |
| 202611230001 | cloud_dashboard                 |
| 202611230002 | revoke_default_table_privileges |
| 202611230003 | security_hardening              |

Unexpected versions: **0**.

## 2. Hosted schema and privilege posture

The hosted `public` schema contains exactly seven tables and one view, all owned by `postgres`:

`profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`, `rate_limits`,
and `repository_scan_stats` (`security_invoker=true`).

- RLS is enabled on all seven tables.
- There are exactly 16 policies: `profiles` 3, `repositories` 4, `scans` 4, `findings` 4,
  `cli_auth_requests` 1; `cli_tokens` 0; `rate_limits` 0.
- Existing triggers: `auth.users.on_auth_user_created`, `profiles_touch_updated_at`, and
  `repositories_touch_updated_at`.
- Functions: `handle_new_user()`, `touch_updated_at()`, `consume_rate_limit(...)`,
  `cleanup_rate_limits(...)`, and `cleanup_cli_tokens(...)`. The three new functions are
  security-definer with `search_path=""`.
- `rate_limits` has primary key `(bucket)`, check `count >= 0`, and index
  `rate_limits_expires_at_idx (expires_at)`.
- `service_role` has `bypassrls=true`, SELECT/INSERT/UPDATE/DELETE on the seven tables, and SELECT on
  the view. It also retains the bootstrap non-DML privileges noted above.
- `anon` has no table grants and no EXECUTE on the new functions; hosted requests returned 401.
- `authenticated` has `INSERT,SELECT,UPDATE` on `profiles`; `DELETE,INSERT,SELECT,UPDATE` on
  `repositories`, `scans`, and `findings`; `INSERT` on `cli_auth_requests`; `SELECT` on the view. It
  has no SELECT on `cli_tokens`, `cli_auth_requests`, or `rate_limits`, no TRUNCATE, and no EXECUTE
  on the new functions.
- The `postgres` public-table default ACL contains only `postgres` and `service_role`; `anon` and
  `authenticated` were removed. The `supabase_admin` defaults remain broad for objects created by
  that internal role, so application objects must remain `postgres`-owned.
- Zero auth users and zero rows in every application table and the view after cleanup.

## 3. Phase 21.5 execution record

Before mutation, the owner explicitly authorized proceeding without a provider backup after
confirming the project was empty and accepting the limited risk. Supabase Free has no provider
backup/snapshot for this project. The read-only baseline is
`supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` (63,394 bytes, SHA-256
`6eab85799d8acb6b061973323b2323103e36c85be032bcdb92c98ec86d875233`). It is catalog evidence, not a
data backup.

Each reviewed file was read exactly, SHA-256 checked, and run separately. No guard was bypassed and
no reviewed SQL was altered hosted.

| Step | Operation                                                 | SHA-256             | Result                                                 |
| ---- | --------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| A    | `supabase/manual/20261123_reconcile_migration_ledger.sql` | `47b4389f…743df8cf` | HTTP 201; ledger 001/002 only                          |
| B    | `supabase/migrations/202611230003_security_hardening.sql` | `7baac8da…bbdebf6`  | HTTP 201; objects, grants, default ACL, RLS verified   |
| C    | `supabase/manual/20261123_record_security_hardening.sql`  | `d7a81f2d…36c39fc5` | HTTP 201; ledger 001/002/003, zero unexpected versions |
| D    | Low-volume synthetic hosted validation                    | n/a                 | 60/60 passed; cleanup zero rows/users                  |

Full hashes are recorded in `PHASE_21_5_REPORT.md`. The validation artifact is
`supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json`; it contains no credentials or tokens.

## 4. Hosted validation summary

The suite used two disposable auth users and explicitly created synthetic rows. It verified:

- profile trigger creation and sign-in;
- service-role PostgREST SELECT success on all eight relations;
- anonymous 401 and authenticated 403 denials for restricted tables and functions;
- own-row profile access and tenant-scoped repository/scan/finding access;
- cross-tenant direct-UUID reads empty, forged `user_id` inserts denied, and view isolation;
- rate-limit counting (2 allowed, third denied with `retry_after=60`), independent keys, and expired
  window reset;
- bounded `cleanup_rate_limits`: 2 deleted of 3 expired rows, then the remaining 1; zero synthetic
  expired rows left;
- `cleanup_cli_tokens`: 2 expired/revoked rows deleted, active token preserved;
- final teardown: zero application rows and zero auth users.

This was deliberately low-volume. It is not a load, concurrency, abuse, or penetration test. The
Phase 21.4 40-connection limiter result was local PostgreSQL evidence, not hosted evidence.

## 5. Residual risks

1. `service_role` has broad inherited table privileges (including non-DML `REFERENCES`, `TRIGGER`,
   `TRUNCATE`, and `MAINTAIN` where supported) and a broad `arwdDxtm` default ACL. It is server-only,
   but least-privilege tightening is a future decision, not part of 21.5.
2. `supabase_admin` defaults remain broad; future application tables must be created by `postgres`.
3. No scheduled cleanup job exists for `rate_limits` or expired CLI authorization rows. The bounded
   cleanup functions are present; scheduling is **PROPOSED / NOT CONFIGURED**.
4. No provider backup exists. Manual additive rollback is the only recovery path for this empty
   project; do not reset or drop existing application tables.
5. The `supabase` CLI migration list and `db push --dry-run` were **NOT TESTED** because the CLI is not
   installed/configured. The ledger was verified directly.
6. Vercel runtime, live GitHub OAuth, live CLI login/upload, deployed CSP/HSTS/cookies, and
   two-browser isolation remain **NOT TESTED**.
7. No monitoring, alerting, audit logging, MFA requirement, or external penetration test exists.

## 6. Future migration rules

- Every schema change is a new timestamped file under `supabase/migrations/`; never edit an applied
  migration's SQL (a comment-only correction is still a change).
- Apply through the linked CLI when available, or SQL editor only when the CLI is unavailable, and
  record the version with a guard that verifies the effects.
- Before pushing, inspect `supabase migration list --linked` and `supabase db push --dry-run`.
- Never use `supabase db reset`, `drop schema`, `truncate`, or a migration that rewrites production
  tables without explicit, reviewed backup and authorization.
- Add a local PGlite test for tenant-isolation, grant, and idempotency effects before applying.
- Test real concurrency only against a temporary local PostgreSQL cluster, not the hosted free tier.
- Hosted verification is a separate step; a local pass is not hosted evidence.
- Keep new application objects owned by `postgres` so the hardened default ACL applies.
- If tightening `service_role`, review every server-side admin path and test hosted PostgREST before
  and after; do not assume local mocks model grants.

## 7. Status labels

- **VERIFIED — HOSTED:** 001/002/003 ledger, migration 003 objects/grants/default ACLs, RLS,
  service-role PostgREST access, anonymous/authenticated denials, tenant isolation, limiter behavior,
  bounded rate-limit cleanup, CLI token cleanup, and zero synthetic rows/users after teardown.
- **VERIFIED — LOCAL:** repository `npm run verify` (20 test files / 109 tests), prior local
  PostgreSQL/PGlite migration and concurrency tests, and documentation formatting.
- **NOT TESTED:** hosted concurrency/load, `supabase` CLI list/dry-run, deployed Vercel runtime, live
  OAuth, live CLI, deployed CSP/HSTS/cookies, and two-browser isolation.
- **BLOCKED:** initial Vercel Production deployment, pending separate explicit owner authorization.
  Database readiness does not authorize deployment.

## 8. Evidence

- `PHASE_21_5_REPORT.md` — full Phase 21.5 report and status table.
- `supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` — pre-mutation read-only baseline.
- `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json` — sanitized 60/60 hosted results.
- `PHASE_21_4_REPORT.md` — pre-mutation review record, retained with a Phase 21.5 banner.
- `DEPLOYMENT_READINESS.md`, `LIVE_DEPLOYMENT_REPORT.md`, `PROJECT_EXECUTION_STATUS.md` — current
  readiness, deployment, and execution state.
