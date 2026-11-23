# LaunchProof v0.1.0 — Release Readiness Audit

**Audit date:** 2026-11-23
**Auditor:** Internal engineering review (LaunchProof maintainers)
**Scope:** `LaunchProof/` source tree, demo applications, automated tests, CI configuration, deployment configuration, static website, and documentation
**Release candidate:** v0.1.0 source preview
**Recommendation:** **CONDITIONAL GO** — see [Final recommendation](#final-recommendation)

> This is an internal engineering review. It is not an independent security audit, penetration test,
> certification, or compliance attestation. No external system was scanned, no website was deployed,
> and no package was published during this review.
>
> **Post-publication update:** the reviewed source was published as a public repository at
> https://github.com/MHK-ctrl/launchproof after this audit. Statements below describing the absence
> of a repository are audit-time context. Hosted CI results are recorded in
> [GITHUB_PUBLICATION_REPORT.md](GITHUB_PUBLICATION_REPORT.md).

## Executive summary

LaunchProof is a working, local-first verification CLI with a coherent result model, bounded network
and browser behavior, self-contained reports, two functioning demo targets, and a statically exported
website. The review found and fixed real issues in authorization scope handling, redirect credential
forwarding, browser identity isolation, report escaping, release-gate semantics, ambiguous BOLA
results, Supabase live-probe classification, report parsing, configuration validation, dependency
versions, and accessibility scanning under strict CSP.

No confirmed critical vulnerability remained after remediation. Seven high-severity issues and five
medium-severity issues were fixed with regression coverage. The intentionally vulnerable demo fails
its configured gate as documented (exit 1, 22 checks, 23 findings). The hardened demo passes its
configured gate (exit 0) after the CSP accessibility fix, with only expected demo-folder hygiene
warnings. The full automated suite, builds, formatting, lint, typecheck, dependency audit, package
dry-runs, and website export pass on the reviewed tree.

Release is **conditionally approved** for an owner-controlled GitHub source publication and static
website deployment. It is **not approved** for npm publication, and it should not be described as
externally audited, certified, or production-proven. The remaining conditions are explicit approval,
ownership decisions, and the documented limitations.

## Scope of review

Reviewed:

- All three packages: `@launchproof/core`, `@launchproof/browser`, and the `launchproof` CLI.
- Discovery, secret scanning, static rules, repository hygiene, dependency audit, HTTP, API,
  authorization, Supabase, browser, accessibility, performance, reporting, and gating.
- Shell behavior, exit codes, config parsing, environment loading, redaction, and report storage.
- Both demos and their scan configurations, including live loopback scans.
- The Next.js website source and static export, route behavior, links, accessibility, metadata, and
  deployment configuration.
- CI workflow, package manifests, lockfile, `.gitignore`, license, security policy, contribution
  guide, README, and documentation set.
- Repository hygiene for accidental secrets, machine-specific paths, build output, and local state.

Not reviewed or not available:

- An independent third-party security assessment.
- A real Supabase project or deployed RLS policies.
- A large third-party production application or staging environment.
- Windows desktop behavior, Safari/Firefox browser behavior, or real mobile devices.
- A live GitHub Actions run at audit time; hosted CI has since passed after publication.
- A deployed website (deployment is approval-gated).
- npm registry publication or package ownership.

## Architecture reviewed

The project is an npm-workspaces monorepo:

- `packages/core` owns discovery, static and network checks, the result model, gating, and all report
  renderers. It has no Playwright dependency.
- `packages/browser` owns optional Playwright workflows, axe-core accessibility, links, mobile
  layout, and performance measurement. Playwright and axe-core are optional peer dependencies.
- `packages/cli` owns command parsing, config loading, modes, output, and exit codes.
- `apps/web` is a static Next.js export with no server-side data or scan execution.
- `examples/` contains an intentionally vulnerable demo and a hardened contrast target.

The central invariant is that every check carries one of `pass`, `fail`, `warn`, `skipped`,
`not-verified`, or `error`, and that missing or unexecuted coverage cannot become a pass. The gate is
computed once from findings at or above `scan.failOn` plus error and not-verified checks.

## Security review

The full threat model and controls are documented in [SECURITY_REVIEW.md](SECURITY_REVIEW.md).
Summary of the review:

- Target URLs, redirects, ports, hostnames, and protocol-relative paths are validated before use.
- URL-embedded credentials are rejected. Cross-origin redirects do not retain caller headers or
  request bodies.
- Loopback is allowed by default; remote targets require explicit authorization and a matching scope;
  private networks require a separate opt-in; metadata hosts are blocked.
- Browser contexts block cross-origin top-level navigation and strip authorization, cookie, proxy
  authorization, and configured identity headers from cross-origin subresources.
- Reports escape untrusted values and whitelist CSS classes and status/severity labels. Response
  bodies are not copied into evidence.
- Report input from disk is structure-validated, status/severity-validated, control-character
  checked, and capped at 25 MB.
- Secrets are masked at finding creation. Environment values are never printed by `config` and are
  not serialized into reports.
- The default scan is static and offline. Network and browser checks are explicit.

Residual security limitations are recorded below and in `docs/limitations.md`. The most important is
that HTTP scope enforcement is host-pattern based and does not resolve DNS before requests, so it is
not a general SSRF firewall against hostile DNS or DNS rebinding. Users should not run scans from a
highly sensitive host against untrusted targets.

## Scanner review

Reviewed discovery, secrets, static security, repository hygiene, dependency audit, HTTP, API,
authorization, Supabase, browser integration, evidence, and gate calculation.

What genuinely works:

- Discovery is bounded and deterministic, with framework, language, package manager, script, route,
  environment-reference, deployment, and test-tool detection.
- Secret checks combine provider patterns, entropy heuristics, placeholder filtering, `.env` hygiene,
  tracked-file checks, and optional bounded git-history filename checks.
- Static rules cover dynamic code execution, raw HTML sinks, shell/SQL interpolation, permissive
  CORS, disabled TLS verification, service-role usage, environment logging, and unsafe build flags.
- HTTP checks cover security headers, cookies, CORS, transport, sensitive-path exposure, error
  leakage, and reachability. Redirects are re-checked hop by hop.
- API checks support configured endpoints and OpenAPI-derived paths, identity resolution, status and
  JSON-shape contracts, latency, and anonymous-access detection.
- Authorization checks run read-only two-identity probes by default and treat unexpected statuses as
  inconclusive instead of fabricating a pass or a vulnerability.
- Supabase analysis is static unless a live anon-key read probe is explicitly configured. A live probe
  that returns an unexpected status is not reported as a pass.
- The gate fails on threshold findings, errored checks, and not-verified checks.

Known scanner limitations:

- Static rules are heuristics, not exploit proof, and can produce false positives and false negatives.
- Unsupported frameworks can reduce discovery precision; the report must be read as a partial profile.
- Secret formats, encoded secrets, and generated code can be missed.
- Dependency advisories depend on registry data at scan time.
- Git-history scanning is filename-based and bounded; historical blob contents are not scanned.
- Supabase policy analysis cannot prove deployed policy state.
- API contracts do not validate full schemas, pagination, concurrency, or business rules.
- Skipped checks are visible but do not count as evidence of safety.

## Browser testing review

Reviewed browser startup, page load, workflows, links, mobile overflow, console and failed-request
capture, accessibility, performance, cleanup, and failure classification.

What genuinely works:

- One Chromium instance is launched per browser run; contexts and pages close in `finally` blocks.
- Missing Playwright/Chromium produces `not-verified`, never a pass.
- Configured workflows support fill, click, press, expect-text, expect-visible, expect-URL, wait, and
  screenshots.
- Cross-origin navigation is blocked at the routing layer, and identity headers are stripped from
  cross-origin subresources.
- Internal links are checked only on sampled pages and only within the configured origin.
- Mobile overflow is measured at the configured viewport.
- axe-core covers the configured WCAG tags on sampled pages.
- Performance measures FCP, LCP, CLS, load, JS transfer, requests, and DOM size against budgets.
- Browser failures surface as high-severity workflow findings or not-verified runtime checks.

Defect found and fixed during this review: axe-core was injected with `page.addScriptTag`, which a
strict `script-src` CSP blocks. Hardened targets therefore produced "Accessibility scan failed"
findings instead of being scanned. The injection now uses a CDP evaluation path that is not blocked by
the page's script policy. A regression test serves a strict-CSP page and asserts that one page is
scanned with no injection failure.

Known browser limitations:

- Only configured workflows and sampled pages are exercised.
- Headless Chromium only; Safari, Firefox, and real mobile browsers are not covered.
- Selector changes can break workflows; a selector failure is a tool limitation and a product signal.
- axe-core covers a subset of WCAG; manual testing is still required.
- Screenshots can contain personal data.

## Report integrity review

Reviewed terminal, HTML, JSON, and SARIF outputs, plus the CLI report reader.

- Terminal and HTML output use the same report object as JSON and SARIF; counts and gate reasons are
  not recomputed independently.
- HTML is self-contained and offline, with no remote scripts, fonts, or analytics.
- User-controlled status, severity, references, timestamps, numeric values, evidence, and finding text
  are escaped or whitelisted. Injected HTML/script payload fixtures do not execute.
- Secret-like values are masked before findings are created. HTTP bodies are not stored in evidence.
- JSON includes all checks, including skipped and not-verified, plus limitations and a safe config
  summary.
- SARIF 2.1.0 includes rules, results, severity mapping, and locations. It no longer claims a
  public project URL that does not exist.
- The report reader validates the report shape, status and severity vocabularies, control characters,
  and a 25 MB size cap before rendering.

The website sample report is real output from the intentionally vulnerable demo. The viewer labels
the demo and report as sample data and does not present it as a live scan of a customer system.

## Website review

Reviewed the landing page, demo, report viewer, documentation, get-started, about, security, and
not-found routes.

- Static export succeeds with `output: "export"`, trailing slashes, unoptimized images, and no
  server runtime.
- Seven content routes plus 404 aliases and `robots.txt` are exported. The build also emits the
  committed sample report and JSON.
- All tested routes return HTTP 200 from the local static server; internal links tested clean.
- The mobile navigation opens, closes, and remains keyboard-operable.
- The report viewer loads `sample-report.json`, renders gate/tabs/search, and does not fetch remote
  content.
- The simulated demo is visibly labeled as simulated; it does not claim a live scan.
- axe-core found zero violations across the audited routes after the palette and focus changes.
- The CI snippet is horizontally scrollable and keyboard focusable.
- Titles, descriptions, Open Graph fields, icon, and robots metadata are present.
- No fake customer logos, testimonials, usage numbers, certifications, or live URL are published.
- The static export is approximately 1.7 MB on disk; no analytics or heavy animation libraries are
  included.

SEO limitation: no canonical URL, sitemap, or absolute Open Graph URL is emitted because no public
domain exists. These should be added only after the deployment host is known; inventing a domain
would be worse than omitting it.

## Documentation review

Reviewed README, quick start, CLI reference, configuration, framework notes, security, browser, API,
authorization, Supabase, reports, CI, deployment, troubleshooting, privacy, limitations, FAQ,
contributing, code of conduct, security policy, changelog, and roadmap.

- Commands in the README and CLI reference match the implemented commands and flags.
- Requirements consistently state Node.js 22.12+ and npm; browser checks are optional.
- The README distinguishes source preview from published package and does not claim a repository or
  deployment.
- Limitations are explicit and repeated in generated reports.
- The license is MIT. Direct dependencies were reviewed for compatible permissive licenses; no
  copyleft dependency was introduced by this project. Third-party notices remain governed by each
  dependency's license.
- The invented `github.com/launchproof/launchproof` reference in CLI help, SARIF metadata, and the
  user agent was removed. The README used a placeholder at audit time; it now uses the verified
  repository URL and the real CI badge.

Documentation limitation: Windows-specific setup and real Supabase/RLS workflows are not validated.

## CI/CD review

Reviewed `.github/workflows/ci.yml`.

- Triggers: pushes to `main` and all pull requests.
- Permissions: `contents: read` only.
- Concurrency cancels superseded runs.
- Matrix: Node 22 and 24, with `fail-fast: false`.
- Steps: `npm ci`, high-severity audit, build, lint, format check, typecheck, Chromium headless-shell
  install, tests, website build, and a single website artifact upload on Node 22.
- Commands match repository scripts.
- No secrets are referenced; pull-request code does not receive write tokens.
- A failing step fails the job; there is no `continue-on-error`.

CI had not run when this audit was written. It has since passed on the public repository for Node 22
and Node 24; see [GITHUB_PUBLICATION_REPORT.md](GITHUB_PUBLICATION_REPORT.md).

## Dependency review

Reviewed direct, development, browser, build, and transitive dependencies through the lockfile and
`npm audit`.

- `npm audit --audit-level=high` reports **0 vulnerabilities** on the final tree.
- Next.js 16.4.6, Zod 4.6.7, Vitest 5.1.1, Playwright 1.65.1, axe-core 4.14.1, and TypeScript 5.9.3
  are pinned.
- A PostCSS 8.5.33 override resolves the advisory affecting the previous transitive version.
- The unused `marked` dependency was removed.
- No install script, telemetry package, or unexpected postinstall behavior was introduced by this
  project.
- Playwright and axe-core remain optional peers, so the CLI does not force a browser download.
- `npm pack --dry-run` for core, browser, and CLI includes only `dist`, the CLI bin, and package
  metadata; tests, source maps outside `dist`, local reports, and secrets are excluded.

Residual supply-chain limitation: npm advisories are point-in-time and registry-dependent. A clean
audit is not proof that all dependencies are vulnerability-free.

## Performance and resource review

- File walk capped at 8,000 files; text reads capped at 750 KiB by default.
- HTTP client uses a 50-request budget, four requests per second, timeouts, and response-size caps.
- One Chromium instance; browser pages, links, and samples are bounded.
- Reports are written locally; no telemetry or hosted service is contacted.
- Full build, typecheck, tests, and website export complete in under two minutes on the target
  machine.
- No Docker, local LLM, or large model download is used.
- Test suite runs files sequentially with at most two workers.

No performance regression was introduced by the security fixes. Performance measurements of scanned
applications remain single-run, local observations, not production benchmarks.

## Findings by severity

### Critical

No confirmed critical vulnerability remained after remediation. The issues below were fixed before
the final gate run; none is being waived.

### High

#### F-01 — Redirect could retain authorization across a port change

- **Affected:** `packages/core/src/scope.ts`, `packages/core/src/http/client.ts`
- **Explanation:** A same-host redirect was treated as staying in scope even when the port changed,
  allowing a redirect to reach a service on a different port than the authorized target.
- **Evidence:** Redirect regression coverage in `packages/core/test/scope.test.ts` and
  `packages/core/test/http-client.test.ts`.
- **Impact:** A hostile or misconfigured target could redirect a scan to an unintended local service.
- **Mitigation:** Re-check every redirect hop against host, port, protocol, and authorization scope.
- **Fixed:** Yes.
- **Verification:** Scope and HTTP client tests pass; typecheck passes.

#### F-02 — URL-embedded credentials were accepted

- **Affected:** `packages/core/src/http/client.ts`, configuration loading
- **Explanation:** A target URL containing `user:password@host` could carry credentials into requests
  or error output.
- **Evidence:** HTTP client regression test with a synthetic credential URL.
- **Impact:** Credential exposure in logs or requests and ambiguous authority over the target.
- **Mitigation:** Reject URLs with username or password components; require identity headers from
  environment variables.
- **Fixed:** Yes.
- **Verification:** HTTP client tests pass; no URL credential path remains.

#### F-03 — Cross-origin redirects could forward caller headers or bodies

- **Affected:** `packages/core/src/http/client.ts`
- **Explanation:** Caller-supplied authorization headers and request bodies could survive a redirect
  to a different origin.
- **Evidence:** Redirect tests assert that sensitive headers are stripped and bodies are not forwarded
  across origins.
- **Impact:** Credential leakage to a third-party origin and unintended state-changing requests.
- **Mitigation:** Strip caller headers after a cross-origin redirect and refuse cross-origin body
  forwarding.
- **Fixed:** Yes.
- **Verification:** HTTP client regression tests pass.

#### F-04 — Browser context could navigate cross-origin or leak identity headers

- **Affected:** `packages/browser/src/index.ts`
- **Explanation:** Context-wide identity headers could be attached to cross-origin subresources, and
  navigation was not blocked at the routing layer.
- **Evidence:** `packages/browser/test/browser-security.test.ts` asserts that cross-origin navigation
  is blocked and that authorization, cookie, proxy authorization, and configured identity headers are
  stripped from external subresource requests.
- **Impact:** Credential leakage to analytics, fonts, or third-party APIs; browser checks could leave
  the authorized origin.
- **Mitigation:** Route-guard the context, abort cross-origin navigation, and strip sensitive headers
  on external requests.
- **Fixed:** Yes.
- **Verification:** Browser security test passes.

#### F-05 — HTML report values were not consistently escaped

- **Affected:** `packages/core/src/report/html.ts`
- **Explanation:** Status/severity values, references, timestamps, and numeric evidence could reach
  HTML attributes or text without a strict whitelist/escape path.
- **Evidence:** `packages/core/test/reports.test.ts` renders synthetic findings containing script and
  attribute-injection payloads and asserts no executable markup.
- **Impact:** A scanned application could inject script into an offline report opened by a reviewer.
- **Mitigation:** Whitelist status/severity classes, validate references, escape text and numeric
  values, and keep the report free of remote scripts.
- **Fixed:** Yes.
- **Verification:** Report tests pass; generated HTML contains no remote script tags.

#### F-06 — Release gate ignored not-verified checks

- **Affected:** `packages/core/src/scan.ts`
- **Explanation:** The gate failed on threshold findings and errored checks but not on checks that
  could not be verified, so missing coverage could still produce exit code 0.
- **Evidence:** `packages/core/test/gate.test.ts` covers not-verified, error, threshold, and passing
  cases.
- **Impact:** A release could be reported as passing while a selected verification never ran.
- **Mitigation:** Treat `not-verified` as a gate failure with an explicit reason.
- **Fixed:** Yes.
- **Verification:** Gate tests and CLI smoke tests pass; vulnerable demo exits 1.

#### F-07 — High-severity dependency advisories

- **Affected:** `package.json`, `package-lock.json`, workspace manifests
- **Explanation:** Pinned versions of Next.js, Zod, Vitest, and a transitive PostCSS release were
  affected by published advisories.
- **Evidence:** `npm audit --audit-level=high` before and after the upgrade.
- **Impact:** Potential denial of service or framework-level vulnerabilities in build/test tooling.
- **Mitigation:** Upgrade to patched pinned releases and add a PostCSS override; keep Node 22.12+.
- **Fixed:** Yes.
- **Verification:** Final `npm audit --audit-level=high` reports 0 vulnerabilities.

### Medium

#### F-08 — Ambiguous BOLA responses were misclassified

- **Affected:** `packages/core/src/authorization.ts`
- **Explanation:** Unexpected 3xx/4xx/5xx responses could be treated as a confirmed pass or a
  confirmed authorization failure.
- **Evidence:** `packages/core/test/authorization.test.ts` covers expected denial, unexpected status,
  and network failure.
- **Impact:** A failed identity-isolation test could be presented as passing, or an inconclusive
  response as a vulnerability.
- **Mitigation:** Classify only configured denial statuses as protected; classify unexpected responses
  as inconclusive/warn.
- **Fixed:** Yes.
- **Verification:** Authorization tests pass.

#### F-09 — Supabase live probes treated unexpected statuses as passes

- **Affected:** `packages/core/src/supabase.ts`
- **Explanation:** Non-200/401/403 live responses could be counted as a successful check.
- **Evidence:** `packages/core/test/supabase-live.test.ts` covers 200, 401/403, 404, and 5xx.
- **Impact:** An unreachable or misconfigured project could appear verified.
- **Mitigation:** Treat only meaningful authorization responses as evidence; mark other statuses as
  warnings/inconclusive.
- **Fixed:** Yes.
- **Verification:** Supabase live tests pass.

#### F-10 — Report reader accepted malformed or oversized input

- **Affected:** `packages/cli/src/index.ts`
- **Explanation:** A report file from disk could contain an invalid schema, unknown status/severity,
  control characters, or an unbounded size before rendering.
- **Evidence:** CLI tests cover invalid status, malformed structure, and size-cap rejection.
- **Impact:** Crashes, terminal escape injection, or excessive memory use when reviewing an untrusted
  report.
- **Mitigation:** Validate structure and vocabularies, strip/reject control characters, and enforce a
  25 MB cap.
- **Fixed:** Yes.
- **Verification:** CLI tests pass; valid saved reports still render.

#### F-11 — Unsafe URL/path and BOLA expectations were accepted by config

- **Affected:** `packages/core/src/config/schema.ts`
- **Explanation:** Configuration could include credentials in URLs, protocol-relative paths, or a BOLA
  expectation that treated a success status as proof of protection.
- **Evidence:** `packages/core/test/config.test.ts` covers each rejection.
- **Impact:** Scope ambiguity, credential exposure, and inverted authorization semantics.
- **Mitigation:** Reject credentials in URLs and protocol-relative paths; require denial statuses for
  BOLA expectations.
- **Fixed:** Yes.
- **Verification:** Config tests pass.

#### F-12 — Accessibility scanning failed on strict-CSP targets

- **Affected:** `packages/browser/src/index.ts`
- **Explanation:** axe-core was injected as an inline script, which a `script-src 'self'` policy
  blocks. The check reported page-level scan failures instead of scanning the page.
- **Evidence:** The secure demo returned two low-severity "Accessibility scan failed" findings before
  the fix; `packages/browser/test/browser-security.test.ts` now serves a strict-CSP fixture.
- **Impact:** Hardened applications, which are the best case, received reduced accessibility coverage
  and noisy low-severity findings.
- **Mitigation:** Evaluate the axe source through CDP rather than injecting a script tag.
- **Fixed:** Yes.
- **Verification:** New strict-CSP regression test passes; secure demo now reports 2 pages scanned,
  0 violations, and its gate passes.

### Low

#### F-13 — Control sequences could survive redaction

- **Affected:** `packages/core/src/util.ts`
- **Explanation:** ANSI/control sequences in untrusted text could reach terminal or report output.
- **Evidence:** Redaction/control-character tests with synthetic payloads.
- **Impact:** Terminal confusion or misleading report text.
- **Mitigation:** Strip ANSI and control sequences from redacted text.
- **Fixed:** Yes.
- **Verification:** Unit tests pass.

#### F-14 — CLI/SARIF referenced a nonexistent GitHub project URL

- **Affected:** `packages/core/src/version.ts`, `packages/core/src/report/sarif.ts`,
  `packages/cli/src/index.ts`
- **Explanation:** The project URL `https://github.com/launchproof/launchproof` was invented; no such
  repository exists.
- **Evidence:** CLI help output and SARIF `informationUri` inspection.
- **Impact:** Misleading documentation and broken external metadata.
- **Mitigation:** Remove the URL and the SARIF field until a real repository exists; use an explicit
  source-distribution help note.
- **Fixed:** Yes.
- **Verification:** Rebuilt CLI help no longer contains the URL; SARIF tests pass.

#### F-15 — Website contrast and keyboard access issues

- **Affected:** `apps/web/app/*`, `apps/web/components/*`
- **Explanation:** Low-contrast palette values and a non-focusable horizontally scrollable CI snippet
  reduced accessibility.
- **Evidence:** axe scan before/after and keyboard focus inspection.
- **Impact:** Difficult reading for low-vision users and keyboard-only users.
- **Mitigation:** Lighten the palette and make the scrollable snippet focusable.
- **Fixed:** Yes.
- **Verification:** 7 routes axe-scanned with 0 violations; mobile navigation works; 24 internal links
  checked with 0 broken.

### Informational

- No telemetry is present.
- The default scan is static/offline; network and browser checks require explicit configuration.
- The sample report is generated from an intentionally vulnerable demo and is labeled as such.
- No repository, deployment, npm package, or public URL currently exists.

## Fixes performed

| Area              | Change                                                                   | Regression coverage                           |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Scope             | Re-check host, port, protocol, and scope on every redirect               | `scope.test.ts`, `http-client.test.ts`        |
| HTTP client       | Reject URL credentials; strip headers and block bodies across origins    | `http-client.test.ts`                         |
| Browser           | Block cross-origin navigation; strip identity headers on subresources    | `browser-security.test.ts`                    |
| Browser           | Inject axe via CDP evaluation for strict-CSP targets                     | strict-CSP test in `browser-security.test.ts` |
| Reports           | Whitelist classes and escape untrusted HTML values                       | `reports.test.ts`                             |
| Gate              | Fail on `error` and `not-verified`, not only findings                    | `gate.test.ts`, CLI tests                     |
| BOLA              | Inconclusive classification for unexpected statuses                      | `authorization.test.ts`                       |
| Supabase          | No pass for unexpected live-probe statuses                               | `supabase-live.test.ts`                       |
| CLI               | Validate report structure, status/severity, control chars, 25 MB cap     | `cli.test.ts`                                 |
| Config            | Reject URL credentials, protocol-relative paths, inverted BOLA semantics | `config.test.ts`                              |
| Dependencies      | Upgrade Next, Zod, Vitest, PostCSS; remove unused `marked`               | lockfile, build, audit                        |
| Report metadata   | Remove invented GitHub URL                                               | CLI help, SARIF tests                         |
| Website           | Palette and keyboard focus fixes                                         | axe scan, manual keyboard/mobile review       |
| Documentation/CI  | Node 22.12+ consistently; CI Node 22/24, audit, website artifact         | command review, workflow inspection           |
| Deployment config | Add security headers and static export validation                        | local static-server route checks              |

## Failed and skipped checks

- No final check failed on the reviewed tree.
- GitHub Actions had not run at audit time; it has since passed on the public repository.
- No external target, real Supabase project, or third-party production app was tested.
- TLS certificate chains and protocol details are not implemented.
- npm publication and website deployment were intentionally not performed.
- The initial implementation log's older count of 40 tests and 9 routes was stale; this audit updates
  the execution log to the current suite and export shape.

## Outstanding issues

1. **DNS rebinding / hostile DNS:** Scope checks are host-pattern based and do not resolve DNS.
   Documented, not fixed. Do not run scans from sensitive hosts against untrusted targets.
2. **No independent security audit:** The project should not claim one.
3. **No real Supabase or large-app validation:** Static and demo evidence only.
4. **No live GitHub Actions run:** CI configuration is inspected but not executed.
5. **No deployment:** The site is locally verified only.
6. **No npm package:** Ownership of the `launchproof` name is unresolved; publication is not required
   for the first launch.
7. **SEO gaps:** Canonical URL, sitemap, and absolute social URLs wait for a real deployment host.
8. **Platform coverage:** macOS local and Linux CI are covered; Windows and real mobile devices are
   not manually validated.
9. **Browser coverage:** Headless Chromium only; axe covers a subset of WCAG.

## Release blockers

No source-level release blocker remains for publishing the reviewed source tree or deploying the
static website, subject to explicit owner approval.

Publication is blocked only by the deliberate approval gates:

- GitHub repository creation/push requires Approval A.
- Production website deployment requires Approval B and Vercel authentication.
- npm publication requires a separate ownership decision and is **not required** for v0.1.0.

## Final recommendation

### Overall: CONDITIONAL GO

The reviewed source is coherent, tested, bounded, and honest about its limits. The high-severity
issues found during this audit were fixed and covered by regression tests. The remaining conditions
are documented limitations, the absence of external validation, and the required publication
approvals — not an unresolved release blocker in the code.

### GitHub publication: GO after Approval A

Publish the source as a public v0.1.0 source preview after the owner chooses the account/organization,
initializes the repository, runs the CI workflow, and confirms the README placeholder replacement.
No repository exists today.

### Website deployment: GO after Approval B

Deploy the static export to Vercel after authentication, using the reviewed `vercel.json`. Verify all
routes, headers, the sample report viewer, and the absence of a fake domain before announcing a URL.

### npm publication: NO-GO for this release

The CLI is not required to be on npm for the first launch. Package ownership, naming, provenance, and
a clean-install test from the registry have not been established.
