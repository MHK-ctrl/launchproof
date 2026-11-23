# Authorization testing

Broken object-level authorization (BOLA/IDOR) is one of the most common and damaging API flaws:
changing an identifier lets one user access another user's data. LaunchProof tests a narrow,
read-only version of this scenario with two configured identities.

## Configure

```json
{
  "auth": {
    "identities": {
      "owner": { "headersEnv": { "authorization": "LP_OWNER_AUTH" } },
      "other": { "headersEnv": { "authorization": "LP_OTHER_AUTH" } }
    }
  },
  "authorizationTests": {
    "allowUnsafeMethods": false,
    "resources": [
      {
        "name": "User 2 profile",
        "path": "/api/users/2",
        "method": "GET",
        "ownerIdentity": "owner",
        "otherIdentity": "other",
        "expectStatusForOther": [401, 403, 404]
      }
    ]
  }
}
```

The owner identity requests first. If the owner does not receive a 2xx response, the scenario is
inconclusive and skipped with an explanation. If the other identity receives a status outside the
expected list, a finding is created—critical for a 2xx response, high otherwise.

## Interpretation

- `owner 200`, `other 403` → pass.
- `owner 200`, `other 200` → critical BOLA finding.
- `owner 401` → scenario skipped; verify the identity fixture.
- Missing env var → skipped with the variable name.
- Unsafe method → skipped unless both the resource and global setting allow it.

The check does not prove the absence of authorization bugs. It covers one object per configured
resource and only the request method you specify.

## Safety

- Default methods are read-only.
- Mutations require `authorizationTests.allowUnsafeMethods` and a resource-level
  `allowUnsafeMethod: true`.
- No IDs are enumerated or brute-forced.
- No payloads are fuzzed.
- Requests go through the shared client with budget, rate limit, timeouts, and scope checks.

Use dedicated test accounts on staging. Never point destructive scenarios at production.

## False positives and negatives

- Endpoints that return 404 for both users may pass while hiding a different bug; inspect the
  response semantics.
- Endpoints that return 200 with an empty object for unauthorized users will be flagged; that is
  intentional because the status contract is indistinguishable from success.
- Server-side authorization may be enforced at the gateway; the test still verifies the observable
  result.
- Resources using opaque tokens are not enumerated; add explicit scenarios for the important ones.

Report findings are evidence of behavior, not proof of exploitability. Reproduce with real accounts
and review server code.
