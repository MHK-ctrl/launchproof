# Phase 21.6 — Final Pre-Deployment Audit and Production Launch Preparation

**Date:** 2026-11-23
**Branch audited:** `feat/cloud-dashboard`
**Commit audited:** `4151a1298fe6217eb358772f3ee99bdd15f21f78` (`Phase 21.5: apply hosted migrations and record validation`)
**Remote:** `origin/feat/cloud-dashboard` at the same commit at the start and end of the audit
**Audit type:** read-only local and hosted checks
**Deployment performed:** **NONE.** No Vercel deployment of any kind, no Preview, no Production, no
alias, no domain, no merge, no tag, no release, no npm publish.
**Hosted database mutations in this phase:** **NONE.** No migration, grant, row, or identity change.
**Final recommendation:** **READY FOR INITIAL DEPLOYMENT AUTHORIZATION** — one owner gate remains.

---

## 1. State recovery

| Check              | Observed                                                                  | Status                   |
| ------------------ | ------------------------------------------------------------------------- | ------------------------ |
| Branch             | `feat/cloud-dashboard`                                                    | VERIFIED — LOCAL         |
| HEAD               | `4151a1298fe6217eb358772f3ee99bdd15f21f78`                                | VERIFIED — LOCAL         |
| Remote HEAD        | `origin/feat/cloud-dashboard` = same SHA                                  | VERIFIED — LOCAL         |
| Working tree       | clean (`git status --porcelain` empty); `git diff --check` exit 0         | VERIFIED — LOCAL         |
| Vercel project     | `launchproof` / `prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`, team `hamza-recallai` | VERIFIED — CONFIGURATION |
| Vercel deployments | `No deployments found`                                                    | VERIFIED — CONFIGURATION |
| Supabase project   | `launchproof` / `ypqpqgnviphwxddrpieq`                                    | VERIFIED — CONFIGURATION |
| Local runtime      | Node `26.0.0`, npm `11.12.1`                                              | VERIFIED — LOCAL         |
| Local `.env`       | present, gitignored (`.gitignore:23`), mode not modified in this phase    | VERIFIED — LOCAL         |

The Phase 21.5 commit was still HEAD; nothing was reset, reverted, or overwritten. A generated
`apps/web/next-env.d.ts` change produced by the local dev-server smoke check was discarded because it
was a Next.js regeneration of a tracked file, not authored work; the committed version was restored
and the tree re-verified clean.

Documents read at the start of the phase: `PROJECT_EXECUTION_STATUS.md`,
`DEPLOYMENT_READINESS.md`, `LIVE_DEPLOYMENT_REPORT.md`, `PHASE_21_4_REPORT.md`,
`PHASE_21_5_REPORT.md`, `supabase/MIGRATION_TRACKING.md`, `CLOUD_DASHBOARD_SETUP.md`,
`CLOUD_DASHBOARD_ARCHITECTURE.md`, `PRIVACY_DATA_FLOW.md`.

---

## 2. Phase 21.5 hosted evidence — status classification

Hosted database mutations were **not** repeated in this phase. The following is the documented
Phase 21.5 evidence, with the status labels that honestly apply.

| Evidence (`PHASE_21_5_REPORT.md`, `supabase/manual/*`)                           | Status                                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Ledger contains exactly 001, 002, 003; zero unexpected versions                  | DOCUMENTED FROM PRIOR PHASE (VERIFIED — HOSTED in 21.5)    |
| Ledger effects re-confirmed read-only (001/002 grant revocation, 003 objects)    | VERIFIED — HOSTED (this phase, read-only, see §3)          |
| Service-role PostgREST 200 on all eight application relations                    | VERIFIED — HOSTED (this phase, read-only)                  |
| Anonymous 401 / authenticated 403 denials                                        | DOCUMENTED; anonymous denial re-confirmed 401 (this phase) |
| Rate-limiter allow/allow/deny, `Retry-After=60`, counter isolation, window reset | DOCUMENTED FROM PRIOR PHASE (60/60 hosted suite)           |
| Bounded rate-limit cleanup (2 removed, then 1)                                   | DOCUMENTED FROM PRIOR PHASE                                |
| CLI token cleanup (2 expired/revoked removed, active preserved)                  | DOCUMENTED FROM PRIOR PHASE                                |
| Hosted RLS and tenant isolation 60/60                                            | DOCUMENTED FROM PRIOR PHASE                                |
| Synthetic teardown: zero auth users, zero rows in seven tables and the view      | VERIFIED — HOSTED (this phase, read-only row counts)       |
| 17/17 hosted RLS suite (Phase 21.2)                                              | DOCUMENTED FROM PRIOR PHASE                                |
| `supabase` CLI `migration list` / `db push --dry-run`                            | NOT TESTED (CLI not installed/configured)                  |

Artifacts: `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json` (sanitized 60/60 result) and
`supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` (SHA-256 `6eab8579…d875233`, 63,394 bytes).
The baseline is catalog evidence, not a data backup; the free plan has no provider backup.

---

## 3. Live Supabase read-only review (this phase)

Executed with a disposable local script that read the gitignored `.env` and printed **status codes and
row counts only**. No credential, token, or key value was printed, logged, committed, or captured.
The script was deleted after the run; `.tmp` is gitignored.

| Check                                                              | Result                                                                                                                     | Status                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Project host                                                       | `ypqpqgnviphwxddrpieq.supabase.co`                                                                                         | VERIFIED — HOSTED           |
| Service-role read, `profiles` / `repositories` / `scans`           | 200 / 200 / 200; count `0` each                                                                                            | VERIFIED — HOSTED           |
| Service-role read, `findings` / `cli_auth_requests` / `cli_tokens` | 200 / 200 / 200; count `0` each                                                                                            | VERIFIED — HOSTED           |
| Service-role read, `rate_limits` / `repository_scan_stats`         | 200 / 200; count `0` each                                                                                                  | VERIFIED — HOSTED           |
| Anonymous read on all eight relations                              | 401 on all eight                                                                                                           | VERIFIED — HOSTED           |
| Exposed RPC paths                                                  | `/rpc/consume_rate_limit`, `/rpc/cleanup_cli_tokens`, `/rpc/cleanup_rate_limits`                                           | VERIFIED — HOSTED           |
| Exposed table definitions                                          | seven application tables plus `repository_scan_stats`                                                                      | VERIFIED — HOSTED           |
| Auth settings (public)                                             | HTTP 200; providers enabled: `github`, `email`; `disable_signup: false`; `mailer_autoconfirm: false`                       | VERIFIED — HOSTED           |
| Migration ledger rows                                              | not re-queried this phase (no read-only management credential in session); unchanged since 21.5 with no SQL executed since | DOCUMENTED FROM PRIOR PHASE |
| Site URL / redirect allowlist contents                             | documented as `http://127.0.0.1:3000` only; not exposed by any public endpoint, not re-read this phase                     | DOCUMENTED FROM PRIOR PHASE |

The 003 effects are therefore re-confirmed indirectly and directly without mutation: the
post-003 `rate_limits` relation exists and is service-role readable, the three security-definer
functions are exposed over PostgREST, anon is denied everywhere, and every relation is empty.

**Configuration observation (not a blocker):** the `email` auth provider is enabled with sign-ups
open. Nothing in the app accepts email sign-up, and RLS is keyed to `auth.uid()`, so this does not
create a data-exposure path; it is an unused public surface that can be disabled later if the product
is GitHub-only.

---

## 4. Final security and configuration review

Reviewed at the audited commit. Status is `VERIFIED — LOCAL` for reviewed code and tests;
deployed runtime behavior remains `NOT TESTED` until a deployment exists.

| Area                             | Evidence                                                                                                                                                                                                                                                             | Status                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Session/auth                     | `lib/auth.ts` uses `supabase.auth.getUser()` server-side (not `getSession`), `requireUser` redirects with `safeNextPath`, `getApiSession` catches failures                                                                                                           | VERIFIED — LOCAL                                  |
| Open-redirect protection         | `safeNextPath` accepts only same-origin relative paths, rejects `//`, `\`, CRLF                                                                                                                                                                                      | VERIFIED — LOCAL                                  |
| Authorization / tenant ownership | Every API route authenticates, filters by `user_id`, and returns 404 on non-owned UUIDs; service-role CLI routes filter by resolved `userId`                                                                                                                         | VERIFIED — LOCAL                                  |
| RLS assumptions                  | User-scoped queries use the anon/session client so RLS applies; service-role use is limited to CLI token exchange/lookup, CLI uploads, and account deletion                                                                                                          | VERIFIED — LOCAL                                  |
| Repository connection            | OAuth via Supabase with `read:user repo`; provider token encrypted (AES-256-GCM) into an `httpOnly`, `secure` in production, `sameSite=lax`, 15-minute cookie bound to the user id; only `GET https://api.github.com/repositories/:id` is issued; token never stored | VERIFIED — LOCAL                                  |
| CLI login / token lifecycle      | Loopback + PKCE (S256), hashed one-time codes, 10-minute expiry, atomic single-use claim, hashed 7-day tokens, revocation on logout, opportunistic bounded cleanup                                                                                                   | VERIFIED — LOCAL                                  |
| Scan upload validation           | Strict Zod schema, 2 MB body cap, content-type check, per-user rate limit (30/min), repository must be owned and active, strict sanitization of text/paths/references                                                                                                | VERIFIED — LOCAL                                  |
| Report download authorization    | Session required, per-user rate limit (60/min), explicit `scan.user_id` check, sanitized cloud-only payload, `Content-Disposition` + `nosniff` + `no-store`                                                                                                          | VERIFIED — LOCAL                                  |
| Account deletion                 | Auth identity deleted first (so retries cannot resurrect a partial account), then tenant rows and profile; auth and cleanup failures reported separately, never as success                                                                                           | VERIFIED — LOCAL                                  |
| Sensitive-data sanitization      | Secret-pattern redaction, local-path stripping, control-character removal; relative-path validation rejects absolute/`..` paths                                                                                                                                      | VERIFIED — LOCAL                                  |
| Rate limiting                    | Atomic Postgres fixed-window function with bounded per-process memory fallback; client address honored from `x-vercel-forwarded-for` only on a verified Vercel runtime                                                                                               | VERIFIED — LOCAL                                  |
| Error handling / leakage         | `structuredLog` drops sensitive keys and logs only event/request id/error name-or-code; client messages are generic; `x-request-id` correlates without internal detail                                                                                               | VERIFIED — LOCAL                                  |
| CSP nonce                        | Per-request nonce in `proxy.ts`, propagated to the request CSP header so Next.js applies it; `strict-dynamic`; no `unsafe-inline`; `unsafe-eval` only in development; path-specific exception for the fixed `sample-report.html`                                     | VERIFIED — LOCAL                                  |
| Security headers                 | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS; CSP `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`                                           | VERIFIED — LOCAL                                  |
| Cookie security                  | Connect cookie `httpOnly`/`secure` in production/`lax`; Supabase session cookies managed by `@supabase/ssr` with refresh in the proxy                                                                                                                                | VERIFIED — LOCAL (deployed attributes NOT TESTED) |
| SSRF / unsafe URLs               | No user-supplied fetch targets. GitHub calls use a fixed `https://api.github.com` base with an integer repository id; finding references must be `http(s)` with credential/secret query keys rejected                                                                | VERIFIED — LOCAL                                  |
| XSS                              | No `dangerouslySetInnerHTML` in `apps/web`; React escaping for stored findings; CSP blocks inline script without a nonce; no remote images/scripts/fonts beyond GitHub avatars                                                                                       | VERIFIED — LOCAL                                  |
| Injection                        | All database access goes through PostgREST/Supabase query builders; no raw SQL construction from request data; scan search input is character-filtered                                                                                                               | VERIFIED — LOCAL                                  |
| CSRF                             | Mutating browser APIs require JSON content type plus a same-origin `Origin` check; session cookies are `sameSite=lax`; forms use server actions                                                                                                                      | VERIFIED — LOCAL                                  |
| Client/server env separation     | Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the browser; service-role and encryption keys are server-only and read through `requireServerEnv`                                                                                          | VERIFIED — LOCAL                                  |
| Log hygiene                      | `console.*` in `apps/web` appears only through `structuredLog`; the only other occurrence is the CLI top-level fatal handler                                                                                                                                         | VERIFIED — LOCAL                                  |

No new vulnerability was found, no speculative hardening was applied, and no dependency changed.

---

## 5. Deployment configuration

| Item                     | Observed                                                                                                                            | Status                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Framework preset         | Next.js (16.4.6)                                                                                                                    | VERIFIED — CONFIGURATION |
| Root directory           | `.` (repo root, npm workspace)                                                                                                      | VERIFIED — CONFIGURATION |
| Install command          | `npm ci`                                                                                                                            | VERIFIED — CONFIGURATION |
| Build command            | `npm run build:web` → `next build` in `apps/web`                                                                                    | VERIFIED — CONFIGURATION |
| Output                   | Next.js server runtime (no static export)                                                                                           | VERIFIED — CONFIGURATION |
| Node.js version          | `26.x` project setting; local `26.0.0`; Vercel documents 26.x as available/GA and the default                                       | VERIFIED — CONFIGURATION |
| Lockfile sync            | `npm ci --dry-run` → `up to date`, exit 0                                                                                           | VERIFIED — LOCAL         |
| Workspace build coupling | `apps/web` has no dependency on `@launchproof/core`; `build:web` needs no prior workspace build                                     | VERIFIED — LOCAL         |
| Git integration          | not connected; deployment will be a CLI deployment from this repository                                                             | VERIFIED — CONFIGURATION |
| Deployments              | none                                                                                                                                | VERIFIED — CONFIGURATION |
| Region                   | `iad1` (project default, no failover)                                                                                               | VERIFIED — CONFIGURATION |
| Custom domain / alias    | none                                                                                                                                | VERIFIED — CONFIGURATION |
| Env loading locally      | root `.env` is loaded for `npm run dev:web` (confirmed by an authenticated-route probe returning 401 rather than a missing-env 500) | VERIFIED — LOCAL         |

### Environment variables (names, scopes and status only; no value displayed)

| Variable                        | Required         | Preview configured | Production configured | Validation                                                                                                                                                                                                                                                          |
| ------------------------------- | ---------------- | ------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes              | Yes (Config)       | Yes (Config)          | Present in both scopes. Value not read.                                                                                                                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes              | Yes (Config)       | Yes (Config)          | Present in both scopes. Public by design. Value not read.                                                                                                                                                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes              | Yes (Secret)       | Yes (Secret)          | Present in both scopes. Server-only; value hidden and never read.                                                                                                                                                                                                   |
| `LAUNCHPROOF_ENCRYPTION_KEY`    | Yes              | Yes (Secret)       | Yes (Secret)          | Present in both scopes. Must decode to 32 bytes; not readable in the dashboard, so runtime validation happens on first GitHub connect after deployment.                                                                                                             |
| `APP_BASE_URL`                  | No (recommended) | Not set            | Not set               | Safe to leave unset for the first deployment: `appBaseUrl()` falls back to `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel documents as always set at build and runtime (production domain, no scheme). Set it explicitly once the real origin exists, then redeploy. |

Per Vercel's documentation, the first deployment of a new project builds with **Production**-scoped
variables and is always assigned to Production; Preview-only variables are not needed for it. The
four required variables are present in Production. `APP_BASE_URL` is intentionally absent until the
generated production origin is known — inventing it now would be inaccurate.

`APP_BASE_URL` consequence if the fallback were ever missing: GitHub-connect and CLI-approval URLs
would resolve to `http://127.0.0.1:3000`. Browser sign-in on `/login` uses `window.location.origin`,
so it would still work; the connect step would not. The deployment plan therefore verifies the
resolved origin immediately after deploy and sets `APP_BASE_URL` explicitly before functional testing.

---

## 6. Verification commands and results

| Command                                                                     | Result                                                                   | Status            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| `npm run verify` (format:check, lint, build, typecheck, tests, `build:web`) | exit 0; 20 test files / 109 tests passed; production web build succeeded | VERIFIED — LOCAL  |
| `npm audit --audit-level=high`                                              | 0 vulnerabilities                                                        | VERIFIED — LOCAL  |
| `npm ci --dry-run`                                                          | `up to date`, exit 0                                                     | VERIFIED — LOCAL  |
| `git diff --check`                                                          | exit 0                                                                   | VERIFIED — LOCAL  |
| Local `next dev` smoke (`/api/health`, `/api/cli/repositories`, `/login`)   | 200, 401, 200; proxy/CSP active in the request pipeline                  | VERIFIED — LOCAL  |
| Hosted read-only probe (§3)                                                 | all checks as listed                                                     | VERIFIED — HOSTED |
| Deployed Vercel build, runtime, headers, cookies, OAuth                     | no deployment exists                                                     | NOT TESTED        |
| Browser two-account isolation, live CLI login/upload/download               | no deployment exists                                                     | NOT TESTED        |

Dependencies were not changed; the verified dependency state is the one being deployed.

---

## 7. Repository safety

- `git diff --check` clean; worktree clean and in sync with `origin/feat/cloud-dashboard`.
- No untracked files (`git ls-files --others --exclude-standard` empty); `.tmp` is gitignored and the
  disposable probes were deleted.
- Secret pattern scan over tracked files (`eyJhbGciOi` JWTs, `sbp_`, `lp_cli_`, `lp_code_`, `ghp_`/`gho_`
  /`ghu_`/`ghs_`/`ghr_`, `github_pat_`, `sk_live_`, `AKIA…`, private-key headers): only the project's
  own redaction regexes and synthetic test strings matched. No real credential.
- `.env` is gitignored; no local database artifact, dump, log, screenshot, or test identity is tracked.
- No debug statements in `apps/web`; the only `console.*` outside `structuredLog` is the CLI fatal
  handler.
- Temporary hosted probes and the local dev server were removed/stopped; no process or artifact was
  left behind.

---

## 8. Genuine blockers

**None found in application code, tests, build, or deployment configuration.**

Required sequence after authorization (not pre-deployment blockers, because the values depend on the
origin that does not exist yet):

1. Create the first Production deployment and record its real origin.
2. Set `APP_BASE_URL=https://<production-origin>` (Production) and redeploy so the value is applied.
3. Add exactly `https://<production-origin>/auth/callback` to Supabase **Authentication → URL
   Configuration** (and set the Site URL to the production origin, optionally keeping the localhost
   entry for development). Without this, Supabase will not accept the production `redirectTo` and
   GitHub sign-in will fall back to the localhost Site URL.
4. Confirm the GitHub OAuth App callback stays `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`.
   Only the Homepage URL needs the production origin, and that is cosmetic.

These are `REQUIRES OWNER AUTHORIZATION` configuration steps bundled with the deployment gate, not
defects.

---

## 9. Exact deployment plan (after explicit authorization only)

1. **Freeze the artifact.** `git fetch`, confirm `feat/cloud-dashboard` HEAD is
   `4151a1298fe6217eb358772f3ee99bdd15f21f78` (or a later explicitly reviewed commit), worktree
   clean, `origin` in sync. Build once more with `npm run build:web` if the commit changed.
2. **Confirm identity and project.** `vercel whoami` → `mdhamzakhan2k6-4663`; `vercel project inspect
launchproof` → root `.`, framework Next.js, build `npm run build:web`, install `npm ci`;
   `vercel ls launchproof` → no deployments.
3. **Confirm environment.** Re-list Production variable names/scopes only; `APP_BASE_URL` still absent.
   Do not read values.
4. **Deploy via CLI, not Git integration** (Git is not connected): `vercel deploy --prod` from the
   repository root. The first deployment of a new project is Production by Vercel's rule; this is
   the reason the first deployment is Production, and it is why authorization is required.
5. **Record build evidence.** Capture deployment id, URL, commit SHA reported by Vercel, build log
   summary, and duration (expected ~2–4 minutes: `npm ci` plus one Next.js build; one production
   deployment, negligible resource impact on the free plan). Do not expose env values in logs or
   screenshots.
6. **Verify the origin resolves.** Confirm `appBaseUrl()` behavior indirectly: request
   `/api/github/connect` while signed out and confirm the redirect target is the production origin
   (or that `/login` is returned) rather than `127.0.0.1`. If the fallback is wrong, stop and set
   `APP_BASE_URL` before continuing.
7. **Set `APP_BASE_URL`** to `https://<production-origin>` for Production and redeploy; confirm the
   second deployment is also Production and record it.
8. **Update Supabase Auth config** (owner-authorized dashboard action): Site URL → production origin;
   add exactly `https://<production-origin>/auth/callback`; keep the localhost callback for local
   development; no wildcards.
9. **Health checks:** `GET /api/health` → 200 `{ ok: true }`; `/` and public routes → 200; signed-out
   `/dashboard` → 307/303 to `/login?next=%2Fdashboard`; response headers include CSP with a fresh
   nonce, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, and
   `Cache-Control: private, no-store` on private routes.
10. **Functional smoke** in the order in §10, using two disposable GitHub test accounts and only
    synthetic repositories/scans.
11. **Record results** in `LIVE_DEPLOYMENT_REPORT.md` and `PROJECT_EXECUTION_STATUS.md` with observed
    values only.
12. **Rollback:** delete the deployment/alias (or the project if it must not remain public), restore
    the Supabase Site URL and redirect allowlist to the localhost values, and leave `APP_BASE_URL`
    unset. No database rollback is needed because this deployment changes no schema or data. There is
    no previous deployment to promote, so rollback means removing the first one.
13. **Immediate-rollback triggers:** a 5xx on `/` or `/api/health`; CSP that blocks the app's own
    scripts; any cross-account visibility of repository/scan/finding/download data; any secret or
    service-role key in the client bundle or response; auth callback loops; or a build/deployment that
    does not correspond to the audited commit.
14. **Secret hygiene throughout:** never print env values, never paste keys into chat, never
    screenshot the Vercel variable editor with values revealed, never commit `.env`, and clear any
    terminal scrollback that could contain a key.

No configuration change is required **before** step 1. The only pre-functional-test configuration is
steps 7–8, which depend on the origin produced by step 4.

---

## 10. Post-deployment test plan (execute only after separate authorization)

Use disposable GitHub accounts and synthetic repositories only. Stop and roll back on any isolation
failure.

**A. Public surface**

1. `/`, `/how-it-works`, `/get-started`, `/docs` (or the actual public routes), `/sample-report.html`
   return 200 without a session.
2. Navigation, header/footer links, and the mobile menu work; no broken links.
3. Login and dashboard routes are `noindex` and `no-store`.
4. Mobile 390 px: no horizontal overflow on the public pages.
5. Keyboard-only pass: skip link first, visible focus, no traps; headings and landmarks sane.
6. Static assets and fonts load with no CSP violations in the console.

**B. Authentication** 7. Signed-out `/dashboard` redirects to `/login?next=%2Fdashboard`. 8. GitHub sign-in completes through Supabase to `/auth/callback` and lands on the intended path. 9. A malicious `next` value cannot redirect off-origin. 10. Session persists across reloads and new tabs; `/api/*` returns 200 for the session and 401 signed out. 11. Sign-out clears the session; protected routes redirect again.

**C. Dashboard** 12. Empty state renders for a new account; profile row exists for the signed-in user. 13. Connect GitHub, consent, select a synthetic repository; only metadata is stored (no token column). 14. Disconnect clears the connect cookie and the repository row. 15. Scan history, filtering, pagination, scan detail, findings, and JSON download work. 16. Download of another account's scan id returns 404, not data.

**D. CLI** 17. `launchproof login` opens the browser, approves, returns to loopback with `state` + PKCE. 18. Token persists (macOS Keychain if available, else file with restricted mode); `status` shows account
and expiry; the token is never printed. 19. `repositories` lists only the connected synthetic repository. 20. `scan . --upload` shows the preview; cancel leaves the local report untouched; success uploads a
sanitized summary only. 21. `logout` revokes the token; a following upload fails 401. Revoke-all in settings also invalidates. 22. An expired/revoked token fails cleanly without a stack trace or secret in output.

**E. Security** 23. Two accounts: A cannot see B's repositories, scans, findings, stats, or downloads, including by
direct UUID; B's rows survive A's attempts. 24. Anonymous requests to every `/api/*` route return 401 with no data. 25. Upload validation: wrong content type → 415; oversized body → 413; invalid schema → 400. 26. Rate limits: exceed a cheap endpoint with a disposable account, confirm 429 with `Retry-After`,
then confirm recovery after the window. 27. CSP has a per-request nonce and no `unsafe-inline`/`unsafe-eval`; security headers present; session
cookies `Secure`/`SameSite=Lax`; connect cookie `HttpOnly`. 28. Account deletion removes the auth identity, profile, and tenant rows, clears the session and
connect cookie, and leaves no orphaned data.

**F. Reliability and operations** 29. `/api/health` 200; error paths return generic JSON with an `x-request-id` and no internals. 30. Vercel function logs contain no tokens, bodies, or `.env` values; only structured event lines. 31. Cold start and a few sequential page loads are acceptable; no unexpected 5xx in the logs. 32. Rollback path confirmed before announcing: know the deployment id, the exact Supabase settings to
restore, and who can remove the deployment.

---

## 11. Remaining risks

Acceptable, documented risks (not deployment blockers):

- No provider backup on the Supabase free plan; the saved baseline is catalog evidence only.
- `service_role` retains bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE`/`MAINTAIN` privileges and a broad
  `arwdDxtm` default ACL. Server-only; least-privilege tightening is a separate future change.
- The GitHub `repo` scope is broad; the app issues GETs only and does not persist the provider token.
- Rate limiting is Postgres-backed with a per-instance memory fallback; not a distributed limiter.
- No monitoring, alerting, audit log, MFA requirement, or scheduled cleanup job.
- CSP/HSTS/cookie/runtime behavior and all OAuth/CLI flows are unverified until deployment.
- Email/password sign-up is enabled in Supabase even though the app only offers GitHub. Unused
  surface; disable it later if desired.
- The production Site URL and redirect allowlist are not yet set; sign-in will not work until they are
  updated after the origin exists.
- No external security audit or penetration test; sanitization remains heuristic.

---

## 12. Explicit statement

**No deployment was performed.** No Vercel deployment, Preview, Production, alias, or domain was
created; nothing was merged, tagged, released, or published; no hosted database object, grant, row, or
identity was changed; no OAuth secret was modified. The initial Production deployment remains
**BLOCKED pending explicit owner authorization**.
