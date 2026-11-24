# Launch checklist — v1.0.0

Status reflects the Phase 21.9 release. Do not check an item without evidence.

## Product and website

- [x] Landing page explains what LaunchProof is, who it is for, local vs cloud, and how to start.
- [x] Navigation works: Home, Demo, Docs, Get started, Security, Report, Login, Dashboard.
- [x] Simulated demo runs with no network requests and is clearly labeled.
- [x] Sample report opens and is real output from the bundled vulnerable demo.
- [x] Dashboard empty states are useful without repositories or scans.
- [x] Public privacy, terms, contact, and security pages exist and are linked in the footer.
- [x] No dead links found in the public navigation/footer check.
- [ ] Owner review of public copy for tone/positioning (recommended, not blocking).

## Onboarding and docs

- [x] README covers install, quick start, capabilities, cloud, privacy, limitations, and disclosure.
- [x] Docs cover installation, commands, configuration, reports, cloud, CI, and limitations.
- [x] CLI reference matches implemented commands.
- [x] Troubleshooting covers install, auth, GitHub, upload, network, and report failures.
- [x] Privacy documentation matches the implemented data flow.
- [x] Terms and security disclosure are published.
- [x] Contact uses verified channels only (GitHub issues + private advisory).

## Security

- [x] Tenant isolation verified in production with two synthetic identities.
- [x] Cross-account downloads and mutations denied.
- [x] CSRF/origin rejection verified on authenticated mutations.
- [x] Live per-user rate limit verified.
- [x] Account deletion verified for synthetic accounts; owner data untouched.
- [x] CLI login, status, logout, and revocation verified.
- [x] No secrets in git, logs, responses, or release artifacts.
- [x] `npm audit --audit-level=high` reports 0 vulnerabilities.
- [ ] GitHub repository connect / provider-token exchange (blocked by owner 2FA).
- [ ] CLI upload/download against a connected repository (blocked by the same gate).
- [ ] External security audit (not purchased; not claimed).

## Distribution

- [x] CLI tarball inspected: only `bin`, `dist`, `README`, and package metadata (no source, tests, env).
- [x] Clean install from a packed tarball on macOS arm64: `--version` 1.0.0, `init`/`analyze`/`test` pass.
- [x] Version consistent at 1.0.0 across workspaces.
- [ ] npm publication — **blocked**: the registry name `launchproof` is owned by an unrelated
      project and no npm account is authenticated. Owner must choose a scoped name and publish.
- [x] Installation instructions describe the actual repository/tarball path.
- [ ] Windows/Linux clean-install verification (not performed; do not claim).

## Release

- [x] Full verification passes: format, lint, build, typecheck, 21 test files / 115 tests, web build.
- [x] CHANGELOG has a 1.0.0 entry with known limitations.
- [x] Git tag `v1.0.0` points at released commit `d9a967f`.
- [x] GitHub release published: https://github.com/MHK-ctrl/launchproof/releases/tag/v1.0.0
- [x] `main` contains the release and the follow-up code-block CSS fix (`07376fd`); CI passed on Node 22 and 24.
- [ ] Branch protection / required reviews (repository is unprotected; owner decision).

## Deployment

- [x] Production deployed from a clean `main` tree at the release commit, plus the follow-up CSS fix.
- [x] Canonical domain serves the v1.0.0 build without Vercel Authentication.
- [x] Public pages and `/api/health` return 200; unknown path returns 404.
- [x] Signed-out `/dashboard` returns 307 to `/login?next=%2Fdashboard`; private cache/noindex intact.
- [x] CSP nonce + strict-dynamic, HSTS, nosniff, DENY framing intact.
- [x] New privacy/terms/contact pages return 200 and render.
- [x] Mobile dashboard at 390px: `scrollWidth` 390, no horizontal overflow.
- [ ] Custom domain (owner decision; not purchased).
- [ ] Paid monitoring/alerting or automated backups (owner decision; not purchased).

## Launch materials

- [x] Product announcement.
- [x] Short social copy.
- [x] Developer-community post.
- [x] Demo script with real commands.
- [x] Real screenshots of home, docs, and sample report captured from production.
- [x] Checklist (this file).
- [ ] Publish social posts / send outreach / buy ads (requires separate owner authorization).
