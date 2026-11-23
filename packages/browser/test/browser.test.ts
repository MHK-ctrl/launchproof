import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDefaultConfig } from '@launchproof/core';

import { runBrowserChecks } from '../src/index.js';
import { startDemo, type DemoServer } from '../../../tests/helpers/demo.js';
import type { CheckResult } from '@launchproof/core';

function findCheck(checks: CheckResult[], id: string): CheckResult | undefined {
  return checks.find((check) => check.id === id);
}

describe('browser verification against the vulnerable demo', () => {
  let demo: DemoServer;
  let checks: CheckResult[];

  beforeAll(async () => {
    demo = await startDemo('vulnerable-demo');
    const config = createDefaultConfig();
    config.browser.timeoutMs = 15_000;
    config.browser.workflows = [
      {
        name: 'Login form',
        path: '/login',
        identity: undefined,
        steps: [
          {
            action: 'fill',
            selector: '#email',
            value: 'demo@example.test',
            valueEnv: undefined,
            secret: false,
          },
          {
            action: 'fill',
            selector: '#password',
            value: 'demo-password',
            valueEnv: undefined,
            secret: true,
          },
          { action: 'click', selector: '#submit' },
          { action: 'expectText', text: 'Signed in', selector: undefined },
        ],
        expectNoConsoleErrors: true,
      },
    ];
    config.accessibility.paths = ['/', '/login'];
    config.performance.paths = ['/'];
    checks = await runBrowserChecks({
      config,
      baseUrl: demo.url,
      workflows: true,
      links: true,
      mobile: true,
      accessibility: true,
      performance: true,
    });
  }, 90_000);

  afterAll(async () => {
    await demo?.stop();
  });

  it('loads the application without a hard failure', () => {
    expect(findCheck(checks, 'browser.page-load')?.status).toBe('pass');
  });

  it('executes the login workflow', () => {
    const workflow = findCheck(checks, 'browser.workflows');
    expect(workflow?.status).not.toBe('fail');
    expect(workflow?.findings.some((finding) => finding.severity === 'high')).toBe(false);
  });

  it('detects accessibility violations', () => {
    const accessibility = findCheck(checks, 'accessibility.axe');
    expect(accessibility?.status).not.toBe('not-verified');
    expect(accessibility?.findings.length).toBeGreaterThan(0);
  });

  it('detects the broken internal link and mobile overflow', () => {
    const links = findCheck(checks, 'browser.links');
    expect(links?.findings.some((finding) => finding.title.includes('/broken'))).toBe(true);
    const mobile = findCheck(checks, 'browser.mobile');
    expect(mobile?.findings.some((finding) => finding.title.includes('overflow'))).toBe(true);
  });

  it('measures performance rather than claiming it', () => {
    const performance = findCheck(checks, 'performance.metrics');
    expect(performance).toBeDefined();
    expect(performance?.status).not.toBe('not-verified');
    expect(performance?.evidence.length).toBeGreaterThan(0);
  });
});

describe('browser verification against the secure demo', () => {
  let demo: DemoServer;
  let checks: CheckResult[];

  beforeAll(async () => {
    demo = await startDemo('secure-demo');
    const config = createDefaultConfig();
    config.browser.timeoutMs = 15_000;
    config.browser.workflows = [
      {
        name: 'Login form',
        path: '/login',
        identity: undefined,
        steps: [
          {
            action: 'fill',
            selector: '#email',
            value: 'demo@example.test',
            valueEnv: undefined,
            secret: false,
          },
          {
            action: 'fill',
            selector: '#password',
            value: 'demo-password',
            valueEnv: undefined,
            secret: true,
          },
          { action: 'click', selector: '#submit' },
          { action: 'expectText', text: 'Signed in', selector: undefined },
        ],
        expectNoConsoleErrors: true,
      },
    ];
    config.accessibility.paths = ['/'];
    config.performance.paths = ['/'];
    checks = await runBrowserChecks({
      config,
      baseUrl: demo.url,
      workflows: true,
      links: false,
      mobile: true,
      accessibility: true,
      performance: true,
    });
  }, 90_000);

  afterAll(async () => {
    await demo?.stop();
  });

  it('passes the workflow and page load', () => {
    expect(findCheck(checks, 'browser.page-load')?.status).toBe('pass');
    expect(findCheck(checks, 'browser.workflows')?.status).toBe('pass');
  });

  it('finds no serious accessibility violations on the sampled page', () => {
    const accessibility = findCheck(checks, 'accessibility.axe');
    expect(accessibility?.status).not.toBe('not-verified');
    expect(
      accessibility?.findings.filter(
        (finding) => finding.severity === 'high' || finding.severity === 'critical',
      ) ?? [],
    ).toHaveLength(0);
  });
});
