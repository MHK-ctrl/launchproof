# Framework discovery

LaunchProof profiles a project statically. It does not execute application code during discovery.

## Detected

- Node frameworks and libraries from `package.json`: Next.js, React, Vue, Nuxt, Svelte, SvelteKit,
  Astro, Remix, Angular, Solid, Express, Fastify, Hono, Koa, NestJS, Elysia.
- Python signals from `requirements*.txt`, `pyproject.toml`, `Pipfile`, and `manage.py`: Django,
  FastAPI, Flask.
- Integrations such as Supabase, Stripe, Clerk, NextAuth/Auth.js, Auth0, Prisma, Drizzle, MongoDB,
  OpenAI, Anthropic, Resend, SendGrid, Sentry, PostHog, Upstash, Cloudinary, and Vercel Blob.
- Test frameworks: Vitest, Jest, Playwright, Cypress, Mocha, Testing Library, pytest, Supertest.
- Package manager from `packageManager` or the lockfile.
- Monorepo indicators: workspaces, pnpm workspace, Lerna, Turborepo.
- Deployment indicators: vercel.json/Next.js, netlify.toml, Dockerfile, render.yaml, fly.toml,
  railway.json, Procfile, GitHub Actions.

## API route discovery

- **Next.js App Router**: `app/**/route.ts` and `src/app/**/route.ts`, with route groups removed and
  dynamic segments converted to `:param`.
- **Next.js Pages Router**: `pages/api/**` and `src/pages/api/**`.
- **Express-like**: `app|router|server.(get|post|put|patch|delete)` string paths in route/server files.
- **FastAPI**: `@app|router.(get|post|...)` decorators.
- **OpenAPI**: configured separately under `api.openapi`; templated paths are reported as skipped
  unless concrete endpoints are configured.

Discovery caps routes at 100 and reads at most a few hundred small files. It is intentionally
conservative: missing a dynamic or generated route is possible, and the report includes only what
was discovered. Configure `api.endpoints` for critical routes rather than relying on discovery.

## Language profile

Counts come from file extensions across the bounded walk. Generated, dependency, build, minified,
source-map, and lockfile paths are excluded by default.

## What discovery does not do

- It does not install dependencies or run builds.
- It does not execute application code.
- It does not resolve framework configuration to runtime routes.
- It does not guarantee complete route coverage.
- It does not infer authorization requirements from code.

Use the profile as orientation, then configure API and authorization scenarios explicitly for the
parts that matter before launch.
