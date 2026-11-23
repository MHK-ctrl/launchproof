import { PROJECT_URL, VERSION } from '../version.js';
import type { ScanReport, Severity } from '../types.js';

const LEVEL: Record<Severity, 'note' | 'warning' | 'error'> = {
  info: 'note',
  low: 'note',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri?: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription: { text: string };
          help: { text: string; markdown: string };
          defaultConfiguration: { level: 'note' | 'warning' | 'error' };
          properties: { securitySeverity: string; category: string };
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      ruleIndex: number;
      level: 'note' | 'warning' | 'error';
      message: { text: string };
      locations?: Array<{
        physicalLocation?: {
          artifactLocation: { uri: string };
          region?: { startLine: number; startColumn?: number };
        };
        logicalLocations?: Array<{ fullyQualifiedName: string }>;
      }>;
      properties: {
        severity: Severity;
        confidence: string;
        verification: string;
        [key: string]: unknown;
      };
    }>;
  }>;
}

/** Converts a scan report into SARIF 2.1.0 for GitHub code scanning or generic SARIF consumers. */
export function renderSarif(report: ScanReport): string {
  const ruleIndex = new Map<string, number>();
  const rules: SarifLog['runs'][number]['tool']['driver']['rules'] = [];

  for (const finding of report.findings) {
    if (ruleIndex.has(finding.checkId)) continue;
    ruleIndex.set(finding.checkId, rules.length);
    rules.push({
      id: finding.checkId,
      name: finding.checkId.replaceAll('.', '-'),
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.description },
      help: {
        text: `${finding.impact}\n\nRemediation: ${finding.remediation}`,
        markdown: `**Impact**\n\n${finding.impact}\n\n**Remediation**\n\n${finding.remediation}`,
      },
      defaultConfiguration: { level: LEVEL[finding.severity] },
      properties: { securitySeverity: finding.severity, category: finding.category },
    });
  }

  const results: SarifLog['runs'][number]['results'] = report.findings.map((finding) => {
    const index = ruleIndex.get(finding.checkId) ?? 0;
    const uri = finding.location?.file
      ? finding.location.file
      : finding.location?.url
        ? finding.location.url
        : (report.meta.target ?? 'launchproof-report');
    const result: SarifLog['runs'][number]['results'][number] = {
      ruleId: finding.checkId,
      ruleIndex: index,
      level: LEVEL[finding.severity],
      message: {
        text: `${finding.title}. ${finding.description} (${finding.verification}, ${finding.confidence} confidence)`,
      },
      properties: {
        severity: finding.severity,
        confidence: finding.confidence,
        verification: finding.verification,
        ...(finding.evidence.length > 0
          ? {
              evidence: finding.evidence.map((item) => `${item.label}: ${item.value}`),
            }
          : {}),
      },
    };
    if (finding.location?.url) {
      result.locations = [
        { logicalLocations: [{ fullyQualifiedName: finding.location.url }] },
        {
          physicalLocation: {
            artifactLocation: { uri },
            ...(finding.location.line ? { region: { startLine: finding.location.line } } : {}),
          },
        },
      ];
    } else {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri },
            ...(finding.location?.line ? { region: { startLine: finding.location.line } } : {}),
          },
        },
      ];
    }
    return result;
  });

  const log: SarifLog = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'LaunchProof',
            version: VERSION,
            informationUri: PROJECT_URL,
            rules,
          },
        },
        results,
      },
    ],
  };
  return JSON.stringify(log, null, 2);
}
