import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/load.js';
import { configurationSchema, createDefaultConfig } from '../src/config/schema.js';
import { ConfigError } from '../src/errors.js';

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-config-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('configuration', () => {
  it('provides strict defaults with network checks disabled', () => {
    const config = createDefaultConfig();
    expect(config.scan.network).toBe(false);
    expect(config.authorization.authorized).toBe(false);
    expect(config.api.allowUnsafeMethods).toBe(false);
    expect(config.ai.enabled).toBe(false);
    expect(config.scan.failOn).toBe('high');
  });

  it('loads YAML configuration and applies nested defaults', async () => {
    const dir = await tempDir();
    await fs.writeFile(
      path.join(dir, 'launchproof.config.yaml'),
      ['version: 1', 'project:', '  name: yaml-app', 'scan:', '  network: true'].join('\n'),
      'utf8',
    );
    const loaded = await loadConfig({ cwd: dir });
    expect(loaded.config.project.name).toBe('yaml-app');
    expect(loaded.config.scan.network).toBe(true);
    expect(loaded.config.http.timeoutMs).toBe(10_000);
    expect(loaded.path).toContain('launchproof.config.yaml');
  });

  it('rejects invalid severity thresholds with a config error', async () => {
    const dir = await tempDir();
    await fs.writeFile(
      path.join(dir, 'launchproof.config.json'),
      JSON.stringify({ version: 1, scan: { failOn: 'urgent' } }),
      'utf8',
    );
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError);
  });

  it('rejects missing explicit config paths', async () => {
    const dir = await tempDir();
    await expect(loadConfig({ cwd: dir, configPath: 'nope.json' })).rejects.toThrow(/not found/i);
  });

  it('rejects credentials, protocol-relative paths, and vacuous authorization expectations', () => {
    expect(
      configurationSchema.safeParse({ version: 1, app: { url: 'https://user:pass@example.com' } })
        .success,
    ).toBe(false);
    expect(
      configurationSchema.safeParse({
        version: 1,
        browser: { workflows: [{ name: 'escape', path: '//evil.example' }] },
      }).success,
    ).toBe(false);
    expect(
      configurationSchema.safeParse({
        version: 1,
        authorizationTests: {
          resources: [
            {
              name: 'vacuous',
              path: '/api/users/1',
              ownerIdentity: 'owner',
              otherIdentity: 'other',
              expectStatusForOther: [200],
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
