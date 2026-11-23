# Deployment Readiness — LaunchProof Website and Cloud Dashboard

**Status:** implemented locally, **not deployed**.
**Recommended host:** Vercel with the Next.js server runtime.
**Required services:** Supabase (Auth + PostgreSQL) and a GitHub OAuth App.
**Production approval:** required and not yet given.
**Production URL:** none. Do not announce one until a real deployment has been verified.

> The public marketing pages can still be hosted without a database; the private dashboard and CLI
> upload require Supabase. This document does not claim that any of those services are configured.

## 1. What is ready

- The Next.js app builds in server mode:
  - public pages are prerendered;
  - `/dashboard/*`, `/login`, `/cli/*`, `/auth/*`, and `/api/*` are dynamic;
  - no `output: "export"`;
  - `trailingSlash` is false so API paths do not redirect.
- `vercel.json` uses `framework: "nextjs"`, `npm ci`, and `npm run build:web`, with security and
  no-store headers.
- The PostgreSQL migration defines the schema, composite tenant foreign keys, RLS, grants, and the
  aggregate view.
- GitHub sign-in through Supabase, repository consent through GitHub OAuth, encrypted short-lived
  provider-token cookie, and server-side repository metadata verification.
- Private dashboard and APIs with server-side ownership checks.
- CLI login via browser loopback + PKCE, hashed seven-day tokens, revocation, explicit upload preview,
  and local sanitization.
- PGlite tenant-isolation tests and upload-sanitization tests pass locally.

## 2. What is not ready

- No Supabase project or credentials.
- No GitHub OAuth App or consent test.
- No Vercel login, project link, preview, or production deployment.
- No production hostname, so `APP_BASE_URL`, Supabase Site URL/redirects, and canonical metadata do
  not exist.
- No live RLS, auth, repository connection, CLI login, upload, download, revocation, or account
  deletion test.
- No real two-account isolation test in a hosted environment.
- GitHub Actions/OIDC upload is not implemented.
- The cloud dashboard does not have a custom domain, monitoring, audit logging, or a scheduled cleanup
  job for expired CLI authorization rows.

## 3. Required configuration

### Supabase

- Create a project.
- Apply `supabase/migrations/202611230001_cloud_dashboard.sql`.
- Enable the GitHub provider with an OAuth App client ID/secret.
- Set Site URL and a narrow redirect allowlist:
  - local: `http://127.0.0.1:3000/auth/callback`
  - preview/production: `https://<host>/auth/callback`
- Record the project URL, anon key, and service-role key.

### GitHub OAuth App

- Homepage URL: the application origin.
- Authorization callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
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

Generate the key with:

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
npm run build
npm run typecheck -w @launchproof/web
npm run build:web
npm test
```

Then, with a local Supabase project configured:

```bash
npm run dev:web
```

Verify:

- public pages load without a session;
- `/dashboard` redirects to `/login` when signed out;
- GitHub sign-in returns to the intended path;
- repository consent and connection work;
- `launchproof login` stores a token;
- `launchproof scan . --upload` shows the preview and respects confirmation;
- cancellation and upload failure preserve the local report;
- a second account cannot see or mutate the first account's data;
- logout revokes the token.

Current local results: build, web typecheck, production web build, and `npm test` (15 files, 68 tests)
pass. Live Supabase/GitHub/CLI flows are blocked on credentials and have not been run.

## 5. Deployment steps after approval

1. Confirm the working tree and all checks are final.
2. Complete `vercel login` through the official flow.
3. Import the repository at the **repository root** (npm workspace), not `apps/web`.
4. Add the five web environment variables to Preview and Production as appropriate.
5. Deploy a preview:
   ```bash
   vercel deploy
   ```
6. Set `APP_BASE_URL` to the preview origin and redeploy.
7. Add the preview `/auth/callback` URL to Supabase.
8. Run the full checklist in `CLOUD_DASHBOARD_SETUP.md` against the preview.
9. Obtain explicit approval for production.
10. Deploy production:
    ```bash
    vercel deploy --prod
    ```
11. Record the exact hostname and verification date in `PROJECT_EXECUTION_STATUS.md` and
    `LIVE_DEPLOYMENT_REPORT.md` only after it exists.

Do not connect a custom domain, enable a paid plan, or create a GitHub release as part of this step
without separate approval.

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
- [ ] Security headers are present on the deployed host.
- [ ] No secrets, source contents, full local paths, or `.env` values appear in requests or logs.
- [ ] A rollback target exists and is understood.

## 7. Risks

- RLS is tested locally with PGlite, not with a real Supabase instance.
- The service-role key bypasses RLS if it leaks; it is a high-value server secret.
- The GitHub `repo` scope is broad and cannot be made read-only for private repositories through
  GitHub OAuth. A GitHub App would be required for finer permissions.
- In-memory rate limits are per instance and reset on deploy.
- No MFA, audit log, monitoring, or alerting is implemented.
- Sanitization is heuristic; review finding text before uploading.
- Vercel's runtime, proxy, header, and cookie behavior are unverified until a real preview exists.
- No deployment has occurred, so no production availability, performance, or recovery claim is made.

## 8. Rollback

- Promote a previous Vercel deployment if a preview/production regression is found.
- The database schema should be tested on a fresh project first; do not mutate production tables
  blindly.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates connect cookies only.
- CLI token revocation is immediate for future requests; local reports are unaffected.
- Deleting the Supabase project is destructive and irreversible without a backup.

## 9. Approval boundary

Deployment requires owner approval after credentials are configured and the preview passes. This
document prepares the work; it does not authorize a production deployment.

See [CLOUD_DASHBOARD_SETUP.md](CLOUD_DASHBOARD_SETUP.md) for step-by-step setup and
[LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md) for current blockers.
