# GitHub Publication Report — LaunchProof v0.1.0

**Publication date:** 2026-11-23
**Result:** **SUCCESS** — public source repository published and hosted CI verified.
**Repository:** https://github.com/MHK-ctrl/launchproof
**Visibility:** Public
**Default branch:** `main`
**Initial commit:** `87b121717cf7e9981a38f1b2ce613f21ead8646c`

> This report records the source publication and hosted CI verification only. No GitHub release or
> tag was created, the website was not deployed, and no package was published to npm.

## 1. Publication summary

The reviewed LaunchProof v0.1.0 source tree was published as a public GitHub repository under the
authenticated account `MHK-ctrl`. The repository was created empty to avoid conflicting generated
README, license, or ignore files, then populated from the reviewed local tree. All repository
metadata, the initial commit, `main` branch, README rendering, clean-clone access, and hosted CI were
verified against the real public URL.

Initial hosted CI exposed one clean-checkout formatting failure in Next's generated
`apps/web/next-env.d.ts`. The file was excluded from Prettier because Next owns and regenerates it.
A second hosted run passed. The workflow actions were then updated to current Node-24-based major
versions, and the final code/workflow run passed on both Node 22 and Node 24.

## 2. Repository details

| Field                           | Value                                      |
| ------------------------------- | ------------------------------------------ |
| Owner                           | `MHK-ctrl`                                 |
| Repository                      | `launchproof`                              |
| URL                             | https://github.com/MHK-ctrl/launchproof    |
| Visibility                      | Public                                     |
| Default branch                  | `main`                                     |
| License                         | MIT                                        |
| Initial commit                  | `87b121717cf7e9981a38f1b2ce613f21ead8646c` |
| CI formatting fix               | `c035df55b1d6d5e1005c5e0c7cec8396db1dd422` |
| Workflow runtime update         | `c2715989c38f65d240a8d75cd3a5c79d7ba11edd` |
| Issues                          | Enabled                                    |
| Private vulnerability reporting | Enabled                                    |
| Secret scanning alerts          | 0                                          |

### Description

> Evidence-backed security, API, browser, accessibility, and performance verification for AI-built applications.

### Topics

`accessibility`, `ai-development`, `api-testing`, `application-security`, `browser-testing`,
`code-quality`, `developer-tools`, `devsecops`, `open-source`, `playwright`, `security-testing`,
`typescript`.

## 3. Files published

The repository contains **136 tracked files**, including:

- `packages/core` — discovery, static and network checks, result model, reports, and gate.
- `packages/browser` — Playwright workflows, axe-core accessibility, links, mobile, performance.
- `packages/cli` — command surface, modes, report handling, and exit codes.
- `apps/web` — static Next.js website source, components, sample report assets, and metadata.
- `examples/vulnerable-demo` and `examples/secure-demo` — loopback demo targets and configs.
- `tests/helpers` and package test suites, including security and precision regressions.
- `docs/` — architecture, CLI, configuration, security, browser, API, authorization, Supabase,
  reports, CI, deployment, troubleshooting, privacy, limitations, and FAQ.
- CI workflow, issue templates, pull-request template, Vercel/Netlify configuration.
- README, changelog, roadmap, contribution guide, code of conduct, security policy, MIT license.
- Release-readiness audit, security review, deployment readiness, publication checklist, release
  notes draft, and this report.

### Excluded by `.gitignore` and verified absent

- `node_modules/` and workspace dependency folders.
- `dist/`, `.next/`, `out/`, `*.tsbuildinfo`.
- `.launchproof/` scan artifacts and local reports.
- `.env` and `.env.*` files; only `.env.example` is public and contains no values.
- Private keys, certificates, local databases, Playwright traces, screenshots, logs, coverage, and
  editor or OS files.

A clean clone reported 136 tracked files and no forbidden paths. GitHub secret scanning reported
**0 alerts**.

## 4. Security review at publication

- No genuine API key, bearer token, password, private key, or credential was found in the staged or
  published tree. The only provider-pattern match was the secret-detector catalog itself.
- `.npmrc` contains only `fund`, `audit`, and `loglevel` settings; no registry token.
- No local absolute paths were found in source or documentation.
- No `.env` file, browser profile, trace, local database, or scan report was published.
- The public sample report is generated from the intentionally vulnerable demo and contains synthetic
  demo data. It is labeled as demo output.
- CI uses `permissions: contents: read`, no repository secrets, and no deployment steps.
- Private vulnerability reporting and the `SECURITY.md` disclosure path are enabled.
- The repository is public and has no open issues at publication time.

Residual risks remain documented in `SECURITY_REVIEW.md` and `docs/limitations.md`, including the
absence of an external audit and the lack of DNS-resolution protection against DNS rebinding.

## 5. Hosted CI

### Workflow

- Name: **CI**
- File: `.github/workflows/ci.yml`
- Triggers: pushes to `main`, all pull requests.
- Permissions: `contents: read`.
- Matrix: Node.js **22** and **24**, `fail-fast: false`.
- Steps: checkout, setup Node with npm cache, `npm ci`, high-severity dependency audit, package
  build, lint, format check, typecheck, Chromium headless-shell install, tests, website build, and a
  single website artifact upload on Node 22.
- Actions use current Node-24-based majors: `actions/checkout@v7`, `actions/setup-node@v7`,
  `actions/upload-artifact@v7`.

### Final verified run

- **Run:** https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874
- **Commit:** `c2715989c38f65d240a8d75cd3a5c79d7ba11edd`
- **Status:** Success
- **Duration:** 2m 24s

| Job              | Node | Result      | Duration | URL                                                                               |
| ---------------- | ---- | ----------- | -------- | --------------------------------------------------------------------------------- |
| Verify (Node 22) | 22   | **Success** | 2m 21s   | https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874/job/137547638775 |
| Verify (Node 24) | 24   | **Success** | 1m 15s   | https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874/job/137547639234 |

All steps passed on both jobs. The website artifact uploaded successfully on the Node 22 job. No
deployment occurred.

### Failure and remediation history

| Run                                                                             | Commit    | Result | Notes                                                   |
| ------------------------------------------------------------------------------- | --------- | ------ | ------------------------------------------------------- |
| [45130503645](https://github.com/MHK-ctrl/launchproof/actions/runs/45130503645) | `87b1217` | Failed | Format check flagged generated `apps/web/next-env.d.ts` |
| [45130767473](https://github.com/MHK-ctrl/launchproof/actions/runs/45130767473) | `c035df5` | Passed | Excluded the generated Next file from Prettier          |
| [45131442874](https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874) | `c271598` | Passed | Current action runtimes; final code/workflow validation |

The first failure was a real clean-checkout difference: Next regenerates `next-env.d.ts`, and
Prettier must not own it. The fix was a one-line `.prettierignore` entry, not a test suppression.

## 6. Changes made during publication

- Created the empty public repository to avoid conflicting initial files.
- Added repository description and 12 topics.
- Enabled private vulnerability reporting.
- Replaced `<repository-url>` placeholders in README, contributing guide, website install snippets,
  security page, release notes, and checklist.
- Added the real CI badge and a repository source link.
- Added a factual terminal-output example to the README.
- Restored `PROJECT_URL` and SARIF `informationUri` using the real repository URL.
- Added `apps/web/next-env.d.ts` to `.prettierignore`.
- Updated CI actions to current Node-24-based majors.
- Added the publication report and updated the execution log and release notes.

## 7. Remaining limitations and risks

- The website has **not** been deployed. No public site URL, alias, or domain exists.
- No GitHub release or tag has been created; that remains a separate approval decision.
- No npm package has been published; package name ownership is unresolved.
- Branch protection requiring the CI matrix has not been enabled.
- No external security audit or penetration test has been performed.
- No real Supabase project, large third-party application, or staging system has been validated.
- DNS rebinding is not defended against by the host-pattern scope model.
- GitHub Actions emits dependency deprecation notices from transitive packages (`eslint@9.39.5`,
  `source-map@0.8.0-beta.0`); they are warnings, not CI failures.
- Windows and real mobile devices are not manually validated.

## 8. Next step

The next mission is **LaunchProof Public Website Deployment — Vercel Production Launch & Live URL
Verification**. It requires explicit deployment approval and a completed `vercel login`; this
publication report does not authorize or perform that deployment.
