import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDefaultConfig, type LaunchProofConfig } from '../src/config/schema.js';
import { runScan } from '../src/scan.js';
import type { ScanReport } from '../src/types.js';
import { PROJECT_ROOT, startDemo, type DemoServer } from '../../../tests/helpers/demo.js';

function baseConfig(url: string): LaunchProofConfig {
  const config = createDefaultConfig();
  config.scan.network = true;
  config.scan.failOn = 'high';
  config.app.url = url;
  config.api.baseUrl = url;
  config.auth.identities = {
    owner: { headersEnv: { 'x-user-id': 'LP_TEST_OWNER_ID' } },
    other: { headersEnv: { 'x-user-id': 'LP_TEST_OTHER_ID' } },
  };
  return config;
}

describe('vulnerable demo end-to-end scan', () => {
  let demo: DemoServer;
  let report: ScanReport;

  beforeAll(async () => {
    process.env.LP_TEST_OWNER_ID = '1';
    process.env.LP_TEST_OTHER_ID = '2';
    demo = await startDemo('vulnerable-demo');
    const config = baseConfig(demo.url);
    config.api.endpoints = [
      {
        name: 'Health',
        path: '/api/health',
        method: 'GET',
        expectStatus: 200,
        expectJson: true,
        requiredJsonKeys: ['status'],
        identity: undefined,
        requiresAuth: false,
        body: undefined,
      },
      {
        name: 'User list',
        path: '/api/users',
        method: 'GET',
        expectStatus: 200,
        expectJson: true,
        requiredJsonKeys: ['users'],
        identity: undefined,
        requiresAuth: true,
        body: undefined,
      },
    ];
    config.authorizationTests.resources = [
      {
        name: 'User 2 profile',
        path: '/api/users/2',
        method: 'GET',
        ownerIdentity: 'owner',
        otherIdentity: 'other',
        expectStatusForOther: [401, 403, 404],
        allowUnsafeMethod: false,
        body: undefined,
      },
    ];
    report = await runScan({
      rootDir: path.join(PROJECT_ROOT, 'examples', 'vulnerable-demo'),
      config,
      target: demo.url,
      components: ['discovery', 'static', 'http', 'api', 'authorization'],
    });
  }, 45_000);

  afterAll(async () => {
    await demo?.stop();
  });

  it('finds the exposed environment and git metadata files', () => {
    const exposure = report.checks.find((check) => check.id === 'http.exposure');
    expect(exposure?.status).toBe('fail');
    const titles = exposure?.findings.map((finding) => finding.title).join(' ') ?? '';
    expect(titles).toMatch(/Environment file/i);
    expect(titles).toMatch(/Git configuration/i);
  });

  it('finds wildcard CORS with credentials', () => {
    const cors = report.checks.find((check) => check.id === 'http.cors');
    expect(cors?.status).toBe('fail');
    expect(cors?.findings.some((finding) => finding.severity === 'high')).toBe(true);
  });

  it('detects an API that serves data without authentication', () => {
    const api = report.checks.find((check) => check.id === 'api.contracts');
    expect(api?.findings.some((finding) => /unauthenticated/i.test(finding.title))).toBe(true);
  });

  it('detects broken object-level authorization', () => {
    const auth = report.checks.find((check) => check.id === 'authorization.objects');
    expect(auth?.status).toBe('fail');
    expect(auth?.findings[0]?.title).toMatch(/broken object-level authorization/i);
  });

  it('does not leak served values into the report', () => {
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('placeholder-database-url');
    expect(serialized).not.toContain('placeholder-stripe-key');
    expect(serialized).not.toContain('placeholder-session-secret');
  });

  it('fails the release gate', () => {
    expect(report.summary.gatePassed).toBe(false);
    expect(report.summary.bySeverity.critical).toBeGreaterThanOrEqual(2);
  });
});

describe('secure demo end-to-end scan', () => {
  let demo: DemoServer;
  let report: ScanReport;

  beforeAll(async () => {
    process.env.LP_TEST_OWNER_ID = '1';
    process.env.LP_TEST_OTHER_ID = '2';
    demo = await startDemo('secure-demo');
    const config = baseConfig(demo.url);
    config.api.endpoints = [
      {
        name: 'Health',
        path: '/api/health',
        method: 'GET',
        expectStatus: 200,
        expectJson: true,
        requiredJsonKeys: ['status'],
        identity: undefined,
        requiresAuth: false,
        body: undefined,
      },
      {
        name: 'User list',
        path: '/api/users',
        method: 'GET',
        expectStatus: 200,
        expectJson: true,
        requiredJsonKeys: ['users'],
        identity: 'owner',
        requiresAuth: true,
        body: undefined,
      },
    ];
    config.authorizationTests.resources = [
      {
        name: 'Own profile',
        path: '/api/users/1',
        method: 'GET',
        ownerIdentity: 'owner',
        otherIdentity: 'other',
        expectStatusForOther: [401, 403, 404],
        allowUnsafeMethod: false,
        body: undefined,
      },
    ];
    report = await runScan({
      rootDir: path.join(PROJECT_ROOT, 'examples', 'secure-demo'),
      config,
      target: demo.url,
      components: ['discovery', 'http', 'api', 'authorization'],
    });
  }, 45_000);

  afterAll(async () => {
    await demo?.stop();
  });

  it('passes the HTTP, API, and authorization checks', () => {
    const relevant = report.checks.filter((check) =>
      ['http', 'api', 'authorization'].includes(check.category),
    );
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.filter((check) => check.status === 'fail')).toHaveLength(0);
    expect(relevant.filter((check) => check.status === 'error')).toHaveLength(0);
  });

  it('passes the configured release gate', () => {
    expect(report.summary.gatePassed).toBe(true);
  });
});
