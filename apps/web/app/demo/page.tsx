import type { Metadata } from 'next';
import Link from 'next/link';

import { SimulatedDemo } from '../../components/simulated-demo';

export const metadata: Metadata = {
  title: 'Simulated demo',
  description:
    'A clearly labeled, simulated LaunchProof terminal experience. No code runs and no network requests are made.',
};

export default function DemoPage() {
  return (
    <div className="container py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">Interactive, not misleading</p>
        <h1 className="mt-3 text-[2.4rem] font-semibold leading-tight tracking-[-0.03em] text-[#f0f6ff]">
          See the shape of a scan.
        </h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-[#9bafc5]">
          This page simulates three LaunchProof commands so you can inspect the output format
          without installing anything. The findings are based on the bundled vulnerable demo.
        </p>
        <div className="sim-banner mt-5">
          SIMULATED DEMO · No command executes, no filesystem is read, no network request is sent.
        </div>
      </div>

      <div className="mt-8">
        <SimulatedDemo />
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="panel p-6">
          <h2 className="text-[16px] font-semibold text-[#e8eff9]">What the real command does</h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#93a6bd]">
            <li>— Discovers the project with a bounded, deterministic file walk.</li>
            <li>
              — Evaluates static rules and credential patterns, masking values before reporting.
            </li>
            <li>— Refuses non-loopback HTTP requests unless authorization and scope match.</li>
            <li>— Runs API, authorization, and browser checks only when they are configured.</li>
            <li>— Writes terminal, HTML, JSON, and optional SARIF artifacts to .launchproof.</li>
          </ul>
        </div>
        <div className="panel p-6">
          <h2 className="text-[16px] font-semibold text-[#e8eff9]">Install and run it for real</h2>
          <pre className="code-block mt-3">
            {`npm install
npm run build
node packages/cli/bin/launchproof.mjs init
node packages/cli/bin/launchproof.mjs analyze
node packages/cli/bin/launchproof.mjs test`}
          </pre>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[#6e8199]">
            The CLI is published on npm as <code className="font-mono">@hamzakhan2006/launchproof</code>
            (the unscoped npm name <code className="font-mono">launchproof</code> belongs to an
            unrelated project). Install the scoped package, or run from a checkout of the repository.
          </p>
          <Link href="/get-started" className="btn btn-primary mt-4 !py-2 !text-[12px]">
            Full setup guide
          </Link>
        </div>
      </div>
    </div>
  );
}
