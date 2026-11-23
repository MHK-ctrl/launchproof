import { VERSION } from '../version.js';
import type { CheckResult, ReportFormat, ScanReport, Severity } from '../types.js';

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
};

const STATUS_COLORS: Record<string, string> = {
  pass: ANSI.green,
  fail: ANSI.red,
  warn: ANSI.yellow,
  skipped: ANSI.gray,
  'not-verified': ANSI.magenta,
  error: ANSI.red,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: ANSI.magenta,
  high: ANSI.red,
  medium: ANSI.yellow,
  low: ANSI.blue,
  info: ANSI.gray,
};

export interface TerminalOptions {
  color?: boolean;
  verbose?: boolean;
  maxFindings?: number;
}

function paint(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${ANSI.reset}` : text;
}

function label(text: string, width: number): string {
  return text.padEnd(width, ' ');
}

export function renderTerminal(report: ScanReport, options: TerminalOptions = {}): string {
  const color = options.color ?? false;
  const verbose = options.verbose ?? false;
  const maxFindings = options.maxFindings ?? (verbose ? 100 : 8);
  const lines: string[] = [];
  const { meta, summary } = report;

  lines.push('');
  lines.push(
    `${paint('LaunchProof', ANSI.bold, color)} ${paint(`v${VERSION}`, ANSI.gray, color)}  ${paint('evidence-backed verification', ANSI.gray, color)}`,
  );
  lines.push(
    `${paint(meta.projectName, ANSI.bold, color)}  ${paint('·', ANSI.gray, color)}  ${meta.mode} ${paint('·', ANSI.gray, color)}  ${meta.startedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`,
  );
  if (meta.target) {
    lines.push(`${paint('Target', ANSI.gray, color)}  ${meta.target}`);
  }
  lines.push(
    `${paint('Scan', ANSI.gray, color)}    ${meta.id}  ${paint(`(${(meta.durationMs / 1000).toFixed(1)}s)`, ANSI.gray, color)}`,
  );
  lines.push('');

  const statusOrder = ['pass', 'fail', 'warn', 'skipped', 'not-verified', 'error'] as const;
  const statusLine = statusOrder
    .filter((status) => summary.byStatus[status] > 0)
    .map(
      (status) =>
        `${paint(String(summary.byStatus[status]), STATUS_COLORS[status] ?? ANSI.reset, color)} ${status}`,
    )
    .join(paint('  ·  ', ANSI.gray, color));
  lines.push(`${paint('Checks', ANSI.gray, color)}    ${statusLine}`);

  const severityLine = (['critical', 'high', 'medium', 'low', 'info'] as Severity[])
    .filter((severity) => summary.bySeverity[severity] > 0)
    .map(
      (severity) =>
        `${paint(String(summary.bySeverity[severity]), SEVERITY_COLORS[severity], color)} ${severity}`,
    )
    .join(paint('  ·  ', ANSI.gray, color));
  lines.push(
    `${paint('Findings', ANSI.gray, color)}  ${summary.totalFindings === 0 ? paint('none', ANSI.green, color) : severityLine}`,
  );

  const gateColor = summary.gatePassed ? ANSI.green : ANSI.red;
  lines.push(
    `${paint('Gate', ANSI.gray, color)}      ${paint(summary.gatePassed ? 'PASS' : 'FAIL', `${ANSI.bold}${gateColor}`, color)} ${paint(`(fail on ${summary.failOn}+)`, ANSI.gray, color)}`,
  );
  for (const reason of summary.gateReasons) {
    lines.push(`          ${paint('→', gateColor, color)} ${reason}`);
  }
  lines.push('');

  if (report.checks.length > 0) {
    lines.push(paint('Checks', ANSI.bold, color));
    for (const check of report.checks) {
      const statusColor = STATUS_COLORS[check.status] ?? ANSI.reset;
      const badge = paint(label(check.status.toUpperCase(), 12), statusColor, color);
      const duration =
        check.durationMs > 0 ? paint(`${Math.round(check.durationMs)}ms`, ANSI.gray, color) : '';
      lines.push(
        `${badge} ${check.id} ${paint('—', ANSI.gray, color)} ${check.summary} ${duration}`.trimEnd(),
      );
    }
    lines.push('');
  }

  const findings = [...report.findings].sort(
    (a, b) =>
      (['critical', 'high', 'medium', 'low', 'info'] as Severity[]).indexOf(a.severity) -
        (['critical', 'high', 'medium', 'low', 'info'] as Severity[]).indexOf(b.severity) ||
      a.title.localeCompare(b.title),
  );
  if (findings.length > 0) {
    lines.push(paint('Findings', ANSI.bold, color));
    for (const finding of findings.slice(0, maxFindings)) {
      const colorForSeverity = SEVERITY_COLORS[finding.severity] ?? ANSI.reset;
      lines.push(
        `${paint(finding.severity.toUpperCase().padEnd(8), colorForSeverity, color)} ${paint(finding.id, ANSI.gray, color)}  ${finding.title}`,
      );
      if (finding.location) {
        const location =
          finding.location.file ??
          finding.location.url ??
          (finding.location.line ? `line ${finding.location.line}` : '');
        lines.push(
          `         ${paint(`${location}${finding.location.line && finding.location.file ? `:${finding.location.line}` : ''}`, ANSI.gray, color)}`,
        );
      }
      if (verbose) {
        lines.push(`         ${finding.description}`);
        lines.push(
          `         ${paint('Fix:', ANSI.gray, color)} ${finding.remediation.split('\n')[0]}`,
        );
      }
    }
    if (findings.length > maxFindings) {
      lines.push(
        paint(
          `… ${findings.length - maxFindings} more finding(s). Open the HTML report or use --verbose.`,
          ANSI.gray,
          color,
        ),
      );
    }
    lines.push('');
  }

  if (verbose) {
    lines.push(paint('Configuration', ANSI.bold, color));
    lines.push(`  network: ${report.configuration.networkEnabled ? 'enabled' : 'disabled'}`);
    lines.push(
      `  file scan: ${report.configuration.fileScan.include.join(', ') || 'all text files'}`,
    );
    lines.push(`  api: ${report.configuration.api.endpointCount} endpoint(s)`);
    lines.push(`  browser: ${report.configuration.browser.enabled ? 'enabled' : 'disabled'}`);
    lines.push('');
  }

  if (report.limitations.length > 0) {
    lines.push(paint('Limitations', ANSI.bold, color));
    for (const limitation of report.limitations) {
      lines.push(`  ${paint('·', ANSI.gray, color)} ${limitation}`);
    }
    lines.push('');
  }

  lines.push(
    paint(
      'Static checks and pattern matches are not proof of security or exploitation. Verify findings before acting.',
      ANSI.gray,
      color,
    ),
  );
  lines.push('');
  return lines.join('\n');
}

export function renderTerminalForFormat(
  report: ScanReport,
  format: ReportFormat,
  options: TerminalOptions = {},
): string {
  if (format === 'terminal') {
    return renderTerminal(report, options);
  }
  throw new Error(`Terminal renderer cannot render ${format}`);
}

export function summarizeCheck(check: CheckResult): string {
  return `${check.id}: ${check.status} (${check.findings.length} findings)`;
}
