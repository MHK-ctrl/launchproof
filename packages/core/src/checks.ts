import type {
  Category,
  CheckResult,
  Confidence,
  Evidence,
  Finding,
  FindingLocation,
  ResultStatus,
  Severity,
  Verification,
} from './types.js';
import { SEVERITY_RANK } from './types.js';
import { findingId, redactText } from './util.js';

export interface FindingInput {
  checkId: string;
  title: string;
  description: string;
  severity: Severity;
  category: Category;
  impact: string;
  remediation: string;
  confidence?: Confidence;
  verification?: Verification;
  evidence?: Evidence[];
  location?: FindingLocation;
  references?: string[];
  /** Stable key used to derive a deterministic finding id. */
  key?: string;
}

export function createFinding(input: FindingInput): Finding {
  const locationKey = input.location
    ? `${input.location.file ?? ''}:${input.location.line ?? ''}:${input.location.url ?? ''}`
    : '';
  const key = input.key ?? `${input.title}\u0000${locationKey}`;
  return {
    id: findingId(input.checkId, key),
    checkId: input.checkId,
    title: input.title,
    description: redactText(input.description),
    severity: input.severity,
    confidence: input.confidence ?? 'high',
    verification: input.verification ?? 'observed',
    category: input.category,
    impact: redactText(input.impact),
    remediation: redactText(input.remediation),
    evidence: (input.evidence ?? []).map((item) => ({
      ...item,
      value: item.redacted ? item.value : redactText(item.value),
    })),
    ...(input.location ? { location: input.location } : {}),
    ...(input.references ? { references: input.references } : {}),
  };
}

export interface CheckInput {
  id: string;
  title: string;
  category: Category;
  summary: string;
  status?: ResultStatus;
  findings?: Finding[];
  evidence?: Evidence[];
  details?: string;
  error?: string;
  durationMs?: number;
}

export function createCheck(input: CheckInput): CheckResult {
  const findings = input.findings ?? [];
  const status = input.status ?? (findings.length > 0 ? 'fail' : 'pass');
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    status,
    summary: redactText(input.summary),
    findings,
    evidence: (input.evidence ?? []).map((item) => ({
      ...item,
      value: item.redacted ? item.value : redactText(item.value),
    })),
    durationMs: input.durationMs ?? 0,
    ...(input.details ? { details: redactText(input.details) } : {}),
    ...(input.error ? { error: redactText(input.error) } : {}),
  };
}

export function highestSeverity(findings: Finding[]): Severity | null {
  let highest: Severity | null = null;
  for (const finding of findings) {
    if (!highest || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highest]) {
      highest = finding.severity;
    }
  }
  return highest;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severity !== 0) {
      return severity;
    }
    return a.title.localeCompare(b.title);
  });
}

export function sortChecks(checks: CheckResult[]): CheckResult[] {
  const categoryOrder: Category[] = [
    'discovery',
    'secrets',
    'security',
    'dependencies',
    'configuration',
    'http',
    'api',
    'authorization',
    'browser',
    'accessibility',
    'performance',
    'database',
  ];
  return [...checks].sort((a, b) => {
    const category = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return category !== 0 ? category : a.id.localeCompare(b.id);
  });
}

export function combineDuration(checks: CheckResult[]): number {
  return checks.reduce((total, check) => total + check.durationMs, 0);
}
