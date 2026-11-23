# Live Deployment Report

**Date:** 2026-11-23
**Status:** **NOT DEPLOYED — BLOCKED ON OWNER-PROVIDED ACCOUNTS AND CREDENTIALS**
**Production URL:** none. No hostname, alias, or custom domain has been created or claimed.

This report separates what was verified locally from what could not be verified without a real
Supabase project, GitHub OAuth consent, and Vercel deployment. Nothing below is a substitute for a
live test.

## 1. Current environment

- macOS on Apple Silicon.
- Node.js `26.0.0`, npm `11.12.1`.
- Repository branch: `feat/cloud-dashboard` (uncommitted work at the time of this report).
- GitHub CLI authenticated as `MHK-ctrl`; the public source repository exists at
  `https://github.com/MHK-ctrl/launchproof`.
- Vercel CLI is installed but **logged out**. No Vercel project is linked.
- Supabase CLI is **not installed**. No Supabase project, project ref, database URL, anon key, or
  service-role key exists in this workspace.
- No GitHub OAuth App client ID or secret exists in this workspace.
- No `.env` file exists. Only `.env.example` with empty values is committed.
- No production or preview URL exists.

## 2. What was implemented

- Next.js server output (static export removed) with Supabase Auth and SSR cookie handling.
- GitHub sign-in through Supabase, a separate repository consent flow, and encrypted short-lived
  provider-token cookie.
- PostgreSQL migration with profiles, repositories, scans, findings, CLI auth requests/tokens,
  composite tenant foreign keys, RLS policies, grants, and an aggregate view.
- Private dashboard: overview, repositories, scans, scan detail, settings, account.
- APIs for account, repositories, scans, findings, downloads, health, and CLI auth/upload.
- CLI `login`, `logout`, `status`, `repositories`, `upload`, plus explicit `--upload` with a
  sanitized preview and `--yes` support on local scan commands.
- CLI token hashing, seven-day expiry, revocation, atomic one-time claim, PKCE, and loopback callback.
- Dashboard account deletion with cascade and connect-cookie clearing.
- Sanitization of upload text, finding paths, references, and server-side gate recomputation.
- PGlite tenant-isolation tests and CLI/server sanitization tests.

## 3. Local verification actually run

| Check                                                                 | Result                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run build`                                                       | **Passed** — core, browser, and CLI bundles built with declarations |
| `npm run typecheck -w @launchproof/web`                               | **Passed**                                                          |
| `npm run build:web`                                                   | **Passed** — Next.js production build; public pages prerendered     |
| `npm test`                                                            | **Passed — 15 files, 68 tests**                                     |
| `npx vitest run packages/core/test/cloud-dashboard-rls.test.ts`       | **Passed — 9 tests**                                                |
| `npx vitest run packages/core/test/cloud-upload-sanitization.test.ts` | **Passed — 6 tests**                                                |
| Keychain stdin self-test (`security`, temp item)                      | **Passed** — value written/read, temporary item deleted             |

The build output labels `/dashboard/*`, `/login`, `/cli/*`, `/auth/*`, and `/api/*` as dynamic and the
public marketing pages as static. This confirms that the static-export configuration is gone.

## 4. What has not been tested

These are blockers, not completed work:

1. **No live Supabase project.** The migration has only been executed under PGlite. Hosted
   PostgREST behavior, JWT claims, grants, RLS enforcement, connection pooling, and Supabase Auth
   provider configuration are unverified.
2. **No GitHub OAuth App.** The real GitHub consent screen, Supabase callback URL, provider token
   delivery, `repo` scope behavior, and repository metadata fetch have not been exercised.
3. **No Vercel deployment.** `vercel.json`, environment injection, runtime cookies, middleware/proxy,
   and real HTTP headers have not been tested on the host.
4. **No production URL.** `APP_BASE_URL`, Supabase Site URL, Supabase redirect allowlist, and GitHub
   OAuth callback have not been configured for a real origin.
5. **No end-to-end two-account test** against a deployed instance. The PGlite suite cannot simulate
   two real Supabase sessions, browser cookies, or serverless behavior.
6. **No real CLI login/upload test.** The browser/device flow and upload were tested only at the unit
   and build level; no live API accepted a token or scan.
7. **No deployment approval.** Production deployment remains gated on explicit owner approval.
8. **No GitHub Actions/OIDC upload.** This is intentionally not implemented, not merely untested.
   Workflows cannot authenticate to the cloud API automatically.

## 5. Exact blockers

### Blocker A — Supabase project and credentials

Needed:

- project URL;
- anon/public key;
- service-role key;
- confirmation that the migration applied cleanly;
- Supabase Auth GitHub provider configured;
- allowed redirect URLs for the chosen origin.

The owner must create the project and enter the credentials through the official dashboard or CLI.
Do not paste secrets into chat. Set them locally in `.env` and in the host's environment settings.

### Blocker B — GitHub OAuth App

Needed:

- an OAuth App under the owner's GitHub account or organization;
- client ID and client secret entered into Supabase;
- authorization callback URL set to the Supabase callback
  `https://<project-ref>.supabase.co/auth/v1/callback`;
- consent to the `repo` scope if private repositories are to be connected.

LaunchProof never asks for a GitHub password or personal access token. The owner authenticates
through GitHub and Supabase directly.

### Blocker C — Host and production approval

Needed:

- `vercel login` through the official browser flow, or an equivalent Next.js host;
- a linked project using the repository root;
- the five server environment variables;
- explicit approval to deploy;
- a generated hostname, recorded only after deployment succeeds.

No paid plan, custom domain, or purchase is required for a generated hostname. None has been
authorized or created.

### Blocker D — Real deployment verification

After A–C, the checklist in [CLOUD_DASHBOARD_SETUP.md](CLOUD_DASHBOARD_SETUP.md) must be run against
the deployed instance. In particular, two real accounts must be used to confirm that the second
account cannot list, fetch, download, mutate, or delete the first account's data.

## 6. Deployment sequence after credentials are supplied

1. Apply the migration to a fresh Supabase project.
2. Configure GitHub OAuth and the Supabase redirect allowlist.
3. Set local environment variables and run the app.
4. Complete a local two-account isolation check.
5. Run `npm run build`, web typecheck, `npm run build:web`, and `npm test`.
6. Deploy a **preview** only after the checks pass.
7. Set `APP_BASE_URL` to the preview origin, add the preview `/auth/callback` to Supabase, redeploy.
8. Verify the full checklist, including CLI login/upload/logout and cross-account denial.
9. Obtain explicit production approval.
10. Promote to production, verify again, and record the exact hostname in this report and
    `PROJECT_EXECUTION_STATUS.md`.

Do not skip the preview or the two-account check. A successful build is not evidence that tenant
isolation works in the hosted environment.

## 7. Rollback

- Vercel retains prior deployments; promote a known-good deployment if the preview regresses.
- The first deployment has no production data. If the schema is wrong, fix the migration on a fresh
  project rather than mutating a production database in place.
- Rotating `LAUNCHPROOF_ENCRYPTION_KEY` invalidates connect cookies only; users reconnect.
- Revoking CLI tokens from settings or `launchproof logout` does not delete local reports.
- Deleting a Supabase project removes all dashboard data and cannot be undone; export anything needed
  first.

## 8. Honest conclusion

The cloud dashboard is **implemented and locally verified**, but the mission's deployment and live
isolation requirements are **not complete**. There is no live URL, no real Supabase RLS run, no real
GitHub consent run, and no deployed CLI upload. Those remain blocked on owner credentials and
approval, as described above.
