#!/usr/bin/env node
/**
 * End-to-end packaging verification.
 *
 * Proves, by execution rather than assertion, that a fresh `npm pack` tarball can be installed into
 * an unrelated project and used to run a real scan. Checks:
 *
 *   1. the tarball's declared name is not the unrelated public `launchproof` package
 *   2. the tarball contains a bin entry, a bundled dist entry, a licence, and no node_modules
 *   3. install succeeds in a directory with no relationship to this repository
 *   4. the installed binary reports a version and its help text
 *   5. a scan of a scratch app returns real findings
 *   6. the raw secret value never appears in the report or on stdout
 *   7. the HTML report can be produced and contains the authorization statement
 *
 * Usage: npm run verify:package        (expects `npm run build` to have run; it runs it for you)
 * Exit code 0 means every check passed.
 */

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = '@hamzakhan2006/launchproof';
const FORBIDDEN_NAME = 'launchproof';

/** Synthetic credential. Assembled at runtime so no secret-shaped literal lives in the repo. */
const FAKE_SECRET = ['sk', 'live', '51H8xQ2KZ9mNpQrStUvWxYz0123456789abcdef'].join('_');

const results = [];
const tempDirs = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 300_000,
    ...options,
    env: { ...process.env, NO_COLOR: '1', CI: '1', npm_config_fund: 'false' },
  });
}

async function main() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  // --- 0. Build ------------------------------------------------------------------------------
  process.stdout.write('Building workspace...\n');
  const build = run(npm, ['run', 'build'], { cwd: ROOT });
  check('workspace builds', build.status === 0, build.status === 0 ? '' : tail(build.stderr));
  if (build.status !== 0) return report();

  // --- 1. Pack -------------------------------------------------------------------------------
  const packDir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-pack-'));
  tempDirs.push(packDir);
  const packed = run(
    npm,
    ['pack', '--workspace', WORKSPACE, '--pack-destination', packDir, '--json'],
    { cwd: ROOT },
  );
  check('npm pack succeeds', packed.status === 0, packed.status === 0 ? '' : tail(packed.stderr));
  if (packed.status !== 0) return report();

  let manifest;
  try {
    // `prepack` runs the build first, so npm writes lifecycle output before the JSON payload.
    const start = packed.stdout.indexOf('[\n');
    const end = packed.stdout.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('no JSON payload in npm pack output');
    manifest = JSON.parse(packed.stdout.slice(start, end + 1))[0];
  } catch {
    check('npm pack emits a manifest', false, tail(packed.stdout));
    return report();
  }

  const tarball = path.join(packDir, manifest.filename);
  const files = (manifest.files ?? []).map((entry) => entry.path);

  check(
    'package name is scoped and is not the unrelated public package',
    manifest.name !== FORBIDDEN_NAME && manifest.name === WORKSPACE,
    `name=${manifest.name}`,
  );
  check('tarball ships the bin entry', files.includes('bin/launchproof.mjs'));
  check('tarball ships the bundled CLI entry', files.includes('dist/index.js'));
  check('tarball ships a LICENSE file', files.some((file) => /^LICEN[CS]E/i.test(file)));
  check(
    'tarball does not ship node_modules or sources',
    !files.some((file) => file.startsWith('node_modules/') || file.startsWith('src/')),
    `${files.length} files, ${Math.round(manifest.size / 1024)} kB`,
  );

  // --- 2. Install into an unrelated project ---------------------------------------------------
  const consumer = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-consumer-'));
  tempDirs.push(consumer);
  await fs.writeFile(
    path.join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'unrelated-consumer', version: '0.0.0', private: true }, null, 2)}\n`,
    'utf8',
  );
  const install = run(npm, ['install', tarball, '--no-audit', '--no-fund'], { cwd: consumer });
  check('tarball installs into an unrelated project', install.status === 0, tail(install.stderr));
  if (install.status !== 0) return report();

  const bin = path.join(
    consumer,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'launchproof.cmd' : 'launchproof',
  );
  check('installed bin exists', await exists(bin));

  const version = run(bin, ['--version'], { cwd: consumer });
  check(
    'installed bin runs and reports a semver version',
    version.status === 0 && /^\d+\.\d+\.\d+/.test(version.stdout.trim()),
    version.stdout.trim() || tail(version.stderr),
  );

  const help = run(bin, ['--help'], { cwd: consumer });
  check(
    'installed bin documents scan and report',
    help.status === 0 && help.stdout.includes('scan') && help.stdout.includes('report'),
  );

  // --- 3. Real scan from the installed package ------------------------------------------------
  const app = path.join(consumer, 'app');
  await fs.mkdir(app, { recursive: true });
  await fs.writeFile(
    path.join(app, 'package.json'),
    `${JSON.stringify(
      {
        name: 'packaging-fixture',
        version: '1.0.0',
        dependencies: { express: '^4.18.2' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await fs.writeFile(
    path.join(app, 'server.js'),
    [
      "const express = require('express');",
      'const app = express();',
      `const STRIPE_SECRET = "${FAKE_SECRET}";`,
      "app.get('/run', (req, res) => { const c = req.query.c; res.send(eval(c)); });",
      'app.listen(3000);',
      '',
    ].join('\n'),
    'utf8',
  );

  const scan = run(bin, ['scan', '.', '--json'], { cwd: app });
  let reportJson = null;
  try {
    reportJson = JSON.parse(scan.stdout);
  } catch {
    /* handled below */
  }
  check(
    'installed package scans a scratch app and emits JSON',
    scan.status === 1 && reportJson !== null,
    scan.status === 1 ? '' : `exit=${scan.status} ${tail(scan.stderr)}`,
  );

  if (reportJson) {
    const ids = new Set((reportJson.findings ?? []).map((finding) => finding.checkId));
    const titles = (reportJson.findings ?? []).map((finding) => finding.title).join(' | ');
    check(
      'scan detects unsafe dynamic code execution',
      /dynamic code|eval/i.test(titles),
      [...ids].join(', '),
    );
    check(
      'scan detects the provider API key',
      /API key|secret/i.test(titles),
    );
    check(
      'secret value is not present in the report',
      !scan.stdout.includes(FAKE_SECRET) && !JSON.stringify(reportJson).includes(FAKE_SECRET),
    );
    check(
      'gate fails on the high-severity fixture',
      reportJson.summary?.gatePassed === false,
      String(reportJson.summary?.gateReasons ?? []).slice(0, 120),
    );
  }

  // --- 4. Report conversion from the installed package ---------------------------------------
  const htmlOut = path.join(consumer, 'out', 'report.html');
  const html = run(bin, ['report', path.join(app, '.launchproof', 'latest.json'), '--format', 'html', '--out', htmlOut], {
    cwd: consumer,
  });
  let htmlText = '';
  try {
    htmlText = await fs.readFile(htmlOut, 'utf8');
  } catch {
    /* handled below */
  }
  check('installed package converts JSON to HTML', html.status === 0 && htmlText.length > 0, tail(html.stderr));
  check(
    'HTML report carries the authorization statement',
    /Authorization/i.test(htmlText) && /not a penetration test/i.test(htmlText),
  );
  check('HTML report masks the secret value', !htmlText.includes(FAKE_SECRET));

  report();
}

function tail(text, limit = 400) {
  const value = String(text ?? '').trim();
  return value.length > limit ? `…${value.slice(-limit)}` : value;
}

async function exists(target) {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

function report() {
  const width = Math.max(...results.map((result) => result.name.length), 10);
  process.stdout.write('\nPackaging verification\n');
  for (const result of results) {
    const mark = result.passed ? 'PASS' : 'FAIL';
    const detail = result.detail ? `  ${String(result.detail).split('\n')[0]}` : '';
    process.stdout.write(`  ${mark}  ${result.name.padEnd(width)}${detail}\n`);
  }
  const failed = results.filter((result) => !result.passed);
  process.stdout.write(
    `\n${results.length - failed.length}/${results.length} checks passed\n`,
  );
  if (failed.length > 0) {
    process.stdout.write('FAILED CHECKS:\n');
    for (const result of failed) {
      process.stdout.write(`  - ${result.name}${result.detail ? `: ${result.detail}` : ''}\n`);
    }
  }
  process.exitCode = failed.length > 0 ? 1 : 0;
}

const cleanup = async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }).catch(() => {})),
  );
};

main()
  .catch((error) => {
    check('verification script completed', false, error instanceof Error ? error.message : String(error));
    report();
  })
  .finally(cleanup);
