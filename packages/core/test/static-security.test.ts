import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/config/schema.js';
import { discoverProject } from '../src/discovery.js';
import { runRepositoryChecks } from '../src/repository.js';
import { runStaticSecurityChecks } from '../src/static-security.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-static-'));
  tempDirs.push(dir);
  return dir;
}

describe('static security precision', () => {
  it('flags eval with an argument but not Playwright $$eval or empty prose mentions', async () => {
    const dir = await makeProject();
    // Build the dangerous call at runtime so this test's own source stays free of the pattern.
    const dangerousCall = ['const result = ', 'eval', '(userInput);'].join('');
    await fs.writeFile(
      path.join(dir, 'app.ts'),
      [
        "await page.$$eval('a[href]', (anchors) => anchors.length);",
        dangerousCall,
        '// Avoid eval() in production code.',
        '',
      ].join('\n'),
      'utf8',
    );
    const config = createDefaultConfig();
    const discovery = await discoverProject(dir, config);
    const checks = await runStaticSecurityChecks(discovery, config);
    const staticCheck = checks.find((check) => check.id === 'security.static');
    const evalFindings =
      staticCheck?.findings.filter(
        (finding) => finding.title === 'Dynamic code execution with eval()',
      ) ?? [];
    expect(evalFindings).toHaveLength(1);
    expect(evalFindings[0]?.location?.line).toBe(2);
  });
});

describe('repository hygiene', () => {
  it('detects a lockfile even though it is excluded from content scanning', async () => {
    const dir = await makeProject();
    await fs.mkdir(path.join(dir, '.github', 'workflows'), { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), '{"name":"demo","version":"1.0.0"}\n');
    await fs.writeFile(path.join(dir, 'package-lock.json'), '{}\n');
    await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules\n.env\n');
    await fs.writeFile(path.join(dir, 'README.md'), '# Demo\n');
    await fs.writeFile(path.join(dir, 'LICENSE'), 'MIT\n');
    await fs.writeFile(path.join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
    const config = createDefaultConfig();
    const discovery = await discoverProject(dir, config);
    expect(discovery.files.some((file) => file.path === 'package-lock.json')).toBe(false);
    const checks = await runRepositoryChecks(discovery, config);
    const repository = checks.find((check) => check.id === 'configuration.repository');
    expect(repository?.findings.some((finding) => /lockfile/i.test(finding.title))).toBe(false);
    expect(repository?.findings).toHaveLength(0);
  });
});
