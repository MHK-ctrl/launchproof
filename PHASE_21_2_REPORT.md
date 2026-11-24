# Phase 21.2 — OAuth Secret Rotation and Initial Production Deployment Gate

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Base commit at start:** `ded30b5`
**Verdict:** OAuth secret rotation is **COMPLETED**. Hosted Supabase security remains **VERIFIED**.
The Vercel project is **READY** for an initial Production deployment, but **NO DEPLOYMENT EXISTS**
and production is **NOT AUTHORIZED** in this phase.

## 1. Executive summary

This phase treated the previously rendered GitHub OAuth client secret as compromised. The secret was
rotated in GitHub, the old secret was deleted, and the Supabase GitHub provider was updated without
recording or reading back any secret value. The hosted Supabase security checks were re-run after the
rotation and passed **17/17**. The Vercel project was prepared with Production-scoped environment
variables, and the application passed the local production build, test, audit, accessibility, and
mobile checks.

No Vercel deployment was created. Vercel classifies the first deployment of this project as
Production, and explicit owner approval has not been given. `APP_BASE_URL` and the production auth
callback remain intentionally unset until a real deployment origin exists.

## 2. Scope and safety constraints

- Work was performed on `feat/cloud-dashboard`; no feature was rebuilt.
- Only Vercel account `mdhamzakhan2k6-4663`, team `hamza-recallai`, was used.
- No GitHub owner 2FA was bypassed, no account was switched, and no secret was printed, logged,
  screenshotted, committed, or stored in a repository file.
- The old secret was deleted, not merely superseded.
- No production deployment, merge to `main`, tag, release, npm publication, purchase, or custom
  domain was created.
- Docker was not used.

## 3. GitHub OAuth secret rotation — COMPLETED

1. The existing GitHub OAuth App was opened through the authenticated browser session and confirmed
   as `LaunchProof` (app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`) owned by `MHK-ctrl`.
2. A new client secret was generated using GitHub's own control. The value was never extracted from
   the DOM and no snapshot or screenshot was taken while it was visible.
3. The new secret was pasted directly into the Supabase GitHub provider field and saved. The dialog
   closed without an alert and the provider remained enabled.
4. The old secret was deleted in GitHub. One masked secret remains.
5. The macOS clipboard was cleared and verified at 0 bytes; generated browser snapshots were removed.
6. The Supabase provider was reopened only to confirm the client ID and callback. The secret field was
   not read back.

**Recorded result:** previous secret considered compromised; rotation completed; Supabase provider
updated; no secret value recorded. The callback remains
`https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`.

## 4. Supabase verification after rotation — VERIFIED

- Project: `launchproof`, ref `ypqpqgnviphwxddrpieq`, organization `LaunchProof`
  (`hhaljmwqphlagxetcccs`), Tokyo, free plan.
- GitHub provider enabled; client ID matches the expected OAuth App; callback matches the Supabase
  callback above.
- Supabase Site URL remains `http://127.0.0.1:3000`; redirect allowlist contains only
  `http://127.0.0.1:3000/auth/callback`. No production callback has been invented.
- Hosted SQL audit: six tables, all with `rowsecurity = true`; 16 policies; zero `anon` table grants;
  zero `authenticated` `TRUNCATE` grants; zero auth users; zero profile, repository, scan, and finding
  rows.
- The hosted PostgREST/RLS suite was re-run after rotation: **17/17 passed**. It used two disposable
  identities for cross-tenant reads, writes, deletes, forged IDs, repository/scan attachment, the
  aggregate view, anonymous denial, and cleanup. Both identities were deleted.
- No unexpected migration or production data was found.
- **Known gap:** the hosted project has no `supabase_migrations.schema_migrations` ledger. The two
  repository migrations were applied manually through the SQL editor. This is recorded as an
  operational limitation, not as a passed migration-ledger check.

## 5. Vercel preparation — READY, NOT DEPLOYED

- Account: `mdhamzakhan2k6-4663`; team `hamza-recallai`; no account switching.
- Project: `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`), root directory `.`, framework
  Next.js, install `npm ci`, build `npm run build:web`, Git repository not connected.
- No deployment exists. Vercel's first deployment for this project is assigned to Production; a
  preview-only first deployment is not supported.
- Four environment variable names are configured in both Preview and Production without exposing
  values:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCHPROOF_ENCRYPTION_KEY`
  - `APP_BASE_URL` is **unset** because no deployment origin exists.
- The two `NEXT_PUBLIC_*` values are Vercel Config variables; the service-role key and encryption key
  are Vercel Secret variables and are server-only.
- No temporary deployment, alternate project, alternate account, or undocumented workaround was
  used.

## 6. Production readiness review

### Application security — reviewed, no blocking defect found

- Dashboard pages and APIs re-check the Supabase session server-side; `/dashboard` redirects a
  signed-out browser to `/login?next=%2Fdashboard`.
- Tenant ownership is derived from the verified session or CLI token hash, never from a
  client-supplied `user_id`.
- Upload schemas are strict, body size is limited, checks/findings are capped, and the server
  recomputes the security gate.
- CLI authorization uses state, PKCE, one-time codes, expiry, atomic claim, hashed tokens, and
  revocation.
- Session-route origin checks, `safeNextPath` redirect normalization, encrypted short-lived GitHub
  connect cookies, and `private, no-store` private responses are present.
- Rate limits are in-memory and per instance; they are not a distributed limiter.
- GitHub's `repo` scope remains broader than the application's GET-only use. A GitHub App is not
  implemented.
- No Content-Security-Policy is configured. CSP was not added without testing because it could break
  Next.js; this remains a documented gap.
- No external security audit or penetration test exists.

### Environment and secret exposure

- The service-role key and encryption key are not present in client bundles, static assets, source
  maps, or Git. A scan of 200 tracked files and 19 client static files for the exact secret values
  returned zero hits.
- No placeholder production secrets are present.
- `APP_BASE_URL` must be set to the exact Vercel production origin after deployment, then the app
  must be redeployed because the value is read at runtime.
- The Supabase redirect allowlist must then receive `https://<production-origin>/auth/callback`.
  The GitHub OAuth callback stays pointed at Supabase.

### Build and test

- `npm run verify`: exit 0. Format, lint, typecheck, core/browser/CLI builds, 15 test files with
  68 tests, and the production web build all passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- The production web build recognizes `Proxy` as middleware; public pages are prerendered and
  dashboard/API routes are dynamic.
- Local `next start` production server: `/api/health` returned 200 and the public routes returned 200.

### UI and accessibility

- `/`, `/login`, `/security`, `/docs`, `/get-started`, `/report`, `/demo`, and `/about` returned 200
  on the production build.
- axe-core WCAG 2.0/2.1 A and AA scan: **0 violations on all eight pages** after two genuine UI fixes:
  - removed the logo link's mismatched `aria-label` so its visible text is its accessible name;
  - added `min-w-0` to the `/get-started` grid columns so long code samples no longer widen the
    mobile document.
- Mobile checks at 390 px: `/`, `/login`, `/security`, `/get-started`, and `/report` had no
  horizontal overflow.
- Keyboard check on `/`: focus begins with the skip link, then the logo link and mobile menu button,
  then page actions.

## 7. Deployment readiness checklist

| Requirement                  | Status            | Evidence                                                                                     |
| ---------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| OAuth secret rotated         | VERIFIED          | New secret generated; old secret deleted; one masked secret remains                          |
| Supabase secret updated      | VERIFIED          | Provider saved without alert; value not read back                                            |
| Supabase configuration       | VERIFIED          | Project, provider, client ID, callback, local-only redirect allowlist checked                |
| GitHub sign-in configuration | READY             | Provider enabled; live sign-in not tested because no application origin exists               |
| Migration status             | VERIFIED (manual) | Both migrations applied through the SQL editor; migration ledger absent and documented       |
| Hosted RLS validation        | VERIFIED          | 17/17 passed after rotation; disposable identities deleted                                   |
| Tenant isolation             | VERIFIED          | Hosted database 17/17; deployed browser test NOT TESTED                                      |
| Local test suite             | VERIFIED          | 15 files, 68 tests passed                                                                    |
| Production build             | VERIFIED          | `npm run build:web` and `npm run verify` passed                                              |
| Secret scan                  | VERIFIED          | 200 tracked files + 19 client static files; 0 exact-value hits                               |
| Dependency audit             | VERIFIED          | 0 high-or-higher vulnerabilities                                                             |
| Vercel account               | VERIFIED          | `mdhamzakhan2k6-4663`, team `hamza-recallai`                                                 |
| Vercel project               | VERIFIED          | Project exists, settings correct, no Git connection, no deployments                          |
| Environment variables        | READY             | Four variables present in Preview and Production; `APP_BASE_URL` intentionally unset         |
| `APP_BASE_URL` plan          | READY             | Set only after the real origin exists, then redeploy                                         |
| Authentication callback plan | READY             | Keep GitHub callback at Supabase; add exact Vercel `/auth/callback` to Supabase after deploy |
| Production security review   | READY             | No blocking code defect; CSP, external audit, monitoring, and distributed limits remain gaps |
| Deployment rollback strategy | READY             | Initial deploy has no prior target; remove the bad deployment and revert Supabase settings   |
| Deployment approval          | BLOCKED           | No explicit Production deployment authorization has been given                               |

## 8. What remains NOT TESTED

- Real GitHub sign-in, OAuth callback/session cookies, sign-out, redirect rejection, repository
  consent, and provider-token exchange.
- Live CLI browser login, token exchange/storage, status, upload, download, revoke, and logout.
- A deployed dashboard, two-account browser isolation, account deletion, and deployed headers.
- `APP_BASE_URL`, the production callback allowlist, and Vercel runtime/cookie behavior.
- Lighthouse/Core Web Vitals and deployed performance. No performance claim is made.
- External security audit, penetration test, monitoring, MFA, audit logs, and scheduled cleanup of
  expired CLI authorization rows.
- Content-Security-Policy behavior on the deployed host.

## 9. Deployment approval gate

The exact action that requires authorization is:

> **Authorize the initial LaunchProof Production deployment to Vercel.**

At the time of this report, that authorization has **not** been given. The existence of this report,
earlier deployment plans, or the project's desired end state is not approval. No deployment will be
created until the owner explicitly sends that authorization in a subsequent message.

The approval request records the exact repository, branch, commit SHA, Vercel project, public
surface, environment variable names, audit/test results, known risks, and rollback method.

## 10. Rollback plan

- Because this is the initial deployment, there is no prior Vercel deployment to promote. If it is
  bad, remove the deployment (or project), restore the Supabase Site URL and redirect allowlist to
  the local-only values, and redeploy only after a fix is verified locally.
- The Supabase schema is additive and applied manually; do not mutate live tables blindly. Test
  schema changes on a fresh project first.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates connect cookies only; users reconnect.
- Revoking CLI tokens does not modify local reports.
- Deleting the Supabase project is destructive and irreversible without a backup.

## 11. Documentation updated

- `PROJECT_EXECUTION_STATUS.md` — Phase 21.2 status and approval gate.
- `LIVE_DEPLOYMENT_REPORT.md` — rotation, Production variables, and no-deployment state.
- `DEPLOYMENT_READINESS.md` — verified/blocked checklist and post-deploy steps.
- `CLOUD_DASHBOARD_SETUP.md` — rotation complete, Production variable scopes, callback plan.
- `PRIVACY_DATA_FLOW.md` — no deployed production data; hosted data counts.
- `MULTI_TENANT_SECURITY_DESIGN.md` — post-rotation hosted evidence and current limitations.
- `CLOUD_DASHBOARD_ARCHITECTURE.md` — deployment state and environment scopes.
- `PHASE_21_1_REPORT.md` — historical note that Phase 21.2 completed the rotation.
- `PHASE_21_2_REPORT.md` — this report.
