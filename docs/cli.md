# CLI reference

The binary is `launchproof`. In this source preview, invoke it directly:

```bash
node packages/cli/bin/launchproof.mjs --help
```

## Global options

| Option                 | Meaning                                                |
| ---------------------- | ------------------------------------------------------ |
| `-c, --config <path>`  | Explicit JSON or YAML config file                      |
| `--json`               | Print the report JSON to stdout; suppress human output |
| `--quiet`              | Print only a one-line gate summary                     |
| `--verbose`            | More finding text, remediation, and config             |
| `--ci`                 | No color, no progress lines                            |
| `--no-color`           | Disable ANSI colors                                    |
| `-o, --output <dir>`   | Override the report output directory                   |
| `--fail-on <severity>` | Override the gate threshold                            |

## Commands

### `init`

Writes `launchproof.config.json` with conservative defaults. `--force` replaces an existing config.
`--url` sets `app.url` and enables browser checks.

### `analyze`

Runs discovery only and writes a report. No network requests. Use it to confirm detected frameworks,
languages, package manager, API routes, test tools, deployment targets, and file counts.

### `test`

Runs all configured components:

- filesystem checks always
- dependency audit only when `scan.network: true`
- HTTP/API/authorization only when `scan.network: true` and a target exists
- browser workflows/accessibility/performance when `browser.enabled` and a URL exists

Browser checks require the optional Playwright and axe-core dependencies.

### `security`

Runs discovery, secrets, repository, static rules, dependencies (if network enabled), Supabase,
and authorized HTTP/API/authorization checks. `--url` overrides `app.url`.

### `scan <url>`

Forces network checks on (in-memory only), applies authorization flags, and runs HTTP, API, and
authorization checks against the target.

```bash
node packages/cli/bin/launchproof.mjs scan https://staging.example.com \
  --authorized --scope staging.example.com
```

`--authorized` is your explicit confirmation. `--scope` accepts one or more host patterns. The
config file can provide the same values, plus private-network permission. Local loopback is allowed
without these flags.

### `browser [url]`

Runs page load, configured workflows, internal links, mobile overflow, axe-core, and performance.
Use `--no-workflows`, `--no-links`, `--no-mobile`, `--no-accessibility`, or `--no-performance` to
narrow the run. A URL argument or `app.url`/`browser.baseUrl` is required.

### `accessibility [url]` / `performance [url]`

Focused variants that run only the relevant browser checks (plus page load).

### `report [file]`

Reads a saved JSON report (default `.launchproof/latest.json`).

```bash
node packages/cli/bin/launchproof.mjs report --format html --out report.html
node packages/cli/bin/launchproof.mjs report --format sarif
node packages/cli/bin/launchproof.mjs report --open
```

Formats: `terminal`, `json`, `html`, `sarif`.

### `config`

Prints a safe summary: target, mode, fail-on, network state, endpoint counts, identity names, browser
settings, and Supabase flags. It never prints header values, cookies, tokens, or env contents.

### `doctor`

Checks Node version, config discovery, Playwright/Chromium, axe-core, and git. Optional browser
tooling missing is reported as a warning, not a failure.

## Exit codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | Gate passed and the command completed                        |
| `1`  | Gate failed (findings at/above threshold or a check errored) |
| `2`  | Usage, config, or authorization error                        |
| `3`  | Unexpected internal error                                    |

`report` and `config` return `0` on success because they do not evaluate a gate.

## JSON mode

`--json` writes one JSON report object to stdout. Progress and non-fatal notices go to stderr. This
is suitable for CI artifacts:

```bash
node packages/cli/bin/launchproof.mjs security --json > security-report.json
```

The exit code still reflects the gate. Do not treat a written JSON file as a pass.

## Troubleshooting

See [troubleshooting.md](troubleshooting.md).
