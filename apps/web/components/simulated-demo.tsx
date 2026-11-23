'use client';

import { AlertTriangle, Play, RotateCcw, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Severity } from '../lib/report';

interface SimFinding {
  severity: Severity;
  title: string;
  detail: string;
}

interface Scenario {
  command: string;
  description: string;
  lines: string[];
  gate: 'PASS' | 'FAIL' | 'WARN';
  findings: SimFinding[];
}

const SCENARIOS: Scenario[] = [
  {
    command: 'launchproof analyze',
    description: 'Discover the stack and routes without sending a single request.',
    lines: [
      '$ launchproof analyze',
      '',
      '→ Discovering project',
      'Project: vulnerable-demo',
      'Languages: JavaScript (1)',
      'API routes: 0 configured routes discovered',
      'Deployment: none detected',
      'Files scanned: 2',
      '',
      'PASS  discovery.profile',
      'Report written to .launchproof/latest.html',
    ],
    gate: 'PASS',
    findings: [],
  },
  {
    command: 'launchproof security',
    description: 'Static security, secrets, live headers, API authentication, and authorization.',
    lines: [
      '$ launchproof security --url http://127.0.0.1:4173',
      '',
      '→ Scanning for secrets and environment hygiene',
      '→ Running static security rules',
      '→ Testing HTTP security',
      '→ Verifying API contracts',
      '→ Testing object-level authorization',
      '',
      'Checks    6 pass · 4 fail · 4 warn · 2 skipped',
      'Findings  3 critical · 3 high · 6 medium · 7 low',
      'Gate      FAIL (fail on high+)',
      '',
      'CRITICAL  Environment file is publicly accessible',
      'CRITICAL  Git configuration is publicly accessible',
      'CRITICAL  Possible broken object-level authorization',
      'HIGH      GET /api/users accepts unauthenticated requests',
      'HIGH      Wildcard CORS with credentials',
    ],
    gate: 'FAIL',
    findings: [
      {
        severity: 'critical',
        title: 'Environment file is publicly accessible',
        detail:
          'GET /.env returned content matching an environment file. Values are never shown in reports.',
      },
      {
        severity: 'critical',
        title: 'Possible broken object-level authorization',
        detail:
          'A second identity received HTTP 200 for another user’s profile; 401/403/404 was expected.',
      },
      {
        severity: 'high',
        title: 'GET /api/users accepts unauthenticated requests',
        detail:
          'The endpoint is configured as protected, but an anonymous request returned HTTP 200.',
      },
    ],
  },
  {
    command: 'launchproof test',
    description:
      'The full configured run, including Chromium workflows, axe-core, and performance budgets.',
    lines: [
      '$ launchproof test',
      '',
      '→ Running static security rules',
      '→ Testing HTTP security',
      '→ Running browser workflows',
      '→ Running accessibility checks',
      '→ Measuring navigation performance',
      '→ Checking internal links',
      '→ Checking mobile layout',
      '',
      'Checks    8 pass · 4 fail · 8 warn · 2 skipped',
      'Findings  23 total',
      'Gate      FAIL (fail on high+)',
      '',
      'WARN   Accessibility: color contrast',
      'WARN   Broken internal link: /broken',
      'WARN   Horizontal overflow on /',
      'PASS   Browser login workflow',
      'PASS   Navigation performance budgets',
    ],
    gate: 'FAIL',
    findings: [
      {
        severity: 'medium',
        title: 'Accessibility: minimum color contrast',
        detail: 'axe-core matched a WCAG 2 AA contrast rule on the simulated demo page.',
      },
      {
        severity: 'low',
        title: 'Broken internal link: /broken',
        detail: 'A link found on the home page returned HTTP 404.',
      },
      {
        severity: 'low',
        title: 'Horizontal overflow on /',
        detail: 'The page is wider than the 390px mobile viewport, requiring sideways scrolling.',
      },
    ],
  },
];

export function SimulatedDemo() {
  const [index, setIndex] = useState(1);
  const [visible, setVisible] = useState(SCENARIOS[1]?.lines.length ?? 0);
  const [running, setRunning] = useState(false);
  const scenario = SCENARIOS[index] ?? SCENARIOS[0]!;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setVisible((current) => {
        if (current >= scenario.lines.length) {
          setRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 110);
    return () => window.clearInterval(timer);
  }, [running, scenario.lines.length]);

  function select(nextIndex: number) {
    setIndex(nextIndex);
    setVisible(SCENARIOS[nextIndex]?.lines.length ?? 0);
    setRunning(false);
  }

  function run() {
    setVisible(0);
    setRunning(true);
  }

  const finished = visible >= scenario.lines.length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <div className="panel p-6">
        <div className="mb-5 flex items-center gap-2">
          <Terminal size={16} className="text-[#3ddc97]" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#93a6bd]">
            Choose a simulated command
          </h2>
        </div>
        <div className="space-y-2">
          {SCENARIOS.map((candidate, candidateIndex) => (
            <button
              key={candidate.command}
              type="button"
              onClick={() => select(candidateIndex)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                candidateIndex === index
                  ? 'border-[#2f6b53] bg-[#0d2018]'
                  : 'border-[#1c2938] bg-[#0a111a] hover:border-[#2a3b50]'
              }`}
              aria-pressed={candidateIndex === index}
            >
              <span className="font-mono text-[12.5px] text-[#6ef0b6]">$ {candidate.command}</span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-[#8fa3ba]">
                {candidate.description}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={run}
          className="btn btn-primary mt-5 w-full"
          disabled={running}
        >
          {running ? (
            <>Running simulation…</>
          ) : (
            <>
              {finished ? <RotateCcw size={15} /> : <Play size={15} />}
              {finished ? 'Run again' : 'Run simulation'}
            </>
          )}
        </button>
        <p className="mt-4 flex gap-2 text-[11.5px] leading-relaxed text-[#6e8199]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#ffd166]" />
          This is a simulation. No code runs, no files are read, and no network requests are made.
          The output mirrors findings from the bundled intentionally vulnerable demo.
        </p>
      </div>

      <div className="terminal flex min-h-[430px] flex-col">
        <div className="terminal-bar">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="ml-2 font-mono text-[10px] text-[#8499b0]">
            simulated terminal · not a real scan
          </span>
          <span
            className={`ml-auto font-mono text-[10px] font-bold ${
              scenario.gate === 'FAIL' ? 'text-[#ff6b6b]' : 'text-[#3ddc97]'
            }`}
          >
            {finished ? scenario.gate : running ? 'RUNNING' : 'READY'}
          </span>
        </div>
        <div className="terminal-body flex-1" aria-live="polite">
          {scenario.lines.slice(0, visible).map((line, lineIndex) => (
            <div
              key={`${scenario.command}-${lineIndex}`}
              className={
                line.startsWith('CRITICAL')
                  ? 'text-[#ff8383]'
                  : line.startsWith('HIGH')
                    ? 'text-[#ffb36b]'
                    : line.startsWith('WARN')
                      ? 'text-[#ffd98a]'
                      : line.startsWith('PASS')
                        ? 'text-[#6ef0b6]'
                        : line.startsWith('FAIL')
                          ? 'text-[#ff8383]'
                          : line.startsWith('$')
                            ? 'text-[#9bd6ff]'
                            : 'text-[#b7c7da]'
              }
            >
              {line || '\u00a0'}
            </div>
          ))}
          {running ? <span className="text-[#3ddc97]">▌</span> : null}
        </div>
      </div>

      {finished && scenario.findings.length > 0 ? (
        <div className="panel p-6 lg:col-span-2">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6e8199]">
            Simulated findings
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {scenario.findings.map((finding) => (
              <div key={finding.title} className={`finding-card sev-${finding.severity}`}>
                <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
                <p className="mt-2 text-[13.5px] font-medium text-[#e8eff9]">{finding.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#8fa3ba]">{finding.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
