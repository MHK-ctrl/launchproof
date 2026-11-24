# Changelog

All notable changes to LaunchProof are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-11-24

First supported release. The CLI and verification engine are unchanged in capability from the
0.1.0 preview; this release adds the public website, the hosted dashboard, release documentation,
privacy and terms pages, and production validation.

### Added

- Hosted website and dashboard at https://launchproof-rose.vercel.app, deployed from `main`.
- GitHub sign-in through Supabase, private dashboard, repository connection, scan history, findings,
  and authorized JSON report downloads.
- CLI cloud workflow: `login` (loopback + PKCE), `status`, `repositories`, explicit `--upload`,
  `logout`, and token revocation. Uploads are sanitized summaries only.
- Public pages for privacy, terms, and contact/responsible disclosure, plus footer and docs links.
- Release documentation: refreshed README, docs, changelog, launch materials, and a final completion
  report.
- Regression coverage for dashboard deep-link redirects and `Secure` session cookies on HTTPS.

### Security

- Tenant isolation verified against production with two disposable identities at the API and RLS
  layers; cross-tenant reads, updates, uploads, and downloads were denied.
- CSRF/origin checks reject foreign or missing `Origin` on every authenticated state-changing route.
- Live per-user rate limiting verified (download limit returns `429` with `Retry-After`).
- Account deletion verified for synthetic accounts: every tenant row removed, Auth user gone, stale
  sessions denied.
- Session cookies are marked `Secure` on HTTPS; they remain client-managed and thus not `HttpOnly`.
- The CSP keeps a per-request nonce with `strict-dynamic`; private responses stay `no-store` and
  `noindex`.

### Known limitations

- GitHub repository consent and a CLI upload against a connected repository were not exercised in
  production because GitHub required owner 2FA during validation. No partial GitHub state exists.
- The npm name `launchproof` is owned by an unrelated project; the CLI installs from the repository
  or an `npm pack` tarball until a scoped package name is chosen.
- CLI "revoke all" was not exercised; tokens were revoked individually.
- No external security audit, penetration test, or certification has been performed.
- No paid monitoring, alerting, or automated database backups are configured.
- Some automated checks are heuristic and may be wrong; read the report limitations.

## [0.1.0] — 2026-11-23 — source preview (unreleased)

The first public source preview. Not published to npm at the time of writing.

### Added

- npm-workspaces monorepo with strict TypeScript packages for core, browser, and CLI.
- Bounded project discovery: frameworks, languages, package manager, scripts, API routes, env
  references, deployment targets, integrations, and test frameworks.
- Secret scanning with provider patterns, entropy heuristics, placeholder filtering, `.env`
  hygiene, tracked-file detection, and optional sensitive-filename git history review. Values are
  masked before findings are created.
- Static security rules for dynamic code execution, raw HTML sinks, shell/SQL interpolation,
  permissive CORS, disabled TLS verification, service-role usage, environment logging, and unsafe
  build flags.
- Repository hygiene checks for `.gitignore`, lockfiles, CI, README, and license.
- Optional npm dependency audit with network checks enabled.
- Bounded HTTP client with scope checks on every redirect, rate limiting, timeouts, and response
  caps.
- HTTP checks for security headers, cookies, CORS, transport, sensitive path exposure, error
  leakage, and reachability.
- API contract checks for configured endpoints and OpenAPI documents, including JSON shape,
  latency budgets, and anonymous-access detection.
- Two-identity object-level authorization probes with read-only defaults.
- Supabase static RLS migration review and an optional anon-key live read probe.
- Optional Playwright browser checks: page load, console/network errors, configured workflows,
  internal links, mobile overflow, axe-core accessibility, and navigation performance budgets.
- Report engine with terminal, self-contained HTML, JSON, and SARIF 2.1.0 outputs.
- CLI commands: `init`, `analyze`, `test`, `security`, `scan`, `browser`, `accessibility`,
  `performance`, `report`, `config`, and `doctor`, with JSON/quiet/verbose/CI modes and exit codes.
- Intentionally vulnerable and hardened demo servers with scan configurations.
- Public Next.js website with landing page, clearly labeled simulated demo, real sample report
  viewer, documentation, get-started, about, and security pages.
- CI workflow, Vercel/Netlify static deployment configuration, issue templates, and community
  documentation.
- Vercel and Netlify deployment configuration for the static website.

### Security

- Remote testing requires explicit authorization and host scope.
- Private networks require an opt-in; cloud metadata hosts are blocked.
- Unsafe API methods are disabled unless configured.
- Secrets are masked in reports; HTTP response bodies are excluded from evidence.
- Optional AI remediation is consent-gated and sends no evidence values.

### Known limitations

- Static rules are heuristics, not exploit proof.
- TLS certificate chains and protocol versions are not independently assessed.
- HTTP checks are unauthenticated unless identities are configured.
- Browser coverage is limited to configured workflows and sampled pages.
- Performance is a single local measurement; Lighthouse is not bundled.
- Live Supabase write policies are not tested.
- No real Supabase project, large third-party application, or external security audit has been
  performed.
