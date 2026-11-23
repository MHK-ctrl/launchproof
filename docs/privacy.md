# Privacy and data handling

LaunchProof is local-first. There is no LaunchProof account, telemetry endpoint, hosted dashboard, or
cloud storage.

## What stays local

- Project discovery and file contents
- Secret scanning and findings
- Static analysis
- HTTP/API/authorization results
- Browser workflows, accessibility results, and performance measurements
- Reports, screenshots, and traces under `.launchproof/`

## What can leave the machine

Only when you enable the corresponding feature:

1. **Target requests** — the URL you configure receives the configured verification requests.
   Scope rules apply before every request and redirect.
2. **npm registry** — when `scan.network` is true, the package manager's audit command queries the
   registry with dependency metadata.
3. **Supabase** — when `supabase.live` is configured, one read-only request per listed table goes to
   the configured Supabase URL using the anon key from an environment variable.
4. **AI provider** — only when `ai.enabled` and `ai.consent` are true and an API key is present.
   Finding titles, descriptions, locations, and current remediation text are sent. Evidence values
   and credentials are not sent.
5. **Links** — browser link checks request same-origin pages found on sampled pages.

No other external service is contacted.

## Reports

Reports can contain:

- project and package names
- file paths and line numbers
- framework/dependency versions
- API route paths and HTTP URLs
- response status, content type, and size
- file/URL locations and evidence labels

They intentionally exclude credential values, HTTP response bodies, environment file contents, and
identity header values. Review reports before publishing; internal URLs and architecture can still be
sensitive.

## Secrets

- Credential-like values are masked at finding creation.
- Environment variable values are loaded only to satisfy configured identities or live checks.
- `launchproof config` prints names and safe counts, never values.
- `.env` files are never included in reports.
- AI remediation does not receive evidence values.

Masking is best-effort pattern matching. A novel credential format may not be recognized. Rotate
anything confirmed exposed.

## Screenshots and traces

When enabled, browser screenshots are written to `.launchproof/screenshots/`. They can contain
personal data rendered by the application under test. Treat them as sensitive and delete them when no
longer needed.

## Retention and deletion

Delete the `.launchproof/` directory to remove local artifacts. CI artifacts follow your retention
policy. If you explicitly uploaded a report to the optional cloud dashboard, delete the scan or the
account in the dashboard; local files are not touched by that deletion. See
[PRIVACY_DATA_FLOW.md](../PRIVACY_DATA_FLOW.md).

## Website

The public website pages are prerendered. They do not run scans or collect analytics, and the sample
report viewer fetches a committed JSON file from the same origin.

An optional cloud dashboard is implemented but not deployed. Its hosted database schema and RLS have
been verified, but real GitHub sign-in and CLI uploads have not been exercised. It accepts GitHub
sign-in and explicit CLI uploads of sanitized scan summaries; it is not required for local scanning.
The full field-level data flow is documented in [PRIVACY_DATA_FLOW.md](../PRIVACY_DATA_FLOW.md).
