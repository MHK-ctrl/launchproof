# Limitations

This page is deliberately blunt. A verification tool is only useful if its blind spots are visible.

## Security

- LaunchProof is not a penetration test, exploit framework, vulnerability research tool, or security
  certification.
- A clean scan does **not** mean an application is secure.
- Static rules are pattern heuristics. They can miss vulnerabilities and can produce false positives.
- Findings are not proof of exploitability. Reproduce and review before acting.
- No SQL injection, XSS, SSRF, authentication-bypass, business-logic, race-condition, or file-upload
  exploit payloads are sent.
- HTTP checks are unauthenticated unless identities are explicitly configured.
- TLS certificate chains, protocol versions, cipher suites, and revocation are not independently
  assessed.
- HTTP scope checks are host-pattern based and do **not** resolve DNS first. A public hostname that
  resolves to a private address (DNS rebinding or a hostile DNS record) is not defended against.
  Run scans from a host that does not hold sensitive credentials when testing untrusted targets.
- Metadata blocking is hostname-based for known endpoints; it is not a general SSRF firewall.
- Secret detection is pattern/entropy based. Novel formats and encoded secrets can be missed.
- Redaction reduces risk but cannot guarantee removal of every possible secret from every report.
- Dependency advisories depend on registry data at scan time. A clean audit is not proof that
  dependencies are vulnerability-free.
- Supabase static analysis cannot prove deployed policy state. Live probes cover only anon-key reads
  of listed tables.
- Object authorization tests cover one configured scenario per resource and only read-only methods by
  default.

## Browser and accessibility

- Browser checks require optional Playwright/axe-core dependencies and a Chromium shell. Missing
  dependencies produce `not-verified`, not a pass.
- Only configured workflows and sampled pages are exercised. Untested routes, roles, and states
  remain unknown.
- Workflow selectors can break with UI changes; a failed selector is a tool limitation as well as a
  possible product issue.
- axe-core covers only a subset of WCAG. Manual keyboard, screen-reader, zoom, motion, cognitive, and
  real-device testing remain necessary.
- Browser tests run headless Chromium only; Safari, Firefox, and real mobile browsers are not
  covered.
- Screenshots may contain personal data.

## Performance

- Metrics are single-run observations from the scanning machine and network.
- No field data, throttling profiles, concurrency, or load testing is performed.
- Lighthouse is not bundled. Requesting it produces an explicit `not-verified` check.
- CI runners vary; do not treat small threshold differences as regressions without repeat runs.

## Coverage

- Discovery is static and bounded. Dynamic/generated routes and framework magic may be missed.
- The file walk is capped (8,000 files by default) and skips dependencies, builds, lockfiles, maps,
  and minified assets.
- Git history checking is filename-based and bounded by commit count; historical blobs are not
  content-scanned.
- API tests do not validate full schemas, pagination, concurrency, or business rules.
- Only npm-family dependency auditing is implemented.
- No real Supabase project, large third-party codebase, or external audit has validated this tool.
- The website sample is from an intentionally vulnerable demo, not a benchmark of a real product.

## Operational

- The public npm name `launchproof` belongs to an unrelated project. The package is
  `@hamzakhan2006/launchproof` and is not published; install from the repository or a `npm run pack:cli`
  tarball until the first scoped release.
- PDF export, and all browser checks, depend on optional Playwright and a Chromium download. Without
  them those commands exit with an explicit error rather than degrading silently.
- The website and dashboard are deployed at https://launchproof-rose.vercel.app. GitHub repository
  consent and a CLI upload against a connected repository are unverified because GitHub required
  owner 2FA during validation.
- Windows has not been the primary test platform; bash-compatible commands are used in docs and CI.
- LaunchProof cannot verify that you have legal authorization to test a target.
