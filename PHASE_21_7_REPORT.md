# Phase 21.7 — Initial Vercel Production Deployment and First Live Validation

**Date:** 2026-11-24
**Branch:** `feat/cloud-dashboard`
**Deployed commit:** `73912cf2d6d8aaf2d65c83cd89baf6079d92c274` (unchanged during this phase)
**Production origin:** `https://launchproof-rose.vercel.app`
**Production deployment:** `dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz`
**Deployment URL:** `https://launchproof-3gx32f5n4-hamza-recallai.vercel.app`
**Verdict:** **SUCCESSFULLY DEPLOYED — INITIAL VALIDATION PASSED**

No code was changed in this phase. The only changes were Vercel project build settings, two Vercel
Production values, Supabase Auth URL configuration, and documentation.

## A. Deployment summary

| Item             | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Host             | Vercel, team `hamza-recallai`, project `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`)                   |
| Target           | Production                                                                                                  |
| Branch / commit  | `feat/cloud-dashboard` / `73912cf2d6d8aaf2d65c83cd89baf6079d92c274`                                         |
| Status           | ● Ready                                                                                                     |
| Build duration   | 40 s (initial successful build: 41 s)                                                                       |
| Canonical domain | `https://launchproof-rose.vercel.app` (listed as **Production** in project Domains)                         |
| Deployment alias | `https://launchproof-hamza-recallai.vercel.app` (serves the same deployment; Vercel Authentication applies) |
| Region           | `iad1`                                                                                                      |
| Node.js          | `26.x` (local `26.0.0`)                                                                                     |
| Framework        | Next.js 16.4.6                                                                                              |
| Git integration  | Not connected; deployments are CLI-driven from the local commit                                             |
| `APP_BASE_URL`   | `https://launchproof-rose.vercel.app`, Production scope, Config type                                        |

### Attempts

1. `dpl_GJMQentPegb5joVDftjc2bj8dau8` — **FAILED** after 34 s with
   `[NEXT_OUTPUT_DIR_MISSING] The Next.js output directory ".next" was not found at
"/vercel/path0/.next"`. The Next.js build itself completed (full route table printed); Vercel
   expected `.next` in the repository root while the app builds into `apps/web/.next`.
2. `dpl_Hfw9vSnq1AnSKFv2ESRmkSzL7tLP` — **FAILED** after 13 s with
   `[BUILD_UTILS_SPAWN_1] Command "npm run build:web" exited with 1`. This attempt used Root
   Directory `apps/web`; the repository-root `vercel.json` still supplied the build command, which
   then ran inside `apps/web` where no `build:web` script exists.
3. `dpl_5gLuwQpZj5JefhYU4GeqFLt1738m` — **READY** in 43 s. Fix: keep Root Directory at the
   repository root and override the framework Output Directory to `apps/web/.next`.
4. `dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz` — **READY** in 40 s. Redeployment after setting
   `APP_BASE_URL`; this is the current Production deployment.

## B. Verification results

### Deployment and transport

| Check                                                     | Result                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `https://launchproof-rose.vercel.app/` over HTTPS         | **VERIFIED — PRODUCTION** (HTTP 200, TLS verification result 0)                       |
| Production deployment status                              | **VERIFIED — PRODUCTION** (`Ready`, target `production`)                              |
| Canonical domain listed as Production in project settings | **VERIFIED — HOSTED**                                                                 |
| Preview/deployment URLs require Vercel Authentication     | **VERIFIED — PRODUCTION** (`302` to Vercel SSO)                                       |
| No public caching of private routes                       | **VERIFIED — PRODUCTION** (`private, no-cache, no-store, max-age=0, must-revalidate`) |

### Public routes and health

All returned `200`: `/`, `/login`, `/demo`, `/docs`, `/get-started`, `/security`, `/report`,
`/robots.txt`, `/icon.svg`. An unknown path returned `404`.
`/api/health` returned `200` with `{"ok":true,"service":"launchproof-web","timestamp":"…"}`.

### Authentication gating without a session

| Request                         | Result                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `/dashboard`                    | `307` → `/login?next=%2Fdashboard` **VERIFIED — PRODUCTION**                      |
| `/dashboard/settings`           | `307` → `/login?next=%2Fdashboard` (see observation O1)                           |
| `/api/account`                  | `401 unauthorized`                                                                |
| `/api/repositories`             | `401 unauthorized`                                                                |
| `/api/scans`                    | `401 unauthorized`                                                                |
| `/api/cli/me`                   | `401` "A valid CLI token is required."                                            |
| `/api/cli/repositories`         | `401` "A valid CLI token is required."                                            |
| `/api/github/connect`           | `303` → `/login?next=/dashboard/repositories`                                     |
| `/api/cli/token` (PUT)          | `405`                                                                             |
| `/auth/signout` (GET)           | `405` (POST-only)                                                                 |
| `/auth/callback?code=…invalid…` | `303` → `/auth/error?reason=exchange_failed` (no token or provider detail echoed) |

### Security headers

Observed on `/`, `/login`, and the authenticated `/dashboard`:

- `content-security-policy` with a fresh per-request nonce, `strict-dynamic`, `frame-ancestors
'none'`, `object-src 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`;
- `strict-transport-security: max-age=31536000; includeSubDomains`;
- `x-frame-options: DENY`, `x-content-type-options: nosniff`;
- `referrer-policy: strict-origin-when-cross-origin`;
- `permissions-policy: camera=(), microphone=(), geolocation=()`;
- `cross-origin-opener-policy: same-origin`;
- authenticated dashboard additionally returned `x-robots-tag: noindex, nofollow, noarchive`.

Status: **VERIFIED — PRODUCTION**.

### Supabase Auth configuration

- Site URL changed from `http://127.0.0.1:3000` to `https://launchproof-rose.vercel.app`.
- Redirect allowlist now contains exactly:
  - `http://127.0.0.1:3000/auth/callback` (retained for local development);
  - `https://launchproof-rose.vercel.app/auth/callback` (new).
- No wildcard was added.
- GitHub OAuth callback remains `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`; the
  GitHub OAuth App was not modified and no secret was read or changed.
- Values persisted after a dashboard reload. Status: **VERIFIED — HOSTED**.

### GitHub sign-in and dashboard

Performed with the owner's existing GitHub account (`MHK-ctrl`); no disposable GitHub account was
available. No other user's data was accessed and no repository was connected.

- "Continue with GitHub" started the Supabase → GitHub authorize flow with scope `user:email` and
  `redirect_to=https://launchproof-rose.vercel.app/auth/callback?next=%2Fdashboard`.
- Authorizing returned to `/dashboard`; the Overview rendered with the signed-in account, empty
  repositories, empty scans, and the private-workspace disclosure.
- `/dashboard/repositories`, `/dashboard/scans`, `/dashboard/settings`, and `/dashboard/account`
  rendered without console errors.
- Authenticated API checks: `/api/account` `200` (account identity only), `/api/repositories` `200`
  with `[]`, `/api/scans` `200` with `total: 0`.
- Invalid authenticated upload (`POST /api/scans` with `{}`) returned `400 invalid_scan` and created
  no record.
- Sign-out from the dashboard returned to `/`; `/dashboard` then returned `307` to `/login` again and
  the Supabase session was cleared.

Status: **VERIFIED — PRODUCTION**.

### CLI

The CLI was run against production with an isolated configuration directory
(`LAUNCHPROOF_CONFIG_DIR` in the system temp directory) and
`LAUNCHPROOF_NO_KEYCHAIN=1`, so nothing was written to the macOS Keychain or the home directory.

- `launchproof login --no-browser` produced a loopback + PKCE approval URL; approving it in the
  signed-in browser completed the loopback callback.
- Token was stored in a `0600` config file; the CLI reported the 7-day expiry.
- `launchproof status` returned the production API URL, `GitHub: MHK-ctrl`, and the token expiry.
- `launchproof scan <dir> --upload` completed the local scan but upload was **refused** with
  "No active repositories are connected to your account", which is the intended behavior when no
  repository is connected; the local report was preserved.
- `launchproof logout` revoked the token server-side and deleted the local credential file; the
  dashboard then showed `Active CLI tokens: 0`.
- Temporary scan output (`.launchproof/`) is gitignored and the worktree remained clean.

Status: login, token storage, session status, revocation — **VERIFIED — PRODUCTION**. Upload,
download, and repository association — **NOT TESTED** (see E).

### Failures

None active. Two failed deployment attempts occurred and were resolved without a code change
(see A). Observations:

- **O1 (low, UX):** signed-out `/dashboard/settings` redirects with `next=%2Fdashboard`, so the deep
  path is not preserved. No security impact; not changed in this phase.
- **O2 (low, hardening):** the Supabase browser client's session cookies are `HttpOnly=false` and
  `Secure=false` on the production origin (library default: client-managed cookies). Exposure is
  mitigated by the nonce-based CSP with `strict-dynamic` and no inline scripts, but setting
  `cookieOptions` (`secure`, `sameSite`) would be worthwhile hardening. Not changed in this phase.

## C. Failures with evidence and severity

| ID  | Severity                             | Item                                    | Evidence                                                                                                      | Resolution                                 |
| --- | ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F1  | High (deployment-blocking, resolved) | `.next` not found at repository root    | `[NEXT_OUTPUT_DIR_MISSING] … "/vercel/path0/.next"`; build log shows a completed Next build                   | Output Directory override `apps/web/.next` |
| F2  | High (deployment-blocking, resolved) | Build command run from `apps/web`       | `[BUILD_UTILS_SPAWN_1] Command "npm run build:web" exited with 1`; npm "Missing script" in `@launchproof/web` | Root Directory reverted to repository root |
| O1  | Low                                  | `next` loses deep dashboard path        | `307 /login?next=%2Fdashboard` for `/dashboard/settings`                                                      | Open; cosmetic                             |
| O2  | Low                                  | Session cookies not `HttpOnly`/`Secure` | `document.cookie`/context cookie inspection on the production origin                                          | Open; hardening recommendation             |

## D. Security assessment

- Private data is server-gated: dashboard pages redirect when signed out, and every private API
  returned `401`; CLI endpoints do not accept a browser session.
- Private responses carry `no-store` and `noindex`; no private data was observed on public routes.
- The CSP nonce changes per request and matches the rendered document; HSTS, `X-Frame-Options:
DENY`, `nosniff`, `Referrer-Policy`, and `Permissions-Policy` are present in production.
- Auth errors are sanitized (`exchange_failed` with no provider or token detail), and the invalid
  upload response is a generic validation error.
- Production origin is reachable; deployment/preview URLs are protected by Vercel Authentication.
- No secret was printed, logged, committed, or screenshotted. Environment checks were limited to
  names, scopes, and types.
- Hosted database state was not mutated in this phase beyond Supabase Auth URL settings and the
  automatic profile row created for the owner's sign-in.
- **Not security-certified.** Cross-tenant isolation with two live accounts, authenticated CSRF
  behavior, live rate-limit enforcement, and account deletion were not exercised.

## E. Untested areas

- Two-account browser/API isolation against production (only one account was used).
- GitHub repository connect/consent, encrypted provider-token cookie, and repository metadata fetch
  (requires installing/authorizing the GitHub App and selecting a repository — an external state
  change outside this phase's scope).
- CLI `scan --upload`, report download, and "revoke all" (upload correctly refused with no connected
  repository).
- Account deletion and its cascading behavior.
- Live rate limiting (30 uploads/min, 10 CLI starts/min, 20 exchanges/min) — not load-tested, by
  instruction.
- Authenticated cross-origin request rejection: the browser cannot forge `Origin`, and the API checks
  authentication before origin, so only the code path from Phase 21.6 supports this.
- Deployment performance/load, mobile layout, accessibility, and Vercel runtime-log review.
- Supabase management API, backup/restore, and scheduled cleanup jobs.

## F. Git status

- Branch `feat/cloud-dashboard`, HEAD `73912cf2d6d8aaf2d65c83cd89baf6079d92c274`, identical to
  `origin/feat/cloud-dashboard` at deployment time.
- Worktree clean before and after the live tests; no source change was made in this phase.
- This phase adds documentation only: this report plus updates to `PROJECT_EXECUTION_STATUS.md`,
  `DEPLOYMENT_READINESS.md`, `LIVE_DEPLOYMENT_REPORT.md`, and the deploy section of
  `CLOUD_DASHBOARD_SETUP.md`.
- No merge to `main`, tag, GitHub release, npm publish, database reset, or deletion of user data.

## G. Verdict

**SUCCESSFULLY DEPLOYED — INITIAL VALIDATION PASSED**

Production serves the authorized commit at `https://launchproof-rose.vercel.app`; public routes,
health, signed-out gating, security headers, Supabase Auth URLs, GitHub sign-in, the private
dashboard, authenticated read APIs, CLI login/status/revocation, and sign-out all behaved as
designed. Remaining untested items are listed in E and require a second account, a connected
repository, or load testing. This is not a claim of production hardening or independent security
certification.
