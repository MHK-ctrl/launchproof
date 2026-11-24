# FAQ

### Is LaunchProof free?

Yes. The source is MIT licensed. There is no paid tier. The optional dashboard is free and hosted at
[launchproof-rose.vercel.app](https://launchproof-rose.vercel.app), but local scanning needs no account.

### Is it published on npm?

No. The public npm name `launchproof` is owned by an unrelated project, so v1.0.0 is distributed from
the repository checkout or an `npm pack -w launchproof` tarball. Do not install the similarly named
registry package expecting this project; a scoped package name is an owner decision.

### Does the cloud dashboard upload my code?

No. Upload happens only with `--upload` (or an explicit API call), and sends a sanitized summary:
counts, findings, commit/branch, and repository metadata. Source code, environment values, and local
paths are never sent. See the [privacy policy](https://launchproof-rose.vercel.app/privacy).

### What is not verified about the cloud dashboard?

Tenant isolation, CSRF rejection, rate limits, account deletion, and CLI login/revocation were tested
against production. GitHub repository consent and a CLI upload against a connected repository were
not completed because GitHub required owner 2FA. The dashboard can therefore be used, but treat the
repository-connect path as newly released rather than battle-tested.

### Does it upload my code?

No. Scanning is local. Network requests go only to the target you configure, the npm registry for
audits when enabled, an optional Supabase project, and an optional AI provider you explicitly enable.
There is no telemetry.

### Does it replace a penetration test?

No. It is a verification aid with heuristic static rules, unauthenticated HTTP checks, configured API
and authorization scenarios, and bounded browser coverage. It does not exploit vulnerabilities or
provide certification. See [limitations.md](limitations.md).

### Why did a check not pass or fail?

A check can be `skipped` (disabled or not applicable), `not-verified` (could not establish an answer),
or `error` (the check itself failed). These are intentionally not passes. Read the check summary and
details.

### Why does the report fail when I expected it to pass?

The gate fails on findings at or above `scan.failOn` (default `high`) or if a check errored. Inspect
the failing findings, not just the total count. You can temporarily change the threshold, but document
why and do not hide real issues.

### Can I scan someone else's website?

Only with explicit written permission. LaunchProof cannot verify authorization. Remote targets
require `authorization.authorized: true` and a matching scope. Never test third-party systems without
permission.

### Why is there no Chromium result?

Playwright and Chromium are optional. Install them and run `launchproof doctor`. Missing browser
tooling is reported as `not-verified`, never a pass.

### Why does `npm audit` say skipped?

Network checks are disabled, no lockfile exists, or registry access failed. Enable `scan.network` and
run in an environment with registry access. A skipped audit is not a clean audit.

### Can I use it in CI?

Yes. Exit code `1` fails the gate. Build before typecheck/test, install the Chromium shell for browser
tests, and keep identity values in secrets. See [ci.md](ci.md).

### Does it support my framework?

Discovery recognizes common JS/TS and Python frameworks and several API routing patterns. Even when
a framework is recognized, explicitly configure critical API endpoints and authorization scenarios.
Framework detection is orientation, not coverage.

### Does it test Supabase write policies?

No. Static review covers migrations; the optional live probe performs a single anon-key read per
listed table. Write policies, authenticated policies, and column grants are not tested.

### Is the sample report real?

Yes—it is real output from scanning the intentionally vulnerable demo bundled in the repository. The
demo is designed to fail. It is not an assessment of a real product or a performance benchmark.

### Why does the HTML report work offline?

All CSS and the small filter script are inline. There are no remote fonts, images, or analytics.
