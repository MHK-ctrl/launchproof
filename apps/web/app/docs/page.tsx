import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Installation, commands, configuration, authorization, reporting, CI, and limitations for LaunchProof.',
};

const SECTIONS = [
  ['overview', 'Overview'],
  ['install', 'Install'],
  ['quick-start', 'Quick start'],
  ['commands', 'Commands'],
  ['configuration', 'Configuration'],
  ['authorization', 'Authorization'],
  ['reports', 'Reports'],
  ['cloud', 'Cloud dashboard'],
  ['ci', 'CI usage'],
  ['limitations', 'Limitations'],
] as const;

export default function DocsPage() {
  return (
    <div className="container py-14">
      <div className="grid gap-10 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8499b0]">
              Documentation
            </p>
            <nav className="mt-3 space-y-1" aria-label="Docs sections">
              {SECTIONS.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-md px-2 py-1.5 text-[12.5px] text-[#8fa3ba] hover:bg-[#0d141e] hover:text-[#e8eff9]"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-6 rounded-lg border border-[#1c2938] p-3 text-[11px] leading-relaxed text-[#6e8199]">
              Free CLI: <code className="font-mono">@hamzakhan2006/launchproof</code> on npm
              (the unscoped name <code className="font-mono">launchproof</code> belongs to an
              unrelated project). MIT licensed. Not a penetration test.
            </div>
          </div>
        </aside>

        <article className="prose-docs min-w-0">
          <p className="eyebrow">Docs</p>
          <h1 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.03em] text-[#f0f6ff]">
            LaunchProof documentation
          </h1>
          <p className="mt-3 max-w-2xl">
            LaunchProof is a free, local-first CLI that verifies AI-built applications and publishes
            evidence. It is MIT licensed and published on npm as <code className="font-mono">@hamzakhan2006/launchproof</code>
            (the unscoped npm name <code className="font-mono">launchproof</code> belongs to an
            unrelated project). A separate founder-operated paid assessment service may be offered
            through the website; do not assume it has an active checkout or is currently accepting
            customers unless that is independently verified on the site. This page does not promise
            capabilities that are not implemented.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            One scan can combine static security and secret checks, repository hygiene, live HTTP
            posture, API contract assertions, cross-identity authorization probes, browser
            workflows, axe-core accessibility, and navigation performance. Every check has a status;
            every finding has severity, confidence, verification method, impact, and remediation.
          </p>
          <div className="code-block my-4">
            {`launchproof analyze      # discovery only, no network
launchproof security     # static + live checks when authorized
launchproof test         # full configured scan, including browser checks
launchproof scan <url>   # live HTTP/API/authorization checks
launchproof report       # render or convert an existing report`}
          </div>

          <h2 id="install">Install from source</h2>
          <p>
            Node.js 22.12 or newer is required. Docker is not used. Install the CLI from npm as the
            scoped package <code>@hamzakhan2006/launchproof</code>, or run it from a checkout of the
            repository. The unscoped npm name <code>launchproof</code> is owned by an unrelated
            project, so do not install <code>launchproof</code> expecting this project.
          </p>
          <div className="code-block my-4">
            {`git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs --help`}
          </div>
          <p>
            Browser checks additionally need optional peer dependencies and the Chromium headless
            shell:
          </p>
          <div className="code-block my-4">
            {`npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium`}
          </div>
          <p>
            The public CLI treats both as optional. If they are missing, browser checks are marked
            <code>NOT VERIFIED</code>, never passed.
          </p>

          <h2 id="quick-start">Quick start</h2>
          <ol>
            <li>
              Create a config in the project root: <code>launchproof init</code>.
            </li>
            <li>
              Run <code>launchproof analyze</code> to confirm the detected stack.
            </li>
            <li>
              Review the generated <code>launchproof.config.json</code> and set <code>app.url</code>{' '}
              if needed.
            </li>
            <li>
              Run <code>launchproof test</code>. Network checks stay off unless{' '}
              <code>scan.network</code> is true.
            </li>
            <li>
              Open <code>.launchproof/latest.html</code> and read the limitations before acting.
            </li>
          </ol>
          <p>
            For a remote deployment, you must set <code>authorization.authorized</code> to true and
            add the exact host (or wildcard) to <code>authorization.scope</code>. Loopback targets
            are allowed by default.
          </p>

          <h2 id="commands">Commands</h2>
          <div className="table-shell my-4">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['init', 'Write a conservative launchproof.config.json.'],
                  ['analyze', 'Profile the project without network access.'],
                  ['test', 'Run all configured checks, including browser when enabled.'],
                  ['security', 'Static security/hygiene and, if enabled, HTTP/API/auth checks.'],
                  ['scan <url>', 'Live checks against an explicitly authorized target.'],
                  ['browser [url]', 'Workflows, links, mobile layout, axe, and performance.'],
                  ['accessibility [url]', 'axe-core against configured pages.'],
                  ['performance [url]', 'Navigation metrics and budgets.'],
                  ['report [file]', 'Render terminal, HTML, JSON, or SARIF from a saved report.'],
                  ['config', 'Print the effective configuration without secret values.'],
                  ['doctor', 'Check Node, config, Playwright, Chromium, axe-core, and git.'],
                ].map(([command, purpose]) => (
                  <tr key={command}>
                    <td className="whitespace-nowrap font-mono text-[11px] text-[#6ef0b6]">
                      {command}
                    </td>
                    <td>{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Global flags: <code>--config</code>, <code>--json</code>, <code>--quiet</code>,{' '}
            <code>--verbose</code>, <code>--ci</code>, <code>--no-color</code>,{' '}
            <code>--output</code>, and <code>--fail-on</code>.
          </p>
          <p>
            Exit codes: <code>0</code> gate passed, <code>1</code> gate failed, <code>2</code>{' '}
            usage/config/authorization error, <code>3</code> unexpected error.
          </p>

          <h2 id="configuration">Configuration</h2>
          <p>
            JSON and YAML are supported. Unknown or invalid fields are rejected. Defaults are
            conservative: network checks off, authorization off, unsafe API methods off, AI off.
          </p>
          <div className="code-block my-4">
            {`{
  "version": 1,
  "project": { "name": "my-app" },
  "app": { "url": "http://localhost:3000" },
  "authorization": {
    "authorized": false,
    "scope": [],
    "allowLocal": true,
    "allowPrivateNetwork": false
  },
  "scan": { "network": false, "failOn": "high", "gitHistory": false },
  "api": {
    "baseUrl": "http://localhost:3000",
    "allowUnsafeMethods": false,
    "endpoints": [
      { "path": "/api/health", "expectStatus": 200, "expectJson": true }
    ]
  },
  "auth": {
    "identities": {
      "owner": { "headersEnv": { "cookie": "LP_OWNER_COOKIE" } },
      "other": { "headersEnv": { "cookie": "LP_OTHER_COOKIE" } }
    }
  },
  "browser": { "enabled": true, "workflows": [] },
  "accessibility": { "enabled": true, "tags": ["wcag2a", "wcag2aa"] },
  "performance": { "enabled": true },
  "report": { "outputDir": ".launchproof", "formats": ["terminal", "json", "html"] }
}`}
          </div>
          <p>
            Identity values are read from environment variables (or a local <code>.env</code>),
            never embedded in reports. Use CI secrets for staging credentials.
          </p>

          <h2 id="authorization">Authorization and safety</h2>
          <ul>
            <li>Loopback targets are allowed by default for local development.</li>
            <li>
              Non-loopback targets require <code>authorization.authorized: true</code> and a
              matching scope entry.
            </li>
            <li>
              Private-network targets additionally require <code>allowPrivateNetwork: true</code>.
            </li>
            <li>Cloud metadata endpoints are always blocked.</li>
            <li>Redirects are checked hop by hop and refused if they leave scope.</li>
            <li>
              API mutations are disabled unless <code>api.allowUnsafeMethods</code> is explicitly
              enabled.
            </li>
            <li>No exploitation, fuzzing, or destructive payloads are performed.</li>
          </ul>

          <h2 id="reports">Reports</h2>
          <p>
            Each scan writes a scan-specific directory under <code>.launchproof/</code> plus{' '}
            <code>latest.json</code> and <code>latest.html</code>. JSON is the canonical artifact;
            HTML is self-contained and offline; SARIF 2.1.0 is generated for code scanning
            integrations. Credential-like values are redacted before entering any artifact, and HTTP
            response bodies are not copied into evidence.
          </p>

          <h2 id="ci">CI usage</h2>
          <div className="code-block my-4">
            {`# .github/workflows/verify.yml (excerpt)
- uses: actions/setup-node@v4
  with: { node-version: 22, cache: npm }
- run: npm ci
- run: npm run build
- run: npm run lint
- run: npm run typecheck
- run: npm test
- run: node packages/cli/bin/launchproof.mjs test --ci --fail-on high`}
          </div>
          <p>
            The last command requires a <code>launchproof.config.json</code> in the repository. Keep
            network checks off or point them at a staging system covered by your authorization and
            repository secrets. A failed gate returns exit code <code>1</code>.
          </p>

          <h2 id="cloud">Cloud dashboard (optional)</h2>
          <p>
            The dashboard at <code>https://launchproof-rose.vercel.app</code> is optional. It uses
            GitHub sign-in through Supabase. Signing in creates a profile; nothing from a local scan
            is uploaded unless you pass <code>--upload</code> (or call the API explicitly).
          </p>
          <div className="code-block my-4">
            {`launchproof login                 # browser + loopback PKCE approval
launchproof status                # account and token expiry
launchproof scan . --upload --yes # explicit sanitized upload
launchproof logout                # revoke the token and delete local credentials`}
          </div>
          <ul>
            <li>
              Connect a repository from the dashboard to associate uploads. GitHub has no read-only
              private-repository scope, so this asks for <code>repo</code>; the provider token is
              encrypted into a 15-minute cookie and never stored in the database.
            </li>
            <li>
              Uploads contain check summaries, counts, findings, commit/branch, and repository
              metadata. Source code, environment values, and local paths are not uploaded.
            </li>
            <li>
              Scan history, finding details, and report downloads are scoped to the signed-in
              account; cross-account reads and downloads return 404.
            </li>
            <li>
              Delete the account from <strong>Dashboard → Account</strong> to remove the profile,
              repositories, scans, findings, and CLI tokens. CLI tokens can also be revoked in
              Settings.
            </li>
            <li>
              Read the <a href="/privacy">privacy policy</a> for what is stored and how long it
              remains.
            </li>
          </ul>

          <h2 id="limitations">Limitations</h2>
          <ul>
            <li>Static rules are heuristics for review; they do not prove exploitability.</li>
            <li>
              A clean scan is not a security certificate or a substitute for a penetration test.
            </li>
            <li>TLS certificate chains and protocol versions are not independently verified.</li>
            <li>HTTP checks are unauthenticated unless identities are configured and executed.</li>
            <li>Browser checks cover only configured workflows and sampled pages.</li>
            <li>Performance is measured in a single local run, not a production benchmark.</li>
            <li>Lighthouse is optional and not bundled; the report says so when requested.</li>
            <li>Static Supabase review cannot prove the policy state of a deployed database.</li>
          </ul>

          <div className="mt-8 rounded-xl border border-[#1c2938] bg-[#0a111a] p-4 text-[12.5px] text-[#8fa3ba]">
            Found a problem in these docs or the tool? See{' '}
            <Link href="/security">the security and disclosure page</Link>.
          </div>
        </article>
      </div>
    </div>
  );
}
