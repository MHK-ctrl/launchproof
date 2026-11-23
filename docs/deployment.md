# Website deployment

The public website is a static Next.js export. It does not run scans and has no server-side data.

## Build locally

```bash
npm ci
npm run build:web
# output: apps/web/out
```

Serve the `out/` directory with any static file server to verify it. The site includes trailing
slashes and unoptimized images, so no Next.js server is required.

## Vercel

`vercel.json` at the repository root configures:

- install: `npm ci`
- build: `npm run build:web`
- output: `apps/web/out`
- framework: none

Deployment requires authentication and the owner's approval. This repository does not deploy
automatically and no live URL is claimed for this source preview.

## Netlify

`netlify.toml` configures the same build and publish directory, Node 22, and baseline security
headers.

## Verification after deployment

A deployment is not considered verified until:

1. The build succeeds from a clean checkout.
2. The home page, demo, report viewer, docs, get-started, about, and security pages respond.
3. `/sample-report.json` loads and renders in the report viewer.
4. The offline sample HTML opens without network access.
5. Links and accessibility are checked.
6. No analytics, fake metrics, or unverified claims were introduced.

Record the URL and checks in the project execution status; do not claim a deployment that was not
performed.
