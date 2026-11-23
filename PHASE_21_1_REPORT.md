# Phase 21.1 — Hosted Supabase, OAuth Configuration, and Preview Gate Report

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Commit:** `98af71e` (`fix: revoke default Supabase table privileges for cloud dashboard`)
**Verdict:** Hosted database security is verified; **no application deployment exists**. The preview
deployment is blocked by Vercel's mandatory first-Production-deployment rule, and live OAuth must wait
for client-secret rotation.

> **Phase 21.2 follow-up (2026-11-23):** the exposed GitHub OAuth client secret was rotated and the
> old secret was deleted; the Supabase provider was updated without recording the value. Hosted RLS
> was re-run and passed 17/17, and Vercel now has Preview and Production variables. No Vercel
> deployment exists; the initial Production deployment still requires explicit owner authorization.
> See [PHASE_21_2_REPORT.md](PHASE_21_2_REPORT.md). The statements below describe the earlier Phase
> 21.1 checkpoint and are retained as history.

## 1. Executive summary

This phase continued from the Phase 21 checkpoint without rebuilding the dashboard. It:

- preserved and committed the uncommitted migration hardening;
- confirmed the hosted Supabase project, re-ran hosted RLS, and passed **17/17** checks;
- confirmed the Supabase GitHub provider is enabled;
- created and linked the Vercel project and added four Preview-scoped environment variables without
  printing values;
- attempted a preview-only deployment and was refused by Vercel because a new project's first
  deployment is always Production;
- did not create a production deployment, merge to `main`, create a tag/release, publish to npm, or
  switch accounts.

A browser automation snapshot rendered the GitHub OAuth client secret unmasked. The value was not
copied into a file, report, or command, but it must be treated as exposed and rotated before live
OAuth use.

## 2. Authentication and account

- **Vercel:** `vercel whoami` returned `mdhamzakhan2k6-4663`; team `hamza-recallai`. No account
  switching occurred. Project `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`) is linked from the
  repository root.
- **GitHub:** GitHub CLI authenticated as `MHK-ctrl`; repository remote is
  `https://github.com/MHK-ctrl/launchproof.git`.
- **Supabase:** project access confirmed through the dashboard; project `launchproof`
  (`ypqpqgnviphwxddrpieq`) belongs to organization `LaunchProof`
  (`hhaljmwqphlagxetcccs`).

## 3. Supabase configuration

**Status: COMPLETED — HOSTED (database); application runtime NOT TESTED.**

- Project: `launchproof`, ref `ypqpqgnviphwxddrpieq`, Tokyo, free plan.
- Migrations applied:
  - `202611230001_cloud_dashboard.sql`
  - `202611230002_revoke_default_table_privileges.sql`
- Hosted catalog verified:
  - six tables: `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`;
  - RLS enabled on all six;
  - 16 policies;
  - composite tenant foreign keys;
  - profile/scan/finding triggers;
  - `repository_scan_stats` with `security_invoker=true`.
- Grant hardening verified: no `anon` table privileges; no `TRUNCATE` for `authenticated`; only the
  operations used by the application remain granted.
- The corrective migration is idempotent and was committed in `98af71e`.
- Supabase Site URL remains `http://127.0.0.1:3000`; redirect allowlist includes
  `http://127.0.0.1:3000/auth/callback`. No preview callback exists because no preview URL exists.

## 4. OAuth

**Status: CONFIGURED — NOT TESTED; ROTATION REQUIRED.**

- GitHub OAuth App: `LaunchProof`, app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`.
- GitHub callback: `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`.
- Supabase Authentication → Providers → GitHub is enabled with the matching client ID and callback.
- The separate repository metadata consent flow (`read:user repo`) is implemented but has not been
  exercised.
- **Security incident:** the Supabase provider dialog rendered the client secret unmasked in
  browser-automation output. The value must be rotated in GitHub and updated in Supabase before any
  live sign-in test. It was not intentionally copied into a repository file, report, or command.
- Real GitHub sign-in, OAuth callback, session creation/refresh, sign-out, invalid-redirect rejection,
  provider-token exchange, and repository consent are **NOT TESTED**.

## 5. Preview deployment

**Status: BLOCKED — no preview URL, no production deployment.**

- Vercel project `launchproof` was created and linked; root directory `.`, no Git connection.
- Preview-scoped variables exist without exposing values:
  - `NEXT_PUBLIC_SUPABASE_URL` (Config)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config)
  - `SUPABASE_SERVICE_ROLE_KEY` (Secret)
  - `LAUNCHPROOF_ENCRYPTION_KEY` (Secret)
- `APP_BASE_URL` is intentionally unset until a real preview origin exists.
- Command attempted:

```bash
vercel deploy --environment preview --yes \
  --meta githubCommitRef=feat/cloud-dashboard \
  --meta githubCommitSha=98af71ea07b330f77da0a6c4138ddda16930f6de
```

- Vercel refused:

> Can't create a Preview deployment. This project has no deployments yet, and a project's first
> deployment is assigned to Production. To deploy to Production, retry with `--prod`.

- Vercel's documented first-deployment rule confirms this applies to CLI deploys, Git imports, and
  explicit Preview targets. No workaround was attempted because production is prohibited.
- `vercel ls launchproof` reports no deployments. No production alias, domain, or preview URL exists.
- `--temporary` was not used: Vercel documents it as a Production deployment and it expires after one
  hour.

## 6. CLI authentication

**Status: NOT TESTED live.** The implementation exists and has local coverage, but no browser login,
live token exchange, Keychain/file storage check, status call, revocation, or expiry handling was run
against a deployed API. No CLI token was printed.

## 7. Upload validation

**Status: COMPLETED — LOCAL; NOT TESTED live.**

- Local sanitization suite: 6/6 tests passed.
- The upload implementation enforces strict schema, 2 MB limit, check/finding caps, secret/path
  redaction, safe relative paths, sensitive-reference rejection, and server-side gate recomputation.
- No synthetic or real report was uploaded to a deployed endpoint. Explicit opt-in, preview,
  confirmation, cancellation, failure preservation, malformed/oversized payloads, and cross-tenant
  upload rejection remain untested in a live runtime.

## 8. Tenant isolation

**Status: COMPLETED — HOSTED (database); deployed browser test NOT TESTED.**

The hosted PostgREST/RLS script ran with two disposable Supabase Auth identities and synthetic data.
All 17 checks passed:

- own profile, repository, scan, and finding access;
- tenant-scoped repository lists;
- cross-tenant reads return no rows;
- cross-tenant updates and deletes affect no rows;
- victim rows remain after adversarial deletes;
- forged `user_id` inserts rejected;
- scan cannot attach to another tenant's repository;
- finding cannot attach to another tenant's scan;
- aggregate view is tenant-scoped;
- anonymous access denied;
- disposable identities deleted.

The database boundary is verified. A two-browser-session test against a deployed app could not run
because no deployment exists.

## 9. Security

**VERIFIED (hosted database):**

- RLS enabled and tenant policies enforced on real PostgREST.
- Default `anon`/`authenticated` grants revoked; `TRUNCATE` closed.
- Service-role and encryption keys are server-only Vercel Secret variables.
- No secrets were printed in commands or committed; `.env` is gitignored and mode `0600`.

**BLOCKED / NOT TESTED:**

- Deployed CSP/HSTS/header behavior, cookie flags, OAuth state, PKCE, redirect validation, rate
  limiting, error leakage, SSRF/URL validation, and bundle secret scanning.
- Real GitHub OAuth consent and callback.
- Live CLI token handling and revocation.

**Incident:** rotate the GitHub OAuth client secret; it was exposed in automation output.

## 10. Performance

**NOT TESTED.** No deployed URL exists, so Lighthouse/Core Web Vitals, bundle transfer sizes, memory,
and mobile layout were not measured. No performance claim is made.

## 11. Tests

| Check                                                           | Result                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm test`                                                      | 15 files, 68/68 passed                                     |
| `npx vitest run packages/core/test/cloud-dashboard-rls.test.ts` | 9/9 passed                                                 |
| Hosted `/tmp/lp-hosted-rls.mjs`                                 | 17/17 passed                                               |
| `npm run format`                                                | Exit 0                                                     |
| `vercel whoami`                                                 | `mdhamzakhan2k6-4663`                                      |
| `vercel project inspect launchproof`                            | linked, no Git, no deployment                              |
| `vercel deploy --environment preview`                           | refused (first deploy = prod)                              |
| Local dev server against hosted Supabase                        | `/` 200, `/login` 200, `/dashboard` 307, `/api/health` 200 |

No test failed. Full `verify`, deployed Playwright, axe, dependency audit, and secret scanning were
not repeated because no application code or dependency changed after the prior full run; the migration
change was covered by the RLS and full test suites.

## 12. Documentation

Updated in this phase:

- `PROJECT_EXECUTION_STATUS.md` — Phase 21 checkpoint, hosted evidence, blockers.
- `LIVE_DEPLOYMENT_REPORT.md` — rewritten to reflect hosted Supabase, OAuth status, and the Vercel
  gate.
- `DEPLOYMENT_READINESS.md` — status, configuration, first-deployment gate, blockers.
- `CLOUD_DASHBOARD_SETUP.md` — current hosted state, secret-rotation warning, deployment gate.
- `README.md` — current status no longer claims no Supabase project/OAuth credentials.
- `CLOUD_DASHBOARD_ARCHITECTURE.md`, `MULTI_TENANT_SECURITY_DESIGN.md`, `docs/deployment.md`,
  `docs/privacy.md` — hosted-vs-deployed distinctions.

Historical phase reports were left intact where they accurately describe their own dates.

## 13. Limitations

- No preview or production URL; no deployed runtime evidence.
- Vercel's first-deployment rule conflicts with a preview-only requirement for a new project.
- Real GitHub OAuth and repository consent are untested; the client secret needs rotation.
- No live CLI login/upload/download/revocation or account-deletion test.
- Hosted RLS is strong database evidence but does not prove server-route authorization, cookie
  behavior, or browser isolation.
- Sanitization is heuristic, not a guarantee.
- No external security audit, penetration test, MFA, audit log, distributed rate limiting, monitoring,
  or scheduled cleanup of expired CLI authorization rows.
- The GitHub `repo` scope is broad; the server issues only GETs and does not store the provider token.

## 14. Exact remaining blockers

1. **Rotate the exposed GitHub OAuth client secret** and update Supabase (owner sudo/2FA).
2. **Resolve the Vercel first-deployment gate.** Production is not authorized; either approve one
   initial Production deployment or use a host/plan that permits a preview-only first deployment.
3. After a reachable preview exists: set `APP_BASE_URL`, add the exact preview callback to Supabase,
   redeploy, and run real OAuth/CLI/dashboard/two-account/header/performance checks.
4. No production deployment, merge, tag, release, npm publication, or custom domain has occurred.

## 15. Recommended next phase

1. Owner rotates the OAuth secret and confirms Supabase still shows the provider enabled.
2. Owner decides the Vercel gate: explicitly approve the initial Production deployment, or authorize
   an alternate host that supports preview-only.
3. Deploy one Preview from `feat/cloud-dashboard`; record URL, commit, and build log.
4. Set `APP_BASE_URL` and the exact Supabase preview callback; redeploy.
5. Run the real end-to-end matrix: GitHub sign-in/sign-out, repository consent, CLI login/status/
   upload/download/logout, two-account adversarial tests, dashboard Playwright/axe, headers, and
   basic performance.
6. Update the deployment report and status with only verified results; keep production gated.
