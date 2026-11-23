import type { ScanReport } from '@launchproof/core';
import { describe, expect, it } from 'vitest';

import { buildCloudPayload } from '../../cli/src/cloud/payload.js';
import { cloudScanSchema, normalizeCloudScan, safeRelativePath } from '@/lib/cloud-scan';

const REPO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function serverPayload() {
  return {
    formatVersion: 1 as const,
    clientScanId: 'scan-1',
    repositoryId: REPO_ID,
    scannerVersion: '0.1.0',
    commitSha: 'abcdef1234567',
    branch: 'main',
    startedAt: '2026-11-23T10:00:00.000Z',
    completedAt: '2026-11-23T10:01:00.000Z',
    status: 'completed' as const,
    summary: {
      totalChecks: 1,
      byStatus: { pass: 0, fail: 1, warn: 0, skipped: 0, 'not-verified': 0, error: 1 },
      bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      totalFindings: 1,
      failOn: 'high' as const,
      gatePassed: false,
      gateReasons: ['High finding present.'],
    },
    checks: [
      {
        id: 'http.headers',
        title: 'HTTP headers',
        status: 'fail' as const,
        summary: 'Missing header',
        details: null,
      },
    ],
    findings: [
      {
        id: 'F-1',
        checkId: 'http.headers',
        title: 'Exposed credential',
        description: 'api_key = sk_live_1234567890abcdef at /Users/alice/project/.env',
        severity: 'high' as const,
        confidence: 'high' as const,
        verification: 'observed' as const,
        category: 'secret',
        impact: 'Leak',
        remediation: 'Rotate the key.',
        location: { file: '/Users/alice/project/src/app.ts', line: 12 },
        references: ['https://example.com/security'],
      },
    ],
    limitations: [],
  };
}

describe('cloud scan payload sanitization', () => {
  it('rejects client-supplied ownership and unknown fields', () => {
    const result = cloudScanSchema.safeParse({ ...serverPayload(), user_id: 'attacker' });
    expect(result.success).toBe(false);
  });

  it('normalizes secrets and absolute paths on the server', () => {
    const parsed = cloudScanSchema.parse(serverPayload());
    const normalized = normalizeCloudScan(parsed);
    const finding = normalized.findings[0];
    expect(finding?.relative_file_path).toBeNull();
    expect(finding?.description).toContain('[REDACTED]');
    expect(finding?.description).not.toContain('sk_live_');
    expect(finding?.description).not.toContain('/Users/');
    expect(JSON.stringify(normalized)).not.toContain('/Users/alice');
  });

  it('only permits safe relative finding paths', () => {
    expect(safeRelativePath('src/app.ts')).toBe('src/app.ts');
    expect(safeRelativePath('./src/app.ts')).toBe('src/app.ts');
    expect(safeRelativePath('../outside.ts')).toBeNull();
    expect(safeRelativePath('/etc/passwd')).toBeNull();
    expect(safeRelativePath('C:\\Users\\alice\\app.ts')).toBeNull();
  });

  it('fails the gate when a finding meets the configured threshold', () => {
    const parsed = cloudScanSchema.parse(serverPayload());
    expect(normalizeCloudScan(parsed).scan.security_gate).toBe('failed');
  });

  it('does not let a payload claim a passing gate while reporting a blocking finding', () => {
    const payload = serverPayload();
    payload.summary.gatePassed = true;
    const parsed = cloudScanSchema.parse(payload);
    expect(normalizeCloudScan(parsed).scan.security_gate).toBe('failed');
  });
});

describe('CLI cloud payload', () => {
  it('relativizes in-repo files, drops out-of-repo files, and strips secret text', () => {
    const report = {
      meta: {
        id: 'scan-1',
        projectName: 'demo',
        toolVersion: '0.1.0',
        startedAt: '2026-11-23T10:00:00.000Z',
        finishedAt: '2026-11-23T10:01:00.000Z',
      },
      summary: {
        totalChecks: 1,
        byStatus: { pass: 0, fail: 1, warn: 0, skipped: 0, 'not-verified': 0, error: 0 },
        bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        totalFindings: 2,
        failOn: 'high',
        gatePassed: false,
        gateReasons: ['api_key = sk_live_1234567890abcdef'],
      },
      checks: [
        {
          id: 'secret',
          title: 'Secrets',
          status: 'fail',
          summary: 'A key was found',
          details: null,
          findings: [],
          evidence: [],
        },
      ],
      findings: [
        {
          id: 'F-1',
          checkId: 'secret',
          title: 'Key',
          description: 'api_key = sk_live_1234567890abcdef',
          severity: 'high',
          confidence: 'high',
          verification: 'observed',
          category: 'secret',
          impact: 'Leak',
          remediation: 'Rotate.',
          location: { file: '/Users/alice/project/src/app.ts', line: 12 },
          references: [
            'https://example.com',
            'javascript:alert(1)',
            'https://user:pass@example.com/private',
            'https://example.com/docs?token=abc123',
          ],
          evidence: [],
        },
        {
          id: 'F-2',
          checkId: 'secret',
          title: 'Outside file',
          description: 'Outside the project.',
          severity: 'low',
          confidence: 'high',
          verification: 'observed',
          category: 'secret',
          impact: 'Leak',
          remediation: 'Rotate.',
          location: { file: '/Users/alice/.ssh/id_rsa', line: 1 },
          references: [],
          evidence: [],
        },
      ],
      limitations: [],
      configuration: {},
      project: null,
    } as unknown as ScanReport;

    const payload = buildCloudPayload(report, REPO_ID, '/Users/alice/project', {
      commitSha: 'abcdef1234567',
      branch: 'main',
    });

    expect(payload.findings[0]?.location).toEqual({ file: 'src/app.ts', line: 12 });
    expect(payload.findings[1]?.location).toBeNull();
    expect(payload.findings[0]?.references).toEqual(['https://example.com/']);
    expect(payload.summary.gateReasons[0]).toContain('REDACTED');
    expect(JSON.stringify(payload)).not.toContain('/Users/alice');
    expect(JSON.stringify(payload)).not.toContain('sk_live_');
  });
});
