# Security policy

## Status

LaunchProof v1.0.0 is released. It has not received an independent security audit. The project does
not claim to be certified, compliant, or safe for every environment. Use it as a verification aid,
not as a substitute for code review, threat modeling, or professional testing.

The website and optional dashboard run at https://launchproof-rose.vercel.app. Tenant isolation, CSRF
rejection, rate limits, account deletion, and CLI token revocation were tested against that
deployment in Phase 21.8; GitHub repository consent and a CLI upload against a connected repository
were not completed because GitHub required owner 2FA.

## Supported versions

| Version | Supported                                             |
| ------- | ----------------------------------------------------- |
| 1.0.x   | Current release; security fixes are applied on `main` |
| 0.1.x   | Superseded source preview                             |

## Reporting a vulnerability

Do **not** open a public issue containing exploit details, credentials, or reproduction data that
could harm a deployed system.

- Use the repository's private **Security advisory** channel (verified enabled):
  https://github.com/MHK-ctrl/launchproof/security/advisories/new
- For non-sensitive reports, open a regular issue without exploit details or credentials.

Please include:

- Affected version or commit
- A minimal reproduction
- Impact and affected component
- Whether the issue requires a configured remote target
- Suggested fix or mitigation, if known

Never include live credentials. Rotate anything that may have been exposed before reporting.

This is a volunteer project; response times are best-effort. We will acknowledge the report,
investigate in good faith, and coordinate disclosure after a fix is available. Please allow
reasonable time before publishing details.

## Security model of the tool

- HTTP and browser checks target only loopback by default.
- Non-loopback targets require `authorization.authorized: true` and a matching host in
  `authorization.scope`.
- Private networks require an additional opt-in. Cloud metadata hostnames are always blocked.
- Redirect hops are re-validated against scope.
- Rate limits, timeouts, response-size caps, and request budgets bound network activity.
- Unsafe HTTP methods and authorization mutations are disabled by default.
- Commands run without a shell; project symlinks are not followed during file walks.
- Secret-like values are masked before findings are created. HTTP response bodies are not copied
  into report evidence.
- Identity values are read from environment variables and never printed.
- AI remediation is off by default; when enabled with consent, it sends finding text only.
- No telemetry is collected by LaunchProof.

Known model limitations are documented in [docs/limitations.md](docs/limitations.md). Notably,
authorization is host-pattern based and does not resolve DNS before checks, so DNS rebinding-style
attacks against a scanner are not defended against. Do not run scans from a highly sensitive host
against untrusted targets.

## Dependency and supply-chain hygiene

- Dependencies are pinned in `package-lock.json`.
- CI installs with `npm ci` and runs lint, typecheck, tests, and builds.
- `npm audit` is available inside scans when network checks are enabled, subject to registry data.
- Optional browser dependencies are peer dependencies, not bundled into the CLI tarball.
- The CLI is distributed from this repository because the public npm name `launchproof` belongs to
  an unrelated project; no npm package is published by this project.

## Data handling

Reports can contain file paths, URLs, header names, response metadata, and project structure. They
do not intentionally contain credential values. Store and share `.launchproof/` artifacts with the
same care as any security report. See [docs/privacy.md](docs/privacy.md).
