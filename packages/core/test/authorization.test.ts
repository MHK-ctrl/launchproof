import { afterEach, describe, expect, it } from 'vitest';

import { runAuthorizationChecks } from '../src/authorization.js';
import { createDefaultConfig } from '../src/config/schema.js';
import type { HttpClient, HttpResponseRecord } from '../src/http/client.js';

const OWNER_ENV = 'LP_AUTH_TEST_OWNER';
const OTHER_ENV = 'LP_AUTH_TEST_OTHER';

afterEach(() => {
  delete process.env[OWNER_ENV];
  delete process.env[OTHER_ENV];
});

function response(status: number): HttpResponseRecord {
  return {
    requestedUrl: 'http://127.0.0.1:3000/resource',
    finalUrl: 'http://127.0.0.1:3000/resource',
    status,
    statusText: '',
    headers: {},
    setCookies: [],
    bodyText: '',
    bodyBytes: 0,
    contentType: 'application/json',
    durationMs: 1,
    redirects: [],
    truncated: false,
  };
}

describe('authorization result classification', () => {
  it('keeps an unexpected 5xx response inconclusive instead of passing or reporting BOLA', async () => {
    process.env[OWNER_ENV] = 'owner';
    process.env[OTHER_ENV] = 'other';
    const config = createDefaultConfig();
    config.auth.identities = {
      owner: { headersEnv: { 'x-test-user': OWNER_ENV } },
      other: { headersEnv: { 'x-test-user': OTHER_ENV } },
    };
    config.authorizationTests.resources = [
      {
        name: 'Owned resource',
        path: '/resource',
        method: 'GET',
        ownerIdentity: 'owner',
        otherIdentity: 'other',
        expectStatusForOther: [401, 403, 404],
        allowUnsafeMethod: false,
        body: undefined,
      },
    ];
    const client = {
      request: async (_url: string, options: { headers?: Record<string, string> }) =>
        response(options.headers?.['x-test-user'] === 'owner' ? 200 : 500),
    } as unknown as HttpClient;

    const checks = await runAuthorizationChecks({
      config,
      baseUrl: 'http://127.0.0.1:3000',
      client,
    });
    const authorization = checks.find((check) => check.id === 'authorization.objects');
    expect(authorization?.status).toBe('warn');
    expect(authorization?.findings).toHaveLength(0);
    expect(authorization?.summary).toMatch(/inconclusive/i);
  });
});
