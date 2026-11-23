# LaunchProof — Execution Status

Persistent execution checklist for the v0.1.0 source preview. Statuses are updated only after the
corresponding command was actually run. This file distinguishes implemented, tested-passed,
not-tested, and blocked work.

Last updated: 2026-11-23

## Release summary

LaunchProof is implemented as a local-first npm-workspaces monorepo with a working CLI, static and
live verification engine, optional Playwright browser checks, report renderers, demo applications,
tests, documentation, CI, and a statically exported public website.

The source tree has completed the phase 18 release-readiness audit and is conditionally ready for
owner-approved publication. It has **not** been published to npm, pushed to GitHub, or deployed. No
external security audit has been performed, and no real Supabase project or large third-party
application has been validated.

## Environment

- macOS 26.6.2, Apple Silicon arm64, 18 GB unified memory assumed per brief
- Node.js 26.0.0, npm 11.12.1, Git 2.39.5
- Project root: `LaunchProof/`
- GitHub CLI authenticated as the repository owner account; nothing pushed
- Vercel CLI installed but logged out; nothing deployed
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
| 14. Website                    | Done locally | 7 content routes plus 404/robots exported; not deployed                              |
| 15. Documentation + CI         | Done         | README, guides, policies, templates, workflow, deployment configs                    |
| 16. GitHub release             | Blocked      | Publication requires explicit owner approval                                         |
| 17. Live deployment            | Blocked      | Requires Vercel authentication and deployment approval                               |
| 18. Final release audit        | Done         | Security, scanner, browser, report, website, docs, CI, deps verified; CONDITIONAL GO |

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
- No real Supabase project or deployed RLS policy tested
- No large third-party application or production staging system tested
- TLS certificate chains, protocol versions, and revocation are not assessed
- Lighthouse is not bundled; requesting it yields NOT VERIFIED
- Browser checks cover only configured workflows and sampled pages
- Performance numbers are single local runs, not production benchmarks
- Windows and Linux desktop behavior are not manually tested (CI covers Linux)
- Website deployment has not been performed, so no live URL is claimed
- npm publication has not occurred; install is from source
- Git history scanning is filename-only and bounded

## Release blockers and required approvals

1. **GitHub publication:** requires explicit owner approval. No remote exists and nothing has been
   pushed. The source tree is ready for an owner-controlled initial commit and push.
2. **Website deployment:** requires `vercel login` (CLI is logged out) and explicit deployment
   approval. `vercel.json` and `netlify.toml` are prepared; after deployment, every route and the
   sample report must be verified before claiming a live URL.
3. **npm publication:** requires choosing the final package ownership/scope and owner approval. The
   CLI package name is currently `launchproof`; the workspace packages are `@launchproof/core` and
   `@launchproof/browser`.
4. **Real-project validation:** recommended before a 1.0 claim. Run against one staging app, review
   false positives, and document results.

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

- GitHub Actions was not run because no repository exists.
- No production deployment, public alias, domain, or npm publication was performed.
- No real Supabase project was tested; live RLS behavior remains unverified.
- No external security audit or penetration test was performed.
- Lighthouse is not bundled; requesting it yields `not-verified`.

### Outstanding issues

1. DNS rebinding / hostile DNS is not defended against; scope is host-pattern based. Documented in
   `SECURITY_REVIEW.md` and `docs/limitations.md`.
2. No real large third-party application or staging system has been validated.
3. No hosted CI run exists yet.
4. Canonical URL, sitemap, and absolute social metadata wait for a real deployment hostname.
5. Windows and real mobile browsers are not manually validated.
6. npm package ownership/name availability is unresolved; npm publication is not required for launch.

### Decisions pending user approval

- **Approval A — GitHub publication:** repository owner/account, name `launchproof`, visibility, and
  initial commit/push. No repository exists.
- **Approval B — Website deployment:** Vercel production deployment after `vercel login`, or Netlify
  as fallback. No deployment exists.
- **npm publication:** separately deferred; no registry changes were made.

### Next exact action

Provide Approval A for GitHub publication (owner/account, repository name, and visibility), or
complete `vercel login` and provide Approval B for website deployment. Until one is approved, no
public action is permitted.
