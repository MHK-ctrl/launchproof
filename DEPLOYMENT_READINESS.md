# Deployment Readiness — LaunchProof Website and Cloud Dashboard

**Status:** implemented and **deployed to Vercel Production**; hosted 001/002/003 schema, ledger,
grants, and RLS verified hosted; 60/60 low-volume synthetic hosted checks passed; the service-role
admin path is unblocked; OAuth secret rotated; Phase 21.7 initial live validation passed; Phase
21.8 post-deployment validation passed with non-blocking issues (tenant isolation, CSRF, rate limits,
account deletion, CLI tokens) and two P3 fixes pending deployment.
**Recommended host:** Vercel with the Next.js server runtime.
**Required services:** Supabase (Auth + PostgreSQL) and a GitHub OAuth App (configured).
**Deployment gate:** closed in Phase 21.7 — the authorized Production deployment is live.
**Production URL:** https://launchproof-rose.vercel.app (deployment
`dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz`). No custom domain is configured; no preview URL is announced.

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
  aggregate view. Migrations 001/002/003 are applied and recorded in the hosted ledger, and their
  schema, grants, default ACLs, and RLS were re-verified in Phase 21.5. Migration 003 adds
  service-role DML, postgres default-ACL hardening, and server-only limiter/cleanup objects; hosted
  synthetic validation passed 60/60 checks.
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
- Phase 21.6 re-verified the candidate commit locally (`npm run verify` exit 0, 20 files / 109
  tests; `npm audit` 0 vulnerabilities; lockfile in sync) and re-checked the hosted state read-only:
  service-role 200 on all eight relations with zero rows, anon 401 on all eight, and the 003 limiter
  and cleanup RPCs exposed. No deployment blocker was found.
- Phase 21.7 deployed that commit to Production and passed initial live validation: public routes and
  `/api/health`, signed-out redirects, `401` on private APIs, CSP/headers, Supabase Auth URLs, GitHub
  sign-in, the private dashboard, authenticated reads, CLI login/status/revocation, and sign-out.
- Vercel project settings now include the framework Output Directory override `apps/web/.next` at
  repository-root scope, and `APP_BASE_URL` is set for Production.

## 2. What is not ready

- Repository connect/consent, the encrypted provider-token cookie, and repository metadata fetch are
  **NOT TESTED** in Production: the Phase 21.8 consent attempt was blocked by GitHub sudo-mode/2FA,
  so no provider token or association was created.
- CLI `scan --upload` and report download against a connected repository are **NOT TESTED**; the
  explicit-upload guard works and the API upload/download path was verified with a synthetic bearer
  token. CLI login, status, local scan, and logout are verified in Production.
- "Revoke all" CLI tokens is **NOT TESTED** (control disabled with zero active tokens; owner tokens
  were not revoked).
- Two-account API **and** database-RLS isolation against production is now **VERIFIED** with two
  synthetic identities (Phase 21.8); browser isolation with two real GitHub accounts is still
  **NOT TESTED**.
- Account deletion (synthetic users), live per-user rate limiting, and authenticated cross-origin
  rejection are **VERIFIED** in Phase 21.8. Deployment performance/load and assistive-technology
  auditing remain **NOT TESTED**.
- Dashboard navigation overflows horizontally at 390 px (P3, unfixed); mobile login is usable.
- No custom domain, monitoring, alerting, audit logging, backups, or MFA requirement is configured.
- Supabase session cookies are client-managed (`HttpOnly=false`); `Secure` is fixed on the branch but
  not deployed. CSP mitigates but does not replace `HttpOnly`; a server-managed session migration is
  the only real fix.
- GitHub Actions/OIDC upload is not implemented.
- No custom domain, monitoring, alerting, audit logging, MFA requirement, or scheduled cleanup job
  for expired CLI authorization rows.
- The hosted ledger now contains exactly 001/002/003, and the 003 effects were independently
  verified. The `supabase` CLI migration list and `db push --dry-run` remain **NOT TESTED** because
  the CLI is not installed/configured; the ledger itself was verified directly.
- Hosted `service_role` DML now works: real PostgREST reads returned 200 on all eight application
  relations. It also retains Supabase bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE` (and `MAINTAIN`
  where supported) privileges and a broad `arwdDxtm` default ACL. That is server-only but broader than strict DML least privilege; a
  future least-privilege migration is a separate decision.
- The hosted limiter, bounded cleanup, and post-003 RLS posture passed **60/60** low-volume synthetic
  checks, including two disposable identities and verified teardown. This is not hosted
  concurrency/load or penetration-test evidence.
- The GitHub `repo` scope is broad for private repositories; the app only issues GETs and does not
  store the provider token.

## 3. Required configuration

### Supabase

- Project `launchproof` (`ypqpqgnviphwxddrpieq`) exists on the free plan.
- `202611230001_cloud_dashboard.sql`, `202611230002_revoke_default_table_privileges.sql`, and
  `202611230003_security_hardening.sql` are applied and recorded. The ledger contains exactly
  001/002/003 with zero unexpected versions. The reconciliation and guarded record scripts are
  `supabase/manual/20261123_reconcile_migration_ledger.sql` and
  `supabase/manual/20261123_record_security_hardening.sql`.
- Migration 003 created `rate_limits` and the `consume_rate_limit`, `cleanup_cli_tokens`, and
  `cleanup_rate_limits` functions, restored service-role DML, and hardened postgres-owned default
  ACLs. No scheduled cleanup job is configured.
- GitHub provider is enabled with the matching OAuth App client ID and the callback
  `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`. The secret was rotated in Phase 21.2.
- Site URL is `https://launchproof-rose.vercel.app`; the redirect allowlist contains exactly
  `http://127.0.0.1:3000/auth/callback` (retained for local development) and
  `https://launchproof-rose.vercel.app/auth/callback`. No wildcard hosts.
- To add another origin later, add its exact `/auth/callback` path; do not use wildcards.
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

Current Vercel state, names and scopes only (Phase 21.6; no value was read):

| Variable                        | Required    | Preview             | Production                                     | Validation                                                                                                                           |
| ------------------------------- | ----------- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes         | Configured (Config) | Configured (Config)                            | Present; public.                                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes         | Configured (Config) | Configured (Config)                            | Present; public by design.                                                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes         | Configured (Secret) | Configured (Secret)                            | Present; server-only, value hidden.                                                                                                  |
| `LAUNCHPROOF_ENCRYPTION_KEY`    | Yes         | Configured (Secret) | Configured (Secret)                            | Present; must decode to 32 bytes, validated on first GitHub connect after deployment.                                                |
| `APP_BASE_URL`                  | Recommended | Not set             | `https://launchproof-rose.vercel.app` (Config) | Set in Phase 21.7 and verified by production redirect `Location` values. Preview keeps the `VERCEL_PROJECT_PRODUCTION_URL` fallback. |

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

- `npm run verify` (Phase 21.6, on `4151a129`): exit 0; format, lint, typecheck, core/browser/CLI
  builds, **20 test files / 109 tests**, and production web build passed.
- `npm audit --audit-level=high`: 0 vulnerabilities (no dependency change in Phase 21.6).
- `npm ci --dry-run`: `up to date`, confirming the lockfile matches `package.json` for Vercel's
  `npm ci` install.
- Local `next dev` smoke: `/api/health` 200, `/api/cli/repositories` 401 without a token, `/login`
  200, with the proxy/CSP pipeline active.
- Hosted read-only re-check: service-role 200 on all eight relations with zero rows, anon 401 on all
  eight, and the 003 limiter/cleanup RPCs exposed. No mutation.
- Hosted synthetic validation: **60/60** checks passed, zero application rows and zero auth users
  after teardown. Artifact: `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json`.
- Project secret scan: 0 hardcoded-secret findings; one expected medium `.env` hygiene finding for
  the gitignored local file (no value recorded).
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

- RLS passed local PGlite tests, 17/17 hosted PostgREST checks in Phase 21.2, and 60/60 low-volume
  synthetic hosted checks in Phase 21.5. No deployed application runtime or real two-browser-session
  test exists.
- Hosted `service_role` DML works, but it also retains bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE`
  (and `MAINTAIN` where supported) privileges and a broad `arwdDxtm` default ACL. The service-role key remains a high-value server
  secret; least-privilege tightening is a future decision.
- Migration 003 is applied and verified hosted. No provider backup exists; the saved baseline is
  catalog evidence, not a data backup. Manual additive rollback is the only recovery path.
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

Both gates are complete.

**Database gate — COMPLETED in Phase 21.5:**

The three reviewed hosted SQL operations ran in order, the ledger contains 001/002/003, and the hosted
synthetic suite passed 60/60 checks with verified teardown.

**Deployment gate — COMPLETED in Phase 21.7:**

The authorized initial Production deployment is live at https://launchproof-rose.vercel.app, with
`APP_BASE_URL` set and the Supabase Site URL/redirect allowlist updated. Initial live validation
passed, and Phase 21.8 proved tenant isolation, CSRF rejection, rate limiting, account deletion, and
CLI-token scoping; the untested items in section 2 still require GitHub 2FA completion for repository
connect/upload. A follow-up candidate containing two P3 fixes (deep-link redirect, `Secure` cookies)
awaits separate deployment authorization. No merge to `main`, tag, GitHub release, or npm publish was
performed.

See [CLOUD_DASHBOARD_SETUP.md](CLOUD_DASHBOARD_SETUP.md) for step-by-step setup,
[PHASE_21_7_REPORT.md](PHASE_21_7_REPORT.md) for deployment evidence, and
[LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md) for the live state.
