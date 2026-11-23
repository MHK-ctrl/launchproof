# Multi-Tenant Security Design

**Scope:** the optional LaunchProof cloud dashboard, its PostgreSQL schema, API routes, server
actions, GitHub connection flow, and CLI uploads.

**Status:** implemented and locally tested with PGlite. The migration and grant hardening were applied
to a hosted Supabase project, where the two-identity PostgREST/RLS run passed 17/17 adversarial
checks, including a re-run after the OAuth secret rotation in Phase 21.2. The hosted project contains
zero auth users and zero tenant rows. **No deployed application exists**, so runtime routes, cookies,
real OAuth, and live CLI uploads remain untested. The local CLI remains usable without any of this.

## 1. Security objective

A signed-in user must never be able to read, download, edit, delete, or enumerate another user's
private resources. This must hold when the attacker:

- changes an ID in a URL or API path;
- sends a JSON body containing another user's `user_id` or repository ID;
- calls the API directly instead of using the UI;
- is anonymous and has no session;
- has a valid session but belongs to a different tenant;
- replays or tampers with a CLI authorization request or token.

The boundary is enforced in **both** application code and PostgreSQL RLS. Application checks are not
treated as sufficient on their own, and RLS is not treated as sufficient without server-side
ownership checks for service-role paths.

## 2. Trust boundaries

| Boundary                | Trusted side                       | Untrusted side                                 |
| ----------------------- | ---------------------------------- | ---------------------------------------------- |
| Browser -> Next.js      | Server session resolution          | Cookies, URLs, headers, form data, JSON bodies |
| Next.js -> Supabase     | Service-role or user-scoped client | Network, PostgREST query construction          |
| CLI -> Next.js API      | Bearer token hash resolution       | Token string, upload JSON, headers             |
| Browser -> GitHub       | GitHub-hosted consent              | OAuth redirect parameters                      |
| Next.js -> GitHub REST  | Short-lived provider token         | GitHub response metadata                       |
| Browser -> loopback CLI | The local CLI process              | Redirect query parameters                      |

Secrets and tokens are never accepted from a user as proof of another user's identity. Ownership is
always derived from the verified Supabase session or from a stored CLI token hash.

## 3. Identity and authorization rules

### 3.1 Session identity

`getApiSession()` and `requireUser()` call Supabase Auth's `getUser()` on the server. They do not
trust a cookie value as a user ID and do not accept a client-supplied `user_id`. Every dashboard page
and session-authenticated route re-checks the session.

### 3.2 CLI identity

A CLI request must carry `Authorization: Bearer lp_cli_...`. The server:

1. validates the bearer shape;
2. hashes it with SHA-256;
3. looks up `cli_tokens` with the **service-role** client;
4. rejects a missing, revoked, or expired token;
5. updates `last_used_at`;
6. uses only the row's `user_id` for the rest of the operation.

The plaintext CLI token is never stored in PostgreSQL, logs, or error responses. Only the hash is
stored.

### 3.3 No client-selected ownership

The cloud upload schema is strict and does not contain a `user_id` field. Unknown fields are rejected.
Even if an attacker adds one, it is not read. Repository ownership is verified with an explicit
`.eq('user_id', cli.userId)` before insert when the service-role client is used.

## 4. Database controls

The migration is `supabase/migrations/202611230001_cloud_dashboard.sql`.

### 4.1 RLS

RLS is enabled on `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, and
`cli_tokens`.

| Table               | Authenticated policy                                        |
| ------------------- | ----------------------------------------------------------- |
| `profiles`          | select/insert/update where `auth.uid() = id`                |
| `repositories`      | select/insert/update/delete where `auth.uid() = user_id`    |
| `scans`             | select/insert/update/delete where `auth.uid() = user_id`    |
| `findings`          | select/insert/update/delete where `auth.uid() = user_id`    |
| `cli_auth_requests` | insert only, with `auth.uid() = user_id`; no browser select |
| `cli_tokens`        | no grants to `anon` or `authenticated`; server-only         |

Anonymous grants are revoked. `repository_scan_stats` is a `security_invoker` view, so its aggregates
are filtered by the same RLS policies as the underlying tables.

### 4.2 Composite foreign keys

`scans(user_id, repository_id)` references `repositories(user_id, id)`. A scan cannot reference a
repository belonging to a different user, even with a valid UUID. `findings(user_id, scan_id)`
references `scans(user_id, id)`, giving the same guarantee for findings.

The RLS test suite exercises both cross-tenant insert attempts and confirms they fail.

### 4.3 Service-role usage

The service-role client is used only for operations that cannot be done with a user-scoped client:

- resolving a CLI bearer token hash;
- inserting a scan after an explicit ownership check;
- reading/updating a CLI authorization request during login/approval/exchange;
- revoking CLI tokens and counting them on the settings page;
- account deletion.

Every service-role path either derives the user ID from a verified token/session or filters by that
verified user ID. The key is server-only and is never exposed through `NEXT_PUBLIC_*`.

### 4.4 Account deletion

The auth user is deleted first. The schema cascades from `auth.users` to `profiles`, then to
repositories, scans, findings, CLI requests, and tokens. A failed auth deletion leaves the account and
data intact and returns an error. This avoids a state where data is deleted but the login still works.

## 5. Application controls

### 5.1 Cross-tenant reads

Dashboard queries use the user-scoped Supabase client. Detail pages additionally verify
`row.user_id === user.id` before rendering and return `notFound()` for a mismatch. API routes use the
same pattern and return `404` rather than disclosing that a row exists.

### 5.2 CSRF and origin checks

State-changing session routes require `Origin` to match either the request origin or the configured
`APP_BASE_URL`: repository connect/disconnect, scan create/delete, account delete, and CLI authorization
start. Server actions use Next.js action origin protections and still re-check the session.

CLI bearer requests do not rely on cookies, so session CSRF does not apply; the bearer token itself is
the credential and is never placed in a cookie.

### 5.3 Open redirects

`/login?next=` and `/auth/callback?next=` are normalized by `safeNextPath`. It rejects values that do
not start with `/`, protocol-relative values (`//`), backslashes, CR/LF, and anything whose parsed
origin differs from the fixed base. The callback constructs redirects against the request origin only
after this check.

### 5.4 GitHub connect cookie

The GitHub provider token is held in `lp_github_connect`:

- HttpOnly;
- SameSite=Lax;
- Secure in production;
- 15-minute lifetime;
- AES-256-GCM encrypted with a 32-byte server key;
- payload bound to the authenticated user ID;
- cleared on sign-out and account deletion;
- never written to the database or logs.

Binding the payload to the user ID prevents a second user signing in on the same browser from reusing
a previous user's connect token. The server only makes GitHub GET requests and never stores the
provider token.

### 5.5 CLI authorization hardening

- Authorization requests are created only by an explicit server action, not by rendering a GET page.
- State and PKCE challenge are validated for shape and length.
- The approval page queries by both request ID and `user_id`.
- Approval and exchange are separate steps.
- Exchange verifies code hash, state, PKCE verifier, expiry, approval, and unconsumed status.
- The request is claimed atomically with a conditional update before the token insert.
- CLI tokens expire after seven days and can be revoked individually or all at once.
- The callback listener binds to `127.0.0.1`; the CLI checks the returned state.
- Token storage uses macOS Keychain stdin, not command-line arguments, or a mode-0600 file.
- `logout` keeps the local token if server revocation fails, rather than falsely claiming revocation.

### 5.6 Rate limits

In-memory limits apply to CLI authorization starts (per user), CLI exchanges (per client address), and
CLI login page requests (per user). These are per server instance. They reduce casual abuse; they are
not a distributed rate limiter.

### 5.7 Upload validation and sanitization

- Request content type must be JSON; body is limited to 2 MB.
- Zod object schemas are strict: unknown fields, including `user_id`, are rejected.
- Checks are capped at 300; findings at 2,000.
- Text lengths are bounded.
- The server recomputes the gate from severity counts and error status. A payload claiming
  `gatePassed: true` while reporting a finding at the threshold is stored as failed.
- Credential patterns are redacted; absolute Unix/Windows paths in text become `<local-path>`.
- Finding locations are reduced to safe relative paths. Absolute, parent-traversal, and Windows
  absolute paths become `null`.
- References must be HTTP(S), cannot contain URL credentials or sensitive query parameter names, and
  are dropped by the current server normalizer.

Sanitization is defense in depth, not a proof that arbitrary finding prose contains no sensitive
data. The CLI builds the payload from structured findings, never from raw source or evidence bodies.

## 6. Verified test evidence

The local test suite uses PGlite to execute the real migration SQL. Hosted Supabase evidence is
recorded separately below; it exercises PostgREST with real JWT claims and disposable identities.

`packages/core/test/cloud-dashboard-rls.test.ts` — **9 tests passed**:

1. Auth insert trigger creates a profile.
2. A user sees only their own profile.
3. A user cannot read another user's repositories/scans/findings.
4. Primary-key lookups outside the tenant return no rows.
5. A spoofed `user_id` insert is rejected by RLS.
6. A scan cannot attach to another user's repository via the composite FK.
7. A finding cannot attach to another user's scan via the composite FK.
8. Cross-tenant update and delete affect zero rows.
9. The aggregate view and anonymous access expose no rows.

`packages/core/test/cloud-upload-sanitization.test.ts` — **6 tests passed**: ownership-field
rejection, server secret/path normalization, safe relative paths, gate recomputation, malicious
"passed" gate rejection, and CLI payload path/secret/reference filtering.

`npm test` on 2026-11-23: **15 files, 68 tests passed**.

`npm run build:web` on the same tree: passed. Public pages prerendered; dashboard and API routes
dynamic.

On Phase 21.2, `npm run verify` passed with 15 test files and 68 tests; the production web build,
format, lint, and typecheck also passed. `npm audit --audit-level=high` reported 0 vulnerabilities. A
secret scan of 200 tracked files and 19 client static files for exact secret values found 0 hits.
The hosted RLS run was repeated after OAuth rotation and passed 17/17; both disposable identities were
deleted. These checks do not substitute for a deployed-application isolation test.

## 7. Residual risks and unverified areas

1. **No deployed-application RLS test.** Hosted Supabase RLS, grants, JWT claims, PostgREST reads and
   writes, and disposable two-identity adversarial cases passed 17/17. A deployed Next.js runtime,
   real browser sessions, pooler behavior, and the Vercel environment remain untested.
2. **Service-role key compromise bypasses RLS.** It must remain server-only and be rotated if exposed.
   There is no separate database role with narrower privileges for each service operation.
3. **GitHub `repo` scope is broad.** GitHub offers no read-only private-repository OAuth scope. The
   app issues only GETs and does not persist the provider token, but the consent itself grants broad
   access. A GitHub App with fine-grained permissions would be a future improvement.
4. **No MFA requirement.** Security depends on the user's GitHub account security.
5. **No audit log or anomaly detection.** There is no record of who viewed which scan beyond ordinary
   platform logs, and no alerting for repeated authorization failures.
6. **In-memory rate limits** reset on deploy and are not shared across serverless instances.
7. **XSS would defeat browser-side controls.** React escaping and the lack of raw HTML rendering are
   the current mitigation; there is no formal CSP for the dashboard.
8. **Local malware can read CLI credentials.** Keychain and mode-0600 files protect against other
   users and casual inspection, not a compromised local account. The CLI cannot protect a token from
   a process already running as the user.
9. **Sanitization is heuristic.** A novel secret format or a path outside the recognized roots could
   survive in free text. The structured payload limits the exposure, but it is not a guarantee.
10. **No shared-browser isolation beyond cookie clearing.** Users should sign out on shared machines.
11. **No repository authorization model beyond the connecting user.** There are no teams, roles, or
    invitations. Each connection belongs to one account.
12. **No deployment has been verified.** Vercel requires a new project's first deployment to be
    Production, and the initial Production deployment is awaiting explicit owner authorization. The
    OAuth secret rotation is complete, but the production callback, Vercel runtime, real GitHub OAuth
    consent/sign-in, and live CLI upload remain untested.

These limitations are also recorded in [LIVE_DEPLOYMENT_REPORT.md](LIVE_DEPLOYMENT_REPORT.md) and the
project execution status. None of them are presented as completed work.
