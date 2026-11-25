# Launch notes and short copy

## Short announcement (social)

LaunchProof v1.0 is live: a local-first verification CLI for AI-built apps.

- No account needed for local scans
- Static security, secrets, HTTP/API, BOLA, Supabase RLS review, browser, axe, performance
- Evidence you can inspect: HTML, JSON, SARIF — never a fabricated pass
- Optional hosted history at launchproof-rose.vercel.app

MIT. https://github.com/MHK-ctrl/launchproof

## One-line description

Open-source, local-first verification for AI-built applications: security, API contracts,
authorization, browser flows, accessibility, and performance — with evidence, not a badge.

## Developer-community post

I built LaunchProof because "the AI wrote it and it renders" is not a launch criterion.

It is an MIT-licensed CLI that runs locally and produces a gate plus inspectable reports. The parts
I use most:

- Static secret/security review where values are masked before findings exist.
- Authorized live HTTP checks: headers, cookies, CORS, transport, error leakage.
- Two-identity BOLA/IDOR probes that default to read-only requests.
- Static Supabase RLS review, plus an optional anon-key read probe.
- Chromium workflows, axe-core, mobile overflow, and performance budgets when you install the
  optional browser stack.

Design choices worth knowing: remote targets require explicit authorization and scope; unsafe HTTP
methods are off by default; skipped checks are never counted as passes; the report states its
limitations.

There is an optional dashboard (GitHub sign-in, explicit sanitized upload, scan history, authorized
downloads). It is not required for local work. Upload is opt-in, never automatic.

The public npm name is owned by another project, so the project publishes as the scoped package `@hamzakhan2006/launchproof`. v1.0 installed from the repository; the current CLI is available from npm at version 1.1.0. Docs and the report are at https://launchproof-rose.vercel.app. Feedback and false-positive reports are welcome through GitHub issues.

## Do not say

- "Guarantees security" or "certifies production readiness".
- "Full OWASP coverage", "bug-free", or "replaces a penetration test".
- "Battle-tested at scale" — it is a new v1.0 with a documented validation scope.
- "Penetration-tested" or "audited" — no external audit has occurred.
