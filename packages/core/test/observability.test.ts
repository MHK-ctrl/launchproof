import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestId, serverErrorResponse, structuredLog } from '@/lib/observability';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('observability', () => {
  it('preserves a safe client request ID and replaces an unsafe one', () => {
    expect(
      requestId(new Request('https://example.test', { headers: { 'x-request-id': 'req-1' } })),
    ).toBe('req-1');
    const generated = requestId(
      new Request('https://example.test', { headers: { 'x-request-id': 'bad id\n' } }),
    );
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('emits structured logs while dropping sensitive fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    structuredLog('error', 'test_event', {
      requestId: 'req-1',
      status: 500,
      token: 'lp_cli_secret',
      authorization: 'Bearer secret',
      cookie: 'session=secret',
      body: '{"secret":"value"}',
      report: 'finding description',
      errorName: 'Error',
    });
    const output = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(output).toMatchObject({
      level: 'error',
      event: 'test_event',
      requestId: 'req-1',
      status: 500,
      errorName: 'Error',
    });
    for (const key of ['token', 'authorization', 'cookie', 'body', 'report']) {
      expect(output).not.toHaveProperty(key);
    }
  });

  it('returns a correlated error response without logging the error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = new Request('https://example.test/api', {
      headers: { 'x-request-id': 'req-500' },
    });
    const response = serverErrorResponse(
      request,
      'test_failure',
      'test_failed',
      'Request failed.',
      new Error('database password was secret'),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('req-500');
    const output = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(output).toMatchObject({
      event: 'test_failure',
      requestId: 'req-500',
      errorName: 'Error',
    });
    expect(JSON.stringify(output)).not.toContain('password');
  });
});
