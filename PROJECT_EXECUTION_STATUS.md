# LaunchProof — Execution Status

Persistent execution checklist for LaunchProof v1.0.0. Statuses are updated only after the
corresponding command was actually run. This file distinguishes implemented, tested-passed,
not-tested, and blocked work.

Last updated: 2026-11-24 (Phase 21.9 release)

## Release summary

LaunchProof is implemented as a local-first npm-workspaces monorepo with a working CLI, static and
live verification engine, optional Playwright browser checks, report renderers, demo applications,
tests, documentation, CI, server-rendered public pages, and an optional server-rendered cloud dashboard.

**v1.0.0 is released.** `main` contains merge commit `d9a967f` and tag `v1.0.0`; the GitHub release is
https://github.com/MHK-ctrl/launchproof/releases/tag/v1.0.0. The public site and dashboard are
**Production** on Vercel at https://launchproof-rose.vercel.app (latest release deploy
`dpl_DXbBmXAMTrrUNEK9zoFF6ur1c3W5`, plus CSS follow-up `dpl_7HGYF2poRGSVPUWgwfTENnm8ozxG`). Hosted CI
passes on Node.js 22 and 24.

The cloud schema is applied to a hosted Supabase project and the hosted RLS suite passed 17/17
checks. Phase 21.8 production validation confirmed two-identity tenant isolation, CSRF rejection,
live rate limits, account deletion, GitHub OAuth sign-in, and CLI login/status/revocation. GitHub
repository connect/consent and a CLI upload against a connected repository remain unverified because
GitHub required owner 2FA.

No npm package is published: the public name `launchproof` belongs to an unrelated maintainer. The
CLI ships from the repository or a self-contained `npm pack` tarball. No external security audit has
been performed, and no large third-party application has been validated. The compromised GitHub
OAuth client secret was rotated in Phase 21.2, the old secret was deleted, and the Supabase provider
was updated without recording the new value. See
[PHASE_21_9_FINAL_COMPLETION_REPORT.md](PHASE_21_9_FINAL_COMPLETION_REPORT.md).

## Environment

- macOS 26.6.2, Apple Silicon arm64, 18 GB unified memory assumed per brief
- Node.js 26.0.0, npm 11.12.1, Git 2.39.5
- Project root: `LaunchProof/`
- GitHub CLI authenticated as `MHK-ctrl`; public repository published and CI verified
- Vercel CLI authenticated as `mdhamzakhan2k6-4663` (team `hamza-recallai`); project `launchproof`
  is linked and deployed to Production at `https://launchproof-rose.vercel.app`; Preview and
  Production variables configured, plus Production `APP_BASE_URL`
- Hosted Supabase project `launchproof` (`ypqpqgnviphwxddrpieq`); migrations applied manually; local
  `.env` configured and gitignored; one owner auth user, no retained repositories/scans/findings
  (both Phase 21.8 synthetic users and their rows were deleted)
- No system Chrome; Playwright Chromium headless shell installed for tests

## Phase checklist

| Phase                           | Status       | Notes                                                                                         |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| 0. Environment inspection       | Done         | Tools and resources inspected before scaffolding                                              |
| 1. Architecture                 | Done         | `docs/architecture.md`; package boundaries and scan pipeline documented                       |
| 2. Foundation                   | Done         | npm workspaces, strict TypeScript, ESLint, Prettier, Vitest, tsup                             |
| 3. Project discovery            | Done         | Frameworks, languages, scripts, routes, env references, deployment, integrations              |
| 4. Static security              | Done         | Secrets, source rules, repository hygiene, dependencies, Supabase RLS                         |
| 5. HTTP checks                  | Done         | Headers, cookies, CORS, transport, sensitive paths, error leakage                             |
| 6. API testing                  | Done         | Configured endpoints and OpenAPI paths, identities, anonymous-access checks                   |
| 7. Authorization testing        | Done         | Two-identity BOLA probes, read-only default, env-based identities                             |
| 8. Browser automation           | Done         | Page load, workflows, links, mobile overflow, screenshots                                     |
| 9. Accessibility + performance  | Done         | axe-core and navigation metrics with budgets                                                  |
| 10. Reports                     | Done         | Terminal, self-contained HTML, JSON, SARIF 2.1.0, local storage                               |
| 11. CLI                         | Done         | All required commands, JSON/quiet/verbose/CI modes, exit codes                                |
| 12. Demo apps                   | Done         | Intentionally vulnerable and hardened loopback servers                                        |
| 13. Tests                       | Done         | Unit, live integration, browser E2E, CLI smoke; 53/53 passing                                 |
| 14. Website                     | Done         | Public pages and dashboard deployed in Production; v1.0.0 live validated                      |
| 15. Documentation + CI          | Done         | README, guides, policies, templates, workflow, deployment configs                             |
| 16. GitHub publication          | Done         | Public repository `MHK-ctrl/launchproof`; v1.0.0 tag and GitHub release published             |
| 17. Live deployment             | Done         | Production deployed in Phase 21.7; initial live validation passed                             |
| 18. Final release audit         | Done         | Security, scanner, browser, report, website, docs, CI, deps verified; CONDITIONAL GO          |
| 19. Public GitHub publication   | Done         | 137 files published; Node 22/24 CI passed; repository metadata and clone verified             |
| 20. Cloud dashboard             | Done         | Auth, private scans, RLS tests, CLI tokens; deployed and tenant isolation verified            |
| 21. Hosted Supabase + preview   | Partial      | Hosted RLS 17/17; OAuth configured; Vercel preview blocked by first-deploy rule               |
| 21.2 OAuth rotation + gate      | Ready        | Secret rotated, hosted RLS 17/17, Production vars set; deployment approval pending            |
| 21.3 Pre-production hardening   | Done locally | CSP, headers, Postgres/memory rate limits, token cleanup, observability, tests                |
| 21.4 Hosted audit + 003 review  | Done         | Hosted read-only audit; service-role 403 defect found and fixed in migration 003              |
| 21.5 Hosted apply + validation  | Done         | Ledger 001/002/003; 60/60 synthetic hosted checks; zero rows/users left behind                |
| 21.6 Final pre-deployment audit | Ready        | Local verify/audit pass; hosted read-only re-check matches; no deployment blockers            |
| 21.7 Production deploy + tests  | Done         | Vercel Production live; auth, dashboard, CLI login/status, headers, gating verified           |
| 21.8 Post-deploy validation     | Done         | Tenant isolation, CSRF, rate limits, deletion, CLI tokens verified; GitHub/CLI upload blocked |
| 21.9 v1.0.0 release + deploy    | Done         | PR #1 merged; tag/release published; Production deployed; smoke tests and mobile fix verified |

## Initial implementation verification (historical)

Run on 2026-11-23 from the project root before the phase 18 audit. The test and route counts below
are superseded by the phase 18 results at the end of this document.

| Command                                                             | Result                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run format`                                                    | Exit 0                                                                                                          |
| `npm run lint`                                                      | Exit 0, no findings                                                                                             |
| `npm run build`                                                     | Exit 0; core, browser, and CLI bundles built with declarations                                                  |
| `npm run typecheck`                                                 | Exit 0 for core, browser, CLI, and web                                                                          |
| `npm test`                                                          | Exit 0; 8 test files, 40 tests passed (12.02 s)                                                                 |
| `node packages/cli/bin/launchproof.mjs security --json` (self-scan) | Exit 0; 6 pass, 3 skipped, 0 findings; gate passed. Network, dependency audit, and Supabase checks were skipped |
| `npm run build:web`                                                 | Exit 0; static export, 9 routes, first-load JS shared 103 kB                                                    |
| `node packages/cli/bin/launchproof.mjs --version`                   | `0.1.0`                                                                                                         |
| CLI hostile-demo scan (`test` with both identities)                 | Exit 1 as expected; 22 checks, 23 findings, gate failed on high+                                                |
| Sample report leak check                                            | 0 occurrences of demo credential values                                                                         |
| `npx playwright --version`                                          | 1.65.1; Chromium headless shell installed                                                                       |

Live scan breakdown for the intentionally vulnerable demo: 8 pass, 4 fail, 8 warn, 2 skipped;
3 critical, 3 high, 7 medium, 10 low findings. Observed evidence included an exposed `.env`,
exposed `.git/config`, wildcard CORS with credentials, an unauthenticated user-list API, and a
broken object-level authorization scenario. Browser checks detected the intentional console error,
broken internal link, mobile overflow, and an axe-core contrast violation.

The secure demo integration test passes the HTTP, API, authorization, and gate assertions. This is
test-suite evidence for the two demo implementations, not proof of security for arbitrary apps.

Self-scanning the LaunchProof repository produced no findings, but that is a smoke check only: it
ran without network checks, dependency auditing, or Supabase configuration. It is not an external
audit and does not establish that the project is vulnerability-free. The self-scan also caught and
led to fixes for false positives in Playwright link handling, rule-catalog prose, JWT claim checks,
and lockfile detection during development.

## Implemented

- Config loading (JSON/YAML), strict zod validation, `.env` loading, safe config summary
- Deterministic bounded file walk, glob excludes, text cache, symlink avoidance
- Secret scanning with provider patterns, entropy, placeholders, env hygiene, optional history
- Static security rules and repository/CI/lockfile hygiene
- Optional npm audit with bounded timeout and honest not-verified states
- Supabase migration RLS review and optional anon-key read probe
- Scope-gated HTTP client with redirect re-checks, rate limit, body cap, request budget
- HTTP security, exposure, CORS, cookie, transport, and error-disclosure checks
- API endpoint/OpenAPI contracts, identity env resolution, unsafe-method guard
- Two-identity authorization resource tests
- Playwright workflows, console/network errors, internal links, mobile overflow, screenshots
- axe-core accessibility with violations mapped to findings
- FCP/LCP/CLS/load/JS/requests/DOM measurements against configurable budgets
- Terminal, HTML, JSON, and SARIF reports with status/severity taxonomy, gate, limitations, and
  redaction
- CLI: `init`, `analyze`, `test`, `security`, `scan`, `browser`, `accessibility`, `performance`,
  `report`, `config`, `doctor`; exit codes 0/1/2/3; JSON/quiet/verbose/CI modes
- Vulnerable and secure demos with configs and ephemeral-port test startup
- 40 automated tests across unit, integration, browser E2E, CLI smoke, and precision regressions
- Static website: landing, simulated demo, real report viewer, docs, get-started, about, security,
  not-found; no fake metrics, stars, or testimonials
- CI workflow, Vercel/Netlify configs, issue/PR templates, community and security policies

## Not verified / limitations

- No external security audit or penetration test of LaunchProof or its findings
- Hosted Supabase RLS passed 17/17 checks, but no deployed dashboard/runtime or real OAuth test exists
- No large third-party application or production staging system tested
- TLS certificate chains, protocol versions, and revocation are not assessed
- Lighthouse is not bundled; requesting it yields NOT VERIFIED
- Browser checks cover only configured workflows and sampled pages
- Performance numbers are single local runs, not production benchmarks
- Windows and Linux desktop behavior are not manually tested (CI covers Linux)
- Website deployment has not been performed, so no live URL is claimed
- npm publication has not occurred; install is from source
- Git history scanning is filename-only and bounded

## Remaining approvals and recommended work

1. **GitHub publication:** complete. Public repository, `main` branch, initial commit, metadata,
   clean clone, secret scanning, and Node 22/24 hosted CI are verified. No GitHub release or tag has
   been created.
2. **Website deployment:** requires `vercel login` (CLI is logged out) and explicit deployment
   approval. `vercel.json` and `netlify.toml` are prepared; after deployment, every route and the
   sample report must be verified before claiming a live URL.
3. **npm publication:** deferred and not required for launch. Requires final package ownership/scope
   and explicit approval. The CLI package name is currently `launchproof`; the workspace packages are
   `@launchproof/core` and `@launchproof/browser`.
4. **Real-project validation:** recommended before a 1.0 claim. Run against one staging app, review
   false positives, and document results.
5. **Branch protection:** recommended for `main` when the repository begins accepting contributions;
   require the CI `Verify` matrix before merge.

## Resource profile

- No Docker or background services required
- One Chromium instance, sequential browser checks, five pages maximum by default
- 50 HTTP requests per scan at four requests per second by default
- 8,000-file walk cap and 750 KiB text read cap by default
- Vitest uses sequential files and at most two workers
- Full build, typecheck, tests, and web export complete in under two minutes on the target machine

## Phase 18 — Final release-readiness audit

Completed on 2026-11-23 against the frozen working tree. This phase did not rebuild the product; it
independently reviewed the existing implementation, fixed confirmed issues, added regression coverage,
and reran the complete verification surface.

### Work completed

- Reviewed the full repository, package source, docs, CI, deployment configuration, demos, and website.
- Fixed six high-severity application issues: redirect port/scope bypass, URL-embedded credentials,
  cross-origin redirect header/body forwarding, browser cross-origin navigation and identity-header
  leakage, HTML report escaping gaps, and release-gate handling of `not-verified` checks.
- Fixed high-severity dependency advisories by upgrading Next.js 16.4.6, Zod 4.6.7, Vitest 5.1.1, and
  a PostCSS 8.5.33 override; removed the unused `marked` dependency.
- Fixed medium issues in BOLA classification, Supabase live probes, CLI report validation, config
  validation, and axe-core injection under strict CSP.
- Fixed low issues in control-sequence redaction, the invented GitHub project URL, and website
  contrast/keyboard focus.
- Added regression coverage for CSP-safe accessibility, browser identity isolation, redirect safety,
  report escaping, gate semantics, BOLA classification, and report parsing.
- Created `RELEASE_READINESS_AUDIT.md`, `SECURITY_REVIEW.md`, `DEPLOYMENT_READINESS.md`,
  `GITHUB_PUBLICATION_CHECKLIST.md`, and `V0.1.0_RELEASE_NOTES_DRAFT.md`.
- Updated README documentation links and consistency (Node 22.12+, source-preview status).

### Files changed in this phase

- `packages/core/src/scope.ts`, `packages/core/src/http/client.ts`, `packages/core/src/authorization.ts`,
  `packages/core/src/supabase.ts`, `packages/core/src/scan.ts`, `packages/core/src/util.ts`,
  `packages/core/src/report/html.ts`, `packages/core/src/report/sarif.ts`,
  `packages/core/src/config/schema.ts`, `packages/core/src/version.ts`.
- `packages/browser/src/index.ts`, `packages/browser/test/browser-security.test.ts`.
- `packages/cli/src/index.ts`.
- `apps/web/app/*`, `apps/web/components/*`, `apps/web/app/robots.ts`, `vercel.json`.
- `package.json`, workspace package manifests, `package-lock.json`, `.github/workflows/ci.yml`,
  `README.md`, and root release documents.

### Final verification (current tree)

| Command                                          | Result             | Evidence                                                                                                                      |
| ------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run format`                                 | Exit 0             | Prettier rewrote/checked all files, including new docs                                                                        |
| `npm run format:check`                           | Exit 0             | All matched files use Prettier style                                                                                          |
| `npm run lint`                                   | Exit 0             | No ESLint findings                                                                                                            |
| `npm run typecheck`                              | Exit 0             | Core, browser, CLI, and web                                                                                                   |
| `npm run build`                                  | Exit 0             | Core, browser, CLI bundles with declarations                                                                                  |
| `npm test`                                       | Exit 0             | **13 files, 53 tests passed**, 13.17 s                                                                                        |
| `npm run build:web`                              | Exit 0             | Static export, 11 generated entries                                                                                           |
| `npm run audit`                                  | Exit 0             | `npm audit --audit-level=high`: **0 vulnerabilities**                                                                         |
| Vulnerable demo `test --ci`                      | Exit 1 as expected | 22 checks, 23 findings; 8 pass/4 fail/8 warn/2 skipped; 3 critical/3 high/7 medium/10 low; gate failed                        |
| Secure demo `test --ci`                          | Exit 0             | 22 checks, 4 findings; 19 pass/1 warn/2 skipped; 1 medium/3 low demo-folder hygiene warnings only                             |
| Secure demo accessibility                        | Pass               | 2 pages scanned, 0 axe violations under strict CSP                                                                            |
| Self-scan `security --json`                      | Exit 0             | 9 checks, 0 findings; 6 pass, 3 skipped; gate passed (smoke check only)                                                       |
| Static-site route check                          | 11/11 HTTP 200     | `/`, `/about/`, `/demo/`, `/docs/`, `/get-started/`, `/report/`, `/security/`, `/404.html`, `/robots.txt`, `/sample-report.*` |
| `npm pack --dry-run` (core/browser)              | Exit 0             | `dist` + `package.json` only                                                                                                  |
| `npm pack --dry-run` (CLI)                       | Exit 0             | `bin`, `dist`, `README.md`, `package.json` only                                                                               |
| Browser/site audit (prior phase, unchanged site) | Pass               | 7 routes, 0 axe violations; 24 internal links, 0 broken; mobile nav and report viewer work; no console errors                 |

No final command failed. The secure demo's four findings are expected because `examples/secure-demo`
is a demo directory without its own `.gitignore`, license, README, or CI workflow; they are not
server or application vulnerabilities and remain below the `high` gate threshold.

### Failed checks

- None on the frozen tree.

### Skipped / unavailable checks

- At phase 18 completion, GitHub Actions had not run because no repository existed. Hosted CI has
  since passed in phase 19.
- No production deployment, public alias, domain, or npm publication was performed.
- No real Supabase project was tested; live RLS behavior remains unverified.
- No external security audit or penetration test was performed.
- Lighthouse is not bundled; requesting it yields `not-verified`.

### Outstanding issues

1. DNS rebinding / hostile DNS is not defended against; scope is host-pattern based. Documented in
   `SECURITY_REVIEW.md` and `docs/limitations.md`.
2. No real large third-party application or staging system has been validated.
3. Hosted CI did not exist at phase 18 completion; phase 19 records the successful hosted runs.
4. Canonical URL, sitemap, and absolute social metadata wait for a real deployment hostname.
5. Windows and real mobile browsers are not manually validated.
6. npm package ownership/name availability is unresolved; npm publication is not required for launch.

### Decisions pending user approval

- **Approval A — GitHub publication:** completed in phase 19; public repository and hosted CI are
  verified.
- **Approval B — Website deployment:** still pending. Vercel production deployment requires
  `vercel login` and explicit approval; no deployment exists.
- **npm publication:** separately deferred; no registry changes were made.

### Next exact action at phase 18 close

Approval A was provided after this phase and completed in phase 19. The next remaining approval is
for website deployment.

## Phase 19 — Public GitHub publication and hosted CI

Completed on 2026-11-23. This phase published the reviewed source and verified the real hosted
pipeline; it did not deploy the website, publish to npm, or create a GitHub release or tag.

### Publication record

- **Repository:** https://github.com/MHK-ctrl/launchproof
- **Owner:** `MHK-ctrl`
- **Name:** `launchproof`
- **Visibility:** Public
- **Default branch:** `main`
- **Initial commit:** `87b121717cf7e9981a38f1b2ce613f21ead8646c`
  (`feat: initial LaunchProof v0.1.0 release`)
- **CI formatting fix:** `c035df55b1d6d5e1005c5e0c7cec8396db1dd422`
- **Workflow runtime update:** `c2715989c38f65d240a8d75cd3a5c79d7ba11edd`
- **Tracked files:** 137
- **License:** MIT
- **Topics:** 12, covering developer tools, application security, AI development, browser testing,
  accessibility, API testing, Playwright, DevSecOps, TypeScript, and open source.
- **Private vulnerability reporting:** enabled.
- **Secret scanning alerts:** 0.

### Publication changes

- Updated every repository placeholder with the verified URL.
- Added the real CI badge and a source link to the website footer.
- Added a factual terminal-output example to the README.
- Restored `PROJECT_URL` and SARIF `informationUri` using the real URL.
- Added generated `apps/web/next-env.d.ts` to `.prettierignore` after the first hosted run exposed a
  clean-checkout formatting failure.
- Updated CI to `actions/checkout@v7`, `actions/setup-node@v7`, and `actions/upload-artifact@v7`.
- Added `GITHUB_PUBLICATION_REPORT.md` and updated the checklist, audit, release notes, and this log.

### Hosted CI record

| Run         | Commit    | Result | Evidence                                                   |
| ----------- | --------- | ------ | ---------------------------------------------------------- |
| 45130503645 | `87b1217` | Failed | Format check flagged generated `apps/web/next-env.d.ts`    |
| 45130767473 | `c035df5` | Passed | Node 22 and 24; Chromium tests and website build passed    |
| 45131442874 | `c271598` | Passed | Final code/workflow run with current action majors; 2m 24s |

Final verified run: https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874

Both Node 22 and Node 24 jobs passed every step: install, dependency audit, build, lint, format
check, typecheck, Chromium headless-shell install, tests, website build, and artifact upload on Node 22. No deployment step exists.

### Repository verification

- `git ls-remote` confirmed `refs/heads/main` at the expected commit.
- A fresh `git clone --depth 1` from the public URL succeeded with 137 tracked files.
- The clean clone contained no `node_modules`, `dist`, `.next`, `out`, `.launchproof`, `.env`, keys,
  traces, or local scan reports.
- GitHub reported the repository public, default branch `main`, MIT license, and the intended
  description and topics.
- README rendering, CI badge URL, and source links were verified against the real repository.
- GitHub secret scanning reported 0 alerts.

### Final local verification (post-publication; historical, before v1.0.0)

- Formatting and format check: exit 0.
- Lint: exit 0.
- Typecheck: exit 0 after the ordered package build.
- Tests: 13 files, 53 tests passed.
- Package build: exit 0.
- Website production build: exit 0, 11 generated entries.
- Dependency audit: 0 vulnerabilities.

### Remaining limitations

- Website not deployed; no public site URL, alias, or domain.
- No GitHub release or tag; release creation remains a separate approval decision.
- No npm package published; ownership/name availability unresolved.
- Branch protection is not yet enabled on `main`.
- No external security audit; DNS rebinding, real Supabase, and large third-party application
  validation remain unverified.
- Dependency deprecation warnings from transitive packages are non-failing and documented.

### Next exact action

Website deployment is the next separate mission. It requires `vercel login`, explicit deployment
approval, and post-deployment verification before any public URL is claimed.

## Phase 20 — Optional cloud dashboard and explicit CLI upload

Implemented locally on 2026-11-23 on branch `feat/cloud-dashboard`. This phase does **not** claim a
deployment, a live Supabase run, or a real GitHub OAuth run. Those are blocked on owner credentials.

### Delivered

- Next.js server output (static export removed) with dynamic dashboard/auth/API routes and
  server-rendered public pages (dynamic for the CSP nonce).
- Supabase SSR authentication, GitHub sign-in through Supabase, and a separate repository consent
  flow using GitHub OAuth `repo` scope.
- Encrypted, user-bound, 15-minute HttpOnly connect cookie for the GitHub provider token. The token is
  never stored in PostgreSQL or logs.
- Migration `supabase/migrations/202611230001_cloud_dashboard.sql` with:
  - `profiles`, `repositories`, `scans`, `findings`, `cli_auth_requests`, `cli_tokens`;
  - composite tenant foreign keys;
  - RLS policies and revoked anonymous grants;
  - profile trigger and `repository_scan_stats` security-invoker view.
- Private dashboard: overview, repositories, scan history, scan detail, settings, account.
- APIs for repository connection/listing/deletion, scan upload/list/detail/findings/download/delete,
  account read/delete, health, and CLI token/me/logout/repositories.
- CLI browser loopback login with state + PKCE, one-time code, hashed seven-day tokens, revocation,
  Keychain/0600 storage, and no token printing.
- Explicit `--upload` on `scan`/`security`, plus `upload`, `repositories`, `status`, `login`, and
  `logout` commands. Uploads show a sanitized preview and require confirmation unless `--yes`.
- Server-side strict upload schema, 2 MB limit, 300-check/2,000-finding caps, secret/path redaction,
  safe relative paths, sensitive-reference rejection, and gate recomputation.
- Account deletion deletes the auth user first (cascade), then clears session and connect cookie.
- Documentation: `CLOUD_DASHBOARD_ARCHITECTURE.md`, `MULTI_TENANT_SECURITY_DESIGN.md`,
  `CLOUD_DASHBOARD_SETUP.md`, `PRIVACY_DATA_FLOW.md`, `LIVE_DEPLOYMENT_REPORT.md`; README and
  deployment docs updated.

### Verification run on this tree

| Command                                 | Result                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `npm run build`                         | Exit 0; core, browser, and CLI bundles built                |
| `npm run typecheck -w @launchproof/web` | Exit 0                                                      |
| `npm run build:web`                     | Exit 0; public pages `○`, dashboard/auth/CLI/API routes `ƒ` |
| `npm test`                              | 15 files, 68 tests passed                                   |
| PGlite RLS suite                        | 9 tests passed                                              |
| Sanitization suite                      | 6 tests passed                                              |
| Keychain stdin behavior                 | Add/read/delete of a temporary generic-password item passed |

Branch checkpoint: commit `8c91666` (`feat: add optional cloud dashboard and explicit CLI upload`).
The branch is local; it has not been pushed or merged.

The RLS suite executes the real migration under PGlite with `auth.uid()` derived from a request
claim. It covers own-row access, cross-tenant reads and primary-key lookups, spoofed inserts,
cross-tenant foreign keys, update/delete isolation, the aggregate view, and anonymous denial. It is
not a hosted Supabase test.

### Not verified / blocked at Phase 20 close

At this checkpoint (before Phase 21), no Supabase project or hosted migration existed. Phase 21 later
applied the migration and verified hosted RLS; the remaining runtime gaps are recorded below.

- No GitHub OAuth App, callback consent, or provider-token exchange had been exercised.
- No Vercel login, preview, production deployment, hostname, or deployed header check.
- No live CLI login, token exchange, upload, download, revocation, account deletion, or two-account
  isolation test.
- GitHub Actions/OIDC automatic upload is **not implemented**.
- The GitHub `repo` scope is broad and cannot be made read-only for private repositories with GitHub
  OAuth. The server only issues GET requests and does not store the provider token.
- No MFA, audit logging, distributed rate limiting, monitoring, or scheduled cleanup of expired CLI
  authorization rows.
- No external security audit or penetration test.

### Next exact action

Owner supplies a Supabase project (URL, anon key, service-role key, applied migration), a GitHub OAuth
App, and Vercel authentication/approval. Then follow `CLOUD_DASHBOARD_SETUP.md`: local two-account
verification, preview deployment, full checklist, explicit production approval, production deploy,
and record the real hostname. Do not announce a URL before it exists.

## Phase 21 — Hosted Supabase setup and preview gate

Continued on 2026-11-23 on `feat/cloud-dashboard`; migration hardening commit `98af71e` was pushed to
`origin/feat/cloud-dashboard`. This phase does **not** claim a Vercel deployment, a live GitHub
sign-in, a live CLI upload, or a production URL.

### Hosted Supabase — completed and verified

- Organization: `LaunchProof` (`hhaljmwqphlagxetcccs`).
- Project: `launchproof` (`ypqpqgnviphwxddrpieq`, Tokyo, free plan).
- Applied `202611230001_cloud_dashboard.sql` and the corrective idempotent
  `202611230002_revoke_default_table_privileges.sql` in the hosted SQL editor.
- Hosted catalog verified: six tables, RLS enabled on all six, 16 policies, composite tenant foreign
  keys, profile/scan/finding triggers, and `repository_scan_stats` with `security_invoker=true`.
- Default bootstrap privileges were revoked from `anon` and `authenticated`; `TRUNCATE` is no longer
  granted, and `authenticated` retains only the operations the application uses. This closed a real
  hosted bug where `TRUNCATE` would have bypassed RLS.
- Two disposable Supabase Auth identities were used for a hosted PostgREST/RLS run. All 17 checks
  passed: own-row access, tenant-scoped lists, cross-tenant reads/updates/deletes, victim-row
  preservation, forged `user_id`, cross-tenant scan/finding attachment, aggregate-view isolation,
  anonymous denial, and cleanup. Both disposable identities were deleted.
- The run was repeated after commit `98af71e`: **17/17 passed**.

### GitHub OAuth configuration — configured, not exercised

- GitHub OAuth App `LaunchProof`, app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`.
- Callback: `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`.
- Supabase GitHub provider is enabled with the client ID and callback above. The repository metadata
  consent flow is a separate OAuth flow and has not been exercised.
- **Security action required:** during browser automation, the Supabase provider dialog rendered the
  client secret unmasked in tool output. The value was not intentionally copied, but it must be
  treated as exposed. Rotate the GitHub OAuth client secret and update Supabase before any live
  sign-in test. Do not use the exposed secret for validation.
- Real GitHub sign-in, session establishment/refresh, sign-out, redirect rejection, repository
  consent, and provider-token exchange are **BLOCKED / NOT TESTED** until rotation and a reachable
  application origin exist.

### Vercel — project prepared, no deployment

- Account used: `mdhamzakhan2k6-4663`; team `hamza-recallai`. No account switching occurred.
- Project `launchproof` (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`) created and linked. Root directory `.`,
  Git repository not connected, no deployments.
- Preview-scoped variables set without printing values: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config), `SUPABASE_SERVICE_ROLE_KEY`,
  `LAUNCHPROOF_ENCRYPTION_KEY` (Secret). `APP_BASE_URL` is intentionally unset until a real preview
  origin exists.
- `vercel deploy --environment preview` was refused by Vercel: **the first deployment of a new
  project is always Production**. No production deployment was created, no alias/domain exists, and
  `vercel ls launchproof` reports no deployments.
- Because preview-only deployment is impossible under that rule without an unauthorized production
  deployment, the preview URL, `APP_BASE_URL`, Supabase preview callback allowlist, deployed header
  checks, hosted browser tests, and live CLI upload remain **BLOCKED**.

### Verification run after this phase

| Command                                                         | Result                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npx vitest run packages/core/test/cloud-dashboard-rls.test.ts` | 9/9 passed                                                          |
| `npm test`                                                      | 15 files, 68/68 tests passed                                        |
| Hosted `/tmp/lp-hosted-rls.mjs`                                 | 17/17 checks passed                                                 |
| `vercel whoami`                                                 | `mdhamzakhan2k6-4663`                                               |
| `vercel project inspect launchproof`                            | linked, no Git, no deployment                                       |
| `vercel deploy --environment preview`                           | refused: first deploy is prod                                       |
| Local dev server against hosted Supabase                        | `/` 200, `/login` 200, `/dashboard` 307 to login, `/api/health` 200 |

### Exact remaining blockers

1. Rotate the exposed GitHub OAuth client secret and update Supabase (owner 2FA).
2. Vercel requires one Production deployment before any Preview deployment exists. Production is not
   authorized; owner must explicitly approve that first production deployment or choose a host/plan
   that permits a preview-only first deployment.
3. After a reachable preview exists: set `APP_BASE_URL`, add the exact preview callback to Supabase,
   redeploy, and run the real GitHub OAuth, CLI, two-account, dashboard, header, and performance
   checks.
4. No production deployment, merge, tag, release, npm publication, or custom domain has occurred.

## Phase 21.2 — OAuth secret rotation and initial Production gate

Continued on 2026-11-23 from `ded30b5` on `feat/cloud-dashboard`. This phase does **not** claim a
Vercel deployment, a production URL, or a live OAuth/CLI test. The initial Production deployment
remains **BLOCKED pending explicit owner authorization**.

### OAuth rotation — completed

- The GitHub OAuth App `LaunchProof` (app ID `4046464`, client ID `Ov23li2D78osdcDjz84Y`) was
  confirmed before modification.
- A new client secret was generated without DOM extraction or snapshot capture, saved into the
  Supabase GitHub provider, and the old secret was **deleted**. One masked secret remains.
- The clipboard was cleared and generated snapshots removed. The secret was not read back, printed,
  committed, or placed in a report. No secret value is recorded in this repository.
- Supabase provider re-check: client ID matches; callback remains
  `https://ypqpqgnviphwxddrpieq.supabase.co/auth/v1/callback`; provider enabled.

### Supabase after rotation — verified

- Hosted RLS/PostgREST suite re-run: **17/17 passed** with two disposable identities, then both
  identities were deleted.
- Hosted SQL audit: six tables all with RLS enabled, 16 policies, zero `anon` grants, zero
  `authenticated` `TRUNCATE` grants, zero auth users, and zero profile/repository/scan/finding rows.
- Site URL remains `http://127.0.0.1:3000`; redirect allowlist contains only
  `http://127.0.0.1:3000/auth/callback`.
- No unexpected migration or production data exists. The project has no
  `supabase_migrations.schema_migrations` ledger because both migrations were applied manually in the
  SQL editor; this is a documented operational gap.

### Vercel — prepared (historical Phase 21.2 state; superseded by Production deployment)

- Account `mdhamzakhan2k6-4663`, team `hamza-recallai`; project `launchproof`
  (`prj_OMc6CDEwAcGppuZFhEqa3j0X95u3`), root `.`, Next.js, `npm ci`, `npm run build:web`, no Git
  connection, **no deployments**.
- Four variables now exist in both Preview and Production without values being printed:
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config);
  `SUPABASE_SERVICE_ROLE_KEY` and `LAUNCHPROOF_ENCRYPTION_KEY` (Secret).
- `APP_BASE_URL` remains unset. It must be set to the real Vercel production origin after deployment
  and the app must then be redeployed.
- Vercel assigns the first deployment of this project to Production. A preview-only first deployment
  is not possible; no temporary deployment, alternate project, or account switch was used.

### Production readiness checks

| Check                                      | Result                                                          |
| ------------------------------------------ | --------------------------------------------------------------- |
| `npm run verify`                           | Exit 0; 15 files / 68 tests; lint, typecheck, builds, web build |
| `npm audit --audit-level=high`             | 0 vulnerabilities                                               |
| Secret scan (exact values, tracked/client) | 200 tracked + 19 client static files; 0 hits                    |
| Production web build                       | Passed; Proxy recognized as middleware; server output           |
| Local `next start`                         | `/api/health` 200; public routes 200                            |
| axe WCAG A/AA, eight public pages          | 0 violations after logo and mobile-overflow fixes               |
| Mobile 390 px, five public pages           | No horizontal overflow                                          |
| Signed-out `/dashboard`                    | Redirects to `/login?next=%2Fdashboard`                         |

UI fixes in this phase: the logo link now uses its visible text as the accessible name, and
`/get-started` grid children use `min-w-0` so long code blocks do not widen the mobile viewport.

### Approval gate and remaining work

1. **No production deployment has been created.** The exact requested authorization is:
   **"Authorize the initial LaunchProof Production deployment to Vercel."**
2. After approval: verify the final commit and clean tree, deploy the initial Production build,
   capture the real URL, set `APP_BASE_URL`, add the exact Supabase callback, and redeploy if needed.
3. Then run live GitHub sign-in, repository consent, CLI login/upload/download/logout, two-account
   isolation, account deletion, deployed headers, mobile, and lightweight performance checks.
4. Not tested: deployed runtime, OAuth provider exchange, CLI upload, CSP/HSTS behavior, monitoring,
   external audit, and distributed rate limits. No URL is claimed.

## Phase 21.3 — Pre-production hardening

Continued on 2026-11-23 from `215a3e2` on `feat/cloud-dashboard`. This phase prepared and verified
security hardening locally; it did **not** deploy or mutate hosted Supabase.

### Completed locally

- Per-request nonce CSP with `strict-dynamic`, static security headers in `next.config.ts`, and
  dynamic public-page rendering so nonces match the HTML.
- Atomic Postgres fixed-window rate limiting with a bounded in-memory fallback and hashed, trusted
  client keys only on a verified Vercel runtime.
- CLI token validity checks and failure-safe opportunistic cleanup.
- Account-deletion auth/cleanup separation, repository-disconnect cookie clearing, and revocation
  success/error feedback.
- Structured JSON logs with request IDs and redacted error names/codes.
- Additive, idempotent migration `202611230003_security_hardening.sql`, a manual migration-ledger
  reconciliation script, and `supabase/MIGRATION_TRACKING.md`.

### Verification

`npm run verify` passed with **20 test files / 105 tests**, format, lint, typecheck, builds, and the
production web build. `npm audit --audit-level=high` reported 0 vulnerabilities. A local production
server passed header, CSP, page-load, sample-report, and sign-in-message checks. Full evidence and
status labels are in [`PHASE_21_3_REPORT.md`](PHASE_21_3_REPORT.md).

### Blocked / not tested

- Hosted migration-ledger reconciliation and migration `003` are **BLOCKED** pending owner
  authorization; neither was run.
- Vercel deployment, live OAuth, live CLI, authenticated dashboard CSP, two-account browser
  isolation, and deployed performance remain **NOT TESTED**.
- The initial Production deployment remains **BLOCKED pending explicit owner authorization**.

## Phase 21.4 — Hosted migration reconciliation and security migration review

Continued on 2026-11-23 from `d15ea3c` on `feat/cloud-dashboard`. This phase re-audited hosted
Supabase read-only, reviewed migration 003, and validated the limiter/cleanup locally. It did **not**
mutate hosted Supabase, deploy, merge, tag, release, or publish.

### Hosted read-only audit — VERIFIED — HOSTED

- Exactly the six application tables and `repository_scan_stats` view exist, owned by `postgres`.
- RLS on all six tables; 16 policies; three triggers; both composite tenant foreign keys; view is
  `security_invoker=true`.
- `anon` has no table grants; `authenticated` has no `TRUNCATE`; no auth users and zero application
  rows.
- The migration ledger is absent and `rate_limits`/the three new functions are absent.

### Critical defect found — BLOCKED

`service_role` has `bypassrls` but no DML on the application tables. A real PostgREST read with the
service-role key returned 403 `permission denied for table profiles` (42501). Every server-side
admin path would fail in a deployment. Migration 003 is revised to grant only the DML the app uses;
this is **not fixed hosted** until the owner authorizes and applies 003.

### Prepared and locally verified

- Migration 003 now has a preflight, service-role grants, postgres default-ACL hardening, bounded
  token cleanup (100/call), bounded `cleanup_rate_limits`, and stricter input validation.
- Reconciliation SQL has stronger guards; a guarded SQL file records 003 only after verifying its
  objects and grants.
- `npm run verify`: **20 test files / 109 tests** passed, including migration, limiter, and RLS
  tests. A temporary PostgreSQL instance accepted 40 concurrent limiter requests with exactly 5
  allowed and 35 denied. `npm audit --audit-level=high`: 0 vulnerabilities. Secret scan: 0
  hardcoded-secret findings.

### Blocked / not tested

- Hosted ledger reconciliation, migration 003 application, and the 003 ledger record are **BLOCKED**
  pending explicit owner authorization. No hosted mutation was performed.
- Hosted rate-limiter, token-cleanup, service-role REST, and post-003 RLS checks are **NOT TESTED**.
- Vercel deployment, deployed CSP/OAuth/CLI, and two-account browser isolation remain **NOT TESTED**.

Full evidence and the exact approval request are in [`PHASE_21_4_REPORT.md`](PHASE_21_4_REPORT.md).

## Phase 21.5 — Authorized hosted migration application and synthetic validation

Continued on 2026-11-23 on `feat/cloud-dashboard`. The owner explicitly authorized the reviewed
hosted operations without a provider backup after confirming the project was empty and accepting the
limited risk. The operations ran in the authorized order, each from the exact committed file with a
pre-execution SHA-256 check. No guard was bypassed and no reviewed SQL was altered hosted.

### Completed — VERIFIED — HOSTED

- Ledger reconciliation recorded only `202611230001` and `202611230002` (HTTP 201).
- Migration `202611230003` applied (HTTP 201); `rate_limits`, its expiry index, and the three
  security-definer functions were created; service-role DML, function ACLs, default ACL hardening,
  and RLS were verified independently.
- The guarded record script recorded `202611230003` (HTTP 201). The final ledger contains exactly
  three rows with zero unexpected versions.
- Low-volume hosted synthetic validation passed **60/60** checks: service-role PostgREST reads,
  anonymous/authenticated denials, profile-trigger creation, repository/scan/finding tenant
  isolation, `security_invoker` view isolation, rate-limit counting/window reset/isolation, bounded
  rate-limit cleanup (2 then 1), and CLI token cleanup (2 removed, active preserved).
- Cleanup left zero auth users and zero rows in all seven tables and the view. No real user or
  application data was introduced.

### Resolved / residual

- The Phase 21.4 `service_role` 403 defect is resolved; server-side PostgREST reads return 200.
- `service_role` also retains bootstrap `REFERENCES`/`TRIGGER`/`TRUNCATE` (and `MAINTAIN` where
  supported) privileges and a broad `arwdDxtm` default ACL. It is server-only, but broader than strict DML least privilege; a future
  least-privilege migration is a separate decision.
- `supabase_admin` defaults remain broad; application objects must stay `postgres`-owned.
- No scheduled cleanup job exists, and no provider backup exists. The saved baseline is catalog
  evidence, not a data backup.

### Verification and artifacts

- `supabase/manual/PHASE_21_5_ROLLBACK_BASELINE.json` — pre-mutation baseline, 63,394 bytes.
- `supabase/manual/PHASE_21_5_HOSTED_VALIDATION.json` — sanitized 60/60 hosted results.
- `npm run verify` passed after documentation updates: format, lint, builds, typecheck, 20 test files
  / 109 tests, and production web build. `npm audit --audit-level=high` remains 0 vulnerabilities; no
  dependency changed in this phase.

### Blocked / not tested

- Hosted concurrency/load, `supabase` CLI list/dry-run, deployed Vercel runtime, live GitHub OAuth,
  live CLI, deployed CSP/HSTS/cookies, and two-browser isolation remain **NOT TESTED**.
- The initial Vercel Production deployment remains **BLOCKED pending separate explicit owner
  authorization**. Database readiness does not authorize deployment.

Full evidence is in [`PHASE_21_5_REPORT.md`](PHASE_21_5_REPORT.md).

## Phase 21.6 — Final pre-deployment audit and launch preparation

Continued on 2026-11-23 from `4151a129` on `feat/cloud-dashboard`. This phase audited the exact
candidate commit, re-verified the hosted state **read-only**, and prepared the first Vercel
deployment plan and a post-deployment test plan. It did **not** deploy, merge, tag, release, publish,
modify OAuth secrets, or mutate the hosted database.

### Completed — VERIFIED — LOCAL

- Branch `feat/cloud-dashboard` at `4151a1298fe6217eb358772f3ee99bdd15f21f78`, in sync with
  `origin/feat/cloud-dashboard`, clean worktree, `git diff --check` exit 0, no untracked files.
- `npm run verify`: format, lint, core/browser/CLI builds, typecheck, **20 test files / 109 tests**,
  and the production web build all passed (exit 0).
- `npm audit --audit-level=high`: 0 vulnerabilities. `npm ci --dry-run`: `up to date` (lockfile in
  sync with `package.json`). No dependency changed.
- Focused security review of authentication, session handling, tenant ownership, repository consent,
  CLI PKCE/token lifecycle, upload validation, download authorization, account deletion,
  sanitization, rate limiting, error/log hygiene, CSP nonce, security headers, cookies, SSRF, XSS,
  injection, CSRF, env separation, and RLS/service-role usage. No new vulnerability found; no
  speculative hardening applied.
- Secret scan over tracked files found only the project's own redaction regexes and synthetic test
  strings. `.env` remains gitignored; no local database artifact or test identity is tracked.
- Local dev-server smoke: `/api/health` 200, `/api/cli/repositories` 401 without a token, `/login`
  200; the proxy/CSP request pipeline is active.

### Completed — VERIFIED — HOSTED (read-only, no mutation)

- Host `ypqpqgnviphwxddrpieq.supabase.co`; service-role PostgREST reads returned **200** on all eight
  application relations with `count=0`; anonymous reads returned **401** on all eight.
- Exposed RPC paths `/rpc/consume_rate_limit`, `/rpc/cleanup_cli_tokens`, `/rpc/cleanup_rate_limits`
  and the seven tables plus `repository_scan_stats` were present, reconfirming the 003 objects.
- Auth settings returned 200 with the `github` provider enabled.
- Migration-ledger rows and the Supabase Site URL/redirect allowlist were **not** re-queried this
  phase (no read-only management credential in session); no SQL has run since the Phase 21.5
  verification. The saved Phase 21.5 ledger and baseline evidence remain authoritative.

### Configuration (names and scopes only; no values read)

- Preview and Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config).
- Preview and Production: `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCHPROOF_ENCRYPTION_KEY` (Secret).
- `APP_BASE_URL`: not set. Safe for the first deployment because `appBaseUrl()` falls back to
  `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel documents as always set at build and runtime. It must
  be set to the real origin and redeployed immediately after the first deployment.
- Vercel project: root `.`, framework Next.js 16.4.6, install `npm ci`, build `npm run build:web`,
  Node.js `26.x` (locally `26.0.0`; Vercel documents 26.x as available), Git not connected, **no
  deployments**, region `iad1`.

### Blockers and required post-deployment configuration

- **No genuine deployment blocker was found** in code, tests, build, lockfile, or project config.
- Required immediately after the origin exists (owner-authorized, part of the same gate): set
  `APP_BASE_URL=https://<production-origin>` and redeploy; add exactly
  `https://<production-origin>/auth/callback` to Supabase URL Configuration and set the Site URL to
  the production origin (keeping localhost for development). Keep the GitHub OAuth callback at the
  Supabase callback URL. Until then, GitHub sign-in will not complete against production.
- Hosted database mutations: none. Deployment: none.

### Blocked / not tested

- Deployed Vercel build/runtime, headers, cookies, CSP behavior, HSTS, GitHub OAuth exchange, live
  CLI login/upload/download/revocation, deployed account deletion, and two-browser isolation remain
  **NOT TESTED** because no deployment exists.
- Hosted concurrency/load, `supabase` CLI list/dry-run, and provider backup remain **NOT TESTED**.
- The initial Vercel Production deployment remains **BLOCKED pending explicit owner authorization**.

Full evidence, the exact deployment plan, and the post-deployment test plan are in
[`PHASE_21_6_REPORT.md`](PHASE_21_6_REPORT.md).

## Phase 21.7 — Initial Vercel Production deployment and first live validation

Authorized and completed on `feat/cloud-dashboard` at
`73912cf2d6d8aaf2d65c83cd89baf6079d92c274`. No code changed; only Vercel build settings,
`APP_BASE_URL`, Supabase Auth URL configuration, and documentation were updated.

- **Production:** https://launchproof-rose.vercel.app — deployment
  `dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz`, target Production, status Ready, 40 s build. The deployment
  alias `launchproof-hamza-recallai.vercel.app` serves the same build behind Vercel Authentication.
- **Build configuration:** Root Directory remains the repository root; framework Output Directory
  overridden to `apps/web/.next`; install `npm ci`; build `npm run build:web`; Node.js 26.x; region
  `iad1`; Git integration not connected.
- **Deployment attempts:** two failed attempts (`NEXT_OUTPUT_DIR_MISSING` at 34 s, then
  `BUILD_UTILS_SPAWN_1` at 13 s) were resolved with Vercel project settings only, without touching
  the authorized commit. Two subsequent deployments were Ready.
- **`APP_BASE_URL`:** set to `https://launchproof-rose.vercel.app` for Production (Config type) and
  redeployed. Preview remained unchanged.
- **Supabase:** Site URL is now the production origin; redirect allowlist has exactly the retained
  localhost callback plus `https://launchproof-rose.vercel.app/auth/callback`. No wildcard. GitHub
  OAuth callback unchanged; no OAuth secret change.
- **Verified in Production:** HTTPS/200 and canonical domain; all public routes and `/api/health`;
  signed-out dashboard redirects; `401` on all private APIs; sanitized `/auth/callback` error;
  CSP nonce, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`,
  and private `no-store`/`noindex`; GitHub sign-in; dashboard Overview/Repositories/Scans/Settings/
  Account; authenticated account/repository/scan reads; invalid upload `400`; CLI login (loopback +
  PKCE), `status`, and `logout`; CLI upload correctly refused with no connected repository; sign-out.
- **Not tested:** two-account isolation, repository connect/consent and provider-token exchange,
  CLI upload/download/revoke-all, account deletion, live rate limits, deployment performance/load,
  mobile and accessibility, and runtime-log review.
- **Observations (open, non-blocking):** signed-out `/dashboard/settings` redirect keeps
  `next=/dashboard`; Supabase session cookies are client-managed (`HttpOnly=false`, `Secure=false`)
  and rely on the CSP for mitigation.
- **Cleanup:** temporary CLI config directory and synthetic scan fixtures were deleted; the CLI token
  was revoked server-side; the browser session was signed out; the worktree stayed clean.
- **Restrictions honored:** no merge to `main`, tag, release, publish, database reset, secret
  exposure, real-user data, load testing, Docker, or deployment of a different commit.

Full evidence and the untested-area list are in [`PHASE_21_7_REPORT.md`](PHASE_21_7_REPORT.md).

## Phase 21.8 — Post-deployment functional, isolation, and security validation

Completed against the pinned Production deployment `dpl_HgJwEytzp1F3Z3BNvTv9dn2phMjz`
(commit `73912cf`) on `feat/cloud-dashboard`, starting from docs commit `f97edb0`. No deployment.

- **Verdict:** PRODUCTION VALIDATION PASSED WITH NON-BLOCKING ISSUES — 135 checks recorded
  (127 PASS, 0 FAIL, 2 WARN, 6 NOT VERIFIED). Evidence:
  [`supabase/manual/PHASE_21_8_VALIDATION.json`](supabase/manual/PHASE_21_8_VALIDATION.json).
- **Tenant isolation (mandatory gate): PASS** with two disposable synthetic identities. Application
  APIs returned empty lists/`404` for the other tenant's repositories, scans, findings, downloads,
  mutations, and uploads; RLS returned `[]` or 0 rows for cross-tenant reads/writes and the victim's
  data stayed intact.
- **Authentication:** GitHub sign-in, session refresh, sign-out, cookie clearing, private-route
  gating, and sanitized callback errors verified. External/protocol-relative `next` values collapse
  to `/dashboard`.
- **CSRF:** every authenticated state-changing endpoint rejects foreign or missing `Origin` (403),
  wrong content types (415), malformed JSON (400), and oversized payloads (413).
- **Rate limiting:** live per-user download limit enforced — request 61 returned `429` with
  `Retry-After`; another user was unaffected.
- **CLI:** login (loopback + PKCE), status, local scan, explicit-upload refusal, logout, and token
  revocation verified; Settings showed 0 active tokens. CLI upload/download against a connected
  repository is **not verified**.
- **Account deletion:** both synthetic users deleted via the app; all tenant rows zeroed, Auth user
  `404`, stale cookie `401`, stale JWT reads `[]`; owner data untouched.
- **GitHub repository connection:** initiation and scope inspection passed
  (`user:email read:user repo`, matching the documented integration), but consent is **BLOCKED** by
  GitHub sudo mode/2FA ("Use GitHub Mobile"). Provider-token cookie, repository association, and
  disconnect therefore remain untested; no partial state was created.
- **Reliability:** runtime logs contained only info-level entries with no errors, stack traces, or
  secret-like strings; `/api/health` remained 200 and the origin stayed healthy.
- **Findings:** no P0/P1/P2. P3: deep-link redirect collapse (fixed locally), `Secure=false` session
  cookies (fixed locally), dashboard horizontal overflow at 390 px (recorded, not changed). Info:
  broad GitHub `repo` scope is documented by design.
- **Source changes (not deployed):** proxy path header, dashboard layout redirect target, `Secure`
  cookie options for browser/server/proxy clients, two small helper modules, and regression tests.
  `npm run verify` exit 0; `npm test` 21 files / 115 tests.
- **Cleanup:** both synthetic Auth users and all rows deleted; this phase's owner CLI token and auth
  request removed by exact ID; temporary config/session/scripts/logs removed; owner row counts and
  the production deployment unchanged.

Full detail, isolation matrix, and remaining risks: [`PHASE_21_8_REPORT.md`](PHASE_21_8_REPORT.md).
