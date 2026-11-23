export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ReportEvidence {
  kind: string;
  label: string;
  value: string;
  redacted?: boolean;
}

export interface ReportFinding {
  id: string;
  checkId: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: string;
  verification: string;
  category: string;
  impact: string;
  remediation: string;
  evidence: ReportEvidence[];
  location?: { file?: string; url?: string; line?: number; column?: number };
  references?: string[];
}

export interface ReportCheck {
  id: string;
  title: string;
  category: string;
  status: string;
  summary: string;
  findings: ReportFinding[];
  evidence: ReportEvidence[];
  durationMs: number;
  details?: string;
  error?: string;
}

export interface SampleReport {
  meta: {
    id: string;
    toolVersion: string;
    startedAt: string;
    durationMs: number;
    projectName: string;
    target: string | null;
    mode: string;
    runtime: { node: string; platform: string; arch: string };
  };
  summary: {
    totalChecks: number;
    totalFindings: number;
    failOn: string;
    gatePassed: boolean;
    gateReasons: string[];
    byStatus: Record<string, number>;
    bySeverity: Record<Severity, number>;
  };
  project: {
    name: string;
    frameworks: string[];
    languages: Array<{ name: string; files: number }>;
    packageManager: string;
    filesScanned: number;
    apiRoutes: Array<{ method: string; path: string; framework: string }>;
    testFrameworks: string[];
    deployment: string[];
  } | null;
  checks: ReportCheck[];
  findings: ReportFinding[];
  limitations: string[];
  configuration: {
    networkEnabled: boolean;
    failOn: string;
    api: { endpointCount: number };
    browser: { enabled: boolean; workflows: number };
    accessibility: { enabled: boolean; tags: string[] };
    performance: { enabled: boolean };
  };
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
