# Architecture

LaunchProof is an npm-workspaces monorepo. The core engine is independent of the CLI, and browser
automation is isolated in an optional package so a static or HTTP-only scan never loads Playwright.

## Packages

```text
packages/core
  ├─ discovery, file walk, text cache
  ├─ config (zod), dotenv loader, scope gate
  ├─ static checks: secrets, rules, repository, dependencies, Supabase
  ├─ network: bounded HTTP client, HTTP/API/authorization checks
  ├─ reports: terminal, HTML, JSON, SARIF, storage
  └─ scan orchestrator + result model

packages/browser
  ├─ Playwright runtime (optional peer)
  ├─ workflows, page load, links, mobile layout
  ├─ axe-core accessibility
  └─ navigation performance metrics

packages/cli
  └─ commander commands, modes, config loading, report output, exit codes

apps/web
  ├─ public Next.js pages, simulated demo, sample report viewer, docs
  ├─ optional private dashboard (Supabase Auth + PostgreSQL RLS)
  └─ API routes for repositories, scans, account, and CLI uploads
```

`runScan()` always produces a complete report object. The CLI never invents checks outside that
model; browser results are passed into the core scan as `CheckResult[]` so the report and gate treat
them identically.

## Scan flow

```text
load config + .env
        │
        ▼
authorization preflight (if any live component is selected)
        │
        ▼
bounded project discovery ──► project profile
        │
        ├─ secrets / env hygiene / git history
        ├─ static security rules
        ├─ repository hygiene
        ├─ dependency audit (network optional)
        ├─ Supabase migrations (+ optional live probe)
        ├─ HTTP checks (authorized target, network enabled)
        ├─ API contracts + identity headers
        ├─ object-level authorization scenarios
        └─ browser checks supplied by @launchproof/browser
        │
        ▼
sort findings ──► summary + gate ──► terminal / HTML / JSON / SARIF
```

## Result model

Every check has an id, category, title, status, summary, evidence, findings, duration, and optional
details/error. Every finding has a deterministic id, stable check id, title, description, severity,
confidence, verification method, category, impact, remediation, evidence, optional location, and
references.

Statuses are derived from executed work, not hope:

- `pass` — executed and no finding at the check's level
- `fail` — observed failure or configured threshold exceeded
- `warn` — needs review, below the failure line
- `skipped` — disabled or not applicable
- `not-verified` — could not establish an answer
- `error` — the check itself failed

The release gate fails when a finding is at or above `scan.failOn`, or when any check has status
`error`. This is computed once in `runScan()`.

## Authorization boundary

`checkTargetScope()` is the single gate used by HTTP, API, authorization, Supabase live, and browser
checks. Loopback is allowed by default. Any other host needs `authorization.authorized: true` and a
host/port/wildcard match in `authorization.scope`. Private networks need an extra opt-in. Metadata
hosts are always refused.

Redirects are followed manually in `HttpClient`: each hop is checked again. The client also enforces
request budget, timeout, response-size cap, and rate limit. Unsafe API methods are filtered before a
request is created.

## Storage and privacy

Reports are written locally under `.launchproof/` (configurable). Local scans have no server
component. The public website pages are prerendered and read a committed sample report; they never
execute a scan.

The optional cloud dashboard is a server-rendered Next.js application. It stores only GitHub profile
metadata, connected repository metadata, and sanitized scan summaries. Upload is explicit and
requires a CLI token. It does not receive source files, `.env` values, evidence bodies, or full local
paths. See [CLOUD_DASHBOARD_ARCHITECTURE.md](../CLOUD_DASHBOARD_ARCHITECTURE.md) and
[PRIVACY_DATA_FLOW.md](../PRIVACY_DATA_FLOW.md).

## Resource bounds

Designed for a laptop with no Docker:

- deterministic file walk capped at 8,000 files and bounded directory entries
- text reads capped at 750 KiB by default
- one browser instance with at most 5 sampled pages, 25 links per page
- at most 50 HTTP requests per scan, 4 requests/second
- Vitest runs files sequentially with at most two workers

## Extension guidelines

Add a check as a function returning `CheckResult` (or an array). Use `createFinding` so redaction and
deterministic ids apply, take a bounded input, and document skipped/error behavior. Network checks
must receive the shared `HttpClient` or call `checkTargetScope` themselves. Never report a check that
did not execute as a pass.
