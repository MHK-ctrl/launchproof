import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/config/schema.js';
import { discoverProject } from '../src/discovery.js';
import { runSecretsChecks } from '../src/secrets.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('secret scanning', () => {
  it('detects known credential formats and never includes the value', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-secrets-'));
    tempDirs.push(dir);
    await fs.mkdir(path.join(dir, 'src'), { recursive: true });
    const token = `npm_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'.slice(0, 36)}`;
    await fs.writeFile(
      path.join(dir, 'src', 'config.ts'),
      `export const token = "${token}";\n`,
      'utf8',
    );
    const config = createDefaultConfig();
    const discovery = await discoverProject(dir, config);
    const checks = await runSecretsChecks(discovery, config);
    const hardcoded = checks.find((check) => check.id === 'secrets.hardcoded');
    expect(hardcoded).toBeDefined();
    expect(hardcoded?.findings.length).toBeGreaterThan(0);
    expect(hardcoded?.findings[0]?.severity).toBe('critical');
    expect(JSON.stringify(checks)).not.toContain(token);
    expect(JSON.stringify(checks)).toContain('****REDACTED****');
  });

  it('does not flag obvious placeholders', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-placeholder-'));
    tempDirs.push(dir);
    await fs.writeFile(
      path.join(dir, 'app.ts'),
      'export const apiKey = "your-api-key-here";\nexport const password = "change-me";\n',
      'utf8',
    );
    const config = createDefaultConfig();
    const discovery = await discoverProject(dir, config);
    const checks = await runSecretsChecks(discovery, config);
    const hardcoded = checks.find((check) => check.id === 'secrets.hardcoded');
    expect(hardcoded?.findings).toHaveLength(0);
  });

  it('flags a tracked .env file at critical severity without reading values', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-env-'));
    tempDirs.push(dir);
    await fs.writeFile(path.join(dir, '.env'), 'DEMO_ONLY=placeholder\n', 'utf8');
    const config = createDefaultConfig();
    const discovery = await discoverProject(dir, config, new Set(['.env']));
    const checks = await runSecretsChecks(discovery, config, {
      trackedFiles: new Set(['.env']),
    });
    const hygiene = checks.find((check) => check.id === 'secrets.env-hygiene');
    expect(hygiene?.findings.some((finding) => finding.severity === 'critical')).toBe(true);
  });
});
