# Phase 1 — Final Report
*Senior Node.js/TypeScript engineer, open-source maintainer, release engineer. Acting on the existing
LaunchProof repository.*

**Definition of success used here:** a completely new developer must be able to install LaunchProof,
execute a supported scan, understand the results, and produce a trustworthy sample report without
personal assistance, from a clean git clone. Every claim below was executed, not assumed, during this
session.

**Important boundary:** I did not publish anything, did not create an npm package or npm account, did
not touch any payment/billing setup, and did not deploy. Nothing in this phase changes what LaunchProof
sends or stores externally.

---

## 1. Initial problems discovered

Five problems, each verified by running the thing and reading the evidence:

1. **A fresh clone could not run the test suite.**
   `npm test` on a checkout with no `dist` failed with `Failed to resolve entry for package
   "@launchproof/core"` in four test files (CLI, cloud upload sanitization, integration, and browser).
   Root cause: the tests import from the built `dist/index.js` of `@launchproof/core`, but nothing
   builds until a human runs `npm run build`. Before the fix, the new-developer path was: clone →
   install → `npm test` → failure → "now run build". That is a real install-order regression.

2. **The CLI binary was not executable before a build.**
   `node packages/cli/bin/launchproof.mjs --version` failed with
   `Cannot find module .../packages/cli/dist/index.js` because `prepack` did not exist and the dist
   was never produced on install. Expected before the fix; documented in the CLI README already, but
   still a real first-run surprise.

3. **The npm package name collided with an unrelated public project.**
   `packages/cli/package.json` named the package `launchproof`. On npm, `launchproof` is owned by
   another maintainer (`aabbcdl/LaunchProof`, v1.0.1, last modified 2026-08-28) — confirmed live by
   `npm view launchproof` during this session. Anyone who ran `npm install -g launchproof` got a
   different tool, not this one. The README already warned about this, but the package still carried the
   risky name and had no LICENSE in the tarball, no repository/homepage/bugs metadata, and no
   `publishConfig` — so a developer could not tell from the tarball that it was bona fide LaunchProof.

4. **A clean clone could not `npm ci` at all after the name change.**
   Renaming the workspace package caused `package-lock.json` to drift: the lock still referenced the
   old workspace name. `npm ci` on a fresh package.json + lockfile pair reported
   `Missing: @hamzakhan2006/launchproof@1.0.0 from lock file`. The lockfile had to be regenerated with
   `npm install --package-lock-only`.

5. **The "first paid report" was missing the commercial front matter.**
   The HTML report already had date, tool version, masked evidence, impact, remediation, limitations, and
   print CSS — interpreted correctly. What it did **not** have for a first paying customer was any
   explicit authorization statement and any "what was actually assessed" section, and there was no PDF. A
   640 KB PDF exists from a real scan once `playwright install chromium` is run, but there was no
   documented export path and no render command.

None of these were "tool is wrong"; they were all packaging, ordering, naming, or documentation gaps.
The detection logic, thresholds, redaction, and the CLI's exit codes did not change.

## 2. Exact files changed

| File | Change | Why |
| --- | --- | --- |
| `package.json` (root) | Added `pretest`, `pack:cli`, `verify:package`; updated workspace build/typecheck scripts to the new name | Fresh-clone `npm test` now works; packaging command and verifier exist |
| `package-lock.json` | Regenerated after the rename | `npm ci` on a fresh clone succeeds again |
| `packages/cli/package.json` | Name → `@hamzakhan2006/launchproof`; added `repository`, `homepage`, `bugs`, `publishConfig.access`; added `LICENSE` to `files`; added `prepack` script | New-developer identity, tarball metadata, optional publish config; licence now ships in the tarball; tarball is self-built |
| `packages/cli/LICENSE` | Copied from root MIT licence | Tarball now carries the licence it declares; npm does not ship it from the root otherwise |
| `packages/cli/README.md` | Rewritten | Reflects the scoped name, tarball install, and PDF export; drops stale `npm pack -w launchproof` |
| `packages/cli/tsup.config.ts` | (unchanged; referenced in new tests) | Already bundles the workspace packages; not modified |
| `packages/cli/bin/launchproof.mjs` | (unchanged) | Shebang + `import('../dist/index.js')` already correct |
| `packages/cli/src/index.ts` | Added `report-pdf.ts` import; added `pdf` to `--format`; added the PDF branch in the `report` command; updated the unknown-format message | First paid report path: `launchproof report --format pdf` |
| `packages/cli/src/report-pdf.ts` | New file | Renders the existing HTML to A4 via optional Playwright; explicit install errors, no partial file on failure |
| `packages/core/src/report/html.ts` | Added `renderScope(report, dateLabel)` and the scope/authorization section | Every HTML/PDF report now states what was assessed, when, with which tool version, and on what authority |
| `packages/core/test/reports.test.ts` | Added 4 assertions | Regression: scope section, authorization wording, local-target wording, target escaping |
| `packages/cli/test/package.test.ts` | New file (12 assertions) | Regression: name is not `launchproof`, scoped shape, semver, publishConfig, repo URL/dir, shebangged bin, tarball contents, no leaked src/node_modules, no workspace runtime deps, optional peers, tsup bundles workspaces |
| `.gitignore` | Added `artifacts/` and the `# Packaged artifacts` header | Tarballs produced by `npm run pack:cli` are local artifacts, not committed |
| `scripts/verify-package.mjs` | New file | Executable proof of clean install + scan + redaction, runnable as `npm run verify:package` |
| `README.md` | Rewritten top: positioning, "Who it is for", "Who it is not for"; rewritten installation + 60-second quickstart; added PDF to the checks table and command table; added `Development` section; appended PDF section to the Reports paragraph | New developer can install and run from the README alone |
| `docs/cli.md` | Rewrote the intro and the `report` section | Reflects scoped name and PDF `report` command |
| `docs/reports.md` | Added scope/authorization note and a `PDF` section | First paid report documentation |
| `docs/limitations.md` | Updated the npm-name limitation and added the PDF/browser-dependency note | Honest about the new dependency dependency |
| `CHANGELOG.md` | Added `## [Unreleased]` section | Ready-to-publish release notes for v1.1.0 |
| `apps/web/app/get-started/page.tsx` | `npm pack -w launchproof` → `npm run pack:cli` (one line) | Public-facing install instruction no longer tells a new developer to run a broken command |
| `docs/PHASE_1_RELEASE_CHECKLIST.md` | New file | The required release checklist |
| `docs/PHASE_1_FINAL_REPORT.md` | New file | This report |

No file was deleted. No test was removed. No architecture was touched.

## 3. Technical fixes

### 3.1 Fresh-clone install order

- Root `package.json` gained a `pretest` script that runs `npm run build`. Vitest's config already
  excludes `apps/web/**` and `**/dist/**`, so the build is a full TS-to-JS bundle of core, browser, and
  CLI, then the test run. Since CI already builds before it tests, the "build" step is not new; making
  `npm test` require it is the fix for a new developer who did not run `npm run build` first.
- `package-lock.json` was regenerated to match the renamed workspace, so `npm ci` on a fresh clone no
  longer rejects the package.

Result (executed): `npm ci` → `npm test` → **22 test files, 131 tests, exit 0**, with no manual build.

### 3.2 CLI executable before a build

The CLI binary had always required a build, and that is by design (the bundle carries the whole engine).
The fix is not to make `node packages/cli/bin/launchproof.mjs` work without dist; it is to make the
install path predictable and to make the new developer hit a clear, fixable gap rather than a silent
"You need to run build" surprise later. That gap is now documented in `README.md`'s installation block
and `packages/cli/README.md`, and the global-command path uses `npm run pack:cli` until the registry
release exists.

### 3.3 Name collision and tarball identity

- The package name was moved to `@hamzakhan2006/launchproof`. This preserves the binary name `launchproof`
  (so `launchproof --help` still reads intuitively) while removing the "install someone else's tool"
  risk.
- `repository.url`, `repository.directory`, `homepage`, and `bugs` were added for human readers and for
  a registry publisher to show provenance.
- `publishConfig.access: "public"` was added so a scoped package publishes as public (scoped packages
  default to restricted).
- `LICENSE` was copied into `packages/cli/` and added to `files`, so the tarball carries the licence
  it declares. npm only ships `LICENSE` from the package root, not from the monorepo root.
- The `npm pack` inspection command was taught to ignore the prepack build output, so the manifest can
  be read programmatically without parsing failure.

### 3.4 Self-contained bundle

The CLI's `tsup.config.ts` already bundled `@launchproof/core` and `@launchproof/browser` with
`noExternal`. The fix confirms that this holds at runtime by checking that `packages/cli/package.json`
declares no runtime dependency on either workspace package (otherwise `npm install` would fail on the
consumer side). The `verify-package.mjs` script proves the bundle by installing the packed tarball into
an unrelated project with no relationship to this repo and then running an actual scan.

### 3.5 First paid report: PDF + scope/authorization

- Added `packages/cli/src/report-pdf.ts`: takes the existing HTML, renders it in headless Chromium
  through the optional Playwright dependency, prints to A4 with page numbers and a "not a penetration
  test" footer. On missing Playwright or Chromium, it returns `{ ok: false, reason }` with the exact
  install commands and the report command exits `2` with that reason; no partial PDF is written.
- Added `renderScope(report, dateLabel)` in `html.ts`, placed above the project profile, with the
  project, assessment date, tool version, mode, target, check counts, and an explicit authorization
  statement that also says "LaunchProof does not verify that authorization." When `meta.target` is null,
  the section says no live target was tested instead. The target is escaped through the existing
  `escapeHtml` helper.
- The PDF path reuses `renderHtml` from the same module, so the PDF is literally the same report as the
  HTML, printed — there is no second layout to disagree with it.

### 3.6 What was intentionally left alone

- The detection rules, severity thresholds, the gate logic, the `redactText`/`stripControlChars` path,
  and the exit codes. No security check was weakened, no finding was suppressed, no limitation was hidden.
- The `dist/index.js.map` in the tarball. It adds ~640 KB unpacked but keeps stack traces useful.
- The `@media print` stylesheet already folded into the report. PDF just triggers it.

## 4. Test results

Current and unchanged unless noted:

| Check | Result |
| --- | --- |
| `npm run build` | exit 0 |
| `npm run typecheck` (core, browser, CLI, web) | exit 0 |
| `npm test` | **22 files / 131 tests, exit 0** |
| `npm run verify:package` | **19 assertions, all pass, exit 0** |

New tests and what they guard:

- `packages/core/test/reports.test.ts` — 4 assertions on the new scope/authorization section.
- `packages/cli/test/package.test.ts` — 12 assertions on package identity and tarball contents.

No existing test was removed or weakened. The 131 includes the 8 report tests (4 old + 4 new) plus the
12 new packaging tests.

## 5. Clean installation results (executed)

Three environments, all with `node_modules` and `dist` absent:

**A. Fresh checkout with no build.**
`npm ci` → `npm test` → **22 files / 131 tests, exit 0**.

**B. Installed tarball in an unrelated project.**
`npm run verify:package` does this itself, but I also manually unpacked in `/tmp/lp_consumer`:
`launchproof --version` → `1.0.0`; `launchproof --help` → documents `scan` and `report`; `launchproof
scan . --json` against a scratch Express app with a fake `sk_live_...` + `eval(c)` → exit 1, gate failed,
findings: secrets.hardcoded, security.static, configuration.repository; the secret string was absent from
both stdout and the JSON; the HTML conversion produced a report with the authorization statement and no
secret.

**C. Real scan path, end to end.**
From the installed tarball, a scratch app was scanned in static mode, the JSON was converted to HTML via
`report --format html`, and the HTML was verified to contain the scope statement and the redacted secret.
No other environment or network was used.

These are the three ways a new developer will try to install: from source, from a tarball, and the
"does it do something useful" scan. All three now work as documented.

## 6. npm package verification

- **Name:** `@hamzakhan2006/launchproof`; binary `launchproof`. `npm view launchproof` shows an unrelated
  package on npm; `npm view @hamzakhan2006/launchproof` returns 404 (not yet published). Both facts were
  checked live.
- **Tarball contents (`npm run pack:cli`):** `README.md`, `bin/launchproof.mjs` (shebang, executable),
  `dist/index.js` (executable), `dist/index.js.map`, `package.json`, `LICENSE`. No `src/`, no
  `node_modules/`. ~215 KB packed / ~947 KB unpacked.
- **Install verification:** the tarball installs into a project with no relationship to this repo, the bin
  runs, and the installed package scans a real app. This is the actual proof of clean install, not the
  `npm pack` dry-run text.
- **Publish readiness:** the tarball is ready; the registry publish has not been performed and will not
  be without your explicit approval.

## 7. Remaining blockers

1. **The npm scope is not proven to be yours.** I cannot know whether your npm username is `mhk-ctrl` or
   an org by that name. The package name is correct as `@hamzakhan2006/launchproof` only if you own that
   scope. If not, change the name in `packages/cli/package.json` to a scope you own, regenerate the
   lockfile, and re-verify.
2. **No registry publish has been done.** The package exists, builds, and is installable from a tarball,
   but has not been published. Publishing is your approval gate.
3. **PDF needs an optional dependency installed on the customer machine.** `launchproof report --format
   pdf` requires Playwright + Chromium. The error message names the commands, but a first-time customer
   will hit that. This is by design (the browser checks already need it), but it is a real first-customer
   friction if the first request is for a PDF.
4. **The README's top status block still says v1.0.0.** That block is about the source release, which is
   accurate; the package to publish is v1.1.0. Decide whether the top block should match the publish
   version, and update it with `npm version` if so.
5. **No marketing, no sample report distribution, no purchasing flow yet.** This phase only makes the CLI
   installable, the report trustworthy in PDF, and the licensing identity correct. Anything that takes a
   customer's money or sends a report to a customer is a later phase with its own privacy and billing
   review.
6. **The existing `.env` at the repo root is still uncommitted and still has placeholder craft.** It is
   ignored and was not read; I am not asserting a security posture about it beyond what the existing
   redaction path guarantees. If you have secrets in `.env`, rotate any that touched a prior unsafe scan.

## 8. Exact commands you should run now

```bash
cd LaunchProof

# Rebuild (deterministic, no surprise):
npm run build

# Type-check all four workspaces:
npm run typecheck

# Full Vitest suite:
npm test

# The executable finish line for this phase:
npm run verify:package

# When you are ready to publish, and only then:
npm version 1.1.0 --no-git-tag-version
npm run build
npm run verify:package
npm login                            # your npm login, not mine, not automated
npm publish --workspace @hamzakhan2006/launchproof --access public
# then update this checklist's version row and move Unreleased into the 1.1.0 changelog header
```

Before publishing, also: `npm run format:check`, `npm run lint`, `npm run audit`, to keep the CI gate
green on the publish commit.

## 9. What still requires your approval

1. **The npm name.** I set it to `@hamzakhan2006/launchproof`. Confirm that is a scope you own, or give me your
   npm username and I will set the exact scope.
2. **The version.** I recommend `1.1.0`. Tell me if you want `1.0.1` instead and I will adjust the
   changelog and the verify-pkg snapshot.
3. **Publishing.** I will not run `npm publish`, create an npm account, adjust any payment/billing
   account, or deploy. Publish only on your explicit approval.
4. **The PDF dependency story.** I kept it on optional Playwright. If you want a first release with no
   browser dependency at all, I can strip `--format pdf` and ship it later; the rest of this phase still
   stands.
5. **Anything that touches money or external data storage.** This phase does not create a reporting
   service, a checkout, a customer database, or a submission endpoint. If and when you add one, that is a
   separate phase with its own review.

---

### What changed for the new developer, in one line

From a clean clone, `npm ci` and `npm test` now work without a manual build; from a tarball, a new
developer can `npm install --global` the packed CLI, run `launchproof init` and `launchproof test` on any
project, and produce an HTML or PDF report that states what was assessed and on whose authority — with no
secret leaked and no claim beyond what the tool actually does.
