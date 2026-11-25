import type { Metadata } from 'next';
import Link from 'next/link';

import { CopyButton } from '../../components/copy-button';

export const metadata: Metadata = {
  title: 'Get started',
  description:
    'Install LaunchProof from npm or from source, configure a project, run static and authorized live checks, and inspect the report.',
};

const INSTALL = `npm install --global @hamzakhan2006/launchproof
launchproof --version

# or from a checkout of the repository:
git clone https://github.com/MHK-ctrl/launchproof.git
cd LaunchProof
npm install
npm run build
node packages/cli/bin/launchproof.mjs --version`;

const BROWSER = `npm install --save-dev playwright axe-core
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npx playwright install --only-shell chromium`;

const CONFIG = `{
  "version": 1,
  "project": { "name": "my-app" },
  "app": { "url": "http://localhost:3000" },
  "authorization": {
    "authorized": false,
    "scope": [],
    "allowLocal": true
  },
  "scan": { "network": false, "failOn": "high" },
  "report": {
    "outputDir": ".launchproof",
    "formats": ["terminal", "json", "html"]
  }
}`;

const CI = `- uses: actions/setup-node@v4
  with: { node-version: 22, cache: npm }
- run: npm ci
- run: npm run build
- run: npm test
- run: node packages/cli/bin/launchproof.mjs test --ci --fail-on high`;

export default function GetStartedPage() {
  return (
    <div className="container py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">Get started</p>
        <h1 className="mt-3 text-[2.4rem] font-semibold leading-tight tracking-[-0.03em] text-[#f0f6ff]">
          From checkout to evidence in minutes.
        </h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-[#9bafc5]">
          The free LaunchProof CLI is published on npm as <code className="font-mono">@hamzakhan2006/launchproof</code>
          and has no required account, cloud dependency, or Docker image. Start with static analysis,
          then opt into live checks for a system you own. The optional cloud dashboard is live at
          launchproof-rose.vercel.app and receives only summaries you explicitly upload.
        </p>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-[#e8eff9]">
                <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">01</span>
                Build the CLI from source
              </h2>
              <CopyButton value={INSTALL} />
            </div>
            <pre className="code-block mt-3">{INSTALL}</pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              Requires Node.js 22.12+. The public npm name{' '}
              <code className="font-mono">launchproof</code> belongs to an unrelated project, so
              install the scoped package <code className="font-mono">@hamzakhan2006/launchproof</code>
              from npm (or build a tarball of the current checkout with
              <code className="font-mono">npm run pack:cli</code>).
            </p>
          </section>

          <section className="panel p-6">
            <h2 className="text-[16px] font-semibold text-[#e8eff9]">
              <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">02</span>
              Initialize and inspect
            </h2>
            <pre className="code-block mt-3">
              {`node packages/cli/bin/launchproof.mjs init
node packages/cli/bin/launchproof.mjs analyze
node packages/cli/bin/launchproof.mjs test`}
            </pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              With the generated defaults, <code className="font-mono text-[#6ef0b6]">test</code>{' '}
              runs filesystem checks only. Network checks require{' '}
              <code className="font-mono text-[#6ef0b6]">scan.network: true</code>.
            </p>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-[#e8eff9]">
                <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">03</span>
                Configure the surfaces you care about
              </h2>
              <CopyButton value={CONFIG} />
            </div>
            <pre className="code-block mt-3">{CONFIG}</pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              Add <code className="font-mono">api.endpoints</code>, browser workflows, identities,
              or Supabase settings as needed. Invalid fields fail closed with a clear error.
            </p>
          </section>

          <section className="panel p-6">
            <h2 className="text-[16px] font-semibold text-[#e8eff9]">
              <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">04</span>
              Authorize live testing only for systems you own
            </h2>
            <pre className="code-block mt-3">
              {`# Local loopback is allowed by default
node packages/cli/bin/launchproof.mjs security --url http://localhost:3000

# A remote target requires explicit authorization and exact scope
node packages/cli/bin/launchproof.mjs scan https://staging.example.com \\
  --authorized --scope staging.example.com`}
            </pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              Passing <code className="font-mono">--authorized</code> is a statement that you have
              permission. LaunchProof cannot verify your legal authority. Never point it at a
              third-party system without written permission.
            </p>
          </section>

          <section className="panel p-6">
            <h2 className="text-[16px] font-semibold text-[#e8eff9]">
              <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">05</span>
              Optional cloud history
            </h2>
            <pre className="code-block mt-3">
              {`node packages/cli/bin/launchproof.mjs login
node packages/cli/bin/launchproof.mjs scan . --upload --yes
node packages/cli/bin/launchproof.mjs logout`}
            </pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              Sign in with GitHub, connect a repository in the dashboard, and upload only when you
              want a hosted history. Uploads are sanitized summaries; source code and secrets are
              not sent. Read the{' '}
              <Link href="/privacy" className="text-[#3ddc97]">
                privacy policy
              </Link>{' '}
              first.
            </p>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-[#e8eff9]">
                <span className="mr-2 font-mono text-[11px] text-[#3ddc97]">06</span>
                Optional browser checks
              </h2>
              <CopyButton value={BROWSER} />
            </div>
            <pre className="code-block mt-3">{BROWSER}</pre>
            <p className="mt-3 text-[12px] leading-relaxed text-[#7f93aa]">
              Uses one headless Chromium instance with bounded pages. If Playwright or Chromium is
              missing, browser/accessibility/performance checks are reported as NOT VERIFIED.
            </p>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="panel p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8499b0]">
              What you get
            </p>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-[#a2b5ca]">
              <li>Terminal summary with a configured gate.</li>
              <li>Standalone offline HTML report.</li>
              <li>Canonical JSON and optional SARIF.</li>
              <li>Masked evidence and explicit limitations.</li>
              <li>Exit code 1 when the gate fails.</li>
            </ul>
          </div>
          <div className="panel p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8499b0]">
              CI snippet
            </p>
            <pre
              className="code-block mt-3 !p-3 !text-[10.5px]"
              role="region"
              aria-label="CI snippet"
              tabIndex={0}
            >
              {CI}
            </pre>
          </div>
          <div className="rounded-xl border border-[#4a3b14] bg-[#191407] p-4 text-[12px] leading-relaxed text-[#d9c58e]">
            <strong className="text-[#ffd166]">Before you scan:</strong> confirm the target is yours
            or you have written authorization, and keep network checks off until you do.
          </div>
          <div className="panel p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8499b0]">
              Need depth?
            </p>
            <p className="mt-2 text-[12.5px] text-[#93a6bd]">
              Configuration, commands, reports, and limitations are documented in full.
            </p>
            <Link href="/docs" className="btn btn-secondary mt-3 w-full !py-2 !text-[12px]">
              Read the docs
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
