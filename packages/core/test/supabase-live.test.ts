import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDefaultConfig } from '../src/config/schema.js';
import { runSupabaseChecks } from '../src/supabase.js';
import type { HttpClient, HttpResponseRecord } from '../src/http/client.js';
import type { CheckResult } from '../src/types.js';

const tempDirs: string[] = [];
const ENV_KEY = 'LP_TEST_SUPABASE_ANON';

afterEach(async () => {
  delete process.env[ENV_KEY];
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function responseFor(status: number): HttpResponseRecord {
  return {
    requestedUrl: 'http://127.0.0.1:54321/rest/v1/users',
    finalUrl: 'http://127.0.0.1:54321/rest/v1/users',
    status,
    statusText: '',
    headers: {},
    setCookies: [],
    bodyText: '[]',
    bodyBytes: 2,
    contentType: 'application/json',
    durationMs: 1,
    redirects: [],
    truncated: false,
  };
}

function fakeClient(status: number): HttpClient {
  return {
    request: async () => responseFor(status),
  } as unknown as HttpClient;
}

async function liveChecks(status: number): Promise<CheckResult[]> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'launchproof-supabase-'));
  tempDirs.push(rootDir);
  process.env[ENV_KEY] = 'synthetic-anon-key';
  const config = createDefaultConfig();
  config.supabase.live = {
    url: 'http://127.0.0.1:54321',
    anonKeyEnv: ENV_KEY,
    tables: ['users'],
    maxRows: 1,
  };
  return runSupabaseChecks({ config, rootDir, client: fakeClient(status) });
}

describe('Supabase live probe classification', () => {
  it('runs live probing even when no local migrations exist', async () => {
    const checks = await liveChecks(403);
    const live = checks.find((check) => check.id === 'database.supabase-live');
    const staticCheck = checks.find((check) => check.id === 'database.supabase-rls');
    expect(live?.status).toBe('pass');
    expect(staticCheck?.status).toBe('skipped');
  });

  it('does not turn an inconclusive 5xx response into a pass', async () => {
    const checks = await liveChecks(500);
    const live = checks.find((check) => check.id === 'database.supabase-live');
    expect(live?.status).toBe('warn');
    expect(live?.summary).toMatch(/inconclusive|no protection pass/i);
  });
});
