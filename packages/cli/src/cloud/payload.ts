import path from 'node:path';

import { redactText, stripControlChars, type ScanReport } from '@launchproof/core';

export interface CloudScanPayload {
  formatVersion: 1;
  clientScanId: string;
  repositoryId: string;
  scannerVersion: string;
  commitSha: string | null;
  branch: string | null;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'partial' | 'failed';
  summary: {
    totalChecks: number;
    byStatus: Record<'pass' | 'fail' | 'warn' | 'skipped' | 'not-verified' | 'error', number>;
    bySeverity: Record<'critical' | 'high' | 'medium' | 'low' | 'info', number>;
    totalFindings: number;
    failOn: 'critical' | 'high' | 'medium' | 'low' | 'info';
    gatePassed: boolean;
    gateReasons: string[];
  };
  checks: Array<{
    id: string;
    title: string;
    status: string;
    summary: string;
    details: string | null;
  }>;
  findings: Array<{
    id: string;
    checkId: string;
    title: string;
    description: string;
    severity: string;
    confidence: string;
    verification: string;
    category: string;
    impact: string;
    remediation: string;
    location: { file: string; line: number } | null;
    references: string[];
  }>;
  limitations: string[];
}

function clean(value: string, max = 4000): string {
  return redactText(stripControlChars(value))
    .replace(
      /(?<![\w:])\/(?:Users|home|root|private|var|tmp|opt|etc|srv|mnt|workspace|app)\/[^\s"'<>]+/gi,
      '<local-path>',
    )
    .replace(/\b[A-Za-z]:\\[^\s"'<>]+/g, '<local-path>')
    .trim()
    .slice(0, max);
}

function relativeFile(file: string | undefined, rootDir: string): string | null {
  if (!file || file.includes('\u0000')) return null;
  const normalized = file.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    const relative = path.relative(rootDir, path.resolve(rootDir, file)).replaceAll('\\', '/');
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return relative.slice(0, 500);
  }
  return normalized.replace(/^\.\//, '').slice(0, 500);
}

function safeReference(reference: string): string | null {
  try {
    const url = new URL(reference);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    if (
      [...url.searchParams.keys()].some((key) =>
        /(?:token|key|secret|password|passwd|auth|sig|signature|session)/i.test(key),
      )
    ) {
      return null;
    }
    const cleaned = url.toString();
    return cleaned.length <= 500 ? cleaned : null;
  } catch {
    return null;
  }
}

export function buildCloudPayload(
  report: ScanReport,
  repositoryId: string,
  rootDir: string,
  git: { commitSha: string | null; branch: string | null },
): CloudScanPayload {
  const checks = report.checks.slice(0, 300).map((check) => ({
    id: clean(check.id, 160),
    title: clean(check.title, 300),
    status: check.status,
    summary: clean(check.summary, 2000),
    details: check.details
      ? clean(check.details, 4000)
      : check.error
        ? clean(check.error, 4000)
        : null,
  }));

  const findings = report.findings.slice(0, 2000).map((finding, index) => {
    const file = relativeFile(finding.location?.file, rootDir);
    return {
      id: clean(finding.id || `FND-${index + 1}`, 120),
      checkId: clean(finding.checkId, 160),
      title: clean(finding.title, 500),
      description: clean(finding.description, 4000),
      severity: finding.severity,
      confidence: finding.confidence,
      verification: finding.verification,
      category: clean(finding.category, 80),
      impact: clean(finding.impact, 2000),
      remediation: clean(finding.remediation, 4000),
      location:
        file && finding.location?.line
          ? { file, line: finding.location.line }
          : file
            ? { file, line: 1 }
            : null,
      references: (finding.references ?? [])
        .map(safeReference)
        .filter((reference): reference is string => reference !== null)
        .slice(0, 10),
    };
  });

  const status =
    report.summary.byStatus.error > 0
      ? 'partial'
      : report.summary.gatePassed
        ? 'completed'
        : 'completed';

  return {
    formatVersion: 1,
    clientScanId: clean(report.meta.id, 120),
    repositoryId,
    scannerVersion: clean(report.meta.toolVersion, 60),
    commitSha: git.commitSha ? clean(git.commitSha, 80) : null,
    branch: git.branch ? clean(git.branch, 200) : null,
    startedAt: report.meta.startedAt,
    completedAt: report.meta.finishedAt,
    status,
    summary: {
      totalChecks: report.summary.totalChecks,
      byStatus: report.summary.byStatus,
      bySeverity: report.summary.bySeverity,
      totalFindings: report.summary.totalFindings,
      failOn: report.summary.failOn,
      gatePassed: report.summary.gatePassed,
      gateReasons: report.summary.gateReasons.map((reason) => clean(reason, 500)),
    },
    checks,
    findings,
    limitations: report.limitations.map((item) => clean(item, 500)),
  };
}

export function payloadPreview(payload: CloudScanPayload): string[] {
  return [
    `Repository ID: ${payload.repositoryId}`,
    `Scan ID: ${payload.clientScanId}`,
    `Commit: ${payload.commitSha ?? 'not detected'} / Branch: ${payload.branch ?? 'not detected'}`,
    `Checks: ${payload.checks.length} / Findings: ${payload.findings.length}`,
    `Severities: ${Object.entries(payload.summary.bySeverity)
      .map(([severity, count]) => `${severity}=${count}`)
      .join(', ')}`,
  ];
}
