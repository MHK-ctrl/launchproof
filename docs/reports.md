# Reports

Every scan produces one canonical report object and writes it to disk unless output is disabled by
the caller. Reports are local artifacts; nothing is uploaded.

## Artifacts

```text
.launchproof/
  <scan-id>/
    report.json
    report.html      (when HTML is included)
    report.sarif     (when SARIF is included)
  latest.json
  latest.html
  screenshots/       (optional browser captures)
```

The output directory comes from `report.outputDir` or `--output`. The scan-specific directory is
immutable evidence; `latest.*` is a convenience copy for tools and humans but is overwritten.

## JSON

`schemaVersion: 1` in `meta`. The object contains:

- `meta` — id, tool version, timestamps, duration, project name, target, mode, runtime
- `summary` — counts by status/severity, `failOn`, gate result and reasons
- `project` — discovery profile (or null if discovery was not selected)
- `checks` — every selected check, including `skipped`, `not-verified`, and `error`
- `findings` — flattened, sorted findings with evidence, locations, impact, remediation
- `limitations` — explicit unknowns for this run
- `configuration` — a safe summary with no credentials or headers

Treat JSON as the source of truth. HTML and SARIF are derived from it.

## Status and gate

```text
gate failed ⇔ any finding.severity >= summary.failOn
              OR any check.status === "error"
```

The gate result never implies coverage. Read `checks` and `limitations` before making a release
decision. Use `--fail-on critical` only if you knowingly accept high findings.

## HTML

The HTML report is a single file with inline CSS and a small filter/search script. It has no remote
fonts, scripts, or images, so it can be opened offline, attached to a ticket, or archived. It includes
the assessment scope and authorization statement, the project profile, configuration summary, checks
table, evidence, limitations, and print styles.

The scope section states the project, assessment date, tool version, mode, target, selected check
counts, and the authority under which a live target was tested. It states explicitly that the
document is not a penetration test or certification and that LaunchProof does not verify
authorization.

## PDF

```bash
launchproof report --format pdf --out report.pdf
```

PDF export renders the same HTML in headless Chromium through the optional Playwright dependency and
prints it to A4 with page numbers and a "not a penetration test" footer. There is intentionally no
second layout, so the PDF cannot disagree with the HTML or JSON it came from. If Playwright or
Chromium is missing, the command exits `2` with the install command; the HTML report is unaffected.

## SARIF

SARIF 2.1.0 is available for code scanning integrations. Results map severities to error/warning/note
levels, include logical URL locations for HTTP findings, and physical file/line locations for source
findings. Evidence labels and values are included as result properties, but raw response bodies and
secret values are never present.

## Redaction

- Credential-like values become `****REDACTED****` when a finding is created.
- Environment file contents are never read into findings.
- HTTP/API evidence excludes response bodies.
- Identity headers and cookies are never printed.
- Error strings pass through the shared redaction rules.
- AI remediation receives finding text only, never evidence values.

Redaction is defense in depth, not a guarantee that every arbitrary secret format is recognized.
Review a report before sharing it publicly, and rotate anything that appears exposed.

## Reproducing the sample

The committed sample is the output of scanning the bundled vulnerable demo:

```bash
npm run demo:vulnerable
cd examples/vulnerable-demo
LP_DEMO_OWNER_ID=1 LP_DEMO_OTHER_ID=2 \
  node ../../packages/cli/bin/launchproof.mjs test
```

The sample is intentionally failing and should not be presented as a benchmark of a real product.

## Sharing

Reports can include file paths, internal URLs, header names, framework versions, and route lists.
Share them with the same care as any security assessment. Do not publish a report from a production
system without review.
