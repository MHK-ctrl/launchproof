#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { Command } from 'commander';
import pc from 'picocolors';

import {
  ALL_COMPONENTS,
  ConfigError,
  LaunchProofError,
  ScopeError,
  UsageError,
  VERSION,
  PROJECT_URL,
  checkTargetScope,
  createDefaultConfig,
  findConfigFile,
  formatUnknownError,
  isLoopbackHost,
  parseTargetUrl,
  loadConfig,
  loadDotEnvFiles,
  redactUrl,
  stripControlChars,
  renderHtml,
  renderSarif,
  renderTerminal,
  runScan,
  safeConfigSummary,
  writeReportArtifacts,
  type CheckResult,
  type LaunchProofConfig,
  type ScanComponent,
  type ScanReport,
  type Severity,
} from '@launchproof/core';
import { runBrowserChecks } from '@launchproof/browser';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const VALID_REPORT_STATUSES = new Set(['pass', 'fail', 'warn', 'skipped', 'not-verified', 'error']);
const VALID_REPORT_SEVERITIES = new Set<string>(SEVERITIES);

interface GlobalOptions {
  config?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  ci?: boolean;
  color?: boolean;
  output?: string;
  failOn?: string;
}

interface Runtime {
  config: LaunchProofConfig;
  configPath: string | null;
  rootDir: string;
  warnings: string[];
}

class CliError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function colorEnabled(opts: GlobalOptions): boolean {
  if (opts.ci || opts.json) return false;
  if (opts.color === false) return false;
  return pc.isColorSupported;
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function loadRuntime(opts: GlobalOptions): Promise<Runtime> {
  const rootDir = process.cwd();
  const loaded = await loadConfig({ cwd: rootDir, configPath: opts.config });
  const dotenv = await loadDotEnvFiles(rootDir);
  if (opts.failOn) {
    if (!SEVERITIES.includes(opts.failOn as Severity)) {
      throw new UsageError(
        `Invalid --fail-on "${opts.failOn}". Use one of: ${SEVERITIES.join(', ')}.`,
      );
    }
    loaded.config.scan.failOn = opts.failOn as Severity;
  }
  return {
    config: loaded.config,
    configPath: loaded.path,
    rootDir: loaded.rootDir,
    warnings: [...loaded.warnings, ...dotenv.warnings],
  };
}

function targetFromConfig(config: LaunchProofConfig, explicit?: string): string | null {
  const candidate = explicit ?? config.app.url ?? config.browser.baseUrl ?? null;
  return candidate ? redactUrl(candidate) : null;
}

function progressHandler(opts: GlobalOptions): (message: string) => void {
  return (message: string) => {
    if (opts.quiet || opts.json || opts.ci) return;
    log(pc.dim(`→ ${message}`));
  };
}

async function writeAndEmit(
  report: ScanReport,
  opts: GlobalOptions,
  configuredOutputDir = '.launchproof',
): Promise<number> {
  const outputDir = path.resolve(process.cwd(), opts.output ?? configuredOutputDir);
  let files: string[] = [];
  try {
    const written = await writeReportArtifacts(report, {
      outputDir,
      formats: ['json', 'html', 'sarif'],
      writeLatest: true,
    });
    files = written.files;
  } catch (error) {
    log(pc.yellow(`Could not write report files: ${formatUnknownError(error)}`));
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (files.length > 0) log(pc.dim(`Report artifacts written to ${outputDir}`));
  } else if (opts.quiet) {
    const gate = report.summary.gatePassed ? 'PASS' : 'FAIL';
    process.stdout.write(
      `${gate} ${report.meta.projectName}: ${report.summary.totalFindings} finding(s), ${report.summary.bySeverity.critical} critical, ${report.summary.bySeverity.high} high\n`,
    );
  } else {
    process.stdout.write(
      renderTerminal(report, { color: colorEnabled(opts), verbose: opts.verbose }),
    );
    if (files.length > 0) {
      const html = files.find((file) => file.endsWith('latest.html'));
      log(pc.dim(`Report: ${html ?? files[0] ?? outputDir}`));
    }
  }
  return report.summary.gatePassed ? 0 : 1;
}

function applyTargetAuthorization(
  config: LaunchProofConfig,
  target: string,
  opts: GlobalOptions & { authorized?: boolean; scope?: string[] },
): URL {
  const url = parseTargetUrl(target);
  if (opts.authorized) {
    config.authorization.authorized = true;
  }
  if (opts.scope && opts.scope.length > 0) {
    config.authorization.scope = opts.scope;
  }
  if (isLoopbackHost(url.hostname)) {
    config.authorization.allowLocal = true;
  }
  const decision = checkTargetScope(url, config);
  if (!decision.allowed) {
    throw new ScopeError(
      `${decision.reason}\n\nTo test an authorized system, add its host to authorization.scope and set authorization.authorized to true, or pass --authorized --scope ${url.hostname}.`,
    );
  }
  return url;
}

async function runBrowserPhase(
  runtime: Runtime,
  opts: GlobalOptions,
  baseUrl: string,
  selection: {
    workflows?: boolean;
    links?: boolean;
    mobile?: boolean;
    accessibility?: boolean;
    performance?: boolean;
  },
): Promise<CheckResult[]> {
  return runBrowserChecks({
    config: runtime.config,
    baseUrl,
    outputDir: path.resolve(runtime.rootDir, '.launchproof', 'screenshots'),
    ...selection,
    onProgress: progressHandler(opts),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalidReport(message: string): never {
  throw new CliError(`Invalid LaunchProof report: ${message}`, 2);
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string') invalidReport(`${context}.${key} must be a string.`);
  if (stripControlChars(value) !== value) {
    invalidReport(`${context}.${key} contains terminal control characters.`);
  }
  return value;
}

function parseReportJson(raw: string): ScanReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError('The report file is not valid JSON.', 2);
  }
  if (!isRecord(parsed)) {
    invalidReport('the top-level value must be an object.');
  }
  const { meta, summary, checks, findings, limitations, configuration, project } = parsed;
  if (!isRecord(meta) || !isRecord(summary)) {
    invalidReport('meta and summary must be objects.');
  }
  if (!Array.isArray(checks) || !Array.isArray(findings) || !Array.isArray(limitations)) {
    invalidReport('checks, findings, and limitations must be arrays.');
  }
  if (!isRecord(configuration)) {
    invalidReport('configuration must be an object.');
  }
  if (project !== null && !isRecord(project)) {
    invalidReport('project must be an object or null.');
  }
  requireString(meta, 'id', 'meta');
  requireString(meta, 'projectName', 'meta');
  requireString(meta, 'startedAt', 'meta');
  if (Number.isNaN(Date.parse(requireString(meta, 'startedAt', 'meta')))) {
    invalidReport('meta.startedAt must be a valid timestamp.');
  }
  if (!isRecord(meta.runtime)) {
    invalidReport('meta.runtime must be an object.');
  }
  requireString(meta.runtime, 'platform', 'meta.runtime');
  requireString(meta.runtime, 'arch', 'meta.runtime');
  requireString(meta.runtime, 'node', 'meta.runtime');
  if (typeof summary.gatePassed !== 'boolean' || !Array.isArray(summary.gateReasons)) {
    invalidReport('summary.gatePassed must be boolean and summary.gateReasons must be an array.');
  }
  if (!isRecord(summary.byStatus) || !isRecord(summary.bySeverity)) {
    invalidReport('summary status and severity counts must be objects.');
  }
  for (const [index, check] of checks.entries()) {
    if (!isRecord(check)) invalidReport(`checks[${index}] must be an object.`);
    requireString(check, 'id', `checks[${index}]`);
    requireString(check, 'summary', `checks[${index}]`);
    if (!VALID_REPORT_STATUSES.has(requireString(check, 'status', `checks[${index}]`))) {
      invalidReport(`checks[${index}].status is not a supported result status.`);
    }
    if (!Array.isArray(check.findings) || !Array.isArray(check.evidence)) {
      invalidReport(`checks[${index}] must contain findings and evidence arrays.`);
    }
  }
  for (const [index, finding] of findings.entries()) {
    if (!isRecord(finding)) invalidReport(`findings[${index}] must be an object.`);
    for (const key of ['id', 'title', 'description', 'impact', 'remediation']) {
      requireString(finding, key, `findings[${index}]`);
    }
    if (!VALID_REPORT_SEVERITIES.has(requireString(finding, 'severity', `findings[${index}]`))) {
      invalidReport(`findings[${index}].severity is not a supported severity.`);
    }
    if (!Array.isArray(finding.evidence)) {
      invalidReport(`findings[${index}].evidence must be an array.`);
    }
    if (
      finding.references !== undefined &&
      (!Array.isArray(finding.references) ||
        finding.references.some((reference) => typeof reference !== 'string'))
    ) {
      invalidReport(`findings[${index}].references must be an array of strings.`);
    }
    if (finding.location !== undefined && !isRecord(finding.location)) {
      invalidReport(`findings[${index}].location must be an object when present.`);
    }
  }
  return parsed as unknown as ScanReport;
}

function printArtifacts(files: string[], opts: GlobalOptions): void {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ artifacts: files }, null, 2)}\n`);
    return;
  }
  for (const file of files) {
    process.stdout.write(`${file}\n`);
  }
}

async function openFile(filePath: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  const child = spawn(command, [filePath], { detached: true, stdio: 'ignore', shell: false });
  child.unref();
}

const program = new Command();

program
  .name('launchproof')
  .description(
    'Evidence-backed security, API, browser, accessibility, and performance verification for applications.',
  )
  .version(VERSION, '-v, --version', 'Print the LaunchProof version')
  .option('-c, --config <path>', 'Path to launchproof.config.json or .yaml')
  .option('--json', 'Print the report as JSON and suppress human output')
  .option('--quiet', 'Print only the final gate result')
  .option('--verbose', 'Include descriptions, remediation tips, and configuration')
  .option('--ci', 'CI mode: no color, no progress output')
  .option('--no-color', 'Disable ANSI colors')
  .option('-o, --output <dir>', 'Report output directory (default .launchproof)')
  .option('--fail-on <severity>', 'Gate threshold: critical, high, medium, low, info')
  .addHelpText(
    'after',
    `\nExit codes:\n  0  gate passed (no findings at or above the threshold)\n  1  gate failed\n  2  usage, configuration, or authorization error\n  3  unexpected error\n\nDocumentation: ${PROJECT_URL}\n`,
  );

program
  .command('init')
  .description('Create a launchproof.config.json with conservative defaults')
  .option('-f, --force', 'Overwrite an existing config file')
  .option('-u, --url <url>', 'Application URL to verify')
  .action(async (options: { force?: boolean; url?: string }) => {
    await main(async () => {
      const cwd = process.cwd();
      const existing = await findConfigFile(cwd);
      const targetPath = path.join(cwd, 'launchproof.config.json');
      if (existing && !options.force) {
        throw new CliError(
          `A config file already exists: ${path.relative(cwd, existing)}. Use --force to replace it.`,
        );
      }
      if (options.url) {
        parseTargetUrl(options.url);
      }
      const base = createDefaultConfig();
      const config = {
        version: 1,
        project: { name: path.basename(cwd) },
        ...(options.url
          ? {
              app: { url: options.url, healthPath: '/' },
              browser: { enabled: true, baseUrl: options.url, workflows: [] },
            }
          : {}),
        authorization: {
          authorized: false,
          scope: [],
          allowLocal: true,
          allowPrivateNetwork: false,
        },
        scan: {
          network: false,
          failOn: 'high',
          gitHistory: false,
          exclude: base.scan.exclude,
        },
        api: { allowUnsafeMethods: false, endpoints: [] },
        accessibility: { enabled: true, tags: ['wcag2a', 'wcag2aa'] },
        performance: { enabled: true, lighthouse: false },
        report: {
          outputDir: '.launchproof',
          formats: ['terminal', 'json', 'html'],
        },
      };
      await fs.writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
      process.stdout.write(`Created ${path.relative(cwd, targetPath)}\n\n`);
      process.stdout.write(
        [
          'Next steps:',
          '  1. Edit app.url and authorization.scope for the system you own.',
          '  2. Run launchproof analyze to inspect the project profile.',
          '  3. Run launchproof test (static checks only by default).',
          '  4. Enable scan.network only after authorization is confirmed.',
          '',
        ].join('\n'),
      );
    });
  });

program
  .command('analyze')
  .description('Profile the project without running network checks')
  .action(async () => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      if (!opts.quiet && !opts.json)
        log(pc.dim(`Config: ${runtime.configPath ?? 'built-in defaults'}`));
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        components: ['discovery'],
        onProgress: progressHandler(opts),
      });
      const profile = report.project;
      if (profile && !opts.json && !opts.quiet) {
        process.stdout.write(
          [
            `Project: ${profile.name}`,
            `Frameworks: ${profile.frameworks.join(', ') || 'none detected'}`,
            `Languages: ${profile.languages.map((language) => `${language.name} (${language.files})`).join(', ') || 'unknown'}`,
            `Package manager: ${profile.packageManager}`,
            `API routes: ${profile.apiRoutes.length}`,
            `Test frameworks: ${profile.testFrameworks.join(', ') || 'none detected'}`,
            `Deployment: ${profile.deployment.join(', ') || 'none detected'}`,
            `Files scanned: ${profile.filesScanned}${profile.truncated ? ' (truncated)' : ''}`,
            '',
          ].join('\n'),
        );
      }
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('test')
  .description('Run configured static checks plus authorized network and browser checks')
  .action(async () => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const baseUrl = targetFromConfig(runtime.config);
      let browserChecks: CheckResult[] = [];
      if (
        runtime.config.browser.enabled &&
        baseUrl &&
        (runtime.config.app.url || runtime.config.browser.baseUrl)
      ) {
        browserChecks = await runBrowserPhase(runtime, opts, baseUrl, {
          workflows: true,
          links: true,
          mobile: true,
          accessibility: runtime.config.accessibility.enabled,
          performance: runtime.config.performance.enabled,
        });
      }
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        target: baseUrl,
        components: ALL_COMPONENTS,
        browserChecks,
        onProgress: progressHandler(opts),
      });
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('security')
  .description('Static security and hygiene checks, plus HTTP checks when network is enabled')
  .option('-u, --url <url>', 'Target URL (defaults to app.url)')
  .action(async (options: { url?: string }) => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const target = targetFromConfig(runtime.config, options.url);
      const components: ScanComponent[] = [
        'discovery',
        'secrets',
        'repository',
        'static',
        'dependencies',
        'supabase',
        'http',
        'api',
        'authorization',
      ];
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        target,
        components,
        onProgress: progressHandler(opts),
      });
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('scan <url>')
  .description('Authorized live HTTP, API, and authorization verification against a URL')
  .option('--authorized', 'Confirm you are authorized to test the target')
  .option(
    '--scope <hosts...>',
    'Authorized host patterns (for example staging.example.com *.example.com)',
  )
  .action(async (url: string, options: { authorized?: boolean; scope?: string[] }) => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      runtime.config.scan.network = true;
      const target = applyTargetAuthorization(runtime.config, url, options);
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        target: target.toString(),
        components: ['discovery', 'http', 'api', 'authorization'],
        onProgress: progressHandler(opts),
      });
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('browser [url]')
  .description('Browser workflows, links, mobile layout, accessibility, and performance')
  .option('--no-workflows', 'Skip configured workflows')
  .option('--no-links', 'Skip internal link checks')
  .option('--no-mobile', 'Skip mobile overflow checks')
  .option('--no-accessibility', 'Skip axe-core checks')
  .option('--no-performance', 'Skip performance measurements')
  .action(
    async (
      url: string | undefined,
      options: {
        workflows?: boolean;
        links?: boolean;
        mobile?: boolean;
        accessibility?: boolean;
        performance?: boolean;
      },
    ) => {
      await main(async () => {
        const opts = program.opts<GlobalOptions>();
        const runtime = await loadRuntime(opts);
        const baseUrl = targetFromConfig(runtime.config, url);
        if (!baseUrl) {
          throw new CliError(
            'No browser target. Pass a URL or set app.url in launchproof.config.json.',
          );
        }
        const checks = await runBrowserPhase(runtime, opts, baseUrl, {
          workflows: options.workflows !== false,
          links: options.links !== false,
          mobile: options.mobile !== false,
          accessibility: options.accessibility !== false,
          performance: options.performance !== false,
        });
        const report = await runScan({
          rootDir: runtime.rootDir,
          config: runtime.config,
          configPath: runtime.configPath,
          target: baseUrl,
          components: ['discovery', 'browser'],
          browserChecks: checks,
          onProgress: progressHandler(opts),
        });
        return await writeAndEmit(report, opts, runtime.config.report.outputDir);
      });
    },
  );

program
  .command('accessibility [url]')
  .description('Run axe-core accessibility checks in Chromium')
  .action(async (url: string | undefined) => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const baseUrl = targetFromConfig(runtime.config, url);
      if (!baseUrl) throw new CliError('No accessibility target. Pass a URL or set app.url.');
      const checks = await runBrowserPhase(runtime, opts, baseUrl, {
        workflows: false,
        links: false,
        mobile: false,
        accessibility: true,
        performance: false,
      });
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        target: baseUrl,
        components: ['discovery', 'browser'],
        browserChecks: checks,
        onProgress: progressHandler(opts),
      });
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('performance [url]')
  .description('Measure navigation performance and budget compliance in Chromium')
  .action(async (url: string | undefined) => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const baseUrl = targetFromConfig(runtime.config, url);
      if (!baseUrl) throw new CliError('No performance target. Pass a URL or set app.url.');
      const checks = await runBrowserPhase(runtime, opts, baseUrl, {
        workflows: false,
        links: false,
        mobile: false,
        accessibility: false,
        performance: true,
      });
      const report = await runScan({
        rootDir: runtime.rootDir,
        config: runtime.config,
        configPath: runtime.configPath,
        target: baseUrl,
        components: ['discovery', 'browser'],
        browserChecks: checks,
        onProgress: progressHandler(opts),
      });
      return await writeAndEmit(report, opts, runtime.config.report.outputDir);
    });
  });

program
  .command('report [file]')
  .description('Render, convert, or open an existing JSON report')
  .option('--format <format>', 'terminal, json, html, or sarif', 'terminal')
  .option('--out <path>', 'Write converted output to a specific path')
  .option('--open', 'Open the HTML report in the default browser')
  .action(
    async (
      file: string | undefined,
      options: { format?: string; out?: string; open?: boolean },
    ) => {
      await main(async () => {
        const opts = program.opts<GlobalOptions>();
        const runtime = await loadRuntime(opts);
        const source = path.resolve(
          process.cwd(),
          file ?? path.join(runtime.config.report.outputDir, 'latest.json'),
        );
        try {
          const info = await fs.stat(source);
          if (info.size > 25_000_000) {
            throw new CliError('Report file is larger than the 25 MB safety limit.', 2);
          }
        } catch (error) {
          if (error instanceof CliError) throw error;
        }
        let raw: string;
        try {
          raw = await fs.readFile(source, 'utf8');
        } catch {
          throw new CliError(`Report not found: ${source}. Run a scan first.`);
        }
        const report = parseReportJson(raw);
        const format = (options.format ?? 'terminal').toLowerCase();
        if (format === 'json') {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return 0;
        }
        if (format === 'html' || format === 'sarif') {
          const html = format === 'html';
          const content = html ? renderHtml(report) : renderSarif(report);
          const defaultName = html ? 'report.html' : 'report.sarif';
          const destination = path.resolve(
            process.cwd(),
            options.out ?? path.join(runtime.config.report.outputDir, defaultName),
          );
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, content, 'utf8');
          if (opts.json) printArtifacts([destination], opts);
          else process.stdout.write(`${destination}\n`);
          if (options.open && html) await openFile(destination);
          return 0;
        }
        if (format !== 'terminal') {
          throw new CliError(
            `Unknown report format "${format}". Use terminal, json, html, or sarif.`,
          );
        }
        process.stdout.write(
          renderTerminal(report, { color: colorEnabled(opts), verbose: opts.verbose }),
        );
        if (options.open) {
          const html = renderHtml(report);
          const destination = path.resolve(
            process.cwd(),
            options.out ?? path.join(runtime.config.report.outputDir, 'report.html'),
          );
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, html, 'utf8');
          await openFile(destination);
        }
        return 0;
      });
    },
  );

program
  .command('config')
  .description('Print the effective configuration without secret values')
  .action(async () => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const summary = safeConfigSummary(
        runtime.config,
        runtime.config.app.url ? redactUrl(runtime.config.app.url) : null,
        runtime.config.scan.network ? 'remote' : 'static',
      );
      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify({ path: runtime.configPath, config: summary }, null, 2)}\n`,
        );
        return 0;
      }
      process.stdout.write(`Config: ${runtime.configPath ?? 'built-in defaults'}\n`);
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      for (const warning of runtime.warnings) log(pc.yellow(`Warning: ${warning}`));
      return 0;
    });
  });

program
  .command('doctor')
  .description('Check the local environment and optional browser dependencies')
  .action(async () => {
    await main(async () => {
      const opts = program.opts<GlobalOptions>();
      const runtime = await loadRuntime(opts);
      const rows: Array<{ name: string; ok: boolean; detail: string }> = [];
      const [major, minor] = process.versions.node.split('.').map(Number);
      const nodeOk = (major ?? 0) > 22 || ((major ?? 0) === 22 && (minor ?? 0) >= 12);
      rows.push({
        name: 'Node.js',
        ok: nodeOk,
        detail: `${process.versions.node}${nodeOk ? '' : ' (requires >=22.12)'}`,
      });
      rows.push({
        name: 'Config',
        ok: true,
        detail: runtime.configPath ?? 'built-in defaults',
      });
      try {
        const playwright = await import('playwright');
        const executable = playwright.chromium.executablePath();
        let browserOk = false;
        try {
          await fs.access(executable);
          browserOk = true;
        } catch {
          browserOk = false;
        }
        rows.push({
          name: 'Playwright',
          ok: true,
          detail: 'installed (optional)',
        });
        rows.push({
          name: 'Chromium',
          ok: browserOk,
          detail: browserOk
            ? executable
            : 'not installed — run: npx playwright install --only-shell chromium',
        });
      } catch {
        rows.push({
          name: 'Playwright',
          ok: false,
          detail: 'not installed (optional, required for browser checks)',
        });
      }
      try {
        await import('axe-core');
        rows.push({ name: 'axe-core', ok: true, detail: 'installed (optional)' });
      } catch {
        rows.push({ name: 'axe-core', ok: false, detail: 'not installed (optional)' });
      }
      try {
        const { isGitRepository } = await import('@launchproof/core');
        rows.push({
          name: 'Git repository',
          ok: await isGitRepository(runtime.rootDir),
          detail: (await isGitRepository(runtime.rootDir)) ? 'detected' : 'not a git repository',
        });
      } catch {
        rows.push({ name: 'Git repository', ok: false, detail: 'could not inspect' });
      }
      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ checks: rows }, null, 2)}\n`);
      } else {
        for (const row of rows) {
          const mark = row.ok ? pc.green('ok') : pc.yellow('!');
          process.stdout.write(`${mark.padEnd(4)} ${row.name.padEnd(16)} ${row.detail}\n`);
        }
      }
      return rows.some((row) => !row.ok && row.name === 'Node.js') ? 2 : 0;
    });
  });

program.configureHelp({
  sortSubcommands: false,
  subcommandTerm: (command) => command.name(),
});

async function main(action: () => Promise<number | void>): Promise<void> {
  try {
    const code = await action();
    if (typeof code === 'number') {
      process.exitCode = code;
    }
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: unknown): void {
  if (error instanceof ScopeError) {
    log(pc.red(`Authorization refused: ${error.message}`));
    process.exitCode = 2;
    return;
  }
  if (error instanceof UsageError || error instanceof ConfigError) {
    log(pc.red(error.message));
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof CliError) {
    log(pc.red(error.message));
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof LaunchProofError) {
    log(pc.red(error.message));
    process.exitCode = error.exitCode || 3;
    return;
  }
  if (error instanceof Error && /Refusing browser testing/.test(error.message)) {
    log(pc.red(`Authorization refused: ${error.message}`));
    process.exitCode = 2;
    return;
  }
  log(pc.red(`Unexpected error: ${formatUnknownError(error)}`));
  if (process.env.LAUNCHPROOF_DEBUG === '1' && error instanceof Error && error.stack) {
    log(pc.dim(error.stack));
  }
  process.exitCode = 3;
}

export { program };

program.parseAsync(process.argv).catch(handleError);
