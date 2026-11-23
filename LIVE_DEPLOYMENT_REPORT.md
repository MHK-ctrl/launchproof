# Live Deployment Report

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard` at `98af71e`
**Status:** **NO VERCEL DEPLOYMENT — PREVIEW BLOCKED BY VERCEL'S FIRST-DEPLOYMENT RULE**
**Production URL:** none. No production deployment, production alias, custom domain, or public preview URL
exists.

This report separates what was verified against hosted services from what remains untested. A hosted
Supabase RLS run is real hosted evidence, but it is not proof that a deployed Next.js runtime, GitHub
sign-in, or the CLI work end to end.

## 1. Current environment

- macOS on Apple Silicon; Node.js `26.0.0`, npm `11.12.1`.
- Repository: `https://github.com/MHK-ctrl/launchproof`, branch `feat/cloud-dashboard` at `98af71e`.
- GitHub CLI authenticated as `MHK-ctrl`.
- Vercel CLI authenticated as `mdhamzakhan2k6-4663` (team `hamza-recallai`). No other account was used.
- Vercel project `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`) exists and is linked from the
  repository root. It has **no Git connection and no deployments**.
- Hosted Supabase project `launchproof` (`ypqpqgnviphwxddrpieq`), organization `LaunchProof`
  (`hhaljmwqphlagxetcccs`), Tokyo, free plan.
- Local `.env` exists with mode `0600` and is gitignored. Values are not printed in this report.
- Four Preview-scoped Vercel variables exist: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config), `SUPABASE_SERVICE_ROLE_KEY`, and
  `LAUNCHPROOF_ENCRYPTION_KEY` (Secret). `APP_BASE_URL` is unset because no preview origin exists.
- Supabase Site URL remains `http://127.0.0.1:3000`, with
  `http://127.0.0.1:3000/auth/callback` allowed. No preview callback has been added.

## 2. Implemented

- Next.js server output (static export removed) with Supabase Auth and SSR cookie handling.
- GitHub sign-in through Supabase, a separate repository consent flow, and an encrypted short-lived
  provider-token cookie. The provider token is never stored in PostgreSQL.
- PostgreSQL migration with profiles, repositories, scans, findings, CLI auth requests/tokens,
  composite tenant foreign keys, RLS policies, grants, and an aggregate view.
- Private dashboard: overview, repositories, scans, scan detail, settings, account.
- APIs for account, repositories, scans, findings, downloads, health, and CLI auth/upload.
- CLI `login`, `logout`, `status`, `repositories`, `upload`, plus explicit `--upload` with a sanitized
  preview and confirmation unless `--yes`.
- CLI token hashing, seven-day expiry, revocation, atomic one-time claim, PKCE, and loopback callback.
- Dashboard account deletion with cascade and connect-cookie clearing.
- Sanitization of upload text, finding paths, references, and server-side gate recomputation.
- PGlite tenant-isolation tests and CLI/server sanitization tests.

## 3. Hosted Supabase — verified

The initial migration and the corrective grant migration were applied to the hosted project through
the SQL editor:

- `supabase/migrations/202611230001_cloud_dashboard.sql`
- `supabase/migrations/202611230002_revoke_default_table_privileges.sql`

Hosted catalog checks confirmed:

- six tables: `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`;
- RLS enabled on all six tables;
- 16 policies;
- composite tenant foreign keys and profile/scan/finding triggers;
- `repository_scan_stats` with `security_invoker=true`;
- no `anon` table privileges and no `TRUNCATE` grant for `authenticated`.

The grant fix matters: Supabase's bootstrap default privileges had granted `TRUNCATE`, which bypasses
RLS. Without the fix, any signed-in user could have erased every tenant's rows even with correct row
policies.

A hosted PostgREST/RLS script created two disposable Supabase Auth identities and synthetic data. All
17 checks passed:

- own profile/repository/scan/finding access;
- tenant-scoped repository lists;
- cross-tenant reads return no rows;
- cross-tenant updates and deletes affect no rows;
- victim rows remain after adversarial deletes;
- forged `user_id` inserts are rejected;
- scans cannot attach to another tenant's repository;
- findings cannot attach to another tenant's scan;
- the aggregate view is tenant-scoped;
- anonymous access is denied;
- cleanup deleted both disposable identities.

The same run was repeated after commit `98af71e`: **17/17 passed**. This is hosted database evidence,
not a deployed-application or browser-session test.

A local Next.js dev server was also started against the hosted Supabase configuration. `/` and
`/login` returned 200, `/dashboard` returned 307 to `/login?next=%2Fdashboard`, and `/api/health`
returned `{"ok":true,...}`. The login HTML contained no service-role/encryption-key marker. Local
`next dev` does not apply the Vercel header configuration, so deployed headers remain unverified.

## 4. GitHub OAuth — configured, not exercised

- GitHub OAuth App `LaunchProof`, app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`.
- Authorization callback: `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`.
- Supabase Authentication → Providers → GitHub is enabled with that client ID and callback.
- The separate repository metadata consent flow (GitHub OAuth with `read:user repo`) has not been run.

**Security incident requiring action:** during browser inspection, the Supabase provider dialog
rendered the GitHub client secret unmasked in tool output. The value was not intentionally copied into
a file, report, or command, but it must be treated as exposed. Rotate the OAuth client secret in GitHub
and update the Supabase provider before any live sign-in test.

Real GitHub sign-in, callback/session creation, session refresh, sign-out, redirect rejection,
repository consent, and provider-token exchange are **NOT TESTED**.

## 5. Vercel preview — blocked by the first-deployment rule

The Vercel project was created and linked, and the four Preview variables were added without printing
their values. The deployment command was:

```bash
vercel deploy --environment preview --yes \
  --meta githubCommitRef=feat/cloud-dashboard \
  --meta githubCommitSha=98af71ea07b330f77da0a6c4138ddda16930f6de
```

Vercel refused:

> Can't create a Preview deployment. This project has no deployments yet, and a project's first
> deployment is assigned to Production. To deploy to Production, retry with `--prod`.

Vercel's documented behavior is that the first deployment of a new project is always Production, even
without `--prod`, when importing from Git, or when targeting Preview. Because this mission prohibits a
production deployment, no workaround was attempted. `vercel ls launchproof` reports no deployments.
No production alias or domain exists.

A temporary deployment (`--temporary`) is also documented by Vercel as a production deployment and
would expire after one hour; it is not a substitute for the required preview environment and was not
used.

## 6. Not tested / blocked

1. **No preview URL.** `APP_BASE_URL`, preview callback allowlist, deployed cookies, proxy/header
   behavior, and Vercel runtime are unverified.
2. **No real GitHub OAuth.** The provider is configured, but sign-in and repository consent have not
   been exercised; the secret must be rotated first.
3. **No live CLI auth/upload.** The browser/device flow and upload have only unit/build/PGlite
   coverage; no live API accepted a token or scan.
4. **No deployed two-account browser test.** Hosted database RLS passed with disposable identities,
   but no two real browser sessions were tested against a deployed app.
5. **No production deployment.** Production is not authorized and has not occurred.
6. **No merge, tag, release, npm publication, or custom domain.**
7. **No external security audit or penetration test.**
8. **GitHub Actions/OIDC automatic upload is not implemented.**

## 7. Exact blockers

### Blocker A — rotate the exposed OAuth secret

The GitHub OAuth client secret was displayed unmasked in browser-automation output. Rotate it in the
GitHub OAuth App settings (owner sudo/2FA required) and update Supabase. Do not paste the new secret
into chat, a repository file, or a report.

### Blocker B — Vercel preview requires a first Production deployment

Vercel does not permit a Preview deployment before a project's first Production deployment. Production
is explicitly out of scope. The owner must either:

- explicitly approve one initial Production deployment (which would then allow Preview deployments),
  or
- choose a hosting path that permits a preview-only first deployment.

No production deployment will be created without that approval.

### Blocker C — preview origin and callback

After a reachable preview exists, set `APP_BASE_URL` to its exact origin, add
`https://<preview-origin>/auth/callback` to Supabase's redirect allowlist, and redeploy. Keep the
GitHub OAuth callback pointed at the Supabase callback, not the Vercel host.

### Blocker D — live validation

After A–C, run the checklist in `CLOUD_DASHBOARD_SETUP.md`: real GitHub sign-in, repository consent,
CLI login/status/upload/logout, downloads, headers, account deletion, and two-account adversarial
isolation against the deployed preview.

## 8. Deployment sequence after approval

1. Rotate the OAuth client secret and update Supabase.
2. Resolve the Vercel first-deployment gate with explicit owner approval or an alternate host.
3. Deploy the branch as a Preview; record the exact URL and commit.
4. Set `APP_BASE_URL` to the preview origin and redeploy.
5. Add the exact preview `/auth/callback` to Supabase.
6. Run real OAuth, repository consent, CLI login/upload, download, and two-account checks.
7. Inspect deployed headers, console errors, failed requests, accessibility, and basic performance.
8. Update this report and `PROJECT_EXECUTION_STATUS.md` with only verified results.
9. Obtain separate approval before any production promotion or custom domain.

## 9. Rollback

- Vercel retains prior deployments; a bad preview can be abandoned without affecting production.
- If the schema is wrong, fix the migration on a fresh project rather than mutating a live database in
  place.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates connect cookies only; users reconnect.
- Revoking CLI tokens does not delete local reports.
- Deleting the Supabase project removes all dashboard data and cannot be undone.

## 10. Honest conclusion

The cloud dashboard is implemented, locally verified, and backed by a real hosted Supabase project
whose RLS and grant hardening passed 17/17 adversarial checks. The GitHub provider is configured, and
the Vercel project is prepared with Preview variables.

It is **not deployed**. Vercel requires a first Production deployment before any Preview deployment,
and production is not authorized. The OAuth client secret also needs rotation after being rendered
unmasked during automation. No live GitHub sign-in, CLI upload, deployed dashboard, or two-account
browser test has been completed.
