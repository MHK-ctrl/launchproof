# Cloud Dashboard Setup

This guide configures the **optional** LaunchProof cloud dashboard: GitHub sign-in, repository
connection, private scan history, and explicit CLI uploads.

Local scans do not need any of this. If you only want the CLI, skip this document.

**Current state:** the code exists; the cloud-dashboard and grant-hardening migrations have been applied to a
hosted Supabase project (`launchproof`, ref `ypqpqgnviphwxddrpieq`), and the GitHub provider is
configured. Hosted RLS passed 17/17 checks with disposable identities after the OAuth secret
rotation. The previously exposed GitHub client secret was rotated and the old secret deleted; no
secret value is recorded here. A Vercel project is linked with Preview and Production variables, but
there is **no deployment**: Vercel requires a new project's first deployment to be Production, and
production is not authorized. There is no preview or production URL. Real GitHub sign-in and CLI
upload are not tested. Do not paste passwords, OAuth secrets, service-role keys, or CLI tokens into
chat or commit them.

## 1. What you need

- A Supabase account and one project (the free tier is sufficient for a small preview).
- A GitHub account that can create an OAuth App.
- A Vercel account for the hosted dashboard (or another Node.js host that supports Next.js 16).
- Node.js 22.12+ and npm for local development.
- The repository checked out locally.

The dashboard uses:

- Supabase Auth with the GitHub provider;
- Supabase PostgreSQL with the included migration;
- Next.js server routes for OAuth callbacks, repository metadata, scans, and CLI auth;
- Vercel (or equivalent) for the Next.js runtime.

No paid plan is required by this setup. Do not enable paid add-ons or purchase a domain for this
step.

## 2. Create the Supabase project

The hosted project for this checkpoint already exists (`launchproof`, ref `ypqpqgnviphwxddrpieq`).
The steps below are the reproducible setup for a fresh environment.

1. Create a project in the Supabase dashboard.
2. Open **Project Settings -> API** and record:
   - Project URL;
   - anon/public key;
   - service-role key.
3. Treat the service-role key as a server secret. It bypasses RLS and must never be placed in a
   `NEXT_PUBLIC_*` variable, browser code, CLI output, or git.
4. Choose a region close to the expected users.

### 2.1 Apply the migration

The migration is:

```text
supabase/migrations/202611230001_cloud_dashboard.sql
```

Use one of these paths:

**SQL editor (no CLI needed):**

1. Open the Supabase SQL editor.
2. Paste the entire migration file.
3. Run it once against a new project.
4. Confirm the tables `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, and
   `cli_tokens`, plus the `repository_scan_stats` view, exist.

**Supabase CLI:**

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The migration expects the standard Supabase `auth.users` table and `auth.uid()` function. It creates
the profile trigger, composite foreign keys, indexes, grants, RLS policies, and the aggregate view.

Do not re-run a partially applied migration blindly in production. Use a fresh project for the first
verification.

### 2.2 Migration ledger and migration 003

The hosted project has **no** `supabase_migrations.schema_migrations` ledger because migrations 001
and 002 were applied manually. Do not run `supabase db push` until the ledger is reconciled. Phase
21.3 prepared a non-destructive reconciliation script and verification queries in
[`supabase/MIGRATION_TRACKING.md`](supabase/MIGRATION_TRACKING.md) and
`supabase/manual/20261123_reconcile_migration_ledger.sql`; applying them is an **owner action** that
has not been performed.

Migration `202611230003_security_hardening.sql` adds the Postgres rate-limit function/table and CLI
token cleanup function. It is additive and locally tested but **not applied** to hosted Supabase.
Apply it only after the ledger reconciliation and schema verification.

## 3. Configure GitHub OAuth

The GitHub OAuth App `LaunchProof` already exists (app ID `4046464`), and the Supabase GitHub provider
is enabled. The previously exposed client secret was rotated in Phase 21.2, the old secret was
deleted, and Supabase was updated. The secret value was not recorded or read back. The steps below are
the reproducible setup for a fresh environment.

Supabase's GitHub provider uses a GitHub OAuth App. The browser talks to Supabase, and Supabase talks
to GitHub.

1. In GitHub, go to **Settings -> Developer settings -> OAuth Apps -> New OAuth App**.
2. Set:
   - **Application name:** `LaunchProof` (or your deployment name).
   - **Homepage URL:** your application origin, for example `http://127.0.0.1:3000` for local work.
   - **Authorization callback URL:** the Supabase callback:
     `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Create the app and record the client ID. Generate a client secret and keep it private.
4. In Supabase, open **Authentication -> Providers -> GitHub**, enable it, and enter the client ID and
   secret.
5. In Supabase **Authentication -> URL Configuration**:
   - Set **Site URL** to the application origin.
   - Add redirect URLs for every origin you will use:
     - `http://127.0.0.1:3000/auth/callback`
     - `https://<your-app-host>/auth/callback`
   - Keep the list narrow. Do not add wildcard hosts.

The app requests the GitHub `repo` scope for repository connection. GitHub has no read-only scope for
private repositories. The LaunchProof server only performs GET requests to GitHub and never stores the
provider token; see [MULTI_TENANT_SECURITY_DESIGN.md](MULTI_TENANT_SECURITY_DESIGN.md). If broad
private-repository consent is unacceptable, do not connect private repositories; public repository
metadata still works with the same consent flow, and a future GitHub App could offer finer scopes.

## 4. Environment variables

Copy `.env.example` to `.env` for local work. Set these for the web app:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
APP_BASE_URL=http://127.0.0.1:3000
LAUNCHPROOF_ENCRYPTION_KEY=<base64-32-byte-key>
```

Generate the encryption key locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Rules:

- `NEXT_PUBLIC_*` values are visible to the browser. Never put the service-role key there.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- `APP_BASE_URL` is the public origin used for auth callbacks and CLI approval URLs. It must match the
  URL configured in Supabase and GitHub. A path is ignored; only the origin is used.
- `LAUNCHPROOF_ENCRYPTION_KEY` must decode to exactly 32 bytes. Changing it invalidates outstanding
  GitHub connect cookies, which is safe; users simply reconnect.
- Never commit `.env`. It is ignored by git.

Optional CLI variables:

```dotenv
LAUNCHPROOF_API_URL=http://127.0.0.1:3000
# For CI only. Prefer `launchproof login` locally.
# LAUNCHPROOF_CLI_TOKEN=<revocable-cli-token>
```

The CLI refuses a plain-HTTP API URL unless the host is loopback.

## 5. Run locally

```bash
npm install
npm run build
npm run dev:web
```

Open `http://127.0.0.1:3000`.

Expected local flow:

1. `/login` -> GitHub -> `/auth/callback` -> `/dashboard`.
2. **Repositories -> Connect GitHub** -> GitHub consent -> `/dashboard/repositories/connect`.
3. Select a repository and connect it.
4. Run a local scan and upload explicitly:

```bash
node packages/cli/bin/launchproof.mjs login
node packages/cli/bin/launchproof.mjs repositories
node packages/cli/bin/launchproof.mjs scan . --upload --repository <connected-repository-id>
```

If the public site builds but `/dashboard` returns a configuration error, check the five server
variables and confirm the migration ran.

### Common local problems

| Symptom                                    | Check                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------- |
| Login redirects to an error page           | Supabase provider enabled, callback URL exact, redirect allowlist     |
| `localhost` works but `127.0.0.1` does not | Add both origins to Supabase redirect URLs and set `APP_BASE_URL`     |
| GitHub connect says no access              | Approve the GitHub repository prompt; the cookie lasts 15 minutes     |
| Repository list is empty                   | The GitHub account has no repositories, or consent was not granted    |
| CLI login page says unavailable            | Supabase env and migration; check server logs without printing tokens |
| Upload says not signed in                  | Run `launchproof login`; check `LAUNCHPROOF_API_URL`                  |
| Upload says repository not connected       | Connect it in the dashboard, then run `launchproof repositories`      |
| RLS error in the dashboard                 | Migration/grants incomplete; re-check policies and table grants       |

## 6. Deploy to Vercel

The repository's `vercel.json` already defines:

- `framework: "nextjs"`;
- `installCommand: "npm ci"`;
- `buildCommand: "npm run build:web"`;
- no static export.

Static security headers are configured in `apps/web/next.config.ts`; the per-request nonce CSP is
generated in `apps/web/proxy.ts`. Private no-store/noindex headers apply to dashboard, login, auth,
CLI, and API routes. Verify them on the deployed host, not just locally.

Steps, after owner approval:

1. Confirm the exact commit, branch, clean worktree, and successful production build.
2. Confirm the linked Vercel project uses the repository root, not `apps/web`, because this is an npm
   workspace. Account: `mdhamzakhan2k6-4663`, team `hamza-recallai`.
3. In **Project Settings -> Environment Variables**, confirm the four required values are present in
   Production as well as Preview: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config), `SUPABASE_SERVICE_ROLE_KEY`, and
   `LAUNCHPROOF_ENCRYPTION_KEY` (Secret). The service-role key and encryption key must not be exposed
   to the client bundle. Leave `APP_BASE_URL` unset until the real origin exists.
4. **First-deployment gate:** Vercel assigns a new project's first deployment to Production even when
   you request a Preview. A Preview-only first deployment is not possible. Do not work around this by
   creating a production deployment without explicit owner approval; obtain approval for that first
   Production deployment or use a host/plan that supports a preview-only first deployment.
5. Create the initial Production deployment and record the real URL, commit, branch, and build log.
   Do not invent a hostname.
6. Set `APP_BASE_URL` to the exact production origin and redeploy, because the value is read at
   runtime.
7. Add exactly `https://<production-origin>/auth/callback` to Supabase's redirect allowlist. The
   GitHub OAuth callback stays `https://<project-ref>.supabase.co/auth/v1/callback`; do not change it
   to the Vercel host.
8. Verify the flow in section 7, including two-account isolation, CLI login/upload, headers, and
   mobile layout.
9. Record the exact hostname in `PROJECT_EXECUTION_STATUS.md` and `LIVE_DEPLOYMENT_REPORT.md` only
   after it exists.

Do not deploy before the isolation tests pass, and do not claim a live URL until the deployed flow
has been checked.

## 7. Post-deployment verification

- [ ] `/` and the public pages return 200 without requiring a session.
- [ ] `/dashboard` without a session redirects to `/login`.
- [ ] GitHub sign-in returns to the intended dashboard path, not an open redirect.
- [ ] A new profile row exists and belongs to the signed-in user.
- [ ] Connecting a repository stores only metadata and no GitHub token.
- [ ] `launchproof login` completes through the browser and reports Keychain/file storage.
- [ ] `launchproof status` shows the expected account and expiry.
- [ ] `launchproof scan . --upload` prints the preview and requires confirmation.
- [ ] A cancelled upload leaves the local report untouched.
- [ ] A failed upload leaves the local report untouched and reports the failure.
- [ ] The uploaded scan appears only for the uploading user.
- [ ] A second account cannot see the first account's repository, scan, findings, or download.
- [ ] Manipulated scan/repository UUIDs return 404 for the second account.
- [ ] Anonymous API requests return 401 and no private data.
- [ ] `launchproof logout` revokes the token; subsequent uploads fail.
- [ ] “Revoke all CLI tokens” in settings invalidates the CLI token.
- [ ] Account deletion removes the dashboard data and signs the browser out.
- [ ] Response headers include `Cache-Control: private, no-store` on private data.
- [ ] `Content-Security-Policy` is present, uses a per-request nonce, and contains no
      `unsafe-inline`/`unsafe-eval` in Production; the browser console shows no CSP violations.
- [ ] `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and `X-Content-Type-Options: nosniff` are
      present on the deployed host.
- [ ] Migration 003 is applied and the Postgres rate limiter is active; verify a 429 response and
      `Retry-After` without exhausting a real user's limit.
- [ ] No tokens, full local paths, source contents, or `.env` values appear in dashboard data,
      network requests, or server logs.

If any isolation check fails, stop and fix it before announcing or promoting the deployment.

## 8. Operations and retention

- There is no automatic upload, background job, analytics, or email system.
- Supabase and Vercel are the processors. Review their retention and log settings before production.
- Application code does not write scan contents or tokens to application logs. Platform access logs
  may still contain request metadata.
- Deleting an account cascades private rows and deletes the auth user. Local CLI files are not
  touched; run `launchproof logout` and remove the local report directory separately if desired.
- CLI tokens expire after seven days. Revoke them individually with `logout` or all at once in
  dashboard settings.
- Rotate the Supabase service-role key and OAuth client secret if either is exposed. Rotating the
  encryption key invalidates only outstanding connect cookies.

## 9. What is not implemented

- GitHub Actions integration or OIDC-based automatic uploads.
- GitHub App installation tokens or read-only private-repository scopes.
- Teams, organizations, roles, invitations, or shared repositories.
- Public share links, email notifications, billing, or usage plans.
- Production monitoring, alerting, or audit logs.
- A custom domain, DNS, or TLS setup beyond the host's generated certificate.

See [LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md) for the exact blocker list and
[DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) for the deployment checklist.
