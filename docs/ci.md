# CI usage

LaunchProof returns exit code `1` when the configured gate fails, so it can block a pipeline without
parsing output.

## Recommended job order

The test suite includes CLI tests that import the built `dist/`, and the browser package's types
depend on the built core package. Build before typecheck/test in a clean checkout:

```bash
npm ci
npm run build
npm run lint
npm run format:check
npm run typecheck
npx playwright install --with-deps --only-shell chromium
npm test
npm run build:web
```

Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` on `npm ci` so dependency installation does not download
browsers; install only the headless shell explicitly.

The repository workflow in `.github/workflows/ci.yml` follows this order and uploads the static
website artifact.

## Scanning a deployed staging system

Keep the scan config in the repository. Provide identity values through CI secrets:

```yaml
- name: Verify staging
  run: node packages/cli/bin/launchproof.mjs test --ci --fail-on high
  env:
    LP_OWNER_COOKIE: ${{ secrets.LP_OWNER_COOKIE }}
    LP_OTHER_COOKIE: ${{ secrets.LP_OTHER_COOKIE }}
```

Requirements:

- `scan.network: true` in the config used by CI.
- `authorization.authorized: true`.
- `authorization.scope` contains the exact staging host.
- The job runs only for your own environment, not arbitrary pull request targets.

Do not run remote scans on pull requests from forks with production credentials. Prefer a dedicated
staging environment and short-lived test accounts.

## Artifacts

Upload `.launchproof/latest.json` and `.launchproof/latest.html` if you want retained evidence:

```yaml
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: launchproof-report
    path: .launchproof/
    retention-days: 14
```

Reports may contain internal URLs and paths. Treat artifacts as sensitive.

## SARIF and code scanning

```bash
node packages/cli/bin/launchproof.mjs security --json > /tmp/report.json
node packages/cli/bin/launchproof.mjs report /tmp/report.json --format sarif --out results.sarif
```

Upload `results.sarif` with the code scanning action if your repository policy allows it. Findings
without a source file use a URL or the scan target as the artifact location.

## Gate policy

`scan.failOn` defaults to `high`. A release pipeline might use `high` while an early project uses
`critical` temporarily; document any override. Do not use a lower threshold to hide failures.

A check with status `error` fails the gate regardless of severity because the tool could not
establish a result.

## Resource constraints on CI

The test suite uses one Chromium instance and sequential test files. Scans cap files, requests, and
pages. If jobs run on small runners, keep `performance.sampleRuns: 1`, `browser.maxPages` low, and do
not enable Lighthouse (which is not bundled in this release).
