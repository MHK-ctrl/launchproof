# API testing

LaunchProof tests configured API contracts and, optionally, OpenAPI-described paths. It does not
generate requests from an entire schema without bounds.

## Configure endpoints

```json
{
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
        "requiredJsonKeys": ["status"],
        "maxResponseMs": 500
      },
      {
        "name": "Current user",
        "path": "/api/me",
        "method": "GET",
        "identity": "owner",
        "expectStatus": 200,
        "expectJson": true,
        "requiresAuth": true
      }
    ]
  }
}
```

- `expectStatus` accepts a number or a list (e.g. `[200, 204]`).
- `expectJson` requires a valid JSON body; `requiredJsonKeys` checks top-level keys.
- `maxResponseMs` produces a low-severity latency finding.
- `identity` applies headers/cookies from `auth.identities` resolved through environment variables.
- `requiresAuth` sends a second anonymous request. A 200/2xx is a high-severity finding; 401/403 is
  expected. Redirects to a login page are not treated as proof of protection by this check.

GET, HEAD, and OPTIONS run by default. POST/PUT/PATCH/DELETE require
`api.allowUnsafeMethods: true`. If a non-read endpoint is configured without that opt-in, it is
skipped and the report says so.

## OpenAPI

```json
{ "api": { "openapi": "./openapi.yaml", "maxEndpoints": 40 } }
```

Local JSON/YAML files must be inside the project. Remote URLs must pass the authorization scope gate.
Operations become endpoints with expected 2xx status (from `responses`), JSON expectation, and auth
requirement when `security` is present. Templated paths (`/users/{id}`) are skipped because no
concrete values are configured; the report includes the skipped count.

## Identities

```json
{
  "auth": {
    "identities": {
      "owner": { "headersEnv": { "authorization": "LP_OWNER_AUTH" } },
      "other": { "headersEnv": { "cookie": "LP_OTHER_COOKIE" } }
    }
  }
}
```

Values are injected at request time and never printed. Missing environment variables cause the
endpoint/scenario to be skipped with details naming the missing variable—not the value.

## Evidence and redaction

API evidence includes status, final URL, duration, content type, and body byte count. Response bodies
are deliberately excluded to avoid copying tokens or personal data into reports. Error messages are
redacted with the shared text rules.

## What is not tested

- Schema validation beyond top-level keys
- Full OpenAPI request generation
- Mutating flows unless explicitly enabled
- Rate limiting, pagination, concurrency, or load behavior
- Business logic correctness
- Authenticated flows without configured identities

Treat API results as a contract smoke test, not a complete integration suite.
