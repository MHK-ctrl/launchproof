import { describe, expect, it } from 'vitest';

import { createCheck, createFinding } from '../src/checks.js';
import { renderHtml } from '../src/report/html.js';
import { renderSarif } from '../src/report/sarif.js';
import { renderTerminal } from '../src/report/terminal.js';
import type { ScanReport } from '../src/types.js';

function sampleReport(): ScanReport {
  const finding = createFinding({
    checkId: 'security.static',
    title: 'Unsafe <script> pattern',
    description: 'A description with <b>markup</b> that must be escaped.',
    severity: 'high',
    category: 'security',
    impact: 'Impact text',
    remediation: 'Fix "this" & that.',
    evidence: [{ kind: 'text', label: 'Line', value: '<script>alert(1)</script>' }],
    location: { file: 'src/app.ts', line: 12 },
    key: 'test',
  });
  const check = createCheck({
    id: 'security.static',
    title: 'Static security review',
    category: 'security',
    status: 'fail',
    summary: 'One finding',
    findings: [finding],
  });
  return {
    meta: {
      schemaVersion: 1,
      id: 'LP-TEST',
      toolVersion: '0.1.0',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      durationMs: 1000,
      projectName: 'test-app',
      target: 'http://127.0.0.1:3000',
      mode: 'local',
      runtime: { node: 'v22.0.0', platform: 'darwin', arch: 'arm64' },
    },
    summary: {
      totalChecks: 1,
      byStatus: { pass: 0, fail: 1, warn: 0, skipped: 0, 'not-verified': 0, error: 0 },
      bySeverity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      totalFindings: 1,
      failOn: 'high',
      gatePassed: false,
      gateReasons: ['1 finding at or above high'],
    },
    project: null,
    checks: [check],
    findings: [finding],
    limitations: ['Not exhaustive.'],
    configuration: {
      target: 'http://127.0.0.1:3000',
      mode: 'local',
      failOn: 'high',
      networkEnabled: true,
      fileScan: { include: [], excludeCount: 0, gitHistory: false, maxFiles: 8000 },
      api: { baseUrl: null, endpointCount: 0, openapi: null, unsafeMethods: false },
      authIdentities: [],
      authorizationResources: 0,
      browser: { enabled: false, workflows: 0, baseUrl: null },
      accessibility: { enabled: false, tags: [] },
      performance: { enabled: false, lighthouse: false },
      supabase: { staticAnalysis: false, liveConfigured: false },
    },
  };
}

describe('report renderers', () => {
  it('renders self-contained HTML with escaped finding content', () => {
    const html = renderHtml(sampleReport());
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('test-app');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('id="search"');
    expect(html).not.toMatch(/https:\/\/fonts\./);
  });

  it('renders valid SARIF 2.1.0 with one result', () => {
    const sarif = JSON.parse(renderSarif(sampleReport())) as {
      version: string;
      runs: Array<{ results: unknown[] }>;
    };
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.results).toHaveLength(1);
  });

  it('renders a terminal report without ANSI when color is disabled', () => {
    const output = renderTerminal(sampleReport(), { color: false });
    expect(output).toContain('FAIL');
    expect(output).toContain('Unsafe <script> pattern');
    expect(output).not.toContain('\u001b[');
  });

  it('states assessment scope, date, tool version, and authorization', () => {
    const html = renderHtml(sampleReport());
    expect(html).toContain('Assessment scope and authorization');
    expect(html).toContain('2026-01-01 00:00:00 UTC');
    expect(html).toContain('LaunchProof v');
    expect(html).toContain('http://127.0.0.1:3000');
    expect(html).toContain('written authorization exists to test');
  });

  it('does not imply the tool verified authorization or performed a penetration test', () => {
    const html = renderHtml(sampleReport());
    expect(html).toContain('does not verify that authorization');
    expect(html).toContain('not a penetration test');
  });

  it('states that no live target was tested when the scan was local', () => {
    const report = sampleReport();
    report.meta.target = null;
    const html = renderHtml(report);
    expect(html).toContain('No live target was tested');
    expect(html).not.toContain('written authorization exists to test');
  });

  it('escapes the target in the scope section', () => {
    const report = sampleReport();
    report.meta.target = 'http://127.0.0.1:3000/<script>alert(1)</script>';
    const html = renderHtml(report);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralizes untrusted status, severity, and reference fields', () => {
    const report = sampleReport();
    (report.findings[0] as unknown as { severity: string }).severity =
      '<img src=x onerror=alert(1)>';
    (report.checks[0] as unknown as { status: string }).status = '<svg onload=alert(1)>';
    report.findings[0]!.references = ['javascript:alert(1)', 'https://example.com/ok'];
    const html = renderHtml(report);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="https://example.com/ok"');
    expect(html).toContain('sev-info');
  });
});
