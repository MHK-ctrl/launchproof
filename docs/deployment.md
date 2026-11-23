# Deployment

The website is no longer a static Next.js export. Public pages are prerendered, but the private
dashboard, auth callbacks, and APIs require a Node.js server runtime and Supabase.

The complete setup is in [CLOUD_DASHBOARD_SETUP.md](../CLOUD_DASHBOARD_SETUP.md). Deployment
readiness, blockers, and the approval boundary are in
[DEPLOYMENT_READINESS.md](../DEPLOYMENT_READINESS.md).

## Local build

```bash
npm ci
npm run build
npm run build:web
```

The web build uses the normal Next.js server output in `apps/web/.next`. A static file server cannot
serve the dashboard or API routes.

## Vercel

`vercel.json` configures:

- framework: Next.js;
- install: `npm ci`;
- build: `npm run build:web`;
- security headers and private/no-store headers for dashboard and API paths.

The repository root is the project root because this is an npm workspace. Configure the environment
variables from `.env.example`, including `APP_BASE_URL`, before deploying. No deployment has been
performed and no live URL is claimed.

## Netlify

`netlify.toml` is retained as an **unverified** fallback for the Next.js runtime, not as a static
export. It points at `apps/web/.next` and requires Netlify's Next.js runtime plus the same Supabase
environment. Vercel is the recommended and documented target.

## Verification after deployment

Follow the checklist in `CLOUD_DASHBOARD_SETUP.md`, including two-account isolation, CLI
login/upload/logout, account deletion, and header checks. Record the exact hostname and results in
`PROJECT_EXECUTION_STATUS.md` and `LIVE_DEPLOYMENT_REPORT.md` only after the deployment exists.

Do not claim a deployment, RLS result, OAuth flow, or CLI upload that was not actually run.
