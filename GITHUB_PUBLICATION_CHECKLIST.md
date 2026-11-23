# GitHub Publication Checklist — LaunchProof v0.1.0

**Status:** Published to the public repository `MHK-ctrl/launchproof`. See
[GITHUB_PUBLICATION_REPORT.md](GITHUB_PUBLICATION_REPORT.md) for the verified result.
**Approval:** Granted for public repository creation, initial commit, push, and hosted CI verification.

> This checklist deliberately does not invent a GitHub owner or repository URL. Replace placeholders
> only after the owner chooses the account or organization and the repository is created.

## 1. Repository setup requirements

- [ ] Owner chooses the GitHub account or organization.
- [ ] Repository name: **`launchproof`** (recommended).
- [ ] Visibility: **public** at publication time; private only as a temporary staging state.
- [ ] Description (recommended):
  > Evidence-backed security, API, browser, accessibility, and performance verification for AI-built applications.
- [ ] Topics (recommended): `security`, `testing`, `qa`, `playwright`, `accessibility`,
      `production-readiness`, `cli`, `nodejs`, `typescript`, `open-source`.
- [ ] License: MIT (already present in `LICENSE`).
- [ ] Default branch: `main`.
- [ ] Enable private vulnerability reporting / Security advisories after creation.
- [ ] Enable branch protection for `main` after the first successful CI run.
- [ ] Do not enable GitHub Pages unless the static site is intentionally hosted there; the reviewed
      deployment target is Vercel.

## 2. Pre-publication source checks

- [ ] `npm ci` succeeds from the lockfile.
- [ ] `npm run format:check` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm test` passes.
- [ ] `npm run build:web` passes.
- [ ] `npm audit --audit-level=high` reports 0 vulnerabilities.
- [ ] Both demo gates behave as documented.
- [ ] No `.env`, credential, token, private key, local database, browser profile, Playwright trace,
      screenshot, or machine-specific path is staged.
- [ ] `.launchproof/`, `dist/`, `.next/`, `out/`, `node_modules/`, logs, and temporary reports are
      ignored.
- [ ] `package-lock.json` is committed.
- [ ] No fake metrics, testimonials, customer logos, certifications, or fabricated URLs are present.
- [ ] The website sample report is labeled as demo output.

## 3. Repository initialization approach

There is no `.git` directory in the reviewed project. Preserve the current working tree; do not delete
local artifacts that are intentionally ignored.

Recommended initial publication:

```bash
cd LaunchProof
git init -b main
git add .
git status --short
git diff --cached --stat
git commit -m "Release LaunchProof v0.1.0 source preview"
```

Then create the empty repository on GitHub under the owner-approved account and add the remote:

```bash
git remote add origin https://github.com/MHK-ctrl/launchproof.git
git push -u origin main
```

Before committing:

- [ ] Review `git status --short --ignored` and confirm only intended source, docs, tests, configs,
      and the website source are included.
- [ ] Confirm the sample report assets under `apps/web/public/` are intentional and contain only
      synthetic demo data.
- [ ] Confirm no `.launchproof/` artifacts or local logs are tracked.
- [x] Confirm the README placeholder is replaced with the real repository URL.
- [ ] Confirm the CLI no longer claims an invented project URL; re-add `PROJECT_URL` only when a real
      repository URL is known.

Do not force-push, rewrite history, or commit generated build output.

## 4. README review

- [ ] Status clearly says v0.1.0 source preview.
- [ ] It states the package is not published to npm.
- [ ] It does not claim a deployment, external audit, or certification.
- [ ] Requirements state Node.js 22.12+ and npm.
- [ ] Quick start commands match the CLI.
- [ ] Optional browser prerequisites are explained.
- [ ] Limitations and privacy links are present.
- [x] The real clone URL is used in the README and contributing guide.
- [ ] No development-only absolute paths or private workspace references remain.

## 5. Security and community documents

Present and reviewed:

- [x] `SECURITY.md` — private disclosure process, supported versions, security model, limitations.
- [x] `CONTRIBUTING.md` — development setup, checks, test expectations, honesty requirements.
- [x] `CODE_OF_CONDUCT.md` — Contributor Covenant.
- [x] `.github/pull_request_template.md`
- [x] `.github/ISSUE_TEMPLATE/`
- [x] `LICENSE` — MIT.

After publication:

- [ ] Enable GitHub private vulnerability reporting.
- [ ] Add the repository URL to `SECURITY.md` and `README.md`.
- [ ] Add a security advisory link if the owner wants one.
- [ ] Confirm issue templates render correctly.
- [ ] Add branch protection and require the CI `Verify` job.

## 6. CI verification

The workflow is `.github/workflows/ci.yml`:

- Triggers on pushes to `main` and pull requests.
- Permissions: `contents: read`.
- Node matrix: 22 and 24.
- Steps: `npm ci`, high-severity audit, build, lint, format check, typecheck, Chromium install, tests,
  website build, and a single website artifact upload.
- No secrets are used.
- No `continue-on-error`.

Before announcing the release:

- [x] Push the initial commit and confirm the workflow starts.
- [x] Confirm both Node 22 and Node 24 jobs pass.
- [x] Confirm the website artifact uploads on one job only.
- [ ] Confirm a deliberately failing check fails the workflow (can be tested on a throwaway branch).
- [ ] Enable branch protection requiring the successful matrix.

CI has run successfully on the public repository. The final verified code/workflow run is
https://github.com/MHK-ctrl/launchproof/actions/runs/45131442874 (Node 22 and Node 24 both passed).
See [GITHUB_PUBLICATION_REPORT.md](GITHUB_PUBLICATION_REPORT.md) for the failure and remediation
history.

## 7. Release preparation

- [x] Confirm `package.json` and all workspace versions are `0.1.0`.
- [x] Confirm `CHANGELOG.md` has a `0.1.0` source-preview entry.
- [x] Confirm `V0.1.0_RELEASE_NOTES_DRAFT.md` is accurate and still in draft state.
- [ ] Suggested release title: **LaunchProof v0.1.0 — Source Preview**
- [ ] Suggested tag: `v0.1.0`
- [ ] Suggested release type: **pre-release** (source preview, not npm-published).
- [ ] Attach no binaries unless the owner decides to publish a GitHub-generated source archive.
- [ ] Do not publish to npm as part of the GitHub release.
- [ ] Do not claim a live website URL until deployment is verified.

## 8. Publication approval requirement

**No repository may be created, made public, or pushed without explicit owner approval.**

Approval A must specify:

- Exact repository owner/account.
- Repository name and visibility.
- Whether the repository starts private and is later made public.
- Confirmation that the reviewed source tree is the one to publish.

The approval request should disclose remaining risks:

- No external security audit.
- No real Supabase or large third-party application validation.
- DNS rebinding is not defended against.
- CI has not run on GitHub yet.
- No npm package will be published.
- No website deployment is included in GitHub publication.

## 9. Post-publication verification

- [ ] Repository renders README and license correctly.
- [ ] CI passes on the default branch.
- [ ] Security advisory channel is available.
- [ ] Issue and pull-request templates render.
- [ ] The clone URL works from a clean directory.
- [ ] A clean clone can run `npm ci`, `npm run build`, and `npm test`.
- [ ] The README clone URL and any repository links resolve.
- [ ] No secret scanning alert or accidental credential is present.
- [ ] A `v0.1.0` pre-release is created only after the above pass.

## 10. Explicitly out of scope

- Publishing to npm.
- Deploying the website.
- Purchasing a domain.
- Creating paid infrastructure.
- Making a previously private repository public without a separate approval.
- Rewriting existing history or deleting local artifacts.
