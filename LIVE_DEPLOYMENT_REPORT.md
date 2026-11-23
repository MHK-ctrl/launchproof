# Live Deployment Report

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Base commit (Phase 21.2 checkpoint):** `215a3e2610c7385cdc804b709661fea29df7754e`
**Phase 21.3:** pre-production hardening implemented locally on `feat/cloud-dashboard`; no deployment.
**Phase 21.4:** hosted schema re-audited read-only; migration 003 revised; no hosted mutation or
deployment.
**Phase 21.5:** authorized hosted ledger reconciliation, migration 003 application and record, and
60/60 low-volume synthetic hosted checks completed; no deployment.
**Phase 21.6:** final pre-deployment audit completed read-only; local verification and dependency
audit pass; hosted state re-checked read-only; no deployment blockers found; no deployment.
**Status:** **NO VERCEL DEPLOYMENT — INITIAL PRODUCTION DEPLOYMENT AWAITING OWNER APPROVAL**
**Production URL / preview URL:** none. No production deployment, alias, custom domain, or public
preview URL exists.

This report separates hosted evidence from deployed-runtime evidence. The Supabase database and OAuth
provider are real hosted services. The Next.js application is not deployed.

## 1. Current environment

- macOS on Apple Silicon; Node.js `26.0.0`, npm `11.12.1`.
- Repository: `https://github.com/MHK-ctrl/launchproof`, branch `feat/cloud-dashboard`.
- GitHub CLI authenticated as `MHK-ctrl`.
- Vercel CLI authenticated as `mdhamzakhan2k6-4663` (team `hamza-recallai`). No other account was
  used.
- Vercel project `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`) is linked from the repository
  root. Root directory `.`, framework Next.js, install `npm ci`, build `npm run build:web`, Git
  repository not connected, **no deployments**.
- Hosted Supabase project `launchproof` (`ypqpqgnviphwxddrpieq`), organization `LaunchProof`
  (`hhaljmwqphlagxetcccs`), Tokyo, free plan.
- Local `.env` is gitignored with mode `0600`. Values are not recorded in this report.
- Vercel variables, by name and scope only:
  - Preview and Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config).
  - Preview and Production: `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCHPROOF_ENCRYPTION_KEY` (Secret).
  - `APP_BASE_URL`: **unset** until a real deployment origin exists. This is not a blocker:
    `appBaseUrl()` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel documents as always
    set at build and runtime. The first-deployment plan sets it explicitly and redeploys.
- Supabase Site URL remains `http://127.0.0.1:3000`; only
  `http://127.0.0.1:3000/auth/callback` is allowed. No production callback has been added.

## 2. OAuth secret rotation — completed

The GitHub OAuth client secret had been rendered unmasked in browser-automation output. It was treated
as compromised and rotated:

- GitHub OAuth App `LaunchProof` (app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`) was confirmed
  before modification.
- A new secret was generated without snapshot capture or DOM extraction.
- The new secret was pasted directly into the Supabase GitHub provider and saved successfully.
- The old secret was deleted in GitHub. One masked secret remains.
- The clipboard was cleared and generated snapshots removed.
- The provider was reopened only to confirm the client ID and callback. The secret was not read back.

No secret value was printed, logged, committed, stored in a fixture, or included in a screenshot or
report. Rotation status: **COMPLETED**. Supabase provider status: **ENABLED and updated**.

## 3. Hosted Supabase — verified after rotation

The two repository migrations were applied manually through the SQL editor:

- `supabase/migrations/202611230001_cloud_dashboard.sql`
- `supabase/migrations/202611230002_revoke_default_table_privileges.sql`

Hosted catalog and data audit:

- six tables: `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`;
- RLS enabled on all six;
- 16 policies;
- zero `anon` table grants and zero `authenticated` `TRUNCATE` grants;
- `repository_scan_stats` uses `security_invoker=true`;
- zero auth users and zero profile/repository/scan/finding rows.

The hosted PostgREST/RLS suite was re-run after rotation: **17/17 checks passed**. It covered own-row
access, tenant-scoped lists, cross-tenant reads/updates/deletes, victim-row preservation, forged
`user_id`, cross-tenant scan/finding attachment, aggregate-view isolation, anonymous denial, and
cleanup. Both disposable identities were deleted.

Phase 21.4 re-audited the hosted catalog read-only. The 001/002 effects still match: the seven
expected relations, RLS, 16 policies, triggers, composite foreign keys, and the `security_invoker`
view. There are zero auth users and zero application rows.

Phase 21.5 then applied the authorized sequence: the ledger recorded 001/002, migration 003 applied,
and the guarded record script recorded 003. The final ledger contains exactly three rows. The
hosted catalog now has seven tables plus the view, `rate_limits` and its expiry index, three
security-definer functions with empty `search_path`, service-role DML, and hardened postgres
default ACLs. An independent readback and a 60/60 low-volume synthetic suite confirmed the effects,
including two disposable identities and verified teardown. Zero application rows and zero auth users
remain.

**Resolved in Phase 21.5:** the hosted `service_role` 403 defect is fixed. Real PostgREST reads with
the service-role key now return 200 on all eight application relations. `service_role` also retains
Supabase bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE` (and `MAINTAIN` where supported) privileges and
the postgres default ACL grants it `arwdDxtm` for future tables; this is server-only but broader than strict DML least privilege and
is documented as a residual hardening item.

**Ledger:** `supabase_migrations.schema_migrations` now contains exactly `202611230001`,
`202611230002`, and `202611230003`, with zero unexpected versions. The reconciliation and guarded
record scripts are retained under `supabase/manual/`; the canonical state is
`supabase/MIGRATION_TRACKING.md`. No unexpected migration or production data was found.

## 4. Local production verification

| Check                                  | Result                                                           |
| -------------------------------------- | ---------------------------------------------------------------- |
| `npm run verify`                       | Exit 0; 20 files / 109 tests; lint, typecheck, builds, web build |
| `npm audit --audit-level=high`         | 0 vulnerabilities                                                |
| Hosted synthetic validation            | 60/60 passed; zero app rows and auth users after cleanup         |
| Secret scan (project scanner, tracked) | 0 hardcoded-secret findings; one expected `.env` hygiene finding |
| `npm run build:web`                    | Passed; Proxy recognized as middleware                           |
| Local `next start`                     | `/api/health` 200; public routes 200                             |
| axe WCAG A/AA, eight public pages      | 0 violations                                                     |
| Mobile 390 px, five public pages       | No horizontal overflow                                           |
| Signed-out `/dashboard`                | Redirects to `/login?next=%2Fdashboard`                          |

The axe pass found two genuine UI issues, which were fixed before the final run:

- the logo link's explicit `aria-label` did not match its visible text; the override was removed so
  the visible text is the accessible name;
- `/get-started` code panels widened the mobile document; `min-w-0` was added to the grid children.

Keyboard focus on `/` starts with the skip link, then the logo link and mobile menu button, then page
actions. This is a targeted accessibility check, not a full assistive-technology audit.

## 5. Why no deployment exists

Vercel documents and enforces that the first deployment of a new project is assigned to Production.
A Preview-only first deployment is not supported. The earlier attempt was refused:

> Can't create a Preview deployment. This project has no deployments yet, and a project's first
> deployment is assigned to Production. To deploy to Production, retry with `--prod`.

A temporary deployment would also be Production and would expire after one hour. No temporary
deployment, alternate project, alternate account, alias, or undocumented workaround was used.
`vercel ls launchproof` reports no deployments.

The first Production deployment requires explicit owner authorization. That authorization has not
been given.

## 6. Deployment approval gate

The exact action requiring authorization is:

> **Authorize the initial LaunchProof Production deployment to Vercel.**

The approval request must identify the exact repository, branch, commit SHA, Vercel account and
project, public surface, environment variable names, security/test evidence, known risks, and rollback
method. Do not interpret this report, earlier plans, or the project's desired end state as approval.

## 7. Post-approval execution plan

Only after explicit approval:

1. Recheck branch, exact commit, and a clean worktree.
2. Re-run the production build and confirm the Vercel account/project.
3. Confirm the four variables are present in Production and `APP_BASE_URL` is still intentionally
   unset.
4. Create the initial Production deployment and record its real URL, commit, branch, and build log.
5. Set `APP_BASE_URL` to the exact production origin and redeploy.
6. Add `https://<production-origin>/auth/callback` to Supabase's redirect allowlist. Keep the GitHub
   OAuth callback pointed at Supabase.
7. Verify health, headers, cookies, sign-in, sign-out, protected routes, repository consent, CLI
   browser login, explicit sanitized upload, downloads, account deletion, and two-account isolation.
8. Check mobile layout, console errors, failed requests, and lightweight performance.
9. Update this report and `PROJECT_EXECUTION_STATUS.md` with only observed results.

## 8. Known risks and unverified areas

- No deployed Next.js/Vercel runtime, cookie behavior, headers, or OAuth callback has been tested.
- Real GitHub sign-in, repository consent, provider-token exchange, and sign-out are **NOT TESTED**.
- Live CLI login, token storage, upload, download, revocation, and logout are **NOT TESTED**.
- No browser two-account isolation test exists; hosted database RLS passed 17/17.
- A nonce-based CSP and static security headers are implemented locally and verified by local
  production-server header/browser checks and tests. Deployed CSP/HSTS/cookie behavior is **NOT TESTED**.
- Rate limits use an atomic Postgres fixed-window function when migration 003 is available, with a
  bounded per-process memory fallback. The DB path is shared across instances; the fallback is not.
  Migration 003 is **APPLIED** hosted, and the DB limiter path passed synthetic hosted checks. The
  prior 40-connection result was local PostgreSQL evidence, not hosted concurrency proof.
- Hosted `service_role` DML works and real PostgREST reads returned 200. It also retains bootstrap
  `REFERENCES`/`TRIGGER`/`TRUNCATE` (and `MAINTAIN` where supported) privileges and a broad
  `arwdDxtm` default ACL; least-privilege
  tightening remains a future decision.
- The GitHub `repo` scope is broad; the application only issues GETs and does not persist the
  provider token.
- No monitoring, alerting, MFA requirement, audit log, or scheduled cleanup of expired CLI
  authorization rows.
- No external security audit or penetration test.
- No Lighthouse/Core Web Vitals measurement. No performance claim is made.

## 9. Rollback

- This initial deployment has no previous Vercel deployment to promote. If it regresses, remove the
  bad deployment (or project), restore the Supabase Site URL and redirect allowlist to the local-only
  values, and redeploy only after a fix is verified locally.
- Do not mutate live database tables blindly; test schema changes on a fresh project first.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates GitHub connect cookies only; users reconnect.
- CLI token revocation does not delete local reports.
- Deleting the Supabase project is destructive and irreversible without a backup.

## 10. Honest conclusion

The compromised OAuth secret was rotated and the old secret deleted. Hosted Supabase now has an
accurate three-row ledger and applied 001/002/003. The Phase 21.4 `service_role` 403 defect is
resolved; real PostgREST reads return 200. The 60/60 low-volume synthetic suite verified anonymous
and authenticated denials, tenant isolation, limiter behavior, bounded cleanup, and token cleanup,
with zero rows or identities left behind.

The local production build, 20-file/109-test suite, dependency audit, secret scan, and a true
40-connection local limiter test pass. Hosted concurrency/load, the `supabase` CLI dry-run, live
OAuth, live CLI, deployed CSP/HSTS/cookies, and two-browser isolation remain **NOT TESTED**.

The application is **not deployed**. Vercel classifies the initial deployment as Production, and the
owner has not authorized it. No live URL, GitHub sign-in, CLI upload, deployed dashboard, or
two-account browser test is claimed. Database readiness does not authorize deployment.

## 11. Phase 21.6 final pre-deployment audit

Audited commit `4151a1298fe6217eb358772f3ee99bdd15f21f78` on `feat/cloud-dashboard`, in sync with
`origin/feat/cloud-dashboard`, clean worktree. No deployment, merge, tag, release, publish, OAuth
secret change, or hosted database mutation occurred in this phase.

**Local:** `npm run verify` exit 0 (format, lint, core/browser/CLI builds, typecheck, 20 test files /
109 tests, production web build); `npm audit --audit-level=high` 0 vulnerabilities; `npm ci --dry-run`
`up to date`; `git diff --check` clean; local dev-server smoke returned `/api/health` 200,
`/api/cli/repositories` 401 without a token, and `/login` 200 with the proxy/CSP pipeline active.
Secret scan found only the project's own redaction regexes and synthetic test strings.

**Hosted (read-only, no mutation):** service-role PostgREST reads returned 200 on all eight
application relations with zero rows; anonymous reads returned 401 on all eight; the 003 objects
(`rate_limits`, `repository_scan_stats`, and the `consume_rate_limit`, `cleanup_cli_tokens`, and
`cleanup_rate_limits` RPCs) were exposed; auth settings returned 200 with the GitHub provider
enabled. The migration ledger and Supabase Site URL/redirect allowlist were not re-queried this
phase (no read-only management credential in session) and no SQL has run since the Phase 21.5
verification.

**Configuration:** Vercel project root `.`, Next.js 16.4.6, install `npm ci`, build
`npm run build:web`, Node.js `26.x`, Git not connected, no deployments, region `iad1`. Production
and Preview have the four required variables (names/scopes only; values not read). `APP_BASE_URL` is
unset and safe for the first deployment.

**Blockers:** none found in code, tests, build, lockfile, or project configuration. Two configuration
steps are required after the first deployment produces the origin: set `APP_BASE_URL` and redeploy;
update the Supabase Site URL and redirect allowlist. Both are part of the authorized deployment gate,
not defects.

**Recommendation:** READY FOR INITIAL DEPLOYMENT AUTHORIZATION. Full detail and the post-deployment
test order are in [`PHASE_21_6_REPORT.md`](PHASE_21_6_REPORT.md).
