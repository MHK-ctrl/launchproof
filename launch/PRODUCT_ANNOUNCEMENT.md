# LaunchProof v1.0 is live

**Website:** https://launchproof-rose.vercel.app
**Source:** https://github.com/MHK-ctrl/launchproof
**License:** MIT

AI tools made it cheap to produce an application that looks finished. The verification work that
normally happens before launch — access-control checks, secret review, header inspection, API
contracts, real browser journeys, accessibility, performance — did not get cheaper.

LaunchProof is a local-first verification CLI for that gap. It runs on your machine, needs no account
for the core path, and writes evidence you can inspect: a terminal gate, a standalone HTML report,
JSON, and optional SARIF.

## What it checks

- Static security patterns and secret formats, with values masked before they reach a report.
- Repository hygiene, environment-file handling, and dependency advisories when network checks are
  enabled.
- Live HTTP posture for systems you are authorized to test: security headers, cookies, CORS,
  transport, and error leakage.
- API contracts for configured endpoints or OpenAPI paths.
- Two-identity object-level authorization probes (BOLA/IDOR) using read-only requests by default.
- Static Supabase RLS review and an optional anon-key read probe.
- Real Chromium workflows, console/network errors, internal links, mobile overflow, axe-core
  accessibility, and navigation performance budgets.
- Terminal, HTML, JSON, and SARIF reports with explicit limitations.

Every check has a status. A disabled or unreachable check is reported as **SKIPPED** or **NOT
VERIFIED**, never as a pass.

## Optional cloud history

The dashboard at https://launchproof-rose.vercel.app is optional. Sign in with GitHub, connect a
repository, and explicitly upload a sanitized scan summary if you want a searchable history. Uploads
contain findings, counts, commit/branch, and repository metadata; source code, environment values,
and local paths are never uploaded. Downloads are authorized per request, and deleting your account
removes its repositories, scans, findings, and CLI tokens.

## Try it

The CLI is available from npm as the scoped package `@hamzakhan2006/launchproof` (binary:
`launchproof`). The unscoped npm name `launchproof` belongs to an unrelated project, so install the
scoped package and never `npm install launchproof`.

From npm:

```bash
npm install --global @hamzakhan2006/launchproof
launchproof init
launchproof analyze
launchproof test
```

From a checkout of the repository:

```bash
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs init
node packages/cli/bin/launchproof.mjs analyze
node packages/cli/bin/launchproof.mjs test
```

Open `.launchproof/latest.html` for the report. Browser checks are optional; install Playwright and
the Chromium shell only if you want them.

## What v1.0 does not claim

- It is not a penetration test, a security certificate, or a guarantee of production readiness.
- Static rules are heuristics; a clean scan does not prove safety.
- GitHub repository consent and a CLI upload against a connected repository were not exercised in
  production during release validation because GitHub required owner 2FA.
- There is no external security audit, paid monitoring, or automated database backup.
- The hosted dashboard is free and best-effort; availability and response times are not guaranteed.

Read [limitations](../docs/limitations.md) and the [security model](../SECURITY.md) before relying on
a result.
