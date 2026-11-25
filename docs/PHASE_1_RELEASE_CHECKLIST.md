# Phase 1 — Release Checklist (v1.1.0 candidate)

Prepared during **Phase 1: Packaging, Installation Reliability and First Paid Report**.
This is the pre-publication gate. Nothing here has been published, tagged, or deployed.

## 1. Verified npm package name

- **Scope/package:** `@hamzakhan2006/launchproof`
- **Binary:** `launchproof`
- **Why this name:** the unscoped npm name `launchproof` already exists and is owned by an unrelated
  maintainer (`aabbcdl/LaunchProof`, v1.0.1, last modified 2026-08-28) — confirmed live during this
  session. Installing that will give a user someone else's tool.
- **What still needs you:** you must be able to create the `@hamzakhan2006` npm scope. On npm, a scope is
  owned by the registered username `mhk-ctrl`, or by an org you create. If your npm username is not
  `mhk-ctrl`, change the name in `packages/cli/package.json` to a scope you own (one line), then
  regenerate `package-lock.json` with `npm install --package-lock-only`.
- **Publish readiness today:** the tarball exists and works, but has **not** been published. Do not
  publish without your explicit approval.

## 2. Package version recommendation

- **Recommendation:** `1.1.0`
- **Reasoning:** the CLI bundle, the report schema, detection rules, thresholds, and redaction are
  unchanged. What changed is packaging + a new report export (`PDF`) + a new front matter section
  (scope/authorization). Per SemVer, new features are minor bumps; since nothing was ever published,
  a breaking rename of the unpublished package does not force a major.
- **Downside of 1.0.1 instead:** if you later publish `1.1.0` for the same PDF change, the changelog
  would need two releases. Pick `1.1.0` now and keep the `Unreleased` section.

### To apply the version (your command, do it only when you are ready to publish)

```bash
npm version 1.1.0 --no-git-tag-version
# then rebuild and re-verify before publishing:
npm run build
npm run verify:package
```

Do **not** commit or tag until the package is ready for the registry.

## 3. Release notes (ready to publish)

These are in `CHANGELOG.md` under `## [1.1.0] — 2026-11-25` and repeat here for the registry release:

- Added `launchproof report --format pdf`, which prints the existing HTML report to A4 with page
  numbers and a "not a penetration test" footer, using the optional Playwright dependency.
- Added an assessment scope and authorization statement at the top of every HTML and PDF report: project,
  date, tool version, mode, target, selected check counts, and the authority for any live target.
- Added `npm run verify:package`, which packs a tarball, installs it into an unrelated temporary project,
  runs a scan, and asserts the fixture secret never appears in output or the HTML report.
- Added `npm run pack:cli`, which builds and packs the CLI workspace into `artifacts/`.
- Added regression tests for package identity, tarball contents, and bundled workspace dependencies.

**Changed:**
- The CLI package is now `@hamzakhan2006/launchproof`; the binary is still `launchproof`. The unscoped npm
  name belongs to an unrelated project and nothing has been published.
- `npm test` now builds first through `pretest`, so a fresh clone runs the suite without a manual build.
- The CLI tarball ships a `LICENSE` file plus `repository`, `homepage`, `bugs`, and `publishConfig`
  metadata.

**Fixed:**
- A clean clone could not run the test suite: four test files resolved `@launchproof/core` before any
  build existed.
- `npm ci` rejected the lockfile after the workspace rename until `package-lock.json` was updated.

## 4. Fresh installation results (executed)

All of these were run against a checkout with **no** `node_modules`, **no** `dist`, **no** `.git`
artifacts carried — a clean-install simulation of a new developer:

| Step | Result |
| --- | --- |
| `npm ci` | success, 250 packages |
| `npm test` (no manual build) | **22 files / 131 tests pass**, exit 0 |
| `launchproof --version` from the installed tarball | `1.1.0` |
| `launchproof --help` | documents `scan` and `report` |
| Scan of a scratch Express app with a fake secret + `eval` | exit 1, gate failed |
| Findings reported | secrets.hardcoded (high), security.static (high), configuration.repository |
| Secret value in report or stdout | **absent** |
| HTML report carries authorization statement | yes |
| HTML report masks the secret value | yes |

The verifier is the executable proof: `npm run verify:package`.

## 5. npm pack inspection results (executed)

From `npm pack --workspace @hamzakhan2006/launchproof --pack-destination ./artifacts --json`, after the
build + prepack lifecycle:

| Attribute | Value |
| --- | --- |
| Name | `@hamzakhan2006/launchproof` |
| Version | `1.1.0` |
| Tarball | `hamzakhan2006-launchproof-1.1.0.tgz` (~215 KB packed, ~940 KB unpacked) |
| Entry points | `readme` → `README.md`, `bin` → `bin/launchproof.mjs` |
| Files in tarball | `README.md`, `bin/launchproof.mjs` (shebang, mode 0o755), `dist/index.js` (mode 0o755), `dist/index.js.map`, `package.json`, `LICENSE` |
| NOT shipped | `src/`, `node_modules/`, `.git`, `.env`, `.launchproof` |
| LICENSE present | yes (MIT) |
| Bin executable | yes (`bin/launchproof.mjs`, `#!/usr/bin/env node`) |

`dist/index.js.map` is intentionally shipped: stack traces from the bundled CLI remain useful to you
and your customers when something fails. It adds ~640 KB to the unpacked install, which is acceptable
for an npm tool; remove it only if you hit a hard size constraint later.

## 6. Test results (current)

| Suite | Files | Tests | Status |
| --- | --- | --- | --- |
| `npm run build` | — | — | exit 0 |
| `npm run typecheck` (core, browser, CLI, web) | — | — | exit 0 |
| `npm test` (Vitest) | 22 | 131 | exit 0 |
| `npm run verify:package` | — | 19 assertions, all pass | exit 0 |

No existing test was removed or weakened. New tests added:

- `packages/core/test/reports.test.ts` — 4 new assertions: scope/authorization statement present,
  "not a penetration test" wording present, no-live-target wording varies correctly, the target is
  escaped in the scope section.
- `packages/cli/test/package.test.ts` — 12 new assertions: package not named `launchproof` (the
  unrelated public package), scoped name shape, semver version, public publishConfig, repository URL
  and directory, bin points to a real shebangged file, tarball ships bin/dist/LICENSE/README, LICENSE
  exists and says MIT, runtime deps do **not** include unpublished workspace packages, Playwright and
  axe-core remain optional, `tsup.config.ts` bundles the two workspace packages.

## 7. Known limitations that block a clean publish right now

1. **The scoped package is not in the registry.** Until published, the "global command" path for a new
   developer is `npm run pack:cli` + `npm install --global ./artifacts/*.tgz`, not `npm install -g
   @hamzakhan2006/launchproof`. Instructions for customers must use that until the first publish.
2. **npm credential scope ownership is unverified.** This session did **not** log into npm
   (`ENEEDAUTH`). I have not created the `@hamzakhan2006` scope or written the name to npm. Do that only
   when you approve the publish.
3. **README still says "v1.0.0" in the status block near the top.** That block is about the source
   release, and is still true for the engine; the package version to publish is `1.1.0`. If you want
   the top-of-readme status block to match the publish version, update the version line in
   `README.md` together with the `npm version` command.
4. **PDF needs Chromium.** Customers who just `npm install -g @hamzakhan2006/launchproof` will get exit 2
   from `--format pdf` until they run `npx playwright install chromium`. That is by design (the browser
   checks already need it), but the first customer who asks for a PDF is the most likely to hit it.
   The error message names the exact commands.

## 8. Exact commands to run next

```bash
# 1. Rebuild (deterministic, no surprise):
npm run build

# 2. Type-check everything:
npm run typecheck

# 3. Full test suite:
npm test

# 4. The end-to-end pack/install/scan proof that the changelog and this checklist cite:
npm run verify:package

# 5. When you are ready to publish (your call only):
npm version 1.1.0 --no-git-tag-version
npm run build
npm run verify:package
npm login                          # you authenticate; I do not touch payment or npm account
npm publish --workspace @hamzakhan2006/launchproof --access public
# then update this checklist's "version" row to 1.1.0 and move Unreleased into the 1.1.0 header.
```

Before publishing, also:

- confirm your npm username owns/is the `@hamzakhan2006` scope (change `name` in
  `packages/cli/package.json` if not — one line);
- run `npm run audit` to confirm no new high/critical advisories landed in lockfile regeneration;
- run `npm run format:check` and `npm run lint` to keep the CI gate green before a publish commit;
- decide whether the first release is public (it is, given the `--access public` above).

## 9. What still requires your approval

1. **The npm name.** I renamed the workspace package from `launchproof` to `@hamzakhan2006/launchproof`
   because the unscoped name is taken by an unrelated project. You must confirm that `@hamzakhan2006` is a
   scope you can own on npm (username `mhk-ctrl`, or an org), or tell me your actual npm username so I
   set the exact scope. If you want the package to be free of any token/keyword collision, I can set a
   different scope in one line.
2. **The version.** I recommend `1.1.0`. Tell me if you want `1.0.1` instead and I will adjust the
   changelog and the verify-pkg snapshot.
3. **Publishing.** I will not run `npm publish`, create an npm account, touch any payment account, or
   modify any billing setup without your explicit approval. The changelog, this checklist, and the
   verifier are ready to support a publish the moment you say so.
4. **The PDF dependency story.** I kept it on optional Playwright on purpose. If you would rather ship
   a truly zero-browser first release and defer PDF until later, I can move `--format pdf` behind a
   feature flag or strip it; the rest of this phase still stands.
5. **The secrecy/legal question.** The CLI already hides secret values in reports, redacts evidence, and
   writes an authorization statement. Nothing in this phase creates a reporting service, stores customer
   data externally, or changes what is sent anywhere. If you later wire a paid report delivery path, that
   is a separate phase with its own privacy review.
