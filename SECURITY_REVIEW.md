# LaunchProof Security Review

**Review date:** 2026-11-23
**Version reviewed:** 0.1.0 source preview
**Review type:** Internal engineering review
**Status:** Not an independent audit, penetration test, or certification

> This document records the security review performed by the maintainers. It does not claim external
> validation. No production system, real Supabase project, or third-party target was scanned.

## 1. Threat model

### Assets

- Source code, configuration, and environment values belonging to the user's project.
- Credentials used by configured identities, Supabase live probes, or optional AI remediation.
- Generated reports, screenshots, and scan artifacts, which may describe internal architecture.
- The integrity of the authorization scope and the release gate.
- The reviewer's browser when opening a generated HTML report.

### Adversaries and untrusted inputs

- A malicious or compromised application under test, including its HTTP responses, HTML, redirects,
  headers, JavaScript, and console output.
- A malicious saved JSON report supplied to `launchproof report`.
- A hostile DNS record or redirect chain aimed at making the scanner reach an unintended service.
- A compromised or vulnerable dependency in the build, test, browser, or reporting path.
- Untrusted pull-request code in CI.
- A user who misconfigures scope, identities, or unsafe HTTP methods.

### Trust boundaries

1. **Local project to scanner:** Project files are untrusted text. Discovery is bounded and symlinks
   are not followed.
2. **Scanner to target:** Every network request crosses an authorization and scope boundary.
3. **Target to browser:** The app under test runs in Chromium; LaunchProof must not let it navigate
   the scanner outside the authorized origin or receive identity headers.
4. **Target data to report:** Response bodies and secrets must not become report evidence.
5. **Saved report to reviewer:** Report files are untrusted input and must be validated before
   rendering.
6. **CI to repository:** Workflows must not expose write tokens or secrets to pull-request code.

### Security goals

- Do not contact a host the user did not authorize.
- Do not leak credentials into requests to other origins, logs, reports, or AI calls.
- Do not let a scanned application execute code in a LaunchProof report.
- Do not report unexecuted or inconclusive coverage as a pass.
- Keep the default path local, offline, and bounded.

## 2. Sensitive data handling

### Secret discovery and masking

- Provider patterns, private-key markers, high-entropy assignments, `.env` hygiene, and optional
  bounded git-history filename checks are used.
- Values are masked before findings are created; the report stores a masked form rather than the
  original.
- Placeholder filtering reduces false positives from examples and templates.
- Masking is best-effort. Novel formats, encoded values, split values, and secrets in binary files can
  be missed.

### HTTP requests and responses

- URLs containing embedded usernames or passwords are rejected.
- Configured identity values are read from environment variables by name and are not printed by
  `launchproof config`.
- Response bodies are not copied into evidence. Evidence uses status, content type, size, headers, and
  bounded snippets where appropriate.
- Cross-origin redirects strip caller headers and refuse body forwarding.
- URL redaction removes credentials and sensitive query values before a URL enters a report.

### Browser execution

- Browser contexts receive identity headers only for configured identities.
- Cross-origin top-level navigation is aborted.
- Authorization, cookie, proxy authorization, and configured identity headers are stripped from
  cross-origin subresources.
- Console and failed-request evidence is bounded and redacted before becoming a finding.
- Screenshots are written only when configured and may contain application data.

### Logs, terminal, and errors

- The CLI supports `--ci` and `--no-color`; redacted text strips ANSI and control sequences.
- Error messages are passed through redaction before entering findings.
- `--json` writes the report to stdout and progress to stderr, so machine output is not mixed with
  human notices.
- Unexpected errors use exit code 3 and do not print environment values.

### Reports and SARIF

- HTML output is self-contained and offline; it contains no remote scripts, fonts, or analytics.
- Untrusted values are HTML-escaped; status/severity classes are whitelisted; references are
  validated.
- JSON and SARIF are generated from the same report object as terminal/HTML output.
- SARIF no longer emits a project URL that does not exist.
- The CLI report reader validates structure, status/severity vocabularies, and control characters and
  enforces a 25 MB cap.
- Reports can still contain internal paths, URLs, header names, and architecture. Treat them as
  sensitive.

### Optional AI remediation

- Disabled by default.
- Requires both `ai.enabled` and `ai.consent`.
- Sends finding titles, descriptions, locations, and current remediation text; it does not send
  evidence values or credentials.
- No telemetry exists in the core product.

## 3. Authorization boundaries

### Target scope

`checkTargetScope()` is the shared gate for HTTP, API, authorization, Supabase live, and browser
checks.

- Loopback (`localhost`, `127.0.0.0/8`, `::1`) is allowed by default.
- Non-loopback targets require `authorization.authorized: true` and a matching entry in
  `authorization.scope`.
- Scope matching supports exact hosts and explicit wildcard patterns.
- Private networks require `allowPrivateNetwork: true`.
- Known cloud metadata hostnames are always blocked.
- Only `http:` and `https:` targets are accepted.
- URL-embedded credentials are rejected.
- Protocol-relative paths are rejected in configuration.

### Redirects

The HTTP client follows redirects manually. Every hop is re-checked against host, port, protocol, and
scope. A redirect to a different origin does not retain caller headers or a request body. A same-host
redirect with a different port is not accepted merely because the hostname matches.

### Browser boundary

The browser context routes all requests. Cross-origin navigation is aborted; cross-origin
subresources are allowed only after sensitive headers are removed. After each workflow step, the page
origin is checked again. If the browser leaves the authorized origin, further actions are refused.

### Known boundary limitation

Scope enforcement is host-pattern based and does **not** resolve DNS before requests. A public
hostname that resolves to a private address, or a DNS rebinding attack, is not defended against. This
is documented in `docs/limitations.md`. Do not run scans from a host holding sensitive credentials
against untrusted targets.

## 4. HTTP client safety

Reviewed `packages/core/src/http/client.ts`.

Controls:

- Manual redirect handling with per-hop scope validation.
- Rejection of URL-embedded credentials.
- Removal of caller headers after a cross-origin redirect.
- Refusal to forward request bodies across origins.
- Request budget, per-request timeout, response-size cap, and rate limit.
- Unsafe HTTP methods disabled by default for API and authorization checks.
- Response bodies excluded from report evidence.
- Shared client used by HTTP, API, authorization, and Supabase live checks.

Residual risks:

- TLS certificate chains, protocol versions, cipher suites, and revocation are not independently
  assessed.
- Header-based tests cannot prove server behavior under every proxy or CDN configuration.
- A target can return misleading but syntactically valid responses; findings are evidence, not proof.

## 5. SSRF and private-network protections

Implemented:

- Loopback-only default.
- Explicit remote authorization plus host scope.
- Separate private-network opt-in.
- Metadata hostname blocking.
- Protocol restriction.
- Redirect re-validation.
- Port-aware scope checks.
- Request and response bounds.

Not implemented:

- DNS resolution and post-resolution IP validation.
- A general egress firewall.
- Protection against a compromised local DNS resolver.
- Network namespace or container isolation.

The tool is a verification CLI, not a multi-tenant scanning service. Its authorization model reduces
accidental scope expansion; it is not a hostile-network sandbox. Users who need strong isolation
should run it in a disposable environment with restricted egress.

## 6. BOLA testing safeguards

Reviewed `packages/core/src/authorization.ts` and the configuration schema.

- Two identities are resolved from environment variables.
- Each configured resource is tested read-only by default.
- Unsafe methods require explicit configuration and are disabled by default.
- Expected denial statuses must be configured as denial statuses; a success status cannot be
  declared as proof of protection.
- A confirmed denial is reported as protected.
- An unexpected 3xx/4xx/5xx response is inconclusive, not a pass and not a confirmed BOLA finding.
- Missing identities, missing resource identifiers, network errors, and configuration errors are
  distinguished from confirmed authorization results.
- Findings are not destructive and do not attempt exploitation.

Limitations:

- One scenario per resource is a sample, not exhaustive authorization coverage.
- Response-code semantics vary by framework; a 404 can mean "not found" or "hidden", and a 403 can be
  generated by a proxy rather than the application.
- Business-logic authorization and multi-tenant edge cases are not proven.

## 7. Supabase and database review

- Static migration analysis looks for RLS enablement, policy presence, broad policies, anonymous
  access, and service-role usage.
- The presence of a policy is not treated as proof that the policy is secure; the report explains
  what could and could not be verified.
- Live probing is optional, read-only, and limited to listed tables with an anon key.
- Non-200/401/403 responses are not classified as a pass.
- Service-role keys are not accepted as the live probe credential.
- No real Supabase project was tested in this review.

Limitations:

- Deployed policy state can differ from migrations.
- Write policies, storage policies, functions, and edge cases are not tested.
- Static RLS interpretation is heuristic.

## 8. HTML report safety

- HTML is generated from escaped text, not by concatenating raw target output.
- Status and severity CSS classes are selected from a fixed map; unknown values fall back safely.
- References are validated before use as links.
- Numeric and timestamp values are escaped.
- Report HTML includes no remote script, stylesheet, font, image, or analytics request.
- Synthetic findings containing `<script>`, event-handler attributes, and quote-breaking payloads were
  rendered in tests without executing.
- The website report viewer fetches a committed JSON file from the same origin; it does not evaluate
  report text as code.
- The sample report is labeled as demo output, not a live customer scan.

Residual risk: opening any report from an untrusted source is still a local trust decision. The CLI
validates saved report JSON before rendering, but reports may contain sensitive architecture and
should be handled accordingly.

## 9. Dependency and supply-chain review

- Lockfile committed; CI uses `npm ci`.
- Direct versions pinned; no broad `^` ranges for runtime dependencies.
- `npm audit --audit-level=high` reports 0 vulnerabilities on the final tree.
- Next.js, Zod, Vitest, and PostCSS were upgraded to patched releases; unused `marked` was removed.
- Playwright and axe-core are optional peer dependencies, avoiding a forced browser download.
- No telemetry or unexpected postinstall script was added by this project.
- CI permissions are read-only; no secrets are referenced.
- Package dry-runs include only `dist`, the CLI bin, README, and metadata.

Residual risk: npm advisories are point-in-time. A clean audit is not a guarantee. Dependency
installation remains a supply-chain trust decision.

## 10. Findings and remediation summary

| ID   | Severity | Issue                                          | Status |
| ---- | -------- | ---------------------------------------------- | ------ |
| F-01 | High     | Redirect port/scope bypass                     | Fixed  |
| F-02 | High     | URL-embedded credentials accepted              | Fixed  |
| F-03 | High     | Cross-origin redirect header/body forwarding   | Fixed  |
| F-04 | High     | Browser cross-origin navigation/header leakage | Fixed  |
| F-05 | High     | HTML report escaping gaps                      | Fixed  |
| F-06 | High     | Gate ignored not-verified checks               | Fixed  |
| F-07 | High     | Dependency advisories                          | Fixed  |
| F-08 | Medium   | Ambiguous BOLA status classification           | Fixed  |
| F-09 | Medium   | Supabase live-probe pass on unexpected status  | Fixed  |
| F-10 | Medium   | Unvalidated/oversized report input             | Fixed  |
| F-11 | Medium   | Unsafe URL/path/BOLA config values             | Fixed  |
| F-12 | Medium   | axe blocked by strict CSP                      | Fixed  |
| F-13 | Low      | ANSI/control sequences in redacted text        | Fixed  |
| F-14 | Low      | Invented GitHub project URL                    | Fixed  |
| F-15 | Low      | Website contrast and keyboard focus            | Fixed  |

No critical issue remained after remediation. No issue was waived to make the gate pass. The full
finding details, evidence, and verification are in
[RELEASE_READINESS_AUDIT.md](RELEASE_READINESS_AUDIT.md).

## 11. Known limitations

- No independent security audit or penetration test.
- DNS rebinding and hostile DNS are not defended against.
- TLS certificate chains, protocol versions, and revocation are not assessed.
- Static rules and secret detection are heuristic.
- Authorization testing is a sample, not exhaustive.
- Supabase analysis cannot prove deployed policy state.
- Browser checks cover only configured workflows and sampled pages.
- Headless Chromium only; axe covers a subset of WCAG.
- Redaction is best-effort.
- Reports can contain sensitive internal architecture.
- No live deployment, repository, or npm package has been validated.

## 12. Responsible disclosure

Use the repository's private security advisory channel at
https://github.com/MHK-ctrl/launchproof/security/advisories/new. Do not post exploit details,
credentials, or live reproduction data publicly. If the advisory channel is unavailable, request a
private channel through the repository owner profile.

A report should include the affected version/commit, a minimal reproduction, impact, whether a remote
target is required, and any suggested mitigation. Never include live credentials; rotate anything that
may have been exposed. Response times are best-effort. The maintainers will acknowledge, investigate,
and coordinate disclosure after a fix is available.

## 13. Statement of assurance

This review increases confidence in the reviewed tree. It does not establish that LaunchProof is free
of vulnerabilities, compliant with any standard, certified, or safe for every environment. Users
should treat scan results as evidence to review, not as proof of security, and should obtain
independent review for high-risk systems.
