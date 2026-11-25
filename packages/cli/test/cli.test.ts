import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BIN = path.join(ROOT, 'packages', 'cli', 'bin', 'launchproof.mjs');
const tempDirs: string[] = [];

function run(
  args: string[],
  cwd = ROOT,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', CI: '1' },
    timeout: 20_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('CLI', () => {
  it('prints the version and exits successfully', () => {
    const result = run(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('1.1.0');
  });

  it('documents the required commands', () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    for (const command of [
      'init',
      'analyze',
      'test',
      'security',
      'scan',
      'browser',
      'accessibility',
      'performance',
      'report',
      'config',
    ]) {
      expect(result.stdout).toContain(command);
    }
  });

  it('initializes a config that can be read back safely', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-cli-'));
    tempDirs.push(dir);
    const init = run(['init', '--url', 'http://127.0.0.1:3000'], dir);
    expect(init.status).toBe(0);
    const config = JSON.parse(
      await fs.readFile(path.join(dir, 'launchproof.config.json'), 'utf8'),
    ) as { version: number; scan: { network: boolean } };
    expect(config.version).toBe(1);
    expect(config.scan.network).toBe(false);

    const printed = run(['config', '--json'], dir);
    expect(printed.status).toBe(0);
    const parsed = JSON.parse(printed.stdout) as { config: { networkEnabled: boolean } };
    expect(parsed.config.networkEnabled).toBe(false);
  });

  it('rejects an invalid gate threshold with exit code 2', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-cli-'));
    tempDirs.push(dir);
    const result = run(['config', '--fail-on', 'urgent'], dir);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Invalid --fail-on/);
  });
});
