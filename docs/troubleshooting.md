# Troubleshooting

## `ConfigError: Invalid LaunchProof configuration`

The schema is strict. Check the field path in the message. Common causes: a bad severity value
(`urgent` instead of `high`), a URL without a scheme, a path that does not start with `/`, or an
unknown field. Run `launchproof config` after fixing it to inspect safe effective values.

## `Authorization refused`

Remote targets need both:

```json
{
  "authorization": {
    "authorized": true,
    "scope": ["staging.example.com"]
  }
}
```

and `scan.network: true`. Private IPs also need `allowPrivateNetwork: true`. Loopback is allowed by
default. `--authorized --scope host` on `scan` applies the same gate for one run.

Cloud metadata hostnames are always refused.

## Network checks silently missing

- `scan.network` defaults to `false`.
- No `app.url` or `api.baseUrl` means there is no target.
- The corresponding check appears as `skipped` with an explanation; it is not a pass.

## `NOT VERIFIED` browser checks

Playwright or Chromium is unavailable.

```bash
npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium
node packages/cli/bin/launchproof.mjs doctor
```

If Chromium exists but pages fail, check that the target is reachable from the same shell and that
the URL is authorized. Firewalls and self-signed TLS commonly cause failures; LaunchProof does not
disable TLS verification.

## Workflow selector not found

The page may render asynchronously, use a different accessible name, or be inside a frame. Selectors
are CSS by default. Prefer stable `data-testid` attributes. `expectText` searches within the body or a
provided selector; `expectVisible` waits for the element. Timeouts default to 20 seconds.

## Dependency audit says skipped or not verified

`npm audit` needs the registry and a lockfile. Network checks must be enabled. Offline environments
produce `skipped` or `not-verified`, not a pass. Run the audit manually in an environment with
registry access.

## API endpoint skipped

- Method is POST/PUT/PATCH/DELETE and unsafe methods are disabled.
- `identity` is configured but its environment variable is missing.
- OpenAPI path contains `{parameter}` and no concrete endpoint is configured.
- The endpoint is beyond `api.maxEndpoints`.

The check details list the reason.

## Authorization test inconclusive

The owner identity did not receive a 2xx response. Verify the identity fixture, cookie/header names,
base URL, and object ownership. The other identity is only probed after the owner succeeds.

## Empty or missing report

Reports are written under `.launchproof/` relative to the current working directory, unless
overridden. `report` defaults to `.launchproof/latest.json`. Check the command's stderr for a write
error. A running command with `--json` writes JSON to stdout, not a file, unless redirected.

## CLI exits 2 instead of 1

Exit code 2 means usage/config/authorization error, not a failed gate. Exit 1 means the scan ran and
the gate failed. Exit 3 is an unexpected tool error.

## Tests fail on a clean checkout

Build before testing:

```bash
npm run build
npm test
```

CLI tests execute the built `packages/cli/dist/index.js`. Browser tests need the optional Chromium
shell. On Linux CI, install browser dependencies with `--with-deps`.

## Port already in use

The demos default to 4173 and 4174. Set `PORT=0` for an ephemeral port, or choose another port and
update the demo config. Integration tests always use `PORT=0`.

## Reports include unexpected paths

Discovery counts file paths under the project root. Exclude generated or vendored directories with
`scan.exclude`. Never add personal or system directories to `scan.include`.
