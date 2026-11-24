# Phase 21.8 — Post-Deployment Functional, Tenant-Isolation and Security Validation

## A. Executive summary

**Objective:** prove, against the live production application, that LaunchProof's authentication,
GitHub integration, CLI, dashboard, and multi-tenant authorization behave correctly and that one
user cannot read, modify, download, or delete another user's data.

- **Production URL:** https://launchproof-rose.vercel.app
- **Production deployment:** `dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz` (target Production, Ready), commit
  `73912cf2d6d8aaf2d65c83cd89baf6079d92c274` — unchanged during this phase.
- **Working branch / base commit:** `feat/cloud-dashboard` / `f97edb095762c450dff584edb86e9fe4fbd3f0e1`
  (Phase 21.7 documentation commit; distinct from the deployed commit).
- **Overall verdict:** **PRODUCTION VALIDATION PASSED WITH NON-BLOCKING ISSUES**
- **No deployment was made.** Source fixes for two P3 observations are committed locally and not
  deployed, as required by the phase rules.

Tenant isolation passed at both the application-API and database-RLS layers with two disposable
synthetic identities. CSRF/origin rejection, malformed-input handling, per-user rate limiting,
account deletion, CLI-token scoping/revocation, and sign-out all behaved as designed. Runtime logs
showed no errors or secret leakage. GitHub repository connection and a CLI upload against a connected
repository could not be completed because GitHub required sudo-mode/2FA confirmation, which was not
available; that blocker is documented and no partial GitHub state was created.

## B. Test summary

| Result       | Count |
| ------------ | ----- |
| PASS         | 127   |
| FAIL         | 0     |
| WARN         | 2     |
| SKIPPED      | 0     |
| NOT VERIFIED | 6     |
| ERROR        | 0     |
| **Total**    | 135   |

A check counts once per recorded assertion (route/status pair, API authorization attempt, workflow
step, or session/cookie observation). Source-reviewed items are not counted as runtime passes. The
machine-readable, sanitized record is
[`supabase/manual/PHASE_21_8_VALIDATION.json`](supabase/manual/PHASE_21_8_VALIDATION.json).

## C. Authentication and session results

- GitHub sign-in through Supabase completed; the dashboard loaded as `MHK-ctrl`. `/api/account`
  returned only the authenticated identity.
- Session refresh worked across navigation and same-origin fetches; no redirect loop appeared.
- Sign-out removed the Supabase session cookies; `/dashboard` then returned `307` to
  `/login?next=%2Fdashboard` and private APIs returned `401`.
- A signed-in request to `/login?next=https://evil.example` and `/login?next=//evil.example`
  normalized to `/dashboard`; the hostile value appeared only inside Next's serialized request
  metadata, never as a link or redirect target.
- Invalid `/auth/callback` codes redirect to `/auth/error?reason=exchange_failed` with no provider
  or token detail.
- **O1 (deep-link redirect)** was reproduced on all six dashboard routes: every signed-out request
  redirected with `next=/dashboard` because `app/dashboard/layout.tsx` called
  `requireUser('/dashboard')` before the page-level `requireUser(<own path>)` could run. The cause
  and fix are in section K.
- **O2 (session cookies):** the cookie is
  `sb-ypqpqgnviphwxddrpieq-auth-token.0/.1`, `HttpOnly=false`, `Secure=false`, `SameSite=Lax`,
  domain `launchproof-rose.vercel.app`, path `/`. It is client-managed by `@supabase/ssr` so the
  browser SDK can refresh the session; this is an architectural trade-off, not automatically a
  vulnerability, and CSP does **not** replace `HttpOnly`. `Secure=false` on production HTTPS is an
  avoidable weakness and is fixed locally (section K). PKCE verifier cookies share the same
  attributes.

## D. GitHub integration results

- **Initiation:** `GET /api/github/connect` while signed in returned `303` to GitHub's authorize
  endpoint with Supabase's callback and `redirect_to` pointing at
  `/auth/callback?next=/dashboard/repositories/connect&connect=github`.
- **Requested scopes:** `user:email read:user repo`. This matches the documented integration
  (`repo` is required to enumerate private repository metadata; the server uses GET only). GitHub's
  consent screen showed "Personal user data (read-only)" and "Repositories: Public and private".
  The grant is broad at GitHub even though LaunchProof only reads; the documented alternative is to
  avoid connecting private repositories.
- **Completion:** **NOT VERIFIED — BLOCKED.** After authorizing, GitHub required sudo mode and
  offered only "Use GitHub Mobile" 2FA; no owner device was available. No consent was completed and
  no provider token was minted or stored.
- **Provider-token cookie, repository listing, selection, persistence, disconnect:** **NOT
  VERIFIED** because the consent step could not finish. Source inspection confirms the token is
  AES-encrypted into an `HttpOnly`, `SameSite=Lax`, 15-minute, user-bound cookie and is never written
  to the database; that behavior was not exercised live.
- **Cleanup:** no repository association or GitHub grant was created, so none needed removal.

## E. CLI results

Run with an isolated temporary config directory and `LAUNCHPROOF_NO_KEYCHAIN=1`; no owner Keychain
entry or normal config was touched.

- **Login:** loopback listener + PKCE succeeded; approval redirect completed; token stored in a
  mode-`0600` file. One-time exchange replay returned `400 invalid_grant` in the API-level test.
- **Status:** reported the production API URL, `GitHub: MHK-ctrl`, and the 7-day expiry; no token
  printed.
- **Local scan:** completed on the repository (`4 pass, 1 fail, 2 warn, 1 skipped`; 1 high, 1 medium,
  2 low findings) and wrote a local report. No network upload occurred.
- **Explicit upload:** correctly refused — "No active repositories are connected to your account";
  the local report was preserved and no scan row was created. This is the documented behavior when
  no repository is connected; the real upload path could not be exercised because section D is
  blocked.
- **Logout:** revoked the token server-side and deleted the local credential; `status` then failed
  with "Not signed in"; Settings showed `Active CLI tokens: 0`.
- **Upload/download via the API (not the CLI binary):** verified with a synthetic identity — bearer
  upload `201`, dashboard list/detail/findings, and an authorized report download with
  `Content-Type: application/json`, a safe `Content-Disposition` filename, and `Cache-Control:
private, no-store`.

## F. Dashboard results

- Overview, Repositories, Scans, Settings, and Account rendered for the owner with correct empty
  states; no console/CSP errors beyond expected signed-out `401`s.
- With the synthetic identity: repository name, scan timestamp, gate status, findings, severity, and
  file/line were correct; a second scan from a CLI bearer token appeared in the same account.
- Downloads were authorized server-side on every request: owner `200`, other identity `404`, signed
  out `401`; invalid IDs `404`; content included the sanitized finding and no local paths, secrets,
  or stack traces.
- Delete/disconnect endpoints were owner-scoped by `user_id`; a foreign identity received `404`.
- No cross-tenant counts, names, or findings leaked through list, detail, findings, download, or
  aggregate dashboard queries.

## G. Tenant-isolation matrix

User A = disposable synthetic identity A; User B = disposable synthetic identity B. Both sessions
were independent cookies; bearer tokens were independently minted.

| #   | Action (User A against User B)  | Expected         | Observed                   |
| --- | ------------------------------- | ---------------- | -------------------------- |
| I07 | List repositories               | own only (empty) | `200 []`                   |
| I08 | Read B repository by ID         | 404              | `404`                      |
| I09 | Disconnect B repository         | 404              | `404`                      |
| I10 | List scans                      | own only (0)     | `200 total 0`              |
| I11 | Read B scan by ID               | 404              | `404`                      |
| I12 | Read B findings                 | 404              | `404`                      |
| I13 | Download B report               | 404              | `404`                      |
| I14 | Delete B scan                   | 404              | `404`                      |
| I15 | Upload into B repository        | 404              | `404 repository_not_found` |
| I16 | Inject `user_id` in upload body | 400              | `400 invalid_scan`         |
| I17 | RLS: select B repository        | `[]`             | `[]`                       |
| I18 | RLS: select B scan              | `[]`             | `[]`                       |
| I19 | RLS: select B findings          | `[]`             | `[]`                       |
| I20 | RLS: select B profile           | `[]`             | `[]`                       |
| I21 | RLS: update B repository        | 0 rows           | `200 []`                   |
| I22 | RLS: update B profile           | 0 rows           | `200 []`                   |
| I23 | B re-reads own repository       | unchanged        | active, unmodified         |
| I24 | B re-reads own profile          | unchanged        | unmodified                 |

B's own operations all succeeded (`201` repository, `201` scans, `200` reads/downloads), proving the
denials above were authorization, not a broken fixture. **Tenant isolation verdict: PASS.**

## H. CSRF and rate-limit results

Every authenticated state-changing route rejects a cross-origin `Origin` (and a missing one) before
doing work:

| Endpoint                     | Method | Cross-origin | Missing origin | Other checks                             |
| ---------------------------- | ------ | ------------ | -------------- | ---------------------------------------- |
| `/api/scans`                 | POST   | 403          | 403            | text/plain 415; bad JSON 400; 2.1 MB 413 |
| `/api/repositories`          | POST   | 403          | —              | invalid body 400                         |
| `/api/repositories/[repoId]` | DELETE | 403          | —              | `404` for foreign ID                     |
| `/api/scans/[scanId]`        | DELETE | 403          | —              | `404` for foreign ID                     |
| `/api/cli/token`             | POST   | 403          | —              | valid same-origin 200; replay 400        |
| `/auth/signout`              | POST   | 403          | —              | unauthenticated 403                      |
| `/api/account`               | DELETE | 403          | —              | unauthenticated 401; GET 200, POST 405   |

Bearer-token CLI uploads intentionally skip the origin check because they are not cookie-authenticated;
the token is validated per request. CORS is not used as the CSRF defense.

**Rate limit (live):** `GET /api/scans/{uuid}/download`, keyed per user, 60 per 60 s. In one window,
requests 1–60 returned `404` (no such scan) and request 61 returned
`429 {"error":{"code":"rate_limited","message":"Too many report downloads."}}` with `Retry-After:
47`; the database bucket showed `count: 61`. A second user's download in the same period returned
`200`, confirming the window is user-scoped. Limits were exercised only on disposable identities; the
owner account's limits were not exhausted.

## I. Account deletion

Both disposable identities were deleted through the application (`DELETE /api/account`, same-origin).

- Deletion returned `200 {"deleted":true}`; the old cookie then returned `401`.
- All dependent rows reached zero: `profiles`, `repositories`, `scans`, `findings`, `cli_tokens`,
  `cli_auth_requests`.
- The Supabase Auth user returned `404 user_not_found`.
- The deleted user's still-signed JWT returned `[]` from RLS-protected reads (no data, no error
  leakage).
- The owner account and its data were untouched (1 profile, 0 repositories/scans/findings, 1 auth
  user).

## J. Production reliability

- `/api/health` returned `200` throughout; the public origin stayed `200` with valid TLS.
- Vercel runtime logs for the validation window: 103 records, **all level `info`**, no errors,
  exceptions, stack traces, RLS failures, connection errors, or secret-like strings. The platform's
  per-request logs carry no status code, so 5xx absence is also inferred from the recorded HTTP
  responses, not from log status fields.
- Browser console errors were limited to expected signed-out `401 /api/account`, a loopback
  `/favicon.ico` 404, and a connection-refused after the CLI loopback listener closed.
- No rate-limit backend failures were observed; bucket rows incremented as expected.

## K. Security findings

**No P0, P1, or P2 findings.**

| ID   | Severity | Component                         | Evidence                                                     | Root cause                                                                                               | Impact                                                                                                                        | Fix / mitigation                                                                                                                                                                                               | Regression test                                                                                             | Production affected         |
| ---- | -------- | --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| F-01 | P3       | Dashboard deep-link redirect (O1) | `/dashboard/settings` etc. → `307 /login?next=%2Fdashboard`  | `dashboard/layout.tsx` redirected with a hard-coded `/dashboard` before the page's `requireUser(<path>)` | Signed-out users lose their destination and land on Overview after login                                                      | Proxy now copies the requested path into `x-launchproof-path`; the layout passes it to `requireUser`; external/protocol-relative values still fall back                                                        | `packages/core/test/web-auth-cookies.test.ts` (6 tests) + local production-server check of four deep routes | Yes, until a new deployment |
| F-02 | P3       | Supabase session cookies (O2)     | `sb-…-auth-token.0/.1` with `Secure=false`, `HttpOnly=false` | `@supabase/ssr` client-managed cookies use defaults                                                      | Over HTTP the token could be sent in clear; JS-readable cookie is exposed to XSS (CSP limits but does not replace `HttpOnly`) | `cookieOptions.secure` now derives from the origin (HTTPS true, local HTTP false) in browser, server, and proxy clients; `HttpOnly` remains a documented architectural trade-off, not claimed as CSP-mitigated | Unit tests for HTTPS/HTTP/malformed origins                                                                 | Yes, until a new deployment |
| F-03 | P3       | Dashboard mobile layout           | At 390 px: `scrollWidth 577`; Settings/Account off-screen    | Dashboard nav is a single non-wrapping row                                                               | Horizontal scroll and clipped navigation on phones                                                                            | Recommended: allow the nav to wrap or scroll horizontally; **not changed** in this phase                                                                                                                       | —                                                                                                           | Yes                         |
| F-04 | Info     | GitHub OAuth scope                | Consent asks for `repo` (all public/private repositories)    | GitHub has no read-only private-repo OAuth scope                                                         | Broad grant if a user connects a private repo                                                                                 | Documented: connect only repositories you accept sharing metadata for; revoke in GitHub settings; a GitHub App would narrow scopes                                                                             | —                                                                                                           | Yes (by design)             |

O1 and O2 are fixed on `feat/cloud-dashboard` but **not deployed**, so production still exhibits
them. `npm run verify` passed (exit 0) and `npm test` reported 21 files / 115 tests.

## L. Remaining risks and limitations

- **GitHub integration is unverified end to end.** The sudo/2FA gate blocked consent, so the
  encrypted provider-token cookie, repository listing/selection/persistence, disconnect, and the
  "connect only the intended repository" behavior were not exercised against production. The code
  was inspected only.
- **CLI upload/download against a connected repository is unverified.** The CLI's explicit-upload
  guard worked, and the same server endpoint was verified with a synthetic identity's bearer token,
  but the CLI binary never completed an upload or download.
- **Revoke-all CLI tokens is unverified.** The control was disabled with zero active tokens; the
  owner's tokens were not revoked as instructed, and the synthetic tokens had already been revoked
  individually.
- **Deployed fixes are pending.** Production remains pinned to `73912cf`; F-01 and F-02 are only on
  the branch.
- **Cookie architecture trade-off.** `HttpOnly=false` is inherent to the current client-managed
  session design. Moving to server-managed sessions would be an authentication rewrite and was not
  attempted. CSP with per-request nonces and `strict-dynamic` reduces but does not eliminate the
  consequence of an XSS.
- **Rate-limit testing is timing-sensitive.** Verification used batched requests; a single burst of
  61 concurrent requests left several client connections pending past the script timeout even though
  the database counted them. This is a test-harness observation, not evidence of a bypass; no load
  testing was performed.
- **Monitoring, alerting, backups, and log retention** are not configured. Runtime logs lack request
  status codes, limiting incident reconstruction.
- **Only one real account exists.** Two-account isolation was proven with synthetic email/password
  identities, not with two real GitHub accounts.
- **Leftover owner rows from earlier phases:** two expired `cli_auth_requests` entries from Phase
  21.7 remain (one consumed, one expired). They contain no active credential and were not created by
  this phase.

## M. Deployment recommendation

**Keep the current production deployment unchanged.** It remains pinned to
`73912cf2d6d8aaf2d65c83cd89baf6079d92c274` and healthy, and no production emergency was found.

A new deployment candidate containing the P3 fixes (deep-link redirect, `Secure` cookies) is ready on
`feat/cloud-dashboard` for **separate authorization**; it was not deployed, merged, tagged, or
published. A future small phase should add the mobile navigation wrap fix, then re-run the GitHub
connect and CLI upload/download tests with an owner present for the 2FA prompt.

## Cleanup status

- Deleted both disposable Auth users and all their rows: 2 repositories, 2 scans, 2 findings, 2
  profiles, 3 CLI tokens, 3 CLI auth requests.
- Deleted the owner CLI token and auth request created by this phase's login (exact IDs, confirmed
  revoked/consumed).
- Removed the temporary CLI config, session material, scripts, logs, and HTML from `/tmp/lp218`.
- Left the repository's gitignored `.launchproof/` local report in place (local-only artifact).
- Confirmed the owner's database state is unchanged: 1 profile, 0 repositories/scans/findings, 1
  Auth user; production deployment and origin untouched.
- No secret was printed, logged, committed, or screenshotted; only variable names/scopes and
  sanitized responses were used in evidence.
