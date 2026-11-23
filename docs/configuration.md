# Configuration

LaunchProof looks for `launchproof.config.json`, `.yaml`, or `.yml` in the current directory.
Unknown or invalid fields are rejected with a clear error. With no file, conservative defaults are
used.

Run `launchproof config` to print the safe effective configuration.

## Top-level sections

| Section              | Purpose                                          | Safe default                       |
| -------------------- | ------------------------------------------------ | ---------------------------------- |
| `project`            | Name and description                             | Detected name                      |
| `app`                | Application URL and health path                  | No URL                             |
| `authorization`      | Remote testing authorization and scope           | Off; loopback allowed              |
| `scan`               | File walk, fail threshold, network master switch | Network off, fail on high          |
| `http`               | Timeouts, request budget, rate, paths, headers   | 10s, 50 requests, 4 req/s          |
| `api`                | Base URL, OpenAPI, endpoints, unsafe methods     | No endpoints, unsafe off           |
| `auth`               | Named identities resolved from env               | Empty                              |
| `authorizationTests` | Cross-identity object scenarios                  | Empty, unsafe off                  |
| `browser`            | Playwright settings, workflows, mobile viewport  | Disabled                           |
| `accessibility`      | axe tags and sampled paths                       | Enabled when browser runs          |
| `performance`        | Budgets, paths, optional Lighthouse              | Enabled when browser runs          |
| `supabase`           | Migrations directory and optional live probe     | Static enabled, live absent        |
| `ai`                 | Consent-gated OpenAI-compatible remediation      | Disabled, no consent               |
| `report`             | Artifact directory and formats                   | `.launchproof`, terminal/json/html |

## Example

```json
{
  "version": 1,
  "project": { "name": "my-app" },
  "app": { "url": "http://localhost:3000", "healthPath": "/" },
  "authorization": {
    "authorized": false,
    "scope": [],
    "allowLocal": true,
    "allowPrivateNetwork": false
  },
  "scan": {
    "network": false,
    "failOn": "high",
    "gitHistory": false,
    "maxFiles": 8000
  },
  "api": {
    "baseUrl": "http://localhost:3000",
    "allowUnsafeMethods": false,
    "endpoints": [
      {
        "name": "Health",
        "path": "/api/health",
        "method": "GET",
        "expectStatus": 200,
        "expectJson": true,
        "requiredJsonKeys": ["status"]
      }
    ]
  },
  "auth": {
    "identities": {
      "owner": { "headersEnv": { "cookie": "LP_OWNER_COOKIE" } },
      "other": { "headersEnv": { "cookie": "LP_OTHER_COOKIE" } }
    }
  },
  "authorizationTests": {
    "resources": [
      {
        "name": "User 2 profile",
        "path": "/api/users/2",
        "ownerIdentity": "owner",
        "otherIdentity": "other",
        "expectStatusForOther": [401, 403, 404]
      }
    ]
  },
  "browser": {
    "enabled": true,
    "baseUrl": "http://localhost:3000",
    "workflows": []
  },
  "accessibility": { "enabled": true, "tags": ["wcag2a", "wcag2aa"], "paths": ["/"] },
  "performance": { "enabled": true, "paths": ["/"] },
  "report": {
    "outputDir": ".launchproof",
    "formats": ["terminal", "json", "html"],
    "includeEvidence": true
  }
}
```

## Environment variables

`.env` and `.env.local` are loaded without overriding already-set process variables. Values are
never printed. `.env` is not read for secret findings beyond path-level hygiene.

Identity headers reference environment variable names:

```json
{ "headersEnv": { "authorization": "LP_OWNER_BEARER" }, "cookieEnv": "LP_OWNER_COOKIE" }
```

Never commit actual identity values. Use CI secrets.

## Authorization fields

- `authorization.authorized: true` — you confirm permission to test remote targets.
- `authorization.scope` — exact hosts, optional ports, or `*.example.com` wildcards. `*` allows all
  authorized hosts (not recommended).
- `authorization.allowLocal` — loopback default behavior (default true).
- `authorization.allowPrivateNetwork` — required for RFC1918/private targets.
- Metadata endpoints are blocked regardless.

## Scan fields

- `scan.network` — master switch for npm audit, HTTP, API, authorization, and Supabase live checks.
- `scan.failOn` — `critical`, `high`, `medium`, `low`, or `info`.
- `scan.include` / `scan.exclude` — glob allow/deny lists. Defaults exclude dependencies, builds,
  lockfiles, source maps, and minified assets.
- `scan.maxFiles`, `scan.maxFileBytes` — bounded filesystem work.
- `scan.gitHistory` and `scan.gitHistoryMaxCommits` — filename-level sensitive history review.

## Browser workflow steps

`goto`, `click`, `fill`, `press`, `expectText`, `expectVisible`, `expectUrl`, `wait`, and
`screenshot`. `fill` supports `value`, `valueEnv`, and `secret: true` (the value is not written to
reports). Workflows can specify an `identity` whose headers are applied at the context level.

## Validation

Configuration is parsed with zod. Invalid severities, URLs, paths, unknown keys, or missing required
fields fail with exit code 2. LaunchProof fails closed rather than silently ignoring a malformed
security setting.
