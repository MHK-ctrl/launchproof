import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCheck } from '../src/checks.js';
import { createDefaultConfig } from '../src/config/schema.js';
import { runScan } from '../src/scan.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('release gate', () => {
  it('fails when selected coverage is not verified', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-gate-'));
    tempDirs.push(rootDir);
    const report = await runScan({
      rootDir,
      config: createDefaultConfig(),
      components: ['discovery', 'browser'],
      browserChecks: [
        createCheck({
          id: 'browser.runtime',
          title: 'Browser runtime',
          category: 'browser',
          status: 'not-verified',
          summary: 'Browser runtime unavailable.',
        }),
      ],
    });
    expect(report.summary.byStatus['not-verified']).toBe(1);
    expect(report.summary.gatePassed).toBe(false);
    expect(report.summary.gateReasons.join(' ')).toMatch(/not verified/i);
  });
});
