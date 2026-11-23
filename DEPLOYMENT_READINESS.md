# Deployment Readiness — LaunchProof Website

**Status:** Prepared and locally validated. **Not deployed.**
**Recommended host:** Vercel (static export)
**Fallback host:** Netlify
**Approval required:** Yes — production deployment is gated on explicit owner approval.

> No production URL, custom domain, or deployment alias exists. Do not announce one until a deployment
> has actually completed and been verified. This document intentionally contains no invented hostname.

## 1. Recommendation

Deploy the static Next.js export to **Vercel** for v0.1.0.

Reasons:

- The repository already contains a reviewed `vercel.json` with an explicit install command, build
  command, output directory, and security headers.
- The site is fully static; Vercel needs no server runtime, database, or environment secrets.
- Vercel provides a generated `*.vercel.app` hostname without requiring a domain purchase.
- Netlify is a viable fallback and is configured, but maintaining two primary deployment paths adds
  unnecessary surface for a v0.1.0 launch.

No backend, database, analytics, or paid service should be added to host this website.

## 2. Configuration inspected

### `vercel.json`

- `framework: null` — prevents framework auto-detection from overriding the static export.
- `installCommand: "npm ci"` — reproducible install from the lockfile.
- `buildCommand: "npm run build:web"` — builds the web workspace.
- `outputDirectory: "apps/web/out"` — serves the static export.
- Security headers for all routes:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### `netlify.toml` (fallback)

- Build command: `npm run build:web`
- Publish directory: `apps/web/out`
- Node version: 22
- Matching baseline security headers

### `apps/web/next.config.ts`

- `output: "export"` — static HTML export, no Next.js server.
- `trailingSlash: true` — route directories resolve with trailing slashes.
- `images.unoptimized: true` — no image optimization server required.
- `poweredByHeader: false`.
- `reactStrictMode: true`.
- `outputFileTracingRoot` set to the monorepo root.

### Build output

`npm run build:web` produces `apps/web/out/` with:

- `/` landing page
- `/about/`
- `/demo/`
- `/docs/`
- `/get-started/`
- `/report/`
- `/security/`
- `404.html` and `_not-found/`
- `robots.txt`
- `sample-report.html` and `sample-report.json`
- static assets and Next.js chunks

No environment variables are required. The site has no server-side data, account system, analytics, or
API routes.

## 3. Requirements

### Runtime and build

- Node.js **22.12+** (CI covers Node 22 and 24).
- npm with the committed `package-lock.json`.
- No Docker, database, or browser is required for the website build.

### Account permissions

- A Vercel account or team with permission to create a project and deploy.
- Access to the GitHub repository is optional for CLI deployment; connecting the repository enables
  future automatic deployments but is not required for the first manual deploy.
- No payment method, custom domain, or paid add-on is required for a generated `*.vercel.app` URL.

### Authentication

The Vercel CLI was inspected and is currently **logged out**. Authenticate through the official
interactive flow:

```bash
vercel login
```

This opens the official Vercel authentication screen. Do not paste passwords, API tokens, or account
secrets into chat. After authentication, stop and wait for explicit deployment approval.

## 4. Local preview

Build from a clean dependency state:

```bash
cd LaunchProof
npm ci
npm run build:web
```

Serve the static output without adding a dependency:

```bash
python3 -m http.server 3100 --directory apps/web/out
```

Then open `http://127.0.0.1:3100/`.

Local checks performed during this audit:

- Build completed with the static export.
- All tested routes returned HTTP 200.
- The report viewer loaded `sample-report.json` and rendered gate, tabs, and search.
- Internal links tested clean.
- axe found 0 violations on 7 audited routes.
- Mobile navigation worked at the tested viewport.
- No console errors were observed.

## 5. Deployment steps (after approval)

1. Confirm the final source tree is frozen and final checks pass.
2. Authenticate with `vercel login` using the official browser flow.
3. From the repository root, confirm the project link or create it when prompted:
   ```bash
   vercel link
   ```
4. Deploy a preview first:
   ```bash
   vercel deploy
   ```
5. Verify the preview URL with the checklist in section 7.
6. Only after the preview passes and the owner explicitly approves production:
   ```bash
   vercel deploy --prod
   ```
7. Record the resulting hostname in `PROJECT_EXECUTION_STATUS.md` and update canonical/Open Graph
   metadata in a follow-up change.

Do not publish a production alias, connect a custom domain, or enable paid services without a separate
approval.

## 6. Domain configuration

- No domain has been purchased or registered.
- Use the generated `*.vercel.app` hostname for the initial launch.
- Do not invent a canonical domain. Once a real hostname exists, add:
  - `metadataBase` in `apps/web/app/layout.tsx`
  - canonical alternates
  - absolute Open Graph URLs
  - a `sitemap.ts`
  - the real repository URL in package metadata and documentation
- A custom domain is a separate decision requiring registration or DNS control and owner approval.

## 7. Post-deployment verification checklist

- [ ] Production deploy completed and the exact hostname recorded.
- [ ] `/` returns 200 and renders without console errors.
- [ ] `/about/`, `/demo/`, `/docs/`, `/get-started/`, `/report/`, `/security/` return 200.
- [ ] `404.html` is served for unknown paths.
- [ ] `robots.txt` is reachable and does not advertise a nonexistent sitemap.
- [ ] `sample-report.json` loads from the same origin.
- [ ] The report viewer renders gate, tabs, search, and findings.
- [ ] `sample-report.html` opens offline with no remote requests.
- [ ] Security headers are present (`nosniff`, frame denial, referrer policy, permissions policy).
- [ ] Mobile navigation opens, closes, and is keyboard-operable.
- [ ] No horizontal overflow at 390 px.
- [ ] axe scan reports zero violations on the same routes tested locally.
- [ ] No fake metrics, testimonials, certifications, or claims of a live scan.
- [ ] No analytics or third-party requests were introduced.
- [ ] The deployment URL is added to the execution log only after verification.

## 8. Rollback

- Vercel retains previous deployments; promote a known-good deployment if a regression is found.
- The site is static, so rollback does not involve database migrations or state.
- If a security header regression is found, revert `vercel.json`, redeploy, and re-run the header
  checks.

## 9. Risks and limitations

- Deployment has not been performed; hosting behavior is inferred from configuration and local static
  serving.
- Vercel's header application and trailing-slash behavior must be verified on the real deployment.
- No canonical URL or sitemap exists until the hostname is known.
- GitHub-connected automatic deployments are not configured; the first deploy is manual.
- The site has no uptime monitoring, analytics, or error tracking by design. Add only if the owner
  explicitly chooses to.
- A generated `*.vercel.app` URL is suitable for launch but is not a brand domain.

## 10. Approval boundary

This document prepares deployment; it does not authorize it. Production deployment requires
**Approval B** from the owner, after `vercel login` has been completed through the official flow. No
credentials should be pasted into chat.
