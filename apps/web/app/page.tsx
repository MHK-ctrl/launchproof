import {
  Accessibility,
  ArrowRight,
  Braces,
  CheckCircle2,
  CircleHelp,
  Database,
  Eye,
  FileJson,
  Fingerprint,
  Gauge,
  GitBranch,
  Globe2,
  Layers,
  Lock,
  MinusCircle,
  MonitorSmartphone,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Static security & secrets',
    text: 'Risky source patterns, credential formats, environment hygiene, and git history—with values masked before they reach a report.',
  },
  {
    icon: Globe2,
    title: 'Live HTTP posture',
    text: 'Security headers, cookies, CORS, transport, error leakage, and a bounded probe of common sensitive paths.',
  },
  {
    icon: Braces,
    title: 'API contracts',
    text: 'Configured endpoints or OpenAPI paths: status, JSON shape, latency budgets, and unauthenticated access checks.',
  },
  {
    icon: Fingerprint,
    title: 'Object authorization',
    text: 'Two identities, one resource. Detect broken object-level authorization without destructive requests.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Browser workflows',
    text: 'Real Chromium flows for sign-in and other critical journeys, plus console errors, broken links, and mobile overflow.',
  },
  {
    icon: Accessibility,
    title: 'Accessibility',
    text: 'axe-core against sampled pages with WCAG tags, mapped to readable findings and remediation—not a vanity score.',
  },
  {
    icon: Gauge,
    title: 'Performance budgets',
    text: 'FCP, LCP, CLS, load time, JavaScript transfer, request count, and DOM size measured in Chromium against your thresholds.',
  },
  {
    icon: Database,
    title: 'Supabase policies',
    text: 'Static RLS review of migrations, permissive policy detection, and an optional anon-key read probe for deployed projects.',
  },
  {
    icon: FileJson,
    title: 'Evidence you can keep',
    text: 'Terminal summary, standalone HTML, JSON, and SARIF. Every artifact is generated locally and works offline.',
  },
];

const TAXONOMY = [
  {
    icon: CheckCircle2,
    name: 'PASS',
    color: 'text-[#3ddc97]',
    text: 'The check executed and found no issue at its configured level.',
  },
  {
    icon: XCircle,
    name: 'FAIL',
    color: 'text-[#ff6b6b]',
    text: 'A concrete failure was observed or a threshold was exceeded.',
  },
  {
    icon: TriangleAlert,
    name: 'WARN',
    color: 'text-[#ffd166]',
    text: 'Something needs review but did not cross the failure line.',
  },
  {
    icon: MinusCircle,
    name: 'SKIPPED',
    color: 'text-[#7f93aa]',
    text: 'The check was disabled or requires configuration. Not a pass.',
  },
  {
    icon: CircleHelp,
    name: 'NOT VERIFIED',
    color: 'text-[#7cc4ff]',
    text: 'The tool could not establish an answer. Explicitly not a pass.',
  },
  {
    icon: TriangleAlert,
    name: 'ERROR',
    color: 'text-[#ff6b6b]',
    text: 'The check itself failed. The report will not call that success.',
  },
];

const SAMPLE_FINDINGS = [
  {
    severity: 'critical',
    title: 'Environment file is publicly accessible',
    detail:
      'An unauthenticated request to /.env returned content matching an environment file. Values are masked and never shown.',
    location: 'http://127.0.0.1:4173/.env',
  },
  {
    severity: 'critical',
    title: 'Possible broken object-level authorization',
    detail:
      'User 2 accessed a profile owned by User 1 and received HTTP 200; 401, 403, or 404 was expected.',
    location: 'GET /api/users/2',
  },
  {
    severity: 'high',
    title: 'Wildcard CORS with credentials',
    detail:
      'Access-Control-Allow-Origin: * was returned together with Access-Control-Allow-Credentials: true.',
    location: 'HTTP response',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-glow relative overflow-hidden border-b border-[#111c29]">
        <div className="container relative z-10 grid items-center gap-14 py-20 lg:grid-cols-[1.02fr_1fr] lg:py-28">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="chip !border-[#2c5a46] !text-[#6ef0b6]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3ddc97]" />
                Open source · v0.1.0
              </span>
              <span className="chip">Local-first</span>
              <span className="chip">MIT</span>
            </div>
            <h1 className="max-w-xl text-[2.55rem] font-semibold leading-[1.06] tracking-[-0.035em] text-[#f0f6ff] sm:text-[3.2rem]">
              Build with AI.
              <br />
              Test like a professional
              <br />
              <span className="text-[#6ef0b6]">engineering team.</span>
              <br />
              Ship with evidence.
            </h1>
            <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-[#9bafc5]">
              LaunchProof verifies the parts AI-generated apps usually leave untested—security
              posture, API contracts, object authorization, real browser flows, accessibility, and
              performance. You get inspectable evidence, not a green checkmark you have to trust.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/get-started" className="btn btn-primary">
                Run your first scan <ArrowRight size={15} />
              </Link>
              <Link href="/report" className="btn btn-secondary">
                <Eye size={15} /> Inspect a real report
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#8499b0]">
              <span>No account required</span>
              <span>No Docker</span>
              <span>No telemetry</span>
              <span>Authorization required for remote targets</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(circle_at_70%_10%,rgba(61,220,151,0.12),transparent_60%)]" />
            <div className="terminal relative">
              <div className="terminal-bar">
                <span className="terminal-dot" />
                <span className="terminal-dot" />
                <span className="terminal-dot" />
                <span className="ml-2 font-mono text-[10px] text-[#8499b0]">
                  launchproof security · local demo
                </span>
              </div>
              <div className="terminal-body">
                <div>
                  <span className="prompt">$</span> launchproof security --url http://127.0.0.1:4173
                </div>
                <div className="mt-3 dim">→ Scanning for secrets and environment hygiene</div>
                <div className="dim">→ Testing HTTP security at 127.0.0.1</div>
                <div className="dim">→ Verifying API contracts</div>
                <div className="dim">→ Testing object-level authorization</div>
                <div className="mt-3">
                  Checks <span className="text-[#6ef0b6]">6 pass</span> ·{' '}
                  <span className="text-[#ff8383]">4 fail</span> ·{' '}
                  <span className="text-[#ffd98a]">4 warn</span> ·{' '}
                  <span className="text-[#7f93aa]">2 skipped</span>
                </div>
                <div>
                  Findings <span className="text-[#ff8383]">3 critical</span> ·{' '}
                  <span className="text-[#ffb36b]">3 high</span> · 6 medium · 7 low
                </div>
                <div className="mt-1">
                  Gate <span className="font-bold text-[#ff6b6b]">FAIL</span>{' '}
                  <span className="dim">(fail on high+)</span>
                </div>
                <div className="mt-4 text-[#ff8383]">
                  CRITICAL Environment file is publicly accessible
                </div>
                <div className="text-[#ff8383]">
                  CRITICAL Possible broken object-level authorization
                </div>
                <div className="text-[#ffb36b]">
                  HIGH&nbsp;&nbsp;&nbsp;&nbsp; GET /api/users accepts anonymous requests
                </div>
                <div className="text-[#ffb36b]">
                  HIGH&nbsp;&nbsp;&nbsp;&nbsp; Wildcard CORS with credentials
                </div>
                <div className="mt-4 dim">Report → .launchproof/latest.html</div>
              </div>
            </div>
            <p className="mt-3 text-right font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8499b0]">
              Example output from the bundled vulnerable demo
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#111c29] bg-[#070c13]/60">
        <div className="container flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8499b0]">
          <span className="flex items-center gap-2">
            <Lock size={12} /> Secrets masked at collection
          </span>
          <span className="flex items-center gap-2">
            <GitBranch size={12} /> Loopback allowed by default
          </span>
          <span className="flex items-center gap-2">
            <ScanLine size={12} /> Scope checked on every redirect
          </span>
          <span className="flex items-center gap-2">
            <Layers size={12} /> Node 22+ · macOS · Linux
          </span>
        </div>
      </section>

      <section className="container py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">One command, multiple kinds of evidence</p>
          <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.025em] text-[#edf5ff]">
            AI made shipping fast.
            <br />
            <span className="text-[#8fa3ba]">Verification has to catch up.</span>
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[#8fa3ba]">
            LaunchProof runs bounded checks that suit a laptop—no Docker, no always-on services, no
            external account for the core workflow. Each result says how it was established and what
            remains unknown.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="panel card-hover p-5">
              <feature.icon size={18} className="text-[#3ddc97]" />
              <h3 className="mt-4 text-[14.5px] font-semibold text-[#e8eff9]">{feature.title}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[#879bb2]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#111c29] bg-[#080d14]">
        <div className="container grid gap-12 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">The result taxonomy</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.025em] text-[#edf5ff]">
              Six statuses. No ambiguous green.
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#8fa3ba]">
              A skipped check, an unavailable browser, and an empty API configuration are not
              passes. LaunchProof keeps those states visible in the terminal, HTML, JSON, and SARIF
              outputs.
            </p>
            <div className="mt-6 rounded-xl border border-[#2b2411] bg-[#191407] p-4 text-[12.5px] leading-relaxed text-[#d9c58e]">
              <strong className="text-[#ffd166]">The gate is configured, not implied.</strong>{' '}
              Default fail-on is <code className="font-mono text-[#ffd166]">high</code>. You can
              change it per run, but the report always states which threshold produced the gate
              result.
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {TAXONOMY.map((item) => (
              <div key={item.name} className="rounded-xl border border-[#1c2938] bg-[#0a111a] p-4">
                <div
                  className={`flex items-center gap-2 font-mono text-[11px] font-bold ${item.color}`}
                >
                  <item.icon size={14} /> {item.name}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-[#8296ad]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">From a real report</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.025em] text-[#edf5ff]">
              Findings a demo deserves.
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#8fa3ba]">
              These are findings from scanning the intentionally insecure demo bundled with the
              repository. The full report is public—including its limitations.
            </p>
          </div>
          <Link href="/report" className="btn btn-secondary">
            Open sample report <ArrowRight size={14} />
          </Link>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {SAMPLE_FINDINGS.map((finding) => (
            <article key={finding.title} className={`finding-card sev-${finding.severity}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#8499b0]">
                  pattern + observed
                </span>
              </div>
              <h3 className="mt-3 text-[14px] font-semibold leading-snug text-[#e8eff9]">
                {finding.title}
              </h3>
              <p className="mt-2 text-[12px] leading-relaxed text-[#879bb2]">{finding.detail}</p>
              <p className="mt-3 break-all font-mono text-[10px] text-[#8499b0]">
                {finding.location}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[#111c29] bg-[#080d14]">
        <div className="container grid gap-10 py-20 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Three commands to a decision</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.025em] text-[#edf5ff]">
              Built for the moment before you deploy.
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#8fa3ba]">
              Start static, then opt into live checks for systems you own. Browser checks use a
              single headless Chromium instance with bounded pages and workflows.
            </p>
            <Link href="/docs#quick-start" className="btn btn-primary mt-6">
              Read the quick start <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {[
              [
                '01',
                'Analyze the project',
                '$ launchproof analyze',
                'Profile frameworks, languages, routes, environment references, and configuration. No network.',
              ],
              [
                '02',
                'Scan what you own',
                '$ launchproof security --url http://localhost:3000',
                'Static and live checks with loopback allowed. Remote targets require authorization and an exact scope.',
              ],
              [
                '03',
                'Inspect the evidence',
                '$ launchproof test',
                'Run configured API, browser, accessibility, performance, and authorization checks, then open the HTML report.',
              ],
            ].map(([number, title, command, description]) => (
              <div
                key={number}
                className="flex gap-4 rounded-xl border border-[#1c2938] bg-[#0b111a] p-4"
              >
                <span className="font-mono text-[11px] text-[#3ddc97]">{number}</span>
                <div>
                  <h3 className="text-[13.5px] font-semibold text-[#e8eff9]">{title}</h3>
                  <code className="mt-1 block font-mono text-[11.5px] text-[#9bd6ff]">
                    {command}
                  </code>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#8296ad]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="eyebrow">What it will not do</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.025em] text-[#edf5ff]">
              Honest boundaries are a feature.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#8fa3ba]">
              LaunchProof is a verification aid, not a penetration test and not a security
              certificate. It will not invent exploit proof, test a target you have not authorized,
              or label an untested surface as safe.
            </p>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[
              'No exploitation or destructive payloads',
              'No remote scanning without explicit scope',
              'No hidden telemetry or cloud requirement',
              'No AI remediation unless you enable and consent',
              'No claim that a clean scan means secure',
              'No fabricated browser or performance results',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-lg border border-[#1c2938] bg-[#0a111a] p-3.5 text-[12.5px] text-[#a0b3c8]"
              >
                <Lock size={13} className="mt-0.5 shrink-0 text-[#3ddc97]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-[#24523f] bg-[linear-gradient(120deg,#0b1d15,#0a131c)] p-8 sm:p-12">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#3ddc97]/10 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow">Ship with evidence</p>
              <h2 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-[#f0f6ff]">
                Point it at the app you just built.
              </h2>
              <p className="mt-2 max-w-lg text-[13.5px] text-[#9bafc5]">
                Start with the local checkout. No account, cloud, or Docker is required. Browser
                checks are optional and clearly reported when unavailable; cloud upload is opt-in.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/get-started" className="btn btn-primary">
                Get started <ArrowRight size={14} />
              </Link>
              <Link href="/demo" className="btn btn-secondary">
                Try the simulation
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
