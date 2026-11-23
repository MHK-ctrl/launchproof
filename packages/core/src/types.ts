export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const RESULT_STATUSES = [
  'pass',
  'fail',
  'warn',
  'skipped',
  'not-verified',
  'error',
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const CATEGORIES = [
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
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * How a finding was established:
 * - observed: directly observed from the target or filesystem
 * - pattern: matched a known risky code/config pattern
 * - inferred: derived from configuration or metadata, needs review
 */
export type Verification = 'observed' | 'pattern' | 'inferred';

export type EvidenceKind =
  'text' | 'http' | 'header' | 'json' | 'file' | 'screenshot' | 'metric' | 'sql' | 'log';

export interface Evidence {
  kind: EvidenceKind;
  label: string;
  value: string;
  /** True when the value was masked before being placed in the report. */
  redacted?: boolean;
}

export interface FindingLocation {
  file?: string;
  line?: number;
  column?: number;
  url?: string;
}

export interface Finding {
  id: string;
  checkId: string;
  title: string;
  description: string;
  severity: Severity;
  confidence: Confidence;
  verification: Verification;
  category: Category;
  impact: string;
  remediation: string;
  evidence: Evidence[];
  location?: FindingLocation;
  references?: string[];
}

export interface CheckResult {
  id: string;
  title: string;
  category: Category;
  status: ResultStatus;
  summary: string;
  findings: Finding[];
  evidence: Evidence[];
  durationMs: number;
  details?: string;
  error?: string;
}

export interface ApiRouteInfo {
  file: string;
  method: string;
  path: string;
  framework: string;
}

export interface ProjectProfile {
  name: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
  monorepo: boolean;
  frameworks: string[];
  languages: Array<{ name: string; files: number }>;
  scripts: Record<string, string>;
  dependencies: {
    direct: number;
    dev: number;
    notable: string[];
  };
  apiRoutes: ApiRouteInfo[];
  testFrameworks: string[];
  deployment: string[];
  integrations: string[];
  envVars: string[];
  filesScanned: number;
  truncated: boolean;
  ignoredLargeFiles: number;
}

export interface Summary {
  totalChecks: number;
  byStatus: Record<ResultStatus, number>;
  bySeverity: Record<Severity, number>;
  totalFindings: number;
  failOn: Severity;
  gatePassed: boolean;
  gateReasons: string[];
}

export interface ScanRuntime {
  node: string;
  platform: string;
  arch: string;
}

export type ScanMode = 'local' | 'remote' | 'static';

export interface ScanMeta {
  schemaVersion: 1;
  id: string;
  toolVersion: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  projectName: string;
  target: string | null;
  mode: ScanMode;
  runtime: ScanRuntime;
}

export interface SafeConfigSummary {
  target: string | null;
  mode: ScanMode;
  failOn: Severity;
  networkEnabled: boolean;
  fileScan: {
    include: string[];
    excludeCount: number;
    gitHistory: boolean;
    maxFiles: number;
  };
  api: {
    baseUrl: string | null;
    endpointCount: number;
    openapi: string | null;
    unsafeMethods: boolean;
  };
  authIdentities: string[];
  authorizationResources: number;
  browser: {
    enabled: boolean;
    workflows: number;
    baseUrl: string | null;
  };
  accessibility: {
    enabled: boolean;
    tags: string[];
  };
  performance: {
    enabled: boolean;
    lighthouse: boolean;
  };
  supabase: {
    staticAnalysis: boolean;
    liveConfigured: boolean;
  };
}

export interface ScanReport {
  meta: ScanMeta;
  summary: Summary;
  project: ProjectProfile | null;
  checks: CheckResult[];
  findings: Finding[];
  limitations: string[];
  configuration: SafeConfigSummary;
}

export type ReportFormat = 'json' | 'html' | 'sarif' | 'terminal';

export interface ScanArtifacts {
  jsonPath: string;
  htmlPath: string | null;
  sarifPath: string | null;
}
