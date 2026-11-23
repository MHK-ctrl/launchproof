import { z } from 'zod';

import type { Json } from '@/lib/database.types';

export const MAX_FINDINGS = 2000;
export const MAX_CHECKS = 300;

const statusSchema = z.enum(['pass', 'fail', 'warn', 'skipped', 'not-verified', 'error']);
const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const confidenceSchema = z.enum(['high', 'medium', 'low']);
const verificationSchema = z.enum(['observed', 'pattern', 'inferred']);

const text = (max: number) => z.string().max(max);
const count = z.number().int().min(0).max(1_000_000);

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected an ISO timestamp.',
});

const referenceSchema = z
  .string()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        !url.username &&
        !url.password &&
        ![...url.searchParams.keys()].some((key) =>
          /(?:token|key|secret|password|passwd|auth|sig|signature|session)/i.test(key),
        )
      );
    } catch {
      return false;
    }
  }, 'References must use http or https.');

export const cloudScanSchema = z
  .object({
    formatVersion: z.literal(1),
    clientScanId: z.string().min(3).max(120),
    repositoryId: z.string().uuid(),
    scannerVersion: z.string().min(1).max(60),
    commitSha: z.string().max(80).nullable().optional(),
    branch: z.string().max(200).nullable().optional(),
    startedAt: timestamp.nullable().optional(),
    completedAt: timestamp.nullable().optional(),
    status: z.enum(['completed', 'partial', 'failed']).default('completed'),
    summary: z
      .object({
        totalChecks: count,
        byStatus: z
          .object({
            pass: count,
            fail: count,
            warn: count,
            skipped: count,
            'not-verified': count,
            error: count,
          })
          .strict(),
        bySeverity: z
          .object({
            critical: count,
            high: count,
            medium: count,
            low: count,
            info: count,
          })
          .strict(),
        totalFindings: count,
        failOn: severitySchema,
        gatePassed: z.boolean(),
        gateReasons: z.array(text(500)).max(50),
      })
      .strict(),
    checks: z
      .array(
        z
          .object({
            id: text(160),
            title: text(300),
            status: statusSchema,
            summary: text(2000),
            details: text(4000).nullable().optional(),
          })
          .strict(),
      )
      .max(MAX_CHECKS),
    findings: z
      .array(
        z
          .object({
            id: text(120),
            checkId: text(160),
            title: text(500),
            description: text(4000),
            severity: severitySchema,
            confidence: confidenceSchema,
            verification: verificationSchema,
            category: text(80),
            impact: text(2000),
            remediation: text(4000),
            location: z
              .object({
                file: text(500).nullable().optional(),
                line: z.number().int().min(1).max(10_000_000).nullable().optional(),
              })
              .strict()
              .nullable()
              .optional(),
            references: z.array(referenceSchema).max(10).optional(),
          })
          .strict(),
      )
      .max(MAX_FINDINGS),
    limitations: z.array(text(500)).max(50),
  })
  .strict();

export type CloudScanPayload = z.infer<typeof cloudScanSchema>;
export type CloudScanFinding = CloudScanPayload['findings'][number];

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*:\s*(?:bearer|basic|token)\s+)[^\s"',;}]+/gi, '$1[REDACTED]'],
  [
    /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|service[_-]?role[_-]?key)\s*[:=]\s*["']?)[^"'\s,}]{8,}/gi,
    '$1[REDACTED]',
  ],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED]'],
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, '[REDACTED]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED]'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, '[REDACTED]'],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, '[REDACTED]'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED]'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '[REDACTED]'],
];

export function sanitizeCloudText(value: string, maxLength = 4000): string {
  let output = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  output = output
    .replace(
      /(?<![\w:])\/(?:Users|home|root|private|var|tmp|opt|etc|srv|mnt|workspace|app)\/[^\s"'<>]+/gi,
      '<local-path>',
    )
    .replace(/\b[A-Za-z]:\\[^\s"'<>]+/g, '<local-path>')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
  return output.slice(0, maxLength);
}

export function safeRelativePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replaceAll('\\', '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..') ||
    normalized.includes('\u0000')
  ) {
    return null;
  }
  const clean = normalized.replace(/^\.\//, '');
  return clean.length > 0 ? clean.slice(0, 500) : null;
}

export function gateFromSummary(
  summary: CloudScanPayload['summary'],
): 'passed' | 'failed' | 'not-verified' {
  const rank: Record<CloudScanPayload['summary']['failOn'], number> = {
    info: 1,
    low: 2,
    medium: 3,
    high: 4,
    critical: 5,
  };
  const threshold = rank[summary.failOn];
  const blocking = (Object.keys(rank) as Array<keyof typeof rank>).some(
    (severity) => rank[severity] >= threshold && summary.bySeverity[severity] > 0,
  );
  if (blocking || summary.byStatus.error > 0) return 'failed';
  return summary.gatePassed ? 'passed' : 'not-verified';
}

export interface NormalizedFinding {
  finding_key: string;
  rule_id: string;
  severity: CloudScanFinding['severity'];
  title: string;
  description: string;
  category: string | null;
  remediation: string | null;
  relative_file_path: string | null;
  line_number: number | null;
}

export function normalizeCloudScan(payload: CloudScanPayload): {
  scan: {
    client_scan_id: string;
    scan_status: 'completed' | 'partial' | 'failed';
    security_gate: 'passed' | 'failed' | 'not-verified';
    scanner_version: string;
    commit_sha: string | null;
    branch: string | null;
    started_at: string | null;
    completed_at: string | null;
    total_checks: number;
    pass_count: number;
    fail_count: number;
    warning_count: number;
    skipped_count: number;
    not_verified_count: number;
    error_count: number;
    total_findings: number;
    severity_counts: Json;
    summary: Json;
    checks: Json;
    limitations: Json;
  };
  findings: NormalizedFinding[];
} {
  const seen = new Set<string>();
  const findings = payload.findings.map((finding, index) => {
    let key = sanitizeCloudText(finding.id, 120) || `FND-${index + 1}`;
    if (seen.has(key)) key = `${key}-${index + 1}`;
    seen.add(key);
    return {
      finding_key: key,
      rule_id: sanitizeCloudText(finding.checkId, 160),
      severity: finding.severity,
      title: sanitizeCloudText(finding.title, 500),
      description: sanitizeCloudText(finding.description, 4000),
      category: sanitizeCloudText(finding.category, 80) || null,
      remediation: sanitizeCloudText(finding.remediation, 4000) || null,
      relative_file_path: safeRelativePath(finding.location?.file),
      line_number: finding.location?.line ?? null,
    };
  });

  const checks = payload.checks.map((check) => ({
    id: sanitizeCloudText(check.id, 160),
    title: sanitizeCloudText(check.title, 300),
    status: check.status,
    summary: sanitizeCloudText(check.summary, 2000),
    details: check.details ? sanitizeCloudText(check.details, 4000) : null,
  }));

  const scanStatus =
    payload.status === 'failed' || payload.status === 'partial'
      ? payload.status
      : payload.summary.byStatus.error > 0
        ? 'partial'
        : 'completed';

  return {
    scan: {
      client_scan_id: sanitizeCloudText(payload.clientScanId, 120),
      scan_status: scanStatus,
      security_gate: gateFromSummary(payload.summary),
      scanner_version: sanitizeCloudText(payload.scannerVersion, 60),
      commit_sha: payload.commitSha ? sanitizeCloudText(payload.commitSha, 80) : null,
      branch: payload.branch ? sanitizeCloudText(payload.branch, 200) : null,
      started_at: payload.startedAt ?? null,
      completed_at: payload.completedAt ?? null,
      total_checks: payload.summary.totalChecks,
      pass_count: payload.summary.byStatus.pass,
      fail_count: payload.summary.byStatus.fail,
      warning_count: payload.summary.byStatus.warn,
      skipped_count: payload.summary.byStatus.skipped,
      not_verified_count: payload.summary.byStatus['not-verified'],
      error_count: payload.summary.byStatus.error,
      total_findings: payload.summary.totalFindings,
      severity_counts: payload.summary.bySeverity,
      summary: {
        ...payload.summary,
        gateReasons: payload.summary.gateReasons.map((reason) => sanitizeCloudText(reason, 500)),
      } as Json,
      checks: checks as Json,
      limitations: payload.limitations.map((item) => sanitizeCloudText(item, 500)) as Json,
    },
    findings,
  };
}
