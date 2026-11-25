# @hamzakhan2006/launchproof

The command-line interface for [LaunchProof](../../README.md): evidence-backed verification for
security, APIs, authorization, browser workflows, accessibility, and performance. The installed
binary is `launchproof`.

The scoped npm package is **`@hamzakhan2006/launchproof`**, published at version **1.1.0**, and it
requires **Node.js 22.12 or newer**. The unscoped npm name `launchproof` belongs to an unrelated
project, so install the scoped package and never `npm install launchproof`.

From npm (recommended):

```bash
npm install --global @hamzakhan2006/launchproof
launchproof --version
```

Run without installing:

```bash
npx @hamzakhan2006/launchproof@1.1.0 --version
```

From a checkout of this repository (for contributors or when you want the current source):

```bash
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm ci
npm run build
node packages/cli/bin/launchproof.mjs --help
```

You can also pack and install a tarball of the current checkout:

```bash
npm run pack:cli
npm install --global ./artifacts/*.tgz
launchproof --version
```

## Quick start

```bash
cd ~/code/my-app
launchproof init                          # writes launchproof.config.json; network stays off
launchproof test                          # static security, secrets, hygiene, repository checks
launchproof report --format html --open   # open the full report
```

With the defaults written by `init` (`scan.network: false`), `test` runs filesystem checks only and
makes no network requests. To add browser, accessibility, and HTTP checks, install the optional
runtime and enable them:

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
```

Then set `app.url` and `browser.enabled` in `launchproof.config.json`.

## Available commands

Core commands: `init`, `analyze`, `test`, `security`, `scan`, `browser`, `accessibility`,
`performance`, `report`, `config`, and `doctor`.

The `report` command converts a saved JSON report to another format:

```bash
launchproof report --format html --out report.html
launchproof report --format pdf  --out report.pdf    # needs Playwright + Chromium
launchproof report --format sarif
```

PDF export reuses the optional Playwright dependency that browser checks already need. Without
Chromium the command exits `2` with install instructions; the HTML report never depends on it.

Global flags: `--config`, `--json`, `--quiet`, `--verbose`, `--ci`, `--no-color`, `--output`,
`--fail-on`, `--api-url`. Exit codes: `0` gate passed, `1` gate failed, `2` usage/config/authorization
error, `3` unexpected error.

## Authorization and scope

Loopback (`localhost`, `127.0.0.0/8`, `::1`) is allowed by default. Non-loopback targets require
`authorization.authorized: true` **and** a matching entry in `authorization.scope`. Private networks
require `allowPrivateNetwork: true`. Cloud metadata hostnames are always blocked, and every redirect
hop is re-checked. Unsafe API methods are disabled by default. No exploitation, fuzzing, or destructive
payloads run.

`--authorized` is an explicit statement that you have permission. LaunchProof cannot verify your legal
authority. Never point it at a system you do not own or have written authorization to test.

## Optional dependencies

Browser checks, accessibility checks, and PDF export depend on optional Playwright and axe-core plus a
Chromium shell. They are optional by design. If they are missing, browser/accessibility/performance
checks and `--format pdf` fail with an explicit error rather than silently degrading.

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
```

## Reports

Each scan writes `.launchproof/<scan-id>/report.{json,html,sarif}` plus `latest.json` and
`latest.html`. HTML is fully self-contained and offline. Reports begin with an assessment scope and
authorization statement, then list the configuration summary, project profile, every check (including
skipped and not-verified), findings with impact and remediation, and an explicit limitations section.

Credential-like values are masked at finding creation. HTTP response bodies are not copied into
evidence, and environment file contents are never reported. LaunchProof has no telemetry.

## Limitations

LaunchProof is not a penetration test, exploit framework, compliance attestation, or security
certificate. Static rules are heuristics. TLS certificate/protocol validation is not implemented.
HTTP checks are unauthenticated by default. Performance is a single local measurement. Lighthouse is
not bundled. Supabase static analysis cannot prove deployed policy state. Read the full
[limitations](../../docs/limitations.md) and the limitations section of every report.

## Documentation and support

- CLI reference: [docs/cli.md](../../docs/cli.md)
- Configuration: [docs/configuration.md](../../docs/configuration.md)
- Reports: [docs/reports.md](../../docs/reports.md)
- Limitations: [docs/limitations.md](../../docs/limitations.md)
- Website and docs: https://launchproof-rose.vercel.app
- Source and issues: https://github.com/MHK-ctrl/launchproof
- Issue tracker: https://github.com/MHK-ctrl/launchproof/issues

## Packaging notes for maintainers

The bundle is self-contained: `tsup` inlines `@launchproof/core` and `@launchproof/browser`, so the
tarball has no dependency on unpublished workspace packages. `npm run verify:package` proves this by
installing the packed tarball into an unrelated project and running a real scan.

This README is the npm package README for the next publish of `@hamzakhan2006/launchproof`. The README
already published with v1.1.0 cannot be changed retroactively; any corrections will ship with a later
release.
