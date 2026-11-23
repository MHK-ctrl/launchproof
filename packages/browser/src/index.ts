import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  ScopeError,
  checkTargetScope,
  createCheck,
  createFinding,
  redactText,
  resolveIdentity,
  type CheckResult,
  type Evidence,
  type Finding,
  type LaunchProofConfig,
  type Severity,
} from '@launchproof/core';
import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserRunOptions {
  config: LaunchProofConfig;
  baseUrl: string;
  /** Directory for screenshots and traces. Defaults to none (no files written). */
  outputDir?: string;
  workflows?: boolean;
  links?: boolean;
  mobile?: boolean;
  accessibility?: boolean;
  performance?: boolean;
  onProgress?: (message: string) => void;
}

interface ConsoleIssue {
  type: 'console' | 'pageerror' | 'requestfailed';
  message: string;
}

interface AxeNodeResult {
  target?: unknown[];
  html?: string;
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact?: string | null;
  help: string;
  description: string;
  helpUrl: string;
  nodes: AxeNodeResult[];
}

interface AxeResults {
  violations: AxeViolation[];
  passes?: unknown[];
}

interface PageMetrics {
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  loadMs: number | null;
  domNodes: number;
  jsBytes: number;
  requests: number;
  transferBytes: number;
}

const AXE_IMPACT_SEVERITY: Record<string, Severity> = {
  critical: 'high',
  serious: 'medium',
  moderate: 'low',
  minor: 'info',
};

function normalizePath(pathValue: string): string {
  if (!pathValue.startsWith('/')) {
    return `/${pathValue}`;
  }
  return pathValue;
}

function resolveInScope(baseUrl: string, pathValue: string): URL {
  const base = new URL(baseUrl);
  let target: URL;
  try {
    target = new URL(pathValue, base);
  } catch {
    throw new Error(`Invalid browser path: ${pathValue}`);
  }
  if (target.origin !== base.origin) {
    throw new Error(`Refusing browser navigation outside ${base.origin}.`);
  }
  return target;
}

function assertPageInScope(page: Page, baseUrl: string): void {
  const base = new URL(baseUrl);
  const current = new URL(page.url());
  if (current.origin !== base.origin) {
    throw new Error(`Browser left the authorized origin ${base.origin}; refusing further actions.`);
  }
}

async function guardContext(
  context: BrowserContext,
  baseUrl: string,
  identityHeaderNames: string[] = [],
): Promise<void> {
  const origin = new URL(baseUrl).origin;
  const sensitive = new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    ...identityHeaderNames.map((name) => name.toLowerCase()),
  ]);
  await context.route('**/*', async (route) => {
    const request = route.request();
    let sameOrigin = false;
    try {
      sameOrigin = new URL(request.url()).origin === origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin && request.isNavigationRequest()) {
      await route.abort('blockedbyclient');
      return;
    }
    if (sameOrigin) {
      await route.continue();
      return;
    }
    // Browser identity headers are context-wide. Strip them from cross-origin
    // subresources (analytics, fonts, third-party APIs) instead of leaking them.
    const headers = { ...request.headers() };
    for (const key of Object.keys(headers)) {
      if (sensitive.has(key.toLowerCase())) {
        delete headers[key];
      }
    }
    await route.continue({ headers });
  });
}

function samplePaths(config: LaunchProofConfig, kind: 'accessibility' | 'performance'): string[] {
  const explicit = kind === 'accessibility' ? config.accessibility.paths : config.performance.paths;
  const workflowPaths = config.browser.workflows.map((workflow) => workflow.path);
  const candidates = explicit.length > 0 ? explicit : ['/', ...workflowPaths];
  const max =
    kind === 'accessibility' ? config.accessibility.maxPages : config.performance.maxPages;
  return [...new Set(candidates.map(normalizePath))].slice(0, max);
}

async function launchBrowser(): Promise<Browser> {
  const module = await import('playwright');
  return module.chromium.launch({ headless: true });
}

function collectIssues(page: Page): ConsoleIssue[] {
  const issues: ConsoleIssue[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({ type: 'console', message: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', message: error.message });
  });
  page.on('requestfailed', (request) => {
    issues.push({
      type: 'requestfailed',
      message: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`,
    });
  });
  return issues;
}

function issueFindings(issues: ConsoleIssue[], checkId: string, pagePath: string): Finding[] {
  const findings: Finding[] = [];
  const errors = issues.filter((issue) => issue.type === 'pageerror');
  const consoleErrors = issues.filter((issue) => issue.type === 'console');
  const failed = issues.filter(
    (issue) => issue.type === 'requestfailed' && !/favicon\.ico/i.test(issue.message),
  );
  for (const issue of errors.slice(0, 3)) {
    findings.push(
      createFinding({
        checkId,
        title: `Uncaught JavaScript error on ${pagePath}`,
        description: truncateMessage(issue.message),
        severity: 'medium',
        confidence: 'high',
        verification: 'observed',
        category: 'browser',
        impact: 'The page throws at runtime; interactive features may be broken for real users.',
        remediation:
          'Reproduce with the browser console open, fix the exception, and add a regression test.',
        evidence: [{ kind: 'log', label: 'Page error', value: truncateMessage(issue.message) }],
        location: { url: pagePath },
        key: `browser:pageerror:${pagePath}:${issue.message.slice(0, 80)}`,
      }),
    );
  }
  for (const issue of consoleErrors.slice(0, 3)) {
    findings.push(
      createFinding({
        checkId,
        title: `Console error on ${pagePath}`,
        description: truncateMessage(issue.message),
        severity: 'low',
        confidence: 'high',
        verification: 'observed',
        category: 'browser',
        impact: 'Console errors often precede broken user flows and indicate unhandled failures.',
        remediation: 'Fix the underlying error and keep the console clean for tested pages.',
        evidence: [{ kind: 'log', label: 'Console error', value: truncateMessage(issue.message) }],
        location: { url: pagePath },
        key: `browser:console:${pagePath}:${issue.message.slice(0, 80)}`,
      }),
    );
  }
  for (const issue of failed.slice(0, 3)) {
    findings.push(
      createFinding({
        checkId,
        title: `Failed network request on ${pagePath}`,
        description: truncateMessage(issue.message),
        severity: 'low',
        confidence: 'high',
        verification: 'observed',
        category: 'browser',
        impact: 'A required asset or API call failed, which can leave the page partially broken.',
        remediation:
          'Fix the failing request or remove the dependency; check status codes in the network panel.',
        evidence: [{ kind: 'log', label: 'Failed request', value: truncateMessage(issue.message) }],
        location: { url: pagePath },
        key: `browser:reqfail:${pagePath}:${issue.message.slice(0, 80)}`,
      }),
    );
  }
  return findings;
}

function truncateMessage(value: string, max = 300): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function contextOptions(config: LaunchProofConfig): Parameters<Browser['newContext']>[0] {
  return {
    viewport: {
      width: config.browser.viewport.width,
      height: config.browser.viewport.height,
    },
    ignoreHTTPSErrors: false,
    userAgent: 'LaunchProof/0.1 (browser verification)',
  };
}

async function createAuthenticatedContext(
  browser: Browser,
  config: LaunchProofConfig,
  identityName?: string,
): Promise<BrowserContext> {
  const options = contextOptions(config);
  if (!identityName) {
    return browser.newContext(options);
  }
  const identity = resolveIdentity(identityName, config);
  if (!identity || identity.missing.length > 0) {
    throw new Error(
      `Identity "${identityName}" is not fully configured; missing environment variables.`,
    );
  }
  const headers = { ...identity.headers };
  if (identity.cookie) {
    headers.cookie = identity.cookie;
  }
  return browser.newContext({ ...options, extraHTTPHeaders: headers });
}

async function createGuardedContext(
  browser: Browser,
  config: LaunchProofConfig,
  baseUrl: string,
  identityName?: string,
): Promise<BrowserContext> {
  const context = await createAuthenticatedContext(browser, config, identityName);
  const identity = identityName ? resolveIdentity(identityName, config) : null;
  const identityHeaderNames = identity ? Object.keys(identity.headers) : [];
  await guardContext(context, baseUrl, identityHeaderNames);
  return context;
}

async function runWorkflows(browser: Browser, options: BrowserRunOptions): Promise<CheckResult> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const findings: Finding[] = [];
  const evidence: Evidence[] = [];
  let passed = 0;
  let failed = 0;

  for (const workflow of config.browser.workflows) {
    const workflowStarted = Date.now();
    let context: BrowserContext | null = null;
    try {
      context = await createGuardedContext(browser, config, baseUrl, workflow.identity);
      const page = await context.newPage();
      page.setDefaultTimeout(config.browser.timeoutMs);
      const issues = collectIssues(page);
      await page.goto(resolveInScope(baseUrl, workflow.path).toString(), {
        waitUntil: 'domcontentloaded',
      });
      assertPageInScope(page, baseUrl);
      for (const step of workflow.steps) {
        switch (step.action) {
          case 'goto':
            await page.goto(resolveInScope(baseUrl, step.path).toString(), {
              waitUntil: 'domcontentloaded',
            });
            assertPageInScope(page, baseUrl);
            break;
          case 'click':
            await page.locator(step.selector).first().click();
            break;
          case 'fill': {
            const value = step.valueEnv ? process.env[step.valueEnv] : step.value;
            if (value === undefined) {
              throw new Error(`Environment variable ${step.valueEnv ?? ''} is not set.`);
            }
            await page.locator(step.selector).first().fill(value);
            break;
          }
          case 'press':
            await page.locator(step.selector).first().press(step.key);
            break;
          case 'expectText':
            await page
              .locator(step.selector ?? 'body')
              .first()
              .getByText(step.text, { exact: false })
              .first()
              .waitFor({ state: 'visible', timeout: config.browser.timeoutMs });
            break;
          case 'expectVisible':
            await page.locator(step.selector).first().waitFor({ state: 'visible' });
            break;
          case 'expectUrl':
            if (!page.url().includes(step.contains)) {
              throw new Error(`Expected URL to contain "${step.contains}" but was ${page.url()}.`);
            }
            break;
          case 'wait':
            await page.waitForTimeout(step.ms);
            break;
          case 'screenshot': {
            if (options.outputDir) {
              await fs.mkdir(options.outputDir, { recursive: true });
              const file = path.join(
                options.outputDir,
                `${sanitizeName(workflow.name)}-${sanitizeName(step.name ?? 'step')}.png`,
              );
              await page.screenshot({ path: file, fullPage: true });
              evidence.push({ kind: 'screenshot', label: 'Workflow screenshot', value: file });
            }
            break;
          }
          default:
            break;
        }
        assertPageInScope(page, baseUrl);
      }
      const consoleFindings = workflow.expectNoConsoleErrors
        ? issueFindings(issues, 'browser.workflows', workflow.path)
        : [];
      findings.push(...consoleFindings);
      passed += 1;
      evidence.push({
        kind: 'metric',
        label: workflow.name,
        value: `passed · ${Date.now() - workflowStarted} ms`,
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Workflow failed';
      findings.push(
        createFinding({
          checkId: 'browser.workflows',
          title: `Workflow "${workflow.name}" failed`,
          description: truncateMessage(redactText(message), 400),
          severity: 'high',
          confidence: 'high',
          verification: 'observed',
          category: 'browser',
          impact: 'A primary user journey does not complete in a real browser.',
          remediation:
            'Reproduce the workflow locally, inspect the failing step, and add a stable data-testid selector before re-running.',
          evidence: [
            { kind: 'text', label: 'Workflow', value: workflow.name },
            { kind: 'text', label: 'Failure', value: truncateMessage(message, 300) },
          ],
          location: { url: workflow.path },
          key: `workflow:${workflow.name}`,
        }),
      );
      if (options.outputDir && config.browser.screenshots !== 'never') {
        try {
          if (context) {
            const pages = context.pages();
            const page = pages[0];
            if (page) {
              await fs.mkdir(options.outputDir, { recursive: true });
              const file = path.join(
                options.outputDir,
                `${sanitizeName(workflow.name)}-failure.png`,
              );
              await page.screenshot({ path: file, fullPage: true });
              evidence.push({ kind: 'screenshot', label: 'Failure screenshot', value: file });
            }
          }
        } catch {
          // A missing failure screenshot must not mask the workflow failure.
        }
      }
    } finally {
      await context?.close().catch(() => undefined);
    }
  }

  return createCheck({
    id: 'browser.workflows',
    title: 'Browser user workflows',
    category: 'browser',
    status:
      config.browser.workflows.length === 0
        ? 'skipped'
        : findings.some((finding) => finding.severity === 'high')
          ? 'fail'
          : findings.length > 0
            ? 'warn'
            : 'pass',
    summary:
      config.browser.workflows.length === 0
        ? 'No browser workflows are configured; workflow coverage was skipped.'
        : `${passed} workflow(s) passed and ${failed} failed.`,
    findings,
    evidence,
    details:
      config.browser.workflows.length === 0
        ? 'Configure browser.workflows to exercise sign-in, checkout, or other critical journeys. A page load is not workflow coverage.'
        : undefined,
    durationMs: Date.now() - started,
  });
}

async function runPageLoad(browser: Browser, options: BrowserRunOptions): Promise<CheckResult> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const context = await createGuardedContext(browser, config, baseUrl);
  const page = await context.newPage();
  const issues = collectIssues(page);
  const evidence: Evidence[] = [];
  const findings: Finding[] = [];
  try {
    page.setDefaultTimeout(config.browser.timeoutMs);
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    assertPageInScope(page, baseUrl);
    const status = response?.status() ?? 0;
    const title = await page.title();
    evidence.push(
      { kind: 'http', label: 'Root status', value: String(status) },
      { kind: 'text', label: 'Page title', value: title || '(empty)' },
      { kind: 'metric', label: 'Navigation', value: `${Date.now() - started} ms` },
    );
    if (status < 200 || status >= 400) {
      findings.push(
        createFinding({
          checkId: 'browser.page-load',
          title: `Root page returned HTTP ${status}`,
          description: 'The browser could not load the application root successfully.',
          severity: status >= 500 ? 'high' : 'medium',
          confidence: 'high',
          verification: 'observed',
          category: 'browser',
          impact: 'Users cannot load the application.',
          remediation: 'Check the deployment, server logs, and routing configuration.',
          evidence: [{ kind: 'http', label: 'Status', value: String(status) }],
          location: { url: baseUrl },
          key: 'browser:root-status',
        }),
      );
    }
    if (!title) {
      findings.push(
        createFinding({
          checkId: 'browser.page-load',
          title: 'Page has no title',
          description: 'document.title is empty on the root page.',
          severity: 'low',
          confidence: 'high',
          verification: 'observed',
          category: 'browser',
          impact: 'Browser tabs, bookmarks, and assistive technology lack a page label.',
          remediation: 'Set a descriptive, unique <title> on every page.',
          key: 'browser:empty-title',
        }),
      );
    }
    findings.push(...issueFindings(issues, 'browser.page-load', '/'));
  } catch (error) {
    findings.push(
      createFinding({
        checkId: 'browser.page-load',
        title: 'Browser could not load the application',
        description: error instanceof Error ? error.message : 'Navigation failed',
        severity: 'high',
        confidence: 'high',
        verification: 'observed',
        category: 'browser',
        impact: 'No browser-based conclusions are possible.',
        remediation: 'Confirm the URL is reachable and the dev server is running.',
        location: { url: baseUrl },
        key: 'browser:load-failed',
      }),
    );
  } finally {
    await context.close().catch(() => undefined);
  }
  return createCheck({
    id: 'browser.page-load',
    title: 'Browser page load',
    category: 'browser',
    status: findings.some((finding) => finding.severity === 'high')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass',
    summary:
      findings.length === 0
        ? 'The application loaded in Chromium without observed console or network errors.'
        : `${findings.length} browser issue(s) observed on the root page.`,
    findings,
    evidence,
    durationMs: Date.now() - started,
  });
}

async function runAccessibility(
  browser: Browser,
  options: BrowserRunOptions,
): Promise<CheckResult> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const findings: Finding[] = [];
  const evidence: Evidence[] = [];
  let axeSource: string;
  try {
    const axeModule = (await import('axe-core')) as unknown as {
      source?: string;
      default?: { source?: string };
    };
    axeSource = axeModule.source ?? axeModule.default?.source ?? '';
    if (!axeSource) {
      throw new Error('axe-core did not expose an injectable source.');
    }
  } catch (error) {
    return createCheck({
      id: 'accessibility.axe',
      title: 'Accessibility (axe-core)',
      category: 'accessibility',
      status: 'not-verified',
      summary: 'axe-core is not available, so accessibility was not tested.',
      error: error instanceof Error ? error.message : 'axe-core could not be loaded',
      details: 'Install axe-core and re-run. No accessibility pass is claimed.',
      durationMs: Date.now() - started,
    });
  }

  const paths = samplePaths(config, 'accessibility');
  const context = await createGuardedContext(browser, config, baseUrl);
  let scanned = 0;
  for (const pagePath of paths) {
    const page = await context.newPage();
    try {
      await page.goto(resolveInScope(baseUrl, pagePath).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeoutMs,
      });
      assertPageInScope(page, baseUrl);
      // Evaluate axe in the page's main world. Unlike addScriptTag, CDP evaluation
      // is not blocked by a strict script-src Content Security Policy, so hardened
      // targets can still be scanned instead of producing a misleading failure.
      await page.evaluate(axeSource);
      const include = config.accessibility.include;
      const exclude = config.accessibility.exclude;
      const results = (await page.evaluate(
        async (settings: { tags: string[]; include: string[]; exclude: string[] }) => {
          const axe = (
            globalThis as unknown as {
              axe?: { run: (context: unknown, options: unknown) => Promise<AxeResults> };
            }
          ).axe;
          if (!axe) throw new Error('axe was not injected');
          const contextSpec =
            settings.include.length > 0
              ? {
                  include: settings.include.map((selector) => [selector]),
                  exclude: settings.exclude.map((selector) => [selector]),
                }
              : undefined;
          return axe.run(contextSpec ?? document, {
            runOnly: { type: 'tag', values: settings.tags },
            resultTypes: ['violations'],
          });
        },
        { tags: config.accessibility.tags, include, exclude },
      )) as AxeResults;
      scanned += 1;
      evidence.push({
        kind: 'metric',
        label: pagePath,
        value: `${results.violations.length} violation rule(s)`,
      });
      for (const violation of results.violations.slice(0, 15)) {
        const severity = AXE_IMPACT_SEVERITY[violation.impact ?? 'moderate'] ?? 'low';
        const targets = violation.nodes
          .slice(0, 5)
          .map((node) =>
            Array.isArray(node.target)
              ? node.target
                  .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
                  .join(' ')
              : 'unknown',
          );
        findings.push(
          createFinding({
            checkId: 'accessibility.axe',
            title: `Accessibility: ${violation.help}`,
            description: `${violation.description} This is an automated rule match; manual review with assistive technology is still required.`,
            severity,
            confidence: 'high',
            verification: 'observed',
            category: 'accessibility',
            impact:
              Number(violation.nodes.length) > 1
                ? `${violation.nodes.length} element(s) are affected, making the page harder or impossible to use with assistive technology.`
                : 'Users relying on assistive technology may be unable to complete this part of the page.',
            remediation: `Fix the reported elements and re-run axe. See ${violation.helpUrl}`,
            evidence: [
              { kind: 'text', label: 'Rule', value: violation.id },
              ...(targets.length > 0
                ? [{ kind: 'text' as const, label: 'Selectors', value: targets.join('\n') }]
                : []),
              ...(violation.nodes[0]?.failureSummary
                ? [
                    {
                      kind: 'text' as const,
                      label: 'Failure summary',
                      value: truncateMessage(violation.nodes[0].failureSummary, 300),
                    },
                  ]
                : []),
            ],
            location: { url: pagePath },
            references: [violation.helpUrl],
            key: `axe:${pagePath}:${violation.id}`,
          }),
        );
      }
    } catch (error) {
      findings.push(
        createFinding({
          checkId: 'accessibility.axe',
          title: `Accessibility scan failed on ${pagePath}`,
          description: error instanceof Error ? error.message : 'axe run failed',
          severity: 'low',
          confidence: 'medium',
          verification: 'observed',
          category: 'accessibility',
          impact: 'This page was not assessed for accessibility.',
          remediation: 'Confirm the page loads and re-run the accessibility check.',
          location: { url: pagePath },
          key: `axe:failed:${pagePath}`,
        }),
      );
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  await context.close().catch(() => undefined);

  const blocking = findings.some(
    (finding) => finding.severity === 'high' || finding.severity === 'critical',
  );
  return createCheck({
    id: 'accessibility.axe',
    title: 'Accessibility (axe-core)',
    category: 'accessibility',
    status: blocking ? 'fail' : findings.length > 0 ? 'warn' : 'pass',
    summary:
      scanned === 0
        ? 'No page could be scanned for accessibility.'
        : `${scanned} page(s) scanned with tags ${config.accessibility.tags.join(', ')}; ${findings.length} violation(s) found.`,
    findings,
    evidence,
    details:
      'Automated checks cover only a subset of WCAG. Manual keyboard, screen-reader, zoom, and contrast testing is still required.',
    durationMs: Date.now() - started,
  });
}

async function collectMetrics(page: Page): Promise<PageMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((entry) => entry.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsBytes = resources
      .filter((entry) => /\.m?js(\?|$)/.test(entry.name))
      .reduce((total, entry) => total + (entry.transferSize || 0), 0);
    const transferBytes = resources.reduce((total, entry) => total + (entry.transferSize || 0), 0);
    const custom = (
      window as unknown as {
        __lpMetrics?: { lcp: number; cls: number };
      }
    ).__lpMetrics;
    return {
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      lcpMs: custom && custom.lcp > 0 ? Math.round(custom.lcp) : null,
      cls: custom ? Number(custom.cls.toFixed(4)) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      domNodes: document.getElementsByTagName('*').length,
      jsBytes,
      requests: resources.length,
      transferBytes,
    };
  });
}

const LCP_INIT_SCRIPT = `
window.__lpMetrics = { lcp: 0, cls: 0 };
try {
  new PerformanceObserver(function(list) {
    var entries = list.getEntries();
    var last = entries[entries.length - 1];
    if (last) window.__lpMetrics.lcp = last.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(function(list) {
    list.getEntries().forEach(function(entry) {
      if (!entry.hadRecentInput) window.__lpMetrics.cls += entry.value;
    });
  }).observe({ type: 'layout-shift', buffered: true });
} catch (error) { /* unsupported browser */ }
`;

async function runPerformance(
  browser: Browser,
  options: BrowserRunOptions,
): Promise<CheckResult[]> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const paths = samplePaths(config, 'performance');
  const context = await createGuardedContext(browser, config, baseUrl);
  const findings: Finding[] = [];
  const evidence: Evidence[] = [];
  const thresholds = config.performance.thresholds;

  for (const pagePath of paths) {
    const page = await context.newPage();
    try {
      await page.addInitScript({ content: LCP_INIT_SCRIPT });
      await page.goto(resolveInScope(baseUrl, pagePath).toString(), {
        waitUntil: 'load',
        timeout: config.browser.timeoutMs,
      });
      assertPageInScope(page, baseUrl);
      await page.waitForTimeout(500);
      const metrics = await collectMetrics(page);
      evidence.push(
        {
          kind: 'metric',
          label: `${pagePath} FCP`,
          value: metrics.fcpMs === null ? 'n/a' : `${metrics.fcpMs} ms`,
        },
        {
          kind: 'metric',
          label: `${pagePath} LCP`,
          value: metrics.lcpMs === null ? 'n/a' : `${metrics.lcpMs} ms`,
        },
        {
          kind: 'metric',
          label: `${pagePath} CLS`,
          value: metrics.cls === null ? 'n/a' : String(metrics.cls),
        },
        {
          kind: 'metric',
          label: `${pagePath} JS transfer`,
          value: `${Math.round(metrics.jsBytes / 1024)} KB`,
        },
        { kind: 'metric', label: `${pagePath} requests`, value: String(metrics.requests) },
      );
      const breach = (
        id: string,
        title: string,
        actual: number,
        limit: number,
        unit: string,
        severity: Severity,
        remediation: string,
      ): void => {
        if (actual <= limit) return;
        findings.push(
          createFinding({
            checkId: 'performance.metrics',
            title,
            description: `${pagePath} measured ${Math.round(actual)} ${unit} against a ${limit} ${unit} budget.`,
            severity,
            confidence: 'medium',
            verification: 'observed',
            category: 'performance',
            impact:
              'Slower pages reduce conversion and hurt users on lower-end devices and networks.',
            remediation,
            evidence: [
              { kind: 'metric', label: 'Measured', value: `${Math.round(actual)} ${unit}` },
              { kind: 'metric', label: 'Budget', value: `${limit} ${unit}` },
            ],
            location: { url: pagePath },
            key: `perf:${id}:${pagePath}`,
          }),
        );
      };
      if (metrics.fcpMs !== null) {
        breach(
          'fcp',
          'First Contentful Paint exceeds budget',
          metrics.fcpMs,
          thresholds.fcpMs,
          'ms',
          'medium',
          'Reduce render-blocking requests, preload critical assets, and server-render above-the-fold content.',
        );
      }
      if (metrics.lcpMs !== null) {
        breach(
          'lcp',
          'Largest Contentful Paint exceeds budget',
          metrics.lcpMs,
          thresholds.lcpMs,
          'ms',
          'medium',
          'Optimize the largest image or text block: compress images, avoid lazy-loading the hero, and reduce main-thread work.',
        );
      }
      if (metrics.cls !== null) {
        breach(
          'cls',
          'Cumulative Layout Shift exceeds budget',
          metrics.cls,
          thresholds.cls,
          '',
          'medium',
          'Reserve space for images, embeds, and fonts; avoid inserting content above existing content.',
        );
      }
      if (metrics.loadMs !== null) {
        breach(
          'load',
          'Page load time exceeds budget',
          metrics.loadMs,
          thresholds.loadMs,
          'ms',
          'low',
          'Reduce JavaScript and third-party requests, and defer non-critical work.',
        );
      }
      breach(
        'js',
        'JavaScript transfer size exceeds budget',
        metrics.jsBytes,
        thresholds.jsBytes,
        'bytes',
        'low',
        'Split bundles, remove unused dependencies, and compress text assets.',
      );
      breach(
        'requests',
        'Request count exceeds budget',
        metrics.requests,
        thresholds.requests,
        'requests',
        'low',
        'Consolidate requests and remove unused third-party scripts.',
      );
      breach(
        'dom',
        'DOM size exceeds budget',
        metrics.domNodes,
        thresholds.domNodes,
        'nodes',
        'low',
        'Virtualize large lists and simplify deeply nested markup.',
      );
    } catch (error) {
      findings.push(
        createFinding({
          checkId: 'performance.metrics',
          title: `Performance could not be measured on ${pagePath}`,
          description: error instanceof Error ? error.message : 'Navigation failed',
          severity: 'low',
          confidence: 'medium',
          verification: 'observed',
          category: 'performance',
          impact: 'No performance conclusion is available for this page.',
          remediation: 'Confirm the page loads, then re-run the measurement.',
          location: { url: pagePath },
          key: `perf:failed:${pagePath}`,
        }),
      );
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  await context.close().catch(() => undefined);

  const checks: CheckResult[] = [
    createCheck({
      id: 'performance.metrics',
      title: 'Navigation performance',
      category: 'performance',
      status: findings.some((finding) => finding.severity === 'medium')
        ? 'warn'
        : findings.length > 0
          ? 'warn'
          : 'pass',
      summary:
        findings.length === 0
          ? `Sampled ${paths.length} page(s); all measured budgets were met.`
          : `${findings.length} performance budget breach(es) across ${paths.length} page(s).`,
      findings,
      evidence,
      details:
        'Single-run measurements from this machine and network. Treat them as directional, not as a production benchmark.',
      durationMs: Date.now() - started,
    }),
  ];

  if (config.performance.lighthouse) {
    checks.push(
      createCheck({
        id: 'performance.lighthouse',
        title: 'Lighthouse audit',
        category: 'performance',
        status: 'not-verified',
        summary: 'Lighthouse was requested but is not bundled with LaunchProof in this release.',
        details:
          'Install Lighthouse separately and run it against the target. No Lighthouse score is claimed.',
      }),
    );
  }
  return checks;
}

async function runLinks(browser: Browser, options: BrowserRunOptions): Promise<CheckResult> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const origin = new URL(baseUrl).origin;
  const context = await createGuardedContext(browser, config, baseUrl);
  const findings: Finding[] = [];
  const checked = new Set<string>();
  const pages = [...new Set(['/', ...samplePaths(config, 'accessibility')])].slice(
    0,
    config.browser.maxPages,
  );
  let checkedCount = 0;

  for (const pagePath of pages) {
    const page = await context.newPage();
    try {
      await page.goto(resolveInScope(baseUrl, pagePath).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeoutMs,
      });
      assertPageInScope(page, baseUrl);
      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((anchor) => (anchor as HTMLAnchorElement).href)
          .filter((href): href is string => Boolean(href)),
      );
      const internal = hrefs
        .filter((href) => {
          try {
            return new URL(href).origin === origin;
          } catch {
            return false;
          }
        })
        .filter((href) => !checked.has(href))
        .slice(0, config.browser.maxLinksPerPage);
      for (const href of internal) {
        checked.add(href);
        checkedCount += 1;
        try {
          const response = await context.request.get(href, {
            timeout: config.browser.timeoutMs,
            failOnStatusCode: false,
          });
          if (response.status() >= 400) {
            findings.push(
              createFinding({
                checkId: 'browser.links',
                title: `Broken internal link: ${new URL(href).pathname}`,
                description: `Linked from ${pagePath}; returned HTTP ${response.status()}.`,
                severity: response.status() >= 500 ? 'medium' : 'low',
                confidence: 'high',
                verification: 'observed',
                category: 'browser',
                impact: 'Users following the link reach an error page.',
                remediation: 'Update the link or restore the route, and add a link check to CI.',
                evidence: [
                  { kind: 'http', label: 'Status', value: String(response.status()) },
                  { kind: 'text', label: 'Source page', value: pagePath },
                ],
                location: { url: href },
                key: `link:${href}`,
              }),
            );
          }
        } catch (error) {
          findings.push(
            createFinding({
              checkId: 'browser.links',
              title: `Internal link could not be requested: ${href}`,
              description: error instanceof Error ? error.message : 'Request failed',
              severity: 'low',
              confidence: 'medium',
              verification: 'observed',
              category: 'browser',
              impact: 'The link may be broken or intermittently unavailable.',
              remediation: 'Verify the route manually and check server availability.',
              location: { url: href },
              key: `link-error:${href}`,
            }),
          );
        }
      }
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  await context.close().catch(() => undefined);

  return createCheck({
    id: 'browser.links',
    title: 'Internal links',
    category: 'browser',
    status: findings.length > 0 ? 'warn' : checkedCount === 0 ? 'skipped' : 'pass',
    summary:
      checkedCount === 0
        ? `No internal links were found across ${pages.length} sampled page(s); link coverage was skipped.`
        : `${checkedCount} internal link(s) checked; ${findings.length} broken.`,
    findings,
    evidence: [
      { kind: 'metric', label: 'Links checked', value: String(checkedCount) },
      { kind: 'metric', label: 'Pages sampled', value: String(pages.length) },
    ],
    details:
      'Only same-origin links found on sampled pages are checked. External links and JavaScript-driven navigation are not covered.',
    durationMs: Date.now() - started,
  });
}

async function runMobileLayout(browser: Browser, options: BrowserRunOptions): Promise<CheckResult> {
  const started = Date.now();
  const { config, baseUrl } = options;
  const context = await browser.newContext({
    viewport: {
      width: config.browser.mobileViewport.width,
      height: config.browser.mobileViewport.height,
    },
    isMobile: true,
    hasTouch: true,
  });
  await guardContext(context, baseUrl);
  const findings: Finding[] = [];
  const pages = samplePaths(config, 'accessibility');
  for (const pagePath of pages) {
    const page = await context.newPage();
    try {
      await page.goto(resolveInScope(baseUrl, pagePath).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: config.browser.timeoutMs,
      });
      assertPageInScope(page, baseUrl);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        findings.push(
          createFinding({
            checkId: 'browser.mobile',
            title: `Horizontal overflow on ${pagePath}`,
            description: `The page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport, causing horizontal scrolling.`,
            severity: 'low',
            confidence: 'high',
            verification: 'observed',
            category: 'browser',
            impact: 'Mobile users must pan sideways and content may be clipped.',
            remediation:
              'Constrain wide elements, use max-width: 100%, and test at the configured mobile viewport.',
            evidence: [
              { kind: 'metric', label: 'Scroll width', value: `${overflow.scrollWidth}px` },
              { kind: 'metric', label: 'Viewport width', value: `${overflow.clientWidth}px` },
            ],
            location: { url: pagePath },
            key: `mobile:overflow:${pagePath}`,
          }),
        );
      }
    } catch (error) {
      findings.push(
        createFinding({
          checkId: 'browser.mobile',
          title: `Mobile layout could not be measured on ${pagePath}`,
          description: error instanceof Error ? error.message : 'Navigation failed',
          severity: 'low',
          confidence: 'medium',
          verification: 'observed',
          category: 'browser',
          impact: 'Responsive behavior for this page is unverified.',
          remediation: 'Confirm the page loads and re-run the mobile check.',
          location: { url: pagePath },
          key: `mobile:failed:${pagePath}`,
        }),
      );
    } finally {
      await page.close().catch(() => undefined);
    }
  }
  await context.close().catch(() => undefined);
  return createCheck({
    id: 'browser.mobile',
    title: 'Mobile layout',
    category: 'browser',
    status: findings.length > 0 ? 'warn' : 'pass',
    summary:
      findings.length === 0
        ? `No horizontal overflow at ${config.browser.mobileViewport.width}px across ${pages.length} page(s).`
        : `${findings.length} mobile layout issue(s) observed.`,
    findings,
    evidence: [
      {
        kind: 'metric',
        label: 'Viewport',
        value: `${config.browser.mobileViewport.width}×${config.browser.mobileViewport.height}`,
      },
    ],
    details: 'Overflow detection only; this is not a full responsive or touch-target audit.',
    durationMs: Date.now() - started,
  });
}

function sanitizeName(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'capture'
  );
}

function notVerifiedChecks(reason: string): CheckResult[] {
  return [
    createCheck({
      id: 'browser.runtime',
      title: 'Browser runtime',
      category: 'browser',
      status: 'not-verified',
      summary: 'Browser verification could not run.',
      error: reason,
      details:
        'Install the optional dependencies (playwright, axe-core) and install the Chromium browser shell, then re-run.',
    }),
    createCheck({
      id: 'accessibility.axe',
      title: 'Accessibility (axe-core)',
      category: 'accessibility',
      status: 'not-verified',
      summary: 'Accessibility was not tested because the browser runtime is unavailable.',
      error: reason,
    }),
    createCheck({
      id: 'performance.metrics',
      title: 'Navigation performance',
      category: 'performance',
      status: 'not-verified',
      summary: 'Performance was not measured because the browser runtime is unavailable.',
      error: reason,
    }),
  ];
}

/**
 * Runs the requested browser checks with a single Chromium instance and bounded pages.
 * Missing optional dependencies produce NOT VERIFIED checks, never passes.
 */
export async function runBrowserChecks(options: BrowserRunOptions): Promise<CheckResult[]> {
  const target = new URL(options.baseUrl);
  const decision = checkTargetScope(target, options.config);
  if (!decision.allowed) {
    throw new ScopeError(`Refusing browser testing: ${decision.reason}`);
  }
  const progress = options.onProgress ?? (() => undefined);
  const wantWorkflows = options.workflows ?? true;
  const wantAccessibility = options.accessibility ?? options.config.accessibility.enabled;
  const wantPerformance = options.performance ?? options.config.performance.enabled;
  const wantLinks = options.links ?? true;
  const wantMobile = options.mobile ?? options.config.browser.checkMobileLayout;

  let browser: Browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : 'playwright is not installed or Chromium is unavailable';
    return notVerifiedChecks(reason);
  }

  const checks: CheckResult[] = [];
  try {
    progress('Loading application in Chromium');
    checks.push(await runPageLoad(browser, options));
    if (wantWorkflows) {
      progress('Running browser workflows');
      checks.push(await runWorkflows(browser, options));
    }
    if (wantAccessibility) {
      progress('Running accessibility checks');
      checks.push(await runAccessibility(browser, options));
    }
    if (wantPerformance) {
      progress('Measuring navigation performance');
      checks.push(...(await runPerformance(browser, options)));
    }
    if (wantLinks) {
      progress('Checking internal links');
      checks.push(await runLinks(browser, options));
    }
    if (wantMobile) {
      progress('Checking mobile layout');
      checks.push(await runMobileLayout(browser, options));
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  return checks;
}

export function browserScopeReason(baseUrl: string, config: LaunchProofConfig): string | null {
  const decision = checkTargetScope(new URL(baseUrl), config);
  return decision.allowed ? null : decision.reason;
}
