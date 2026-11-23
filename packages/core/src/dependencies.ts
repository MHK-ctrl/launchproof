import path from 'node:path';

import type { LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import type { DiscoveryResult } from './discovery.js';
import { pathExists } from './fs-utils.js';
import { runCommand } from './process.js';
import type { CheckResult, Finding, Severity } from './types.js';
import { truncate } from './util.js';

interface AuditVia {
  title?: string;
  url?: string;
  severity?: string;
  name?: string;
}

interface AuditVulnerability {
  name?: string;
  severity?: string;
  range?: string;
  via?: Array<string | AuditVia>;
  fixAvailable?: boolean | { name?: string; version?: string };
  effects?: string[];
}

interface AuditOutput {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities?: Partial<Record<'info' | 'low' | 'moderate' | 'high' | 'critical', number>>;
  };
}

const SEVERITY_MAP: Record<string, Severity> = {
  info: 'info',
  low: 'low',
  moderate: 'medium',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

function auditSummary(audit: AuditOutput): string {
  const counts = audit.metadata?.vulnerabilities ?? {};
  const parts = [
    ['critical', counts.critical ?? 0],
    ['high', counts.high ?? 0],
    ['moderate', counts.moderate ?? 0],
    ['low', counts.low ?? 0],
  ] as const;
  return parts.map(([label, count]) => `${count} ${label}`).join(', ');
}

export async function runDependencyChecks(
  rootDir: string,
  discovery: DiscoveryResult,
  config: LaunchProofConfig,
): Promise<CheckResult> {
  const started = Date.now();
  const lockfileCandidates = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
  const hasLockfile = (
    await Promise.all(lockfileCandidates.map((name) => pathExists(path.join(rootDir, name))))
  ).some(Boolean);
  if (!discovery.packageJson) {
    return createCheck({
      id: 'dependencies.audit',
      title: 'Dependency vulnerability audit',
      category: 'dependencies',
      status: 'skipped',
      summary: 'No package.json was found, so there are no npm dependencies to audit.',
      durationMs: Date.now() - started,
    });
  }

  if (!config.scan.network) {
    return createCheck({
      id: 'dependencies.audit',
      title: 'Dependency vulnerability audit',
      category: 'dependencies',
      status: 'skipped',
      summary:
        'Dependency auditing requires the npm registry. Network checks are disabled (scan.network), so no audit was performed.',
      details:
        'Enable scan.network or run "npm audit" manually. LaunchProof does not claim dependencies are vulnerability-free.',
      durationMs: Date.now() - started,
    });
  }

  if (!hasLockfile) {
    return createCheck({
      id: 'dependencies.audit',
      title: 'Dependency vulnerability audit',
      category: 'dependencies',
      status: 'warn',
      summary: 'A lockfile is required for a meaningful audit; no dependency audit was performed.',
      findings: [
        createFinding({
          checkId: 'dependencies.audit',
          title: 'Dependency audit could not run without a lockfile',
          description: 'npm audit needs a lockfile to resolve the exact installed dependency tree.',
          severity: 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'dependencies',
          impact: 'Known vulnerable versions can ship unnoticed.',
          remediation: 'Commit a lockfile and re-run the audit.',
          key: 'deps:no-lockfile',
        }),
      ],
      durationMs: Date.now() - started,
    });
  }

  const packageManager = discovery.profile.packageManager;
  const command = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : 'npm';
  const args = command === 'npm' ? ['audit', '--json'] : ['audit', '--json'];
  const result = await runCommand(command, args, {
    cwd: rootDir,
    timeoutMs: 45_000,
    maxBufferBytes: 6_000_000,
  });

  if (result.spawnError || (result.code !== 0 && result.stdout.trim().length === 0)) {
    return createCheck({
      id: 'dependencies.audit',
      title: 'Dependency vulnerability audit',
      category: 'dependencies',
      status: 'not-verified',
      summary: 'The dependency audit could not complete.',
      error: truncate(result.spawnError ?? result.stderr.trim() ?? 'No audit output', 400),
      details: 'This is not a pass. Run the audit manually once registry access is available.',
      durationMs: Date.now() - started,
    });
  }

  let audit: AuditOutput;
  try {
    audit = JSON.parse(result.stdout) as AuditOutput;
  } catch {
    return createCheck({
      id: 'dependencies.audit',
      title: 'Dependency vulnerability audit',
      category: 'dependencies',
      status: 'not-verified',
      summary: 'The dependency audit returned output that could not be parsed.',
      error: truncate(result.stderr || result.stdout, 300),
      durationMs: Date.now() - started,
    });
  }

  const vulnerabilities = Object.values(audit.vulnerabilities ?? {});
  const findings: Finding[] = [];
  for (const vulnerability of vulnerabilities) {
    if (findings.length >= 30) break;
    const name = vulnerability.name ?? 'unknown-package';
    const severity = SEVERITY_MAP[(vulnerability.severity ?? 'low').toLowerCase()] ?? 'low';
    const via = (vulnerability.via ?? [])
      .filter((entry): entry is AuditVia => typeof entry === 'object')
      .map((entry) => entry.title)
      .filter((title): title is string => Boolean(title));
    const fix =
      vulnerability.fixAvailable === true
        ? 'Run the package manager audit fix command after reviewing the changes.'
        : vulnerability.fixAvailable && typeof vulnerability.fixAvailable === 'object'
          ? `Upgrade to ${vulnerability.fixAvailable.name ?? name}@${vulnerability.fixAvailable.version ?? 'a fixed version'}.`
          : 'No automatic fix is available; evaluate a replacement or mitigation.';
    findings.push(
      createFinding({
        checkId: 'dependencies.audit',
        title: `Vulnerable dependency: ${name}`,
        description: `${name}${vulnerability.range ? ` (${vulnerability.range})` : ''} has a known vulnerability. ${via.length > 0 ? via.join('; ') : 'See the advisory for details.'}`,
        severity,
        confidence: 'high',
        verification: 'observed',
        category: 'dependencies',
        impact:
          'Known vulnerabilities in dependencies are reachable through the application unless patched or mitigated.',
        remediation: fix,
        evidence: [
          { kind: 'text', label: 'Package', value: name },
          ...(vulnerability.range
            ? [{ kind: 'text' as const, label: 'Vulnerable range', value: vulnerability.range }]
            : []),
        ],
        location: { file: 'package-lock.json' },
        references: via.length > 0 ? ['https://www.npmjs.com/advisories'] : undefined,
        key: `dep:${name}`,
      }),
    );
  }

  const auditText = auditSummary(audit);
  const highest = findings.reduce<Severity>((current, finding) => {
    const order: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
    return order.indexOf(finding.severity) > order.indexOf(current) ? finding.severity : current;
  }, 'info');

  return createCheck({
    id: 'dependencies.audit',
    title: 'Dependency vulnerability audit',
    category: 'dependencies',
    status:
      findings.length > 0
        ? highest === 'critical' || highest === 'high'
          ? 'fail'
          : 'warn'
        : 'pass',
    summary:
      findings.length > 0
        ? `npm audit reported ${vulnerabilities.length} vulnerable package(s): ${auditText}.`
        : 'npm audit reported no known vulnerabilities in the installed dependency tree.',
    findings,
    evidence: [
      { kind: 'metric', label: 'Vulnerabilities', value: auditText || '0' },
      { kind: 'metric', label: 'Audit exit code', value: String(result.code ?? 'null') },
    ],
    details:
      'npm audit reflects advisory data available at scan time; a clean result does not prove the absence of vulnerabilities.',
    durationMs: Date.now() - started,
  });
}
