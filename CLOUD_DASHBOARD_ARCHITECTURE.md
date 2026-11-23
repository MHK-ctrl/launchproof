# Cloud Dashboard Architecture

**Status:** implemented; hosted Supabase schema and RLS verified after OAuth secret rotation; Phase
21.3 CSP, rate limiting, token cleanup, and observability are implemented and tested **locally**; not
deployed. The initial Vercel Production deployment is awaiting explicit owner authorization. Local
scanning remains fully functional without any cloud configuration.

This document describes what is actually implemented, not a future design. The dashboard is optional:
the public site is static, and every local CLI scan still works with no account, database, or network
upload.

## 1. Components

```text
Browser (public pages, dashboard, CLI approval)
        |
        | HTTPS, Supabase session cookies
        v
Next.js 16 App Router on Vercel
  - public pages (dynamic render for per-request CSP nonce)
  - /dashboard/* (dynamic, authenticated)
  - /auth/* and /api/* route handlers
  - Supabase SSR client, admin client for narrow server operations
        |
        +---------------------------+
        |                           |
        v                           v
Supabase Auth                 Supabase PostgreSQL
(GitHub provider)             (profiles, repositories,
                               scans, findings,
                               CLI requests/tokens)
        ^
        | OAuth callback
        |
GitHub OAuth (sign-in + separate repository consent)

LaunchProof CLI ---- HTTPS bearer token ----> /api/scans, /api/cli/*
        |
        +---- browser loopback callback (127.0.0.1) for one-time CLI authorization
```

- **Next.js on Vercel** is the only application server. There is no separate API service, queue,
  worker, cron job, or websocket.
- **Supabase Auth** owns GitHub sign-in. The application never asks for a GitHub password or personal
  access token.
- **Supabase PostgreSQL with RLS** is the tenant boundary for dashboard reads and user-scoped writes.
- **The CLI** speaks to the same `/api` routes. It has no database credentials.
- **GitHub REST API** is called server-side only, with a short-lived provider token, to list and
  verify repositories.

## 2. Authentication flows

### 2.1 Dashboard sign-in

1. `/login` starts Supabase GitHub OAuth with a `next` path. The path is normalized by
   `safeNextPath`; it must be a same-origin absolute path.
2. Supabase redirects to GitHub, then back to `/auth/callback?code=...`.
3. The callback exchanges the code with Supabase, sets the Supabase session cookies through the SSR
   client, synchronizes the `profiles` row, and redirects to the validated `next` path.
4. `/dashboard/*` calls `requireUser()`. Unauthenticated requests are redirected to
   `/login?next=...`.
5. The root layout does **not** read auth cookies, but it calls `connection()` so every page is
   rendered per request and can receive the proxy's CSP nonce. Public pages remain cacheable only as
   explicitly configured; private routes are `no-store`. The site header fetches `/api/account` from
   the browser to show signed-in state.

`apps/web/proxy.ts` refreshes Supabase cookies on application requests. It is a cookie-maintenance
proxy, not the authorization boundary. Every dashboard page, server action, and API route checks the
session again on the server.

### 2.2 GitHub repository connection

GitHub's OAuth model has no read-only scope for private repositories. LaunchProof therefore separates
two consents:

1. **Sign-in** uses the Supabase GitHub provider.
2. **Repository connection** starts at `/api/github/connect`, which calls
   `signInWithOAuth({ provider: 'github', scopes: 'repo', redirectTo: '/auth/callback?connect=github' })`.
   The user sees GitHub's own consent screen.

The callback receives a GitHub provider token. It stores the token **only** in an encrypted,
HttpOnly, SameSite=Lax cookie (`lp_github_connect`) for 15 minutes. The cookie payload is
AES-256-GCM-encrypted and bound to the authenticated user ID. It is never written to the database,
logs, or browser JavaScript. Sign-out and account deletion clear it.

The `repo` scope is broad: it can grant read/write access to public and private repositories. The
LaunchProof server only issues GitHub **GET** requests to list repositories and fetch metadata
(`/user/repos`, `/repositories/:id`). It does not push, modify, or delete anything. The scope cannot be
made read-only for private repositories without migrating to a GitHub App, which is **not**
implemented.

### 2.3 CLI authorization

The CLI uses a browser-mediated loopback flow with PKCE and a one-time code:

1. `launchproof login` starts a server on `127.0.0.1:<ephemeral-port>` and opens
   `/cli/login?state=...&challenge=...&port=...`.
2. The user signs in through the normal Supabase session. The `/cli/login` page requires an explicit
   **Authorize CLI** button; a GET request does not create a request row.
3. A server action inserts a `cli_auth_requests` row with the state, code hash, PKCE challenge,
   loopback port, and ten-minute expiry. It redirects to `/cli/authorize`.
4. `/cli/authorize` queries the request with both `id` and `user_id`, shows the loopback port and
   expiry, and requires a second explicit approval. Approval marks `approved_at`; it does not mint a
   token.
5. The browser redirects to `http://127.0.0.1:<port>/callback?code=...&state=...`. The CLI checks the
   state, then exchanges the code and PKCE verifier at `/api/cli/token`.
6. The server atomically claims the authorization request (`consumed_at is null`, `approved_at not
null`, unexpired) before inserting a token. A token is `lp_cli_` plus 32 random bytes, stored only
   as a SHA-256 hash. Tokens expire after seven days and can be revoked individually through
   `logout` or all at once from dashboard settings.
7. The CLI stores the plaintext token in the macOS Keychain when available, otherwise in a mode-0600
   file. It never prints the token. `LAUNCHPROOF_CLI_TOKEN` can supply a token for CI; that token is
   still server-revocable.

The callback listener is bound to `127.0.0.1`, not all interfaces. The exchange endpoint rate-limits
by client address and rejects a mismatched state, verifier, code, expiry, or consumed request.

## 3. Data model

The migration is `supabase/migrations/202611230001_cloud_dashboard.sql`.

| Table               | Purpose                                   | Tenant key                  |
| ------------------- | ----------------------------------------- | --------------------------- |
| `profiles`          | GitHub identity mirror for each auth user | `id` = `auth.users.id`      |
| `repositories`      | Connected GitHub repository metadata      | `user_id`                   |
| `scans`             | Sanitized scan summaries                  | `user_id` + `repository_id` |
| `findings`          | Sanitized finding rows                    | `user_id` + `scan_id`       |
| `cli_auth_requests` | Short-lived one-time CLI authorizations   | `user_id`                   |
| `cli_tokens`        | Hashed, expiring, revocable CLI tokens    | `user_id`                   |

Important constraints:

- `profiles.id` references `auth.users(id) on delete cascade`.
- Every tenant table cascades from `profiles`, so deleting the auth user removes dashboard data.
- `scans` uses a composite foreign key `(user_id, repository_id)` to
  `repositories(user_id, id)`. A scan cannot attach to another user's repository even if a malicious
  payload supplies a valid repository UUID.
- `findings` uses `(user_id, scan_id)` to `scans(user_id, id)`. A finding cannot attach to another
  user's scan.
- Unique constraints include `(user_id, github_repository_id)`, `(user_id, client_scan_id)`, and
  `(scan_id, finding_key)`.
- `repository_scan_stats` is a `security_invoker` view, so it returns only rows the caller may read
  under RLS.

`scans` stores counts, gate, status, timestamps, commit/branch, checks JSON, limitations JSON, and
summary JSON. `findings` stores rule ID, severity, title, sanitized description, category,
remediation, a relative file path, and a line number. It does not store raw source, evidence values,
HTTP bodies, environment values, or absolute paths.

Migration `202611230003_security_hardening.sql` adds a server-only `rate_limits` table (RLS enabled,
no client grants), an expiry index, and two functions: `consume_rate_limit` for atomic fixed-window
counters and `cleanup_cli_tokens` for bounded per-user removal of expired/revoked CLI tokens. The
migration is additive and idempotent. It is tested locally but **not applied** to hosted Supabase; the
safe application workflow is in `supabase/MIGRATION_TRACKING.md`.

## 4. Request paths and authorization

### Dashboard reads

Dashboard pages create a request-scoped Supabase SSR client with the user's cookies. Queries do not
filter by a client-supplied user ID; RLS restricts rows by `auth.uid()`. Pages additionally check the
returned row's `user_id` before rendering a scan or repository detail. A missing or cross-tenant row is
rendered as **not found**, not as a permission error that would confirm existence.

### Repository connection writes

`POST /api/repositories` requires a session and a same-origin request. It reads the encrypted connect
cookie only if it belongs to the current user, calls GitHub for the requested repository ID, and then
upserts into `repositories` with `user_id` from the verified session. The client cannot choose the
owner.

### Scan upload

`POST /api/scans` accepts two authentication methods:

- **CLI bearer token:** the hash is resolved server-side. The admin client is used only after that
  resolution, and `storeScanForUser` verifies the repository belongs to `cli.userId`. The insert uses
  that server-derived user ID; a JSON `user_id` field is rejected by the strict schema.
- **Browser session:** the session user ID is used and the request must be same-origin.

The payload is parsed by a strict Zod schema (unknown keys rejected), size-limited to 2 MB, capped at
300 checks and 2,000 findings, and normalized server-side. The server recomputes the security gate from
severity counts and status instead of trusting a client-provided pass flag.

`GET` scan lists/details, findings, downloads, repository lists, and account data all use the
session-scoped client or explicitly filter by the verified user. Download responses are
`Cache-Control: private, no-store` and include only the sanitized cloud summary, not local evidence.

### Account deletion

`DELETE /api/account` and the account page server action require a session, same-origin for the API,
and the literal confirmation `DELETE` for the form. The auth user is deleted first; database rows
cascade from `profiles`. The session and GitHub connect cookie are then cleared. A failure leaves the
account intact and reports an error rather than deleting data while leaving a usable login.

## 5. API surface

| Method | Path                          | Auth                                      |
| ------ | ----------------------------- | ----------------------------------------- |
| GET    | `/api/account`                | session                                   |
| DELETE | `/api/account`                | session + same-origin                     |
| GET    | `/api/health`                 | public, no tenant data                    |
| GET    | `/api/repositories`           | session                                   |
| POST   | `/api/repositories`           | session + same-origin                     |
| GET    | `/api/repositories/:repoId`   | session                                   |
| DELETE | `/api/repositories/:repoId`   | session + same-origin; marks disconnected |
| GET    | `/api/scans`                  | session                                   |
| POST   | `/api/scans`                  | session or CLI bearer                     |
| GET    | `/api/scans/:scanId`          | session                                   |
| DELETE | `/api/scans/:scanId`          | session + same-origin                     |
| GET    | `/api/scans/:scanId/findings` | session                                   |
| GET    | `/api/scans/:scanId/download` | session                                   |
| POST   | `/api/cli/token`              | session (start) / code                    |
| GET    | `/api/cli/me`                 | CLI bearer                                |
| POST   | `/api/cli/logout`             | CLI bearer                                |
| GET    | `/api/cli/repositories`       | CLI bearer                                |

All tenant responses set private/no-store cache headers. API errors use a stable
`{ error: { code, message } }` shape and avoid returning database or GitHub provider details.

## 6. Runtime and deployment shape

- `apps/web/next.config.ts` uses the normal Next.js server output, not `output: "export"`.
- `vercel.json` sets `framework: "nextjs"`, `npm ci`, and `npm run build:web`. Static security
  headers live in `apps/web/next.config.ts`; the CSP is generated per request in `apps/web/proxy.ts`.
- All routes are server-rendered per request because the CSP nonce must match the rendered HTML;
  private routes are dynamic and `no-store`.
- Required server environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_URL`, `LAUNCHPROOF_ENCRYPTION_KEY`.
- Vercel currently has the first four values in Preview and Production except `APP_BASE_URL`, which
  is intentionally unset until the real deployment origin exists. The service-role and encryption
  keys are server-only Secret variables; the two `NEXT_PUBLIC_*` values are Config variables.
- Optional CLI environment: `LAUNCHPROOF_API_URL` (defaults to `http://127.0.0.1:3000`).
- Plain HTTP API URLs are refused for non-loopback hosts.

See [CLOUD_DASHBOARD_SETUP.md](CLOUD_DASHBOARD_SETUP.md) for provisioning and
[MULTI_TENANT_SECURITY_DESIGN.md](MULTI_TENANT_SECURITY_DESIGN.md) for the isolation model and test
evidence.

## 7. Explicit non-goals

- No GitHub App installation flow, fine-grained repository permissions, or read-only private repo
  scope.
- No GitHub Actions integration or OIDC token exchange. Workflows cannot upload scans automatically.
- No automatic upload at the end of a scan. `--upload` is required.
- No source archive, raw file, evidence body, environment value, or secret upload.
- No org/team sharing, roles, invitations, or multi-user repository access.
- No public scan sharing links.
- No analytics, telemetry, background jobs, or email notifications.
- No billing or paid plan setup.

Deployment is currently blocked on the explicit owner authorization required for Vercel's initial
Production deployment. The Supabase and Vercel credentials are configured, and `APP_BASE_URL` will be
set only after the real origin exists. See [LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md)
for the no-deployment state and [PHASE_21_2_REPORT.md](PHASE_21_2_REPORT.md) for the readiness
evidence.
