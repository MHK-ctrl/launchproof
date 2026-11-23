# Phase 21.3 — Pre-Production Hardening Report

**Date:** 2026-11-23
**Branch:** `feat/cloud-dashboard`
**Base commit:** `215a3e2610c7385cdc804b709661fea29df7754e`
**Scope:** pre-production security hardening only. No Vercel deployment, hosted database
mutation, merge, tag, release, or npm publication was performed.

## 1. Outcome

Phase 21.3 materially improved the application's browser and server hardening. The main gaps that
remain are deployment-dependent or require an explicitly authorized hosted migration.

| Area                                                            | Status                | Evidence / limitation                                             |
| --------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Nonce-based CSP and security headers                            | **VERIFIED — LOCAL**  | Local production server headers and browser checks; unit tests    |
| Public-page rendering for CSP                                   | **VERIFIED — LOCAL**  | All app routes render dynamically (`ƒ`); build output             |
| Postgres/memory rate limiting                                   | **COMPLETED — LOCAL** | SQL and application tests; hosted function **NOT APPLIED**        |
| CLI token cleanup                                               | **COMPLETED — LOCAL** | SQL cleanup tests and failure-safe application test               |
| Account deletion / session handling                             | **COMPLETED — LOCAL** | Four account-deletion tests; cleanup failure is surfaced honestly |
| Structured logging / request IDs                                | **COMPLETED — LOCAL** | Three observability tests; no production log pipeline             |
| Migration ledger reconciliation                                 | **BLOCKED**           | Safe SQL and workflow prepared; owner action not authorized       |
| Migration `202611230003` on hosted Supabase                     | **BLOCKED**           | Prepared locally only; not applied                                |
| Vercel deployment and deployed-runtime checks                   | **BLOCKED**           | Initial Production deployment still unauthorized                  |
| Live OAuth, CLI, authenticated dashboard, two-account isolation | **NOT TESTED**        | Requires a deployed runtime and real provider flow                |
| CSP reporting endpoint / monitoring                             | **PROPOSED**          | No `report-uri` or `report-to` is configured                      |

There are no **COMPLETED — HOSTED** changes in this phase. Hosted Supabase remains in its Phase
21.2 state.

## 2. What changed

### 2.1 CSP and security headers

- `apps/web/proxy.ts` generates a fresh per-request nonce and a CSP with `strict-dynamic` for normal
  routes. It sets the nonce on the request so Next.js can attach it to framework scripts and styles.
- `apps/web/app/layout.tsx` calls `connection()`, making pages dynamic so the nonce always matches
  the rendered HTML. The production build confirms every app page is `ƒ` (dynamic); only
  `icon.svg` and `robots.txt` remain static.
- `apps/web/lib/security-headers.ts` owns the CSP builder and static headers:
  - no `unsafe-inline` or Production `unsafe-eval`;
  - `frame-ancestors 'none'`, `frame-src 'none'`, `object-src 'none'`;
  - `base-uri 'self'`, `form-action 'self'`, `media-src 'none'`;
  - `connect-src` limited to self plus the configured Supabase origin;
  - images limited to self, data/blob, and GitHub avatars;
  - HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy, and COOP.
- Static headers moved from `vercel.json` to `apps/web/next.config.ts`, so they apply locally and on
  any host rather than only on Vercel. `vercel.json` now contains only framework/install/build
  settings.
- The offline sample report had inline styles, an inline script, and four `style` attributes. It now
  uses same-origin `sample-report.css` and `sample-report.js`, with no inline script/style markup.
  Its path gets `script-src 'self'` without `strict-dynamic`; all other routes retain the stronger
  nonce policy. This exception is explicitly tests-covered and documented.

### 2.2 Rate limiting

- `apps/web/lib/rate-limit.ts` uses the atomic Postgres `consume_rate_limit` RPC when the admin
  client and migration are available.
- A bounded in-process fallback protects a single instance if the database path is unavailable. It
  is **not** a distributed security boundary.
- The client address is trusted only from `x-vercel-forwarded-for` when `VERCEL`/`VERCEL_ENV`
  indicates a verified Vercel runtime. Outside that runtime it is `local` or `unknown`; a
  caller-supplied `x-forwarded-for`/`x-real-ip` is ignored. Stored keys are SHA-256 hashes, not raw
  IPs.
- Limits added: CLI authorization start 10/min per user, CLI login 10/min per user, CLI exchange
  20/min per address, scan upload 30/min per user, repository connect 20/min per user, report
  download 60/min per user, account deletion 5/hour per user.

### 2.3 CLI token lifecycle

- `isCliTokenActive()` rejects revoked, expired, and malformed expiry values.
- `cleanup_cli_tokens(p_user_id)` deletes only that user's expired or revoked rows. The active token
  used for the request cannot match that predicate, so authentication cannot delete itself.
- `cleanupCliTokens()` runs opportunistically after valid authentication and treats database errors
  or missing functions as non-fatal. The token remains valid; cleanup is retried on a later request.
- The settings page now reports revocation success or failure instead of silently redirecting.

### 2.4 Account and session safety

- `apps/web/lib/account-deletion.ts` deletes the auth identity first, then explicitly deletes the
  tenant tables and profile. An auth failure is kept distinct from a cleanup failure.
- API responses use `account_delete_failed` for an auth failure and
  `account_cleanup_incomplete` when sign-in was removed but rows remain.
- The dashboard action signs out and clears the GitHub connect cookie when cleanup is incomplete,
  then sends the user to a public sign-in message rather than claiming deletion succeeded.
- Repository disconnect now clears the short-lived GitHub connect cookie and tells the user that
  GitHub's OAuth grant must be revoked in GitHub settings. The app does not claim it can revoke the
  provider grant itself.
- The GitHub `repo` scope remains broad. It is not described as read-only; a GitHub App would be
  required for finer private-repository permissions.

### 2.5 Observability

- `apps/web/lib/observability.ts` emits one JSON log line per event with a request ID, event name,
  level, timestamp, and limited safe metadata.
- Sensitive field names (tokens, cookies, authorization, bodies, reports, content, keys) are dropped
  as a second line of defence. Error logging records only the error name or a short safe code, never
  the raw message.
- 500 responses include a matching `x-request-id`. Logs still go to the platform's stdout/stderr;
  no external monitoring or alerting is configured.

### 2.6 Migrations

- `supabase/migrations/202611230003_security_hardening.sql` is additive and idempotent:
  - creates the server-only `rate_limits` table with RLS enabled and no client grants;
  - creates an expiry index;
  - creates the atomic `consume_rate_limit` function;
  - creates `cleanup_cli_tokens`;
  - grants execution only to `service_role`.
- `supabase/manual/20261123_reconcile_migration_ledger.sql` verifies expected tables, RLS, and the
  composite scan foreign key before inserting ledger rows for `202611230001` and `202611230002`. It
  does not re-run either migration.
- `supabase/MIGRATION_TRACKING.md` records the current hosted state, read-only checks, the
  reconciliation workflow, and the required order for applying `003`.

## 3. Verification performed

### 3.1 Full local verification

`npm run verify` passed with exit 0:

- Prettier check: all matched files formatted.
- ESLint: no errors.
- Core, browser, and CLI builds: passed.
- Typecheck for all workspaces: passed.
- Vitest: **20 test files, 105 tests passed**.
- Production web build: passed; every app page is dynamic and the proxy is recognized.

`npm audit --audit-level=high` reported **0 vulnerabilities**.

A secret-pattern scan over the Phase 21.3 diff and untracked files found **0 matches**.

### 3.2 Local production server

`next start -p 3100` served `/`, `/demo`, `/docs`, `/report`, `/security`, `/login`, and
`/sample-report.html` with HTTP 200. `/dashboard` redirected to
`/login?next=%2Fdashboard`.

Observed response behavior:

- CSP present with a fresh per-request nonce and `strict-dynamic` on normal routes.
- No `unsafe-inline` or `unsafe-eval` in the production policy.
- `upgrade-insecure-requests` appears when the request is HTTPS.
- `X-Frame-Options: DENY`, `nosniff`, HSTS, referrer policy, permissions policy, and COOP present.
- Sample report CSP uses `'self'` without `strict-dynamic`; its external CSS and JS load, the filter
  returns the expected one matching finding for `cors`, and the browser console reports no CSP
  violations.
- The public sign-in page renders the incomplete-cleanup message for
  `/login?error=account_cleanup`.
- The only observed browser console error on public pages was the expected 401 from `/api/account`
  when signed out.

### 3.3 Focused security tests

- `security-headers.test.ts`: 11 tests covering nonce policy, `strict-dynamic`, Supabase origin
  allowlisting, malformed URL handling, HTTPS upgrade, the sample-report exception, absence of inline
  markup, and static header values.
- `rate-limit.test.ts`: 11 tests covering memory behavior, concurrency, Postgres result handling,
  fallback behavior, invalid configuration, trusted-address rules, token validity, and cleanup
  failure safety.
- `security-hardening-sql.test.ts`: 8 tests executing the migration twice, enforcing atomic limits,
  window reset, bucket isolation, invalid input rejection, privilege denial, and per-user cleanup.
- `account-deletion.test.ts`: 4 tests covering auth failure, complete deletion, cleanup failure, and thrown exceptions.
- `observability.test.ts`: 3 tests covering request IDs, sensitive-field filtering, and redacted
  error logging.

## 4. Not verified or not completed

The following are explicitly **NOT TESTED** or **BLOCKED** and must not be inferred from local
results:

- No Vercel deployment exists. No production or preview URL, custom domain, HSTS behavior on Vercel,
  deployed CSP, deployed cookie behavior, or deployed performance measurement exists.
- Migration `003` is not applied to hosted Supabase. The hosted database limiter and token cleanup
  function are therefore not verified in production.
- `supabase_migrations.schema_migrations` is still absent in the hosted project. The reconciliation
  script has not been run.
- Live GitHub OAuth sign-in, repository consent, provider-token exchange, sign-out, and grant
  revocation are not tested.
- Live CLI login, token storage, upload, download, revocation, logout, and cleanup are not tested.
- Authenticated dashboard CSP behavior is not tested; only public pages were exercised in a browser.
- No deployed two-account browser isolation test exists. Hosted RLS passed 17/17 in Phase 21.2, but
  that is not a deployed application test.
- No external monitoring, alerting, audit log, MFA requirement, or scheduled cleanup job exists.
- CSP has no `report-uri`/`report-to`, so violations are visible only in a browser console.
- The rate-limit memory fallback is per instance and resets on deploy. If migration `003` is missing,
  limits are not globally enforced.
- Outside a verified Vercel runtime, unauthenticated CLI exchange uses a shared `local` bucket
  because caller-supplied address headers are not trusted. A self-hosted deployment should put a
  trusted proxy in front or accept that availability limitation; this is not an authentication
  bypass.
- The GitHub OAuth `repo` scope is broader than LaunchProof's read-only use of the API.

## 5. Readiness assessment

Phase 21.3 **materially improved security**:

- The app now has a strict, per-request CSP instead of no CSP.
- Static security headers apply locally and on any host.
- Rate limiting is atomic and shared when the Postgres migration is present, with a bounded fallback.
- Expired/revoked CLI tokens are cleaned up without letting cleanup failures break authentication.
- Account deletion and revocation failures are reported honestly rather than as success.
- Server errors are correlated and redacted instead of returning or logging raw provider errors.

It is **not accurate to call the application Production-ready yet**. The remaining blockers are
operational and deployment-specific:

1. Reconcile the migration ledger and apply migration `003` to hosted Supabase with owner
   authorization; verify the rate-limit function, `Retry-After` behavior, and token cleanup against
   the hosted project.
2. Deploy with explicit owner authorization. Because Vercel's first deployment is Production, this
   should be treated as a controlled first deployment with a rollback target, not a casual preview.
3. On the deployed host, verify CSP/nonce behavior, cookies, HSTS, OAuth, CLI upload/download,
   account deletion, two-account isolation, and logs.

Until those are done, the correct readiness statement is: **hardened and locally verified, but
Production authorization remains blocked on hosted migration and deployed-runtime verification.**
