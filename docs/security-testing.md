# Security testing

LaunchProof combines source-level heuristics with bounded, authorized HTTP checks. Static matches are
not exploit proof; observed HTTP behavior is stronger evidence but still not a penetration test.

## Secret scanning

Patterns cover AWS access keys, private key blocks, GitHub tokens, Stripe live keys, AI provider keys,
Slack tokens, Google API keys, npm tokens, SendGrid keys, service-role JWTs, and high-entropy values
assigned to credential-like names.

Filters reduce noise: obvious placeholders, public/anon env prefixes, documentation, and low-entropy
values are skipped. The scanner never emits a matched value. Every finding uses
`****REDACTED****`; matched lines are reduced to the key name where possible.

Environment hygiene:

- `.env*` on disk is reported; severity is higher if git tracks it.
- Missing `.gitignore` coverage for `.env` is reported.
- Optional git history review looks at sensitive **filenames only**, not historical blob contents.

A masked credential is still exposed. Rotate anything confirmed, remove it from source, and purge
history if it was committed.

## Static rules

Current rules include:

- `eval()` and `new Function()`
- `dangerouslySetInnerHTML` and non-literal `innerHTML`
- shell command interpolation in child-process calls
- SQL query interpolation/concatenation
- wildcard CORS configuration
- disabled TLS verification (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`)
- service-role/admin key references (elevated in client components)
- environment objects written to logs
- AI clients allowed in the browser
- ignored type/lint build errors
- debug flags in committed configuration

Each match is capped per file and globally. They are labeled `verification: pattern` and medium/low
confidence where appropriate. Review before acting.

## HTTP checks

When `scan.network` is true and a target is authorized:

- Reachability and root status
- CSP presence and `unsafe-eval`
- HSTS on HTTPS
- `X-Content-Type-Options`, frame protection, referrer policy, permissions policy
- `X-Powered-By` and version-revealing `Server`
- cookie `HttpOnly`, `Secure` on HTTPS, `SameSite`
- CORS with a random Origin and with credentials
- plaintext transport for non-loopback targets
- a fixed list of sensitive paths (`.env`, `.git/config`, `.git/HEAD`, backups, `.DS_Store`,
  package.json, server-status, debug endpoint) with content validators
- stack-trace leakage on a random path

Response bodies are **not copied** into evidence. Sensitive-path findings record status,
content type, and a validation statement only.

## Dependency audit

With network enabled, the configured package manager's audit command runs with a bounded timeout.
Results are mapped to findings. A missing lockfile is a warning, not a fake pass. Registry
availability failures produce `not-verified`, never `pass`.

## Supabase

See [supabase.md](supabase.md). Static migration review and an optional anon-key read probe are
independent of general HTTP checks.

## What this does not cover

No exploitation, fuzzing, authentication bypass attempts, SQL injection payloads, SSRF probes,
business-logic abuse, TLS certificate validation, or manual review. A clean report is not a security
certificate. See [limitations.md](limitations.md).
