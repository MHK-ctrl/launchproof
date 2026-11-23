# LaunchProof

[![CI](https://github.com/MHK-ctrl/launchproof/actions/workflows/ci.yml/badge.svg)](https://github.com/MHK-ctrl/launchproof/actions/workflows/ci.yml)

**Build with AI. Test like a professional engineering team. Ship with evidence.**

LaunchProof is an open-source, local-first verification CLI for applications built with AI. It
checks security posture, secrets, API contracts, object-level authorization, real browser
workflows, accessibility, and performance—then writes evidence you can inspect instead of a
badge you have to trust.

> **Status: v0.1.0 source preview.** The source is public at
> [github.com/MHK-ctrl/launchproof](https://github.com/MHK-ctrl/launchproof). The package is **not
> published to npm**, the website is not deployed, and no external security audit has been performed.
> Read [limitations](docs/limitations.md) before relying on a result.

## Why

AI-assisted development made it cheap to produce a working-looking application. It did not add
the verification work that normally happens before launch: access-control checks, API contract
tests, header review, browser journeys, accessibility, and performance budgets. LaunchProof makes
that work practical on a laptop without Docker, hosted services, or an account for the core path.

It is intentionally conservative about what it claims:

- A skipped check and a missing browser are reported as **SKIPPED** or **NOT VERIFIED**, never a
  pass.
- A clean scan is not described as proof that an application is secure.
- Remote testing requires explicit authorization and a matching host scope.
- Secret values are replaced with `****REDACTED****` before entering a report.

## What it checks

| Area               | Examples                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Discovery          | Framework, language, package manager, scripts, API routes, env references, deployment targets                              |
| Secrets            | Provider token formats, private keys, service-role JWTs, high-entropy assignments, `.env` hygiene, git history filenames   |
| Static security    | `eval`, shell/SQL interpolation, raw HTML sinks, wildcard CORS, disabled TLS verification, service-role use in client code |
| Repository hygiene | `.gitignore` coverage, lockfile, CI, README/license, unsafe build flags                                                    |
| Dependencies       | `npm audit` advisories when network checks are enabled                                                                     |
| HTTP               | CSP, HSTS, framing, cookie attributes, CORS behavior, plaintext transport, sensitive path exposure, stack-trace leakage    |
| API                | Configured endpoints or OpenAPI paths, status contracts, JSON shape, latency budgets, unauthenticated access               |
| Authorization      | Two-identity object access probes for BOLA/IDOR using read-only requests by default                                        |
| Supabase           | Static RLS review of SQL migrations; optional anon-key read probe against a configured project                             |
| Browser            | Chromium page load, console/network errors, configured workflows, internal links, mobile overflow                          |
| Accessibility      | axe-core against sampled pages with WCAG tags                                                                              |
| Performance        | FCP, LCP, CLS, load time, JS transfer, request count, DOM size against configurable budgets                                |
| Reporting          | Terminal summary, self-contained HTML, JSON, SARIF 2.1.0                                                                   |

## Requirements

- Node.js **22.12+** (tested locally on Node 26 / macOS arm64; CI covers Node 22 and 24)
- npm (the repository uses npm workspaces)
- No Docker, database, or hosted service
- Optional: Playwright + Chromium and axe-core for browser checks

Defaults are sized for a laptop: 8,000-file walk cap, 50 HTTP requests per scan, 4 requests/second,
one Chromium instance, bounded response bodies, and two Vitest workers.

## Quick start (from source)

```bash
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs --help
```

Initialize a project and run the offline path:

```bash
node packages/cli/bin/launchproof.mjs init
node packages/cli/bin/launchproof.mjs analyze
node packages/cli/bin/launchproof.mjs test
```

`test` runs filesystem checks only with the generated defaults (`scan.network: false`). Browser
checks also require the optional runtime:

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
```

Then enable `browser.enabled` and `app.url` in `launchproof.config.json`.

### Local demos

```bash
npm run demo:vulnerable   # http://127.0.0.1:4173 — intentionally insecure
npm run demo:secure       # http://127.0.0.1:4174 — hardened contrast target
```

From `examples/vulnerable-demo`, with the demo running:

```bash
LP_DEMO_OWNER_ID=1 LP_DEMO_OTHER_ID=2 \
  node ../../packages/cli/bin/launchproof.mjs test
```

The included [sample report](apps/web/public/sample-report.html) is the real output of that scan.

## Example output

From the intentionally vulnerable demo, the terminal report includes real check results and a failed
gate rather than a badge:

```text
FAIL         http.exposure — 4 sensitive path(s) are publicly reachable.
FAIL         http.cors — 1 permissive CORS behavior(s) observed.
FAIL         authorization.objects — 1 authorization failure(s) observed.

Findings
CRITICAL     Environment file is publicly accessible
CRITICAL     Git configuration is publicly accessible
CRITICAL     Possible broken object-level authorization
HIGH         Debug endpoint is publicly accessible

22 checks · 23 findings · gate failed (3 critical, 3 high, 7 medium, 10 low)
```

The report also lists skipped and not-verified checks, limitations, and remediation guidance. The
scanner does not treat this demo output as proof of security for any other application.

## Commands

| Command                           | Purpose                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `launchproof init`                | Write a conservative config                                     |
| `launchproof analyze`             | Profile the project without network access                      |
| `launchproof security`            | Static security/hygiene plus configured HTTP/API/auth checks    |
| `launchproof test`                | Full configured scan, including browser checks when enabled     |
| `launchproof scan <url>`          | Live HTTP/API/authorization checks against an authorized target |
| `launchproof browser [url]`       | Workflows, links, mobile layout, axe, performance               |
| `launchproof accessibility [url]` | axe-core checks only                                            |
| `launchproof performance [url]`   | Navigation metrics and budgets                                  |
| `launchproof report [file]`       | Render/convert terminal, HTML, JSON, or SARIF                   |
| `launchproof config`              | Print the effective configuration without secret values         |
| `launchproof doctor`              | Check Node, config, Playwright, Chromium, axe, and git          |

Global flags: `--config`, `--json`, `--quiet`, `--verbose`, `--ci`, `--no-color`, `--output`,
`--fail-on`. Exit codes: `0` gate passed, `1` gate failed, `2` usage/config/authorization error,
`3` unexpected error.

Full documentation: [docs/cli.md](docs/cli.md) and the [docs index](#documentation).

## Configuration

```json
{
  "version": 1,
  "project": { "name": "my-app" },
  "app": { "url": "http://localhost:3000" },
  "authorization": {
    "authorized": false,
    "scope": [],
    "allowLocal": true,
    "allowPrivateNetwork": false
  },
  "scan": { "network": false, "failOn": "high" },
  "api": {
    "baseUrl": "http://localhost:3000",
    "allowUnsafeMethods": false,
    "endpoints": [{ "path": "/api/health", "expectStatus": 200, "expectJson": true }]
  },
  "browser": { "enabled": true, "workflows": [] },
  "accessibility": { "enabled": true, "tags": ["wcag2a", "wcag2aa"] },
  "performance": { "enabled": true },
  "report": { "outputDir": ".launchproof", "formats": ["terminal", "json", "html"] }
}
```

Identity headers and cookies are read from environment variables referenced in config. Values are
never printed. See [configuration](docs/configuration.md).

## Authorization model

- Loopback (`localhost`, `127.0.0.0/8`, `::1`) is allowed by default.
- Non-loopback targets require `authorization.authorized: true` **and** a matching entry in
  `authorization.scope`.
- Private networks require `allowPrivateNetwork: true`.
- Cloud metadata hostnames are always blocked.
- Every redirect hop is re-checked.
- Unsafe API methods and authorization mutations are disabled by default.
- No exploitation, fuzzing, or destructive payloads run.

LaunchProof cannot verify that you have legal permission. Never point it at a system you do not
own or have written authorization to test.

## Reports and data handling

Each scan writes `.launchproof/<scan-id>/report.{json,html,sarif}` plus `latest.json` and
`latest.html`. HTML is fully self-contained and offline. Reports include the configuration summary,
a project profile, every check (including skipped/not-verified), findings with impact and
remediation, and an explicit limitations section.

Credential-like values are masked at finding creation. HTTP response bodies are not copied into
evidence, and environment file contents are never reported. LaunchProof has no telemetry. Optional
AI remediation is off by default and requires consent; it receives finding text, not evidence
values.

## Project structure

```text
packages/core      Discovery, static/HTTP/API/auth/Supabase checks, reports, scan orchestrator
packages/browser   Optional Playwright + axe-core + performance checks
packages/cli       Commander CLI, modes, exit codes, report command
apps/web           Static Next.js website, simulated demo, real sample report viewer
examples           Intentionally vulnerable and hardened demo servers
tests              Shared test helpers
docs               Architecture, CLI, configuration, testing, security, privacy, limitations
```

## Documentation

- [Architecture](docs/architecture.md)
- [CLI reference](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Framework discovery](docs/frameworks.md)
- [Security testing](docs/security-testing.md)
- [Browser testing](docs/browser-testing.md)
- [API testing](docs/api-testing.md)
- [Authorization testing](docs/authorization-testing.md)
- [Supabase](docs/supabase.md)
- [Reports](docs/reports.md)
- [CI](docs/ci.md)
- [Website deployment](docs/deployment.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Privacy](docs/privacy.md)
- [Limitations](docs/limitations.md)
- [FAQ](docs/faq.md)
- [Release readiness audit](RELEASE_READINESS_AUDIT.md)
- [Security review](SECURITY_REVIEW.md)
- [Deployment readiness](DEPLOYMENT_READINESS.md)
- [GitHub publication checklist](GITHUB_PUBLICATION_CHECKLIST.md)
- [GitHub publication report](GITHUB_PUBLICATION_REPORT.md)
- [v0.1.0 release notes draft](V0.1.0_RELEASE_NOTES_DRAFT.md)

## What has actually been tested

The automated suite includes unit tests for the scope gate, configuration, secret scanning, and
report renderers; live integration tests that start both demo servers on ephemeral ports; Playwright
end-to-end tests for workflows, axe, links, mobile layout, and performance; and CLI smoke tests for
version, help, init, config, and invalid flags.

It has **not** been tested against a large third-party production system, a real Supabase project,
or every framework version. Those remain unverified unless you run them. See the verification log in
[PROJECT_EXECUTION_STATUS.md](PROJECT_EXECUTION_STATUS.md).

## Limitations

LaunchProof is not a penetration test, exploit framework, compliance attestation, or security
certificate. Static rules are heuristics. TLS certificate/protocol validation is not implemented.
HTTP checks are unauthenticated by default. Performance is a single local measurement. Lighthouse is
not bundled. Supabase static analysis cannot prove deployed policy state. Read the full
[limitations](docs/limitations.md) and the limitations section of every report.

## Contributing, security, license

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md). Licensed under the [MIT License](LICENSE).
