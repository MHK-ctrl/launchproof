# Deployment Readiness — LaunchProof Website and Cloud Dashboard

**Status:** implemented locally; hosted 001/002 schema and RLS re-verified read-only; a hosted
`service_role` grant defect blocks admin paths until migration 003 is applied; OAuth secret rotated;
**not deployed**.
**Recommended host:** Vercel with the Next.js server runtime.
**Required services:** Supabase (Auth + PostgreSQL) and a GitHub OAuth App (configured).
**Deployment gate:** Vercel requires a new project's first deployment to be Production; a Preview-only
first deployment is not possible. The initial Production deployment is **BLOCKED pending explicit
owner authorization**.
**Production URL / preview URL:** none. Do not announce one until a real deployment has been verified.

> The public marketing pages can be hosted without a database; the private dashboard and CLI upload
> require Supabase. This document distinguishes verified hosted evidence from untested deployed
> behavior.

## 1. What is ready

- The Next.js app builds in server mode:
  - public pages are server-rendered per request so the CSP nonce matches the HTML;
  - `/dashboard/*`, `/login`, `/cli/*`, `/auth/*`, and `/api/*` are dynamic;
  - no `output: "export"`;
  - `trailingSlash` is false so API paths do not redirect.
- `vercel.json` uses `framework: "nextjs"`, `npm ci`, and `npm run build:web`; static security and
  private no-store headers are defined in `apps/web/next.config.ts`.
- The PostgreSQL migration defines the schema, composite tenant foreign keys, RLS, grants, and the
  aggregate view. Migrations 001/002 are applied and were re-audited hosted in Phase 21.4. Migration
  003 adds service-role grants, default-ACL hardening, and server-only limiter/cleanup objects; it is
  prepared and locally tested but **not applied**.
- GitHub sign-in through Supabase, a separate repository consent flow, an encrypted short-lived
  provider-token cookie, and server-side repository metadata verification are implemented.
- Private dashboard and APIs use server-side ownership checks.
- CLI login uses browser loopback + PKCE, hashed seven-day tokens, revocation, explicit upload
  preview, and local sanitization.
- Local PGlite tenant-isolation tests, upload-sanitization tests, and the hosted 17/17 RLS suite pass.
- The compromised GitHub OAuth client secret was rotated; the old secret was deleted; Supabase was
  updated without recording the value.
- Vercel has Production-scoped variables for the four required application values, and Preview-scoped
  variables remain.

## 2. What is not ready

- No deployed application runtime. Vercel's first deployment for this project is Production, and
  production is not authorized.
- Real GitHub sign-in, consent, provider-token exchange, and sign-out are not tested because no
  application origin exists.
- No production `APP_BASE_URL` or Supabase production callback; inventing either before the host
  exists would be inaccurate.
- No live CLI login, upload, download, revocation, or account deletion test.
- No deployed two-account browser isolation test; only hosted database RLS and local PGlite tests.
- No deployed header, cookie, CSP, HSTS, or performance measurement. CSP and security headers are
  implemented locally and verified by local production-server checks and tests; deployed runtime
  behavior is **NOT TESTED**.
- GitHub Actions/OIDC upload is not implemented.
- No custom domain, monitoring, alerting, audit logging, MFA requirement, or scheduled cleanup job
  for expired CLI authorization rows.
- The hosted project has no migration ledger; migrations were applied manually. A safe manual
  reconciliation SQL and workflow are prepared in `supabase/manual/` and `supabase/MIGRATION_TRACKING.md`;
  applying them to the hosted project is **BLOCKED** (owner action, not authorized in Phase 21.4).
- **Hosted `service_role` has no DML on the application tables.** A real PostgREST read with the
  service-role key returned 403 `permission denied for table profiles` (42501). Server-side admin
  paths (dashboard, CLI tokens, scans, account deletion, limiter) cannot work until migration 003 is
  applied. This is a grant defect, not an RLS-policy defect.
- The hosted limiter, cleanup functions, and post-003 RLS posture are **NOT TESTED**. The local
  PostgreSQL/PGlite evidence is not hosted evidence.
- The GitHub `repo` scope is broad for private repositories; the app only issues GETs and does not
  store the provider token.

## 3. Required configuration

### Supabase

- Project `launchproof` (`ypqpqgnviphwxddrpieq`) exists on the free plan.
- `202611230001_cloud_dashboard.sql` and `202611230002_revoke_default_table_privileges.sql` are
  applied manually and were re-audited read-only in Phase 21.4. No
  `supabase_migrations.schema_migrations` ledger exists. A safe reconciliation script is prepared at
  `supabase/manual/20261123_reconcile_migration_ledger.sql`; it has **not** been run hosted.
- `202611230003_security_hardening.sql` is **not applied**. It restores service-role DML, hardens
  postgres-owned default ACLs, creates `rate_limits`, and adds `consume_rate_limit`,
  `cleanup_cli_tokens`, and `cleanup_rate_limits`. The guarded record script is
  `supabase/manual/20261123_record_security_hardening.sql`.
- GitHub provider is enabled with the matching OAuth App client ID and the callback
  `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`. The secret was rotated in Phase 21.2.
- Site URL remains `http://127.0.0.1:3000`; redirect allowlist contains only
  `http://127.0.0.1:3000/auth/callback`.
- After the production origin exists, add only `https://<production-origin>/auth/callback` and update
  the Site URL if appropriate; do not use wildcard hosts.
- Record the project URL, anon key, and service-role key outside git.

### GitHub OAuth App

- OAuth App `LaunchProof`, app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`.
- Authorization callback URL: `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback` (unchanged;
  do not point it at Vercel).
- Homepage URL should be the real application origin once it exists.
- Consent includes the broad `repo` scope if private repositories are connected. LaunchProof issues
  only GETs and does not store the token, but the permission itself is broad.

### Web environment

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
APP_BASE_URL=https://<host>
LAUNCHPROOF_ENCRYPTION_KEY=<base64-32-byte-key>
```

Current Vercel state, names and scopes only:

- Preview and Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config).
- Preview and Production: `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCHPROOF_ENCRYPTION_KEY` (Secret).
- `APP_BASE_URL`: unset until the real deployment origin exists.

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never commit `.env`, the service-role key, OAuth secrets, or CLI tokens. The service-role key must
never be exposed through a `NEXT_PUBLIC_*` variable.

### CLI

```dotenv
LAUNCHPROOF_API_URL=https://<host>
```

The default is `http://127.0.0.1:3000`. Plain HTTP is refused for non-loopback hosts.

## 4. Local pre-deployment verification

Run from a clean dependency state:

```bash
npm ci
npm run verify
npm audit --audit-level=high
```

Current results:

- `npm run verify` (Phase 21.4): exit 0; format, lint, typecheck, core/browser/CLI builds, **20 test
  files / 109 tests**, and production web build passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Project secret scan (216 tracked files): 0 hardcoded-secret findings; one expected medium `.env`
  hygiene finding for the gitignored local file (no value recorded).
- Production `next start` health: `/api/health` 200; public pages 200. CSP includes a per-request
  nonce and `strict-dynamic` with no `unsafe-inline`/`unsafe-eval`; the sample report keeps a
  path-specific policy without `strict-dynamic`.
- Signed-out `/dashboard`: redirects to `/login?next=%2Fdashboard`.
- axe WCAG A/AA on eight public pages: 0 violations after fixing the logo accessible name and
  `/get-started` mobile overflow.
- Mobile 390 px on five public pages: no horizontal document overflow.

Live GitHub OAuth, deployed browser flows, and CLI upload remain untested.

## 5. Deployment steps after approval

1. Confirm the exact final commit, branch, clean worktree, and successful production build.
2. Complete `vercel login` through the official flow and confirm
   `mdhamzakhan2k6-4663` / `hamza-recallai`. Do not switch accounts.
3. Confirm the linked project `launchproof`, root `.`, and the four Production variables.
4. Create the initial Production deployment. Record the real URL, commit, branch, and build log.
5. Set `APP_BASE_URL` to the exact production origin and redeploy.
6. Add exactly `https://<production-origin>/auth/callback` to Supabase. Keep the GitHub OAuth
   callback at the Supabase callback URL.
7. Run the full checklist in `CLOUD_DASHBOARD_SETUP.md` and section 6 below.
8. Update `PROJECT_EXECUTION_STATUS.md` and `LIVE_DEPLOYMENT_REPORT.md` with only observed results.

Do not connect a custom domain, enable a paid plan, merge to `main`, or create a GitHub release as
part of this step without separate approval.

## 6. Post-deployment checklist

- [ ] Public routes return 200 without a session.
- [ ] Dashboard/login are noindex and private/no-store.
- [ ] GitHub sign-in works; invalid `next` cannot redirect off-origin.
- [ ] Profile creation and RLS work in the hosted database.
- [ ] Repository consent and metadata connection work; no provider token is stored.
- [ ] CLI login completes; token is not printed; storage reports Keychain or file.
- [ ] CLI status/repositories/upload/logout work against the host.
- [ ] Upload preview, cancel, failure, and success paths behave correctly.
- [ ] Account A cannot list/fetch/download/delete Account B's resources, including direct UUIDs.
- [ ] Anonymous requests return 401 and no data.
- [ ] Revoke-all CLI tokens invalidates an active token.
- [ ] Account deletion removes auth identity, tenant rows, session, and connect cookie.
- [ ] Security headers and CSP are present on the deployed host; nonce behavior and absence of CSP
      violations are confirmed in the browser. (Local production-server verification passed in Phase 21.3;
      deployed runtime is **NOT TESTED**.)
- [ ] No secrets, source contents, full local paths, or `.env` values appear in requests or logs.
- [ ] Console errors, failed requests, mobile layout, and basic performance are checked.
- [ ] A rollback target exists and is understood.

## 7. Risks

- RLS passed local PGlite tests and 17/17 hosted PostgREST checks in Phase 21.2, but no deployed
  application runtime or real two-browser-session test exists. Post-003 hosted RLS was not re-run.
- Hosted `service_role` has `bypassrls` but lacks application DML until 003 is applied. The
  service-role key is a high-value server secret; the grant defect is not a substitute for protecting
  it.
- Migration 003 changes server privileges and creates server-only objects. It was verified on local
  PostgreSQL/PGlite, not hosted. A backup/snapshot and the exact approval gate are required.
- The GitHub `repo` scope is broad and cannot be made read-only for private repositories through
  GitHub OAuth. A GitHub App would be required for finer permissions.
- Rate limiting is atomic in Postgres when the `consume_rate_limit` function/migration is available,
  with a bounded per-process memory fallback when the DB path is unavailable. It is **not** a
  dedicated distributed rate-limit service; the memory fallback is per instance.
- A nonce-based CSP, static security headers, and privacy-respecting structured server logs are
  implemented locally. Deployed CSP/HSTS/cookie behavior, MFA, external monitoring/alerting, and
  audit logging remain unimplemented or unverified.
- Sanitization is heuristic; review finding text before uploading.
- Vercel's runtime, proxy, header, and cookie behavior are unverified until a real deployment exists.
- No deployment has occurred, so no production availability, performance, or recovery claim is made.

## 8. Rollback

- This initial deployment has no previous Vercel deployment to promote. If it regresses, remove the
  bad deployment (or project), restore the Supabase Site URL and redirect allowlist to the local-only
  values, and redeploy only after a fix passes locally.
- The database schema should be tested on a fresh project first; do not mutate production tables
  blindly.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates connect cookies only.
- CLI token revocation is immediate for future requests; local reports are unaffected.
- Deleting the Supabase project is destructive and irreversible without a backup.

## 9. Approval boundary

Two separate owner approvals are required.

**Database gate:**

> **Authorize the three exact hosted SQL operations:** reconcile the ledger to record 001/002, apply
> migration 003, then run the guarded record script for 003.

**Deployment gate (after the database gate):**

> **Authorize the initial LaunchProof Production deployment to Vercel.**

This document prepares the work; it authorizes neither the hosted database mutation nor a production
deployment. Neither will occur until explicit authorization is given in a subsequent message.

See [CLOUD_DASHBOARD_SETUP.md](CLOUD_DASHBOARD_SETUP.md) for step-by-step setup,
[PHASE_21_2_REPORT.md](PHASE_21_2_REPORT.md) for this phase's evidence, and
[LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md) for the current no-deployment state.
