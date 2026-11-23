# LaunchProof — Execution Status

Persistent execution checklist for the v0.1.0 source preview. Statuses are updated only after the
corresponding command was actually run. This file distinguishes implemented, tested-passed,
not-tested, and blocked work.

Last updated: 2026-11-23

## Release summary

LaunchProof is implemented as a local-first npm-workspaces monorepo with a working CLI, static and
live verification engine, optional Playwright browser checks, report renderers, demo applications,
tests, documentation, CI, prerendered public pages, and an optional server-rendered cloud dashboard.

The source tree has completed the phase 18 release-readiness audit and is published as a public
source repository at https://github.com/MHK-ctrl/launchproof. Hosted CI passes on Node.js 22 and 24.
The public site and the cloud dashboard are **not** deployed, no npm package is published, and no
GitHub release or tag exists. No external security audit has been performed. The cloud schema has
been applied to a hosted Supabase project and the hosted RLS suite passed 17/17 checks with two
disposable identities. The Supabase GitHub provider is configured, but real GitHub OAuth has not
been exercised, no live CLI upload has run, and no Vercel deployment exists because Vercel requires
a new project's first deployment to be Production, which is not authorized. The compromised GitHub
OAuth client secret was rotated in Phase 21.2, the old secret was deleted, and the Supabase provider
was updated without recording the new value. No large third-party application has been validated.

## Environment

- macOS 26.6.2, Apple Silicon arm64, 18 GB unified memory assumed per brief
- Node.js 26.0.0, npm 11.12.1, Git 2.39.5
- Project root: `LaunchProof/`
- GitHub CLI authenticated as `MHK-ctrl`; public repository published and CI verified
- Vercel CLI authenticated as `mdhamzakhan2k6-4663` (team `hamza-recallai`); project `launchproof`
  is linked but has no deployments; Preview and Production variables configured
- Hosted Supabase project `launchproof` (`ypqpqgnviphwxddrpieq`); migrations applied manually; local
  `.env` configured and gitignored; no auth users or tenant rows
- No system Chrome; Playwright Chromium headless shell installed for tests

## Phase checklist

| Phase                          | Status       | Notes                                                                                |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------ |
| 0. Environment inspection      | Done         | Tools and resources inspected before scaffolding                                     |
| 1. Architecture                | Done         | `docs/architecture.md`; package boundaries and scan pipeline documented              |
| 2. Foundation                  | Done         | npm workspaces, strict TypeScript, ESLint, Prettier, Vitest, tsup                    |
| 3. Project discovery           | Done         | Frameworks, languages, scripts, routes, env references, deployment, integrations     |
| 4. Static security             | Done         | Secrets, source rules, repository hygiene, dependencies, Supabase RLS                |
| 5. HTTP checks                 | Done         | Headers, cookies, CORS, transport, sensitive paths, error leakage                    |
| 6. API testing                 | Done         | Configured endpoints and OpenAPI paths, identities, anonymous-access checks          |
| 7. Authorization testing       | Done         | Two-identity BOLA probes, read-only default, env-based identities                    |
| 8. Browser automation          | Done         | Page load, workflows, links, mobile overflow, screenshots                            |
| 9. Accessibility + performance | Done         | axe-core and navigation metrics with budgets                                         |
| 10. Reports                    | Done         | Terminal, self-contained HTML, JSON, SARIF 2.1.0, local storage                      |
| 11. CLI                        | Done         | All required commands, JSON/quiet/verbose/CI modes, exit codes                       |
| 12. Demo apps                  | Done         | Intentionally vulnerable and hardened loopback servers                               |
| 13. Tests                      | Done         | Unit, live integration, browser E2E, CLI smoke; 53/53 passing                        |
| 14. Website                    | Done locally | Public pages prerendered; optional dashboard is server-rendered; not deployed        |
| 15. Documentation + CI         | Done         | README, guides, policies, templates, workflow, deployment configs                    |
| 16. GitHub publication         | Done         | Public repository `MHK-ctrl/launchproof`; hosted CI green; no release tag yet        |
| 17. Live deployment            | Blocked      | Vercel first deployment is Production; preview-only deployment is not possible       |
| 18. Final release audit        | Done         | Security, scanner, browser, report, website, docs, CI, deps verified; CONDITIONAL GO |
| 19. Public GitHub publication  | Done         | 137 files published; Node 22/24 CI passed; repository metadata and clone verified    |
| 20. Cloud dashboard            | Done locally | Auth, repo connect, private scans, CLI upload, RLS tests; **not deployed**           |
| 21. Hosted Supabase + preview  | Partial      | Hosted RLS 17/17; OAuth configured; Vercel preview blocked by first-deploy rule      |
| 21.2 OAuth rotation + gate     | Ready        | Secret rotated, hosted RLS 17/17, Production vars set; deployment approval pending   |

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

### Final local verification (post-publication)

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
  prerendered public pages.
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

### Vercel — prepared, not deployed

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
