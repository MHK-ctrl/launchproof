# Contributing to LaunchProof

Thanks for helping improve verification for AI-built software. This project values evidence,
honesty about coverage, and small, reviewable changes.

## Development setup

Requirements: Node.js 22.12+, npm, and git. Docker is not used.

```bash
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs --help
```

Optional browser checks:

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
```

## Before opening a pull request

Run the same checks CI runs:

```bash
npm run build
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:web
```

If formatting fails, run `npm run format`. Do not weaken tests to make a change pass. If a test
assertion must change because behavior intentionally changed, explain why in the pull request.

## Test expectations

- New checks need a unit test or an integration test against a demo server.
- Browser behavior changes need a Playwright test when feasible.
- Test fixtures must use synthetic credentials and data. Never commit a real token.
- Do not assert that an unexecuted check passed. Use `skipped` or `not-verified`.
- Keep network tests on loopback and use ephemeral ports.
- Tests must clean up child processes and temporary directories.

## Code conventions

- TypeScript strict mode, ESM, no `any`.
- Prefer small modules and explicit types at public boundaries.
- Network requests go through `HttpClient` so scope, rate limits, timeouts, and body caps apply.
- Credentials are read from environment variables and never logged or placed in evidence.
- Findings must include a realistic impact and actionable remediation.
- Do not add telemetry, cloud calls, or required external credentials to the core path.
- Avoid new dependencies unless they are justified, maintained, and small.

## Honesty requirements

Documentation and reports must distinguish implemented from tested, and tested-passed from
not-tested. A clean scan is not a security guarantee. A skipped check is not a pass. Do not add
marketing claims, fake metrics, invented testimonials, or security badges that imply certification.

## Commit and pull request guidelines

- Keep commits focused and write a clear message about why the change is needed.
- Describe the user-visible behavior and the verification commands you ran.
- Call out checks that failed or could not run.
- Link related issues when available.

Pull request checklist:

- [ ] Implementation and tests are included
- [ ] `npm run build`, `npm run lint`, `npm run typecheck`, and `npm test` pass
- [ ] No secrets, personal filesystem paths, or real user data are included
- [ ] Documentation reflects what was actually verified
- [ ] The change does not expand authorization scope silently

## Security issues

Do not open a public issue containing exploit details or credentials. Follow
[SECURITY.md](SECURITY.md).

## Code of Conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
