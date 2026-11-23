import { runAiRemediation } from './ai.js';
import { runApiChecks } from './api.js';
import { runAuthorizationChecks } from './authorization.js';
import { createCheck, sortChecks, sortFindings } from './checks.js';
import type { LaunchProofConfig } from './config/schema.js';
import { safeConfigSummary } from './config/safe.js';
import { runDependencyChecks } from './dependencies.js';
import { discoverProject, type DiscoveryResult } from './discovery.js';
import { ScopeError } from './errors.js';
import { findSensitiveHistoryAdditions, isGitRepository, listTrackedFiles } from './git.js';
import { HttpClient } from './http/client.js';
import { runHttpChecks } from './http/checks.js';
import { runRepositoryChecks } from './repository.js';
import { runSecretsChecks } from './secrets.js';
import { checkTargetScope, scopeFailureMessage } from './scope.js';
import { runStaticSecurityChecks } from './static-security.js';
import { runSupabaseChecks } from './supabase.js';
import type {
  CheckResult,
  Finding,
  ScanMeta,
  ScanMode,
  ScanReport,
  Severity,
  Summary,
} from './types.js';
import { createScanId, isLoopbackHost, redactUrl, severityAtLeast } from './util.js';
import { VERSION } from './version.js';

export type ScanComponent =
  | 'discovery'
  | 'secrets'
  | 'repository'
  | 'static'
  | 'dependencies'
  | 'supabase'
  | 'http'
  | 'api'
  | 'authorization'
  | 'browser';

export const ALL_COMPONENTS: ScanComponent[] = [
  'discovery',
  'secrets',
  'repository',
  'static',
  'dependencies',
  'supabase',
  'http',
  'api',
  'authorization',
  'browser',
];

export interface ScanOptions {
  rootDir: string;
  config: LaunchProofConfig;
  configPath?: string | null;
  target?: string | null;
  components?: ScanComponent[];
  browserChecks?: CheckResult[];
  onProgress?: (message: string) => void;
  now?: Date;
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function reportGate(
  checks: CheckResult[],
  findings: Finding[],
  failOn: Severity,
): Pick<Summary, 'gatePassed' | 'gateReasons'> {
  const reasons: string[] = [];
  const blockers = findings.filter((finding) => severityAtLeast(finding.severity, failOn));
  if (blockers.length > 0) {
    const counts = SEVERITIES.map((severity) => ({
      severity,
      count: blockers.filter((finding) => finding.severity === severity).length,
    }))
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.count} ${entry.severity}`)
      .join(', ');
    reasons.push(`${blockers.length} finding(s) at or above "${failOn}" (${counts}).`);
  }
  const errored = checks.filter((check) => check.status === 'error');
  if (errored.length > 0) {
    reasons.push(`Checks errored: ${errored.map((check) => check.id).join(', ')}.`);
  }
  const unverified = checks.filter((check) => check.status === 'not-verified');
  if (unverified.length > 0) {
    reasons.push(
      `Checks not verified: ${unverified.map((check) => check.id).join(', ')}. Unverified coverage is not a pass.`,
    );
  }
  return { gatePassed: reasons.length === 0, gateReasons: reasons };
}

function buildSummary(checks: CheckResult[], findings: Finding[], failOn: Severity): Summary {
  const byStatus: Summary['byStatus'] = {
    pass: 0,
    fail: 0,
    warn: 0,
    skipped: 0,
    'not-verified': 0,
    error: 0,
  };
  const bySeverity: Summary['bySeverity'] = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const check of checks) {
    byStatus[check.status] += 1;
  }
  for (const finding of findings) {
    bySeverity[finding.severity] += 1;
  }
  return {
    totalChecks: checks.length,
    byStatus,
    bySeverity,
    totalFindings: findings.length,
    failOn,
    ...reportGate(checks, findings, failOn),
  };
}

function buildLimitations(
  config: LaunchProofConfig,
  target: string | null,
  checks: CheckResult[],
  usedComponents: Set<ScanComponent>,
): string[] {
  const limitations: string[] = [
    'Static analysis is heuristic. Pattern matches indicate code worth reviewing; they do not prove exploitability, and no finding does not prove safety.',
    'Secret values are masked before entering the report. Masking still means a credential may have leaked; rotate anything confirmed.',
  ];
  if (!target) {
    limitations.push(
      'No live target was tested. HTTP behavior, authentication, and runtime configuration remain unverified.',
    );
  } else {
    limitations.push(
      'HTTP checks were unauthenticated unless configured identities were executed. Authenticated areas may behave differently.',
    );
    limitations.push(
      'TLS certificate chains, protocol versions, and cipher configuration were not independently assessed in this version.',
    );
  }
  if (!config.scan.network) {
    limitations.push(
      'Network checks were disabled by configuration, so dependency advisories and remote behavior were not assessed.',
    );
  }
  const browserChecks = checks.filter(
    (check) =>
      check.category === 'browser' ||
      check.category === 'accessibility' ||
      check.category === 'performance',
  );
  if (!usedComponents.has('browser') || browserChecks.length === 0) {
    limitations.push(
      'Browser rendering, client-side workflows, accessibility, and performance were not verified in this scan.',
    );
  } else {
    limitations.push(
      'Browser checks exercise only the configured workflows and sampled pages; untested flows and states remain unverified.',
    );
    limitations.push(
      'Performance measurements are single-run observations from this machine and network, not a production benchmark.',
    );
  }
  const supabaseLive = checks.find((check) => check.id === 'database.supabase-live');
  if (!supabaseLive) {
    limitations.push(
      'Database policies were assessed statically only, if at all; deployed RLS behavior was not verified.',
    );
  }
  if (config.scan.gitHistory) {
    limitations.push(
      'Git history checks are filename-based and bounded by commit count; historical blobs were not content-scanned.',
    );
  }
  return limitations;
}

/**
 * Orchestrates a complete scan and returns a self-contained report. Network checks require
 * explicit authorization through the scope gate. Browser checks are supplied by the caller so
 * the core package stays free of Playwright.
 */
export async function runScan(options: ScanOptions): Promise<ScanReport> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const begin = Date.now();
  const { config } = options;
  const components = new Set<ScanComponent>(options.components ?? ALL_COMPONENTS);
  const progress = options.onProgress ?? (() => undefined);
  const checks: CheckResult[] = [];

  progress('Discovering project');
  let targetUrl: URL | null = null;
  if (options.target) {
    try {
      targetUrl = new URL(options.target);
    } catch {
      throw new ScopeError(`Invalid target URL: ${options.target}`);
    }
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new ScopeError('Only http and https targets can be tested.');
    }
  }

  const networkComponents = ['http', 'api', 'authorization'].some((component) =>
    components.has(component as ScanComponent),
  );
  if (targetUrl && networkComponents && config.scan.network) {
    const decision = checkTargetScope(targetUrl, config);
    if (!decision.allowed) {
      throw new ScopeError(scopeFailureMessage(decision, redactUrl(targetUrl.toString())));
    }
  }

  let gitRepo = false;
  let trackedFiles: Set<string> | null = null;
  if (components.has('secrets') || components.has('repository') || config.scan.gitHistory) {
    gitRepo = await isGitRepository(options.rootDir);
    if (gitRepo) {
      trackedFiles = await listTrackedFiles(options.rootDir);
    }
  }

  const discovery: DiscoveryResult = await discoverProject(options.rootDir, config, trackedFiles);
  progress(
    `Discovered ${discovery.files.length} files · ${discovery.profile.frameworks.join(', ') || 'no known framework'}`,
  );

  if (components.has('discovery')) {
    checks.push(
      createCheck({
        id: 'discovery.profile',
        title: 'Project discovery',
        category: 'discovery',
        status: 'pass',
        summary: `Detected ${discovery.profile.frameworks.join(', ') || 'no known framework'} across ${discovery.files.length} files (${discovery.profile.languages.map((language) => `${language.name} ${language.files}`).join(', ') || 'unknown languages'}).`,
        evidence: [
          { kind: 'metric', label: 'Package manager', value: discovery.profile.packageManager },
          {
            kind: 'metric',
            label: 'API routes found',
            value: String(discovery.profile.apiRoutes.length),
          },
          {
            kind: 'metric',
            label: 'Deployment targets',
            value: discovery.profile.deployment.join(', ') || 'none detected',
          },
          ...(discovery.walkTruncated
            ? [
                {
                  kind: 'text' as const,
                  label: 'Notice',
                  value: 'File walk hit the configured limit; results are partial.',
                },
              ]
            : []),
        ],
        details: discovery.profile.truncated
          ? 'The project file walk reached scan.maxFiles, so the profile and static results may be incomplete.'
          : undefined,
      }),
    );
  }

  if (components.has('secrets')) {
    progress('Scanning for secrets and environment hygiene');
    let historyEntries;
    if (config.scan.gitHistory && gitRepo) {
      historyEntries = await findSensitiveHistoryAdditions(
        options.rootDir,
        config.scan.gitHistoryMaxCommits,
      );
    }
    checks.push(
      ...(await runSecretsChecks(discovery, config, {
        includeHistory: config.scan.gitHistory,
        historyEntries,
        trackedFiles,
      })),
    );
  }

  if (components.has('repository')) {
    progress('Checking repository hygiene');
    checks.push(...(await runRepositoryChecks(discovery, config)));
  }

  if (components.has('static')) {
    progress('Running static security rules');
    checks.push(...(await runStaticSecurityChecks(discovery, config)));
  }

  if (components.has('dependencies')) {
    progress('Auditing dependencies');
    checks.push(await runDependencyChecks(options.rootDir, discovery, config));
  }

  if (components.has('supabase')) {
    progress('Reviewing Supabase migrations');
    const needsClient = Boolean(config.supabase.live && config.scan.network);
    checks.push(
      ...(await runSupabaseChecks({
        config,
        rootDir: options.rootDir,
        ...(needsClient ? { client: new HttpClient({ config }) } : {}),
      })),
    );
  }

  if (networkComponents) {
    if (!config.scan.network) {
      checks.push(
        createCheck({
          id: 'http.network-disabled',
          title: 'Live network checks',
          category: 'http',
          status: 'skipped',
          summary:
            'Network checks are disabled (scan.network: false). No live HTTP, API, or authorization requests were sent.',
          details:
            'Enable scan.network and configure authorization before testing a deployed system. Static analysis ran where selected.',
        }),
      );
    } else if (!targetUrl) {
      checks.push(
        createCheck({
          id: 'http.no-target',
          title: 'Live network checks',
          category: 'http',
          status: 'skipped',
          summary: 'No target URL is configured, so no live HTTP checks could run.',
          details: 'Set app.url, api.baseUrl, or pass an explicit target URL.',
        }),
      );
    } else {
      const client = new HttpClient({ config });
      if (components.has('http')) {
        progress(`Testing HTTP security at ${targetUrl.origin}`);
        checks.push(...(await runHttpChecks({ target: targetUrl, config, client })));
      }
      const baseUrl = config.api.baseUrl ?? targetUrl.origin;
      if (components.has('api')) {
        progress('Verifying API contracts');
        checks.push(...(await runApiChecks({ config, rootDir: options.rootDir, baseUrl, client })));
      }
      if (components.has('authorization')) {
        progress('Testing object-level authorization');
        checks.push(...(await runAuthorizationChecks({ config, baseUrl, client })));
      }
    }
  }

  if (components.has('browser')) {
    if (options.browserChecks && options.browserChecks.length > 0) {
      checks.push(...options.browserChecks);
    } else {
      checks.push(
        createCheck({
          id: 'browser.checks',
          title: 'Browser verification',
          category: 'browser',
          status: 'skipped',
          summary:
            'Browser checks were selected but no browser results were provided. Install Playwright or run "launchproof browser".',
          details:
            'Playwright and axe-core are optional peer dependencies. Local browser checks require a Chromium build.',
        }),
      );
    }
  }

  const sortedChecks = sortChecks(checks);
  const findings = sortFindings(sortedChecks.flatMap((check) => check.findings));
  const aiCheck = await runAiRemediation(findings, config);
  if (aiCheck) {
    sortedChecks.push(aiCheck);
  }

  const target = targetUrl ? redactUrl(targetUrl.toString()) : null;
  const mode: ScanMode = targetUrl
    ? isLoopbackHost(targetUrl.hostname)
      ? 'local'
      : 'remote'
    : 'static';
  const summary = buildSummary(sortedChecks, findings, config.scan.failOn as Severity);
  const finishedAt = new Date().toISOString();
  const meta: ScanMeta = {
    schemaVersion: 1,
    id: createScanId(now),
    toolVersion: VERSION,
    startedAt,
    finishedAt,
    durationMs: Date.now() - begin,
    projectName: discovery.profile.name,
    target,
    mode,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  return {
    meta,
    summary,
    project: components.has('discovery') ? discovery.profile : null,
    checks: sortedChecks,
    findings,
    limitations: buildLimitations(config, target, sortedChecks, components),
    configuration: safeConfigSummary(config, target, mode),
  };
}

export function reportGateSummary(report: ScanReport): string {
  return report.summary.gatePassed
    ? `PASS — no findings at or above ${report.summary.failOn}`
    : `FAIL — ${report.summary.gateReasons.join(' ')}`;
}
