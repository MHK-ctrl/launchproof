# Privacy Data Flow

This document describes what leaves a user's machine when the optional cloud dashboard is used, and
what stays local. It reflects the implemented code, not an intended future design.

## 1. Default posture

- **Local scans are offline by default.** The CLI works without an account, Supabase, Vercel, or
  network access. Local reports are written under `.launchproof/` and never uploaded automatically.
- **Cloud upload is opt-in twice.** The user must pass `--upload` and confirm the printed preview
  (unless `--yes` is explicitly supplied for automation). Cancelling leaves the local report intact.
- **Upload failure is non-destructive.** A failed login, network request, or server rejection does not
  delete or modify the local report.
- **No telemetry.** The application does not include analytics, session replay, advertising pixels, or
  background reporting.

## 2. Data sent to the LaunchProof dashboard

### 2.1 Account and profile

When a user signs in with GitHub through Supabase, the dashboard stores:

- Supabase auth user ID (UUID);
- GitHub numeric user ID, when available;
- GitHub username;
- GitHub avatar URL;
- email address, when GitHub provides one;
- profile timestamps.

Supabase manages the auth session and its cookies. LaunchProof does not receive or store the user's
GitHub password.

### 2.2 Repository metadata

When a user connects a repository, LaunchProof stores:

- GitHub repository numeric ID;
- owner login and repository name;
- `full_name` (`owner/name`);
- repository HTML URL;
- default branch;
- visibility (`public`, `private`, or `internal`);
- connection status and timestamps;
- the owning LaunchProof user ID.

The GitHub provider token used to fetch this metadata is held only in an encrypted, HttpOnly,
15-minute cookie and is never written to the database. See
[MULTI_TENANT_SECURITY_DESIGN.md](MULTI_TENANT_SECURITY_DESIGN.md).

### 2.3 Scan summary uploaded by the CLI

The upload payload contains:

- format version, client scan ID, connected repository ID, scanner version;
- scan status, security gate, commit SHA, branch;
- start/completion timestamps;
- check counts by status and finding counts by severity;
- the configured fail-on threshold, gate result, and gate reasons;
- up to 300 check summaries (`id`, title, status, summary, optional sanitized details);
- up to 2,000 findings (`id`, check ID, severity, confidence, verification, category, title,
  sanitized description, impact, remediation, relative file path and line, filtered references);
- up to 50 limitation strings.

The server normalizer stores a subset: counts, gate/status, scanner version, commit/branch,
timestamps, check summaries, findings with sanitized text and relative locations, and limitations.
References are currently dropped rather than stored.

### 2.4 Data deliberately excluded

The upload path does **not** send:

- source code or full files;
- raw evidence payloads or HTTP response bodies;
- `.env` contents or environment variable values;
- secret values, tokens, passwords, private keys, or connection strings;
- full local paths or the project root;
- git remote URLs, git history, or uncommitted changes;
- shell history, logs, screenshots, or browser traces;
- GitHub provider tokens or Supabase service-role keys.

The CLI builds the payload from structured report fields. It redacts common credential formats and
replaces recognized absolute paths with `<local-path>`. Finding locations are converted to paths
relative to the scanned project; paths outside the project become `null`. The server repeats secret
and path normalization and recomputes the gate instead of trusting the client's pass flag.

**Limitation:** redaction is heuristic. A previously unknown secret format, or a sensitive string
embedded in prose that does not match a known pattern, could survive. Review the printed upload
preview and avoid uploading a report whose finding text you have not reviewed.

## 3. CLI authentication data

### 3.1 Browser authorization

The CLI generates a random state and PKCE verifier, starts a loopback listener on `127.0.0.1`, and
opens the LaunchProof `/cli/login` page. The browser URL contains the state, PKCE challenge, and
loopback port. After explicit approval, the browser redirects a one-time code and state to the
loopback listener. The code is exchanged with the PKCE verifier for a CLI token.

- The CLI token is not printed.
- The server stores only its SHA-256 hash.
- Tokens expire after seven days and can be revoked.
- Authorization requests expire after ten minutes and are single-use.
- The loopback listener is not exposed on the LAN.
- The one-time code may appear in browser history and platform access logs because it is a URL query
  parameter. It is useless without the PKCE verifier, which never leaves the CLI process, and it is
  consumed on exchange.

### 3.2 Local token storage

On macOS, the CLI stores the token in the login Keychain under service `launchproof-cli`, account
`default`. The secret is written through stdin, not command-line arguments. If Keychain access fails,
it falls back to:

```text
~/.config/launchproof/credentials.json
```

with directory mode `0700` and file mode `0600`. `LAUNCHPROOF_CONFIG_DIR` can relocate that file.
`LAUNCHPROOF_CLI_TOKEN` can supply a token for automation; it is not written to disk by LaunchProof.

`launchproof logout` asks the server to revoke the token first, then deletes local credentials. If
revocation fails, the CLI keeps the local token and reports the failure rather than claiming success.

## 4. GitHub data flow

1. The browser authenticates with GitHub through Supabase's OAuth callback.
2. For repository listing/connection, Supabase returns a GitHub provider token to the LaunchProof
   callback over HTTPS.
3. LaunchProof encrypts that token in a short-lived cookie on the user's browser.
4. When the user lists or connects a repository, the server sends a GitHub GET request with the
   token. GitHub sees the request and the token's authorized scopes.
5. LaunchProof stores only the repository metadata listed above. It does not store the provider
   token.

The requested GitHub `repo` scope is broad for private repositories. The application itself only
issues GET requests, but the consent grants more authority than the application uses. Users who do
not want that consent should not connect private repositories.

## 5. Where data is stored and who processes it

| Data                       | Location                                     | Processor        |
| -------------------------- | -------------------------------------------- | ---------------- |
| Local scan reports         | User's `.launchproof/` directory             | User's machine   |
| CLI token (plaintext)      | macOS Keychain or mode-0600 local file       | User's machine   |
| Account/profile            | Supabase Auth + PostgreSQL                   | Supabase         |
| Repository metadata        | Supabase PostgreSQL                          | Supabase         |
| Scan summaries/findings    | Supabase PostgreSQL                          | Supabase         |
| CLI token hashes           | Supabase PostgreSQL                          | Supabase         |
| GitHub connect token       | Encrypted browser cookie, at most 15 minutes | User's browser   |
| Application requests/logs  | Hosting platform (Vercel or equivalent)      | Hosting provider |
| GitHub repository metadata | GitHub REST API responses in memory          | GitHub           |

**Current deployment state:** as of Phase 21.2, no Vercel deployment exists. The hosted Supabase
project contains zero auth users and zero profile, repository, scan, or finding rows. There is no
production application traffic, deployed access log, or real-user data to retain. This will change
only after an approved deployment and first real use.

Supabase and the hosting provider have their own retention, logging, and subprocessors. Review their
terms and settings before production. LaunchProof does not sell data or use it for advertising.

The application does not currently implement a scheduled cleanup job for expired CLI authorization
rows. Expired rows are unusable, and account deletion cascades them, but they may remain in the
database until cleanup or deletion. This is a known operational limitation.

## 6. Retention and user controls

- **Scans:** retained until the user deletes the scan or deletes the account. Disconnecting a
  repository is a status change and deliberately retains its scan history.
- **Repositories:** retained until account deletion; disconnect marks the connection inactive
  without deleting it.
- **CLI tokens:** expire after seven days; can be revoked individually or all at once. A valid CLI
  request opportunistically removes that user's expired/revoked token rows through a bounded
  server-side function. The migration that adds this function is prepared locally and not applied
  to hosted Supabase, so hosted rows may remain until it is applied or the account is deleted.
- **CLI authorization requests:** expire after ten minutes and are consumed on exchange; rows may
  remain until account deletion.
- **Account deletion:** deletes the auth user first, which cascades the profile and all tenant rows,
  then clears the session and GitHub connect cookie. Local CLI files and local reports are not
  touched.
- **Disconnect repository:** marks it inactive so it is unavailable for new CLI uploads, clears the
  short-lived GitHub connect cookie on that browser, and retains existing scan history until account
  deletion. GitHub's OAuth grant itself must be revoked in GitHub settings; LaunchProof cannot revoke
  the provider grant without the OAuth client secret. The local report remains.
- **Cancel upload:** no request is sent; the local report remains.
- **Upload failure:** the local report remains; the dashboard does not receive a partial scan.

## 7. Security-relevant headers and caching

Private API responses use `Cache-Control: private, no-store, max-age=0` and `Vary: Cookie`.
Dashboard, login, CLI, auth, and API routes are dynamic and marked noindex/noarchive where
appropriate. Public marketing pages are rendered per request for the CSP nonce and contain no private
data. Every application page/API response carries a nonce-based Content-Security-Policy plus clickjacking, MIME-sniffing,
referrer, permissions, and HSTS headers. The CSP allows only the configured Supabase origin for
browser connections, same-origin assets/fonts/forms, and GitHub avatars for images; it does not use
`unsafe-inline` or Production `unsafe-eval`. CSP behavior on the deployed host is **NOT TESTED**.
Structured server logs contain event names, request IDs, route/status metadata, and redacted error
names/codes. They do not intentionally include request bodies, report contents, cookies, tokens, or
secrets.

## 8. Third-party AI

Optional AI remediation in the local CLI is off by default and requires explicit consent. It receives
finding text, not evidence values. The cloud dashboard does not call an AI provider. No AI service is
required for setup or upload.

## 9. Related documents

- [Cloud dashboard architecture](CLOUD_DASHBOARD_ARCHITECTURE.md)
- [Multi-tenant security design](MULTI_TENANT_SECURITY_DESIGN.md)
- [Cloud dashboard setup](CLOUD_DASHBOARD_SETUP.md)
- [Live deployment report](LIVE_DEPLOYMENT_REPORT.md)
