# Demo script (60–90 seconds)

Record at 1440×900 on macOS. Use the repository checkout and a disposable project if you do not
want to scan the LaunchProof repository itself. Do not show `.env` contents, tokens, or account email.

## 0:00 — Intro (10 s)

Screen: https://launchproof-rose.vercel.app

> "LaunchProof is a local-first verification tool for AI-built applications. It checks the parts
> that usually ship untested — secrets, headers, API contracts, object authorization, browser flows,
> accessibility, and performance — and writes evidence you can inspect."

## 0:10 — Install (15 s)

Terminal:

```bash
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs --version
```

> "The CLI runs from the repository because the public npm name belongs to another project. No
> account or Docker is needed for local scans."

## 0:25 — Local scan (20 s)

```bash
cd examples/vulnerable-demo
node ../../packages/cli/bin/launchproof.mjs init
node ../../packages/cli/bin/launchproof.mjs test
```

> "It discovered the stack, masked secret-like values, and failed the gate on real findings. A
> skipped or unreachable check is reported as skipped or not verified — never as a pass."

## 0:45 — Report (10 s)

Open `.launchproof/latest.html`.

> "The standalone HTML report works offline and lists findings, severity, confidence, evidence, and
> limitations. JSON and SARIF are available for CI."

## 0:55 — Explicit cloud upload (20 s)

```bash
node ../../packages/cli/bin/launchproof.mjs login
node ../../packages/cli/bin/launchproof.mjs status
node ../../packages/cli/bin/launchproof.mjs scan . --upload --yes
```

> "Upload is explicit and sanitized: counts, findings, commit/branch, and repository metadata. Source
> code, environment values, and local paths never leave the machine."

## 1:15 — Dashboard (10 s)

Screen: dashboard → Scans → open the scan → Download.

> "The dashboard is scoped to the signed-in account. Another account gets a 404 for this scan, and
> downloads are authorized on every request."

## 1:25 — Close (5 s)

> "MIT licensed. Local by default, honest about coverage. Link in the description."

## Recording notes

- If GitHub repository connection requires 2FA, do not fake it; skip the upload segment or show the
  CLI's correct refusal ("No active repositories are connected") and say the connection step needs a
  repository first.
- Blur account email and any real repository names other than `MHK-ctrl/launchproof`.
- Do not claim certification, an external audit, or guaranteed security.
