import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupCliTokens, isCliTokenActive } from '@/lib/cli-auth';
import {
  clientAddress,
  clientAddressKey,
  memoryRateLimit,
  rateLimit,
  resetMemoryRateLimiter,
  type RateLimitAdmin,
} from '@/lib/rate-limit';

afterEach(() => {
  resetMemoryRateLimiter();
  vi.useRealTimers();
});

describe('memory rate limiter', () => {
  it('enforces the limit, reports retry-after, and resets after the window', () => {
    const now = 1_000_000;
    expect(memoryRateLimit('user-a', 2, 60_000, now).allowed).toBe(true);
    expect(memoryRateLimit('user-a', 2, 60_000, now).allowed).toBe(true);
    const blocked = memoryRateLimit('user-a', 2, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
    expect(memoryRateLimit('user-a', 2, 60_000, now + 60_000).allowed).toBe(true);
  });

  it('isolates users and handles concurrent callers deterministically', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => rateLimit('concurrent-user', 5, 60_000, { admin: null })),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results[0]?.backend).toBe('memory');
    expect((await rateLimit('different-user', 5, 60_000, { admin: null })).allowed).toBe(true);
  });

  it('uses the atomic Postgres result when available', async () => {
    const calls: Array<{ fn: string; args: unknown }> = [];
    const admin = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: [{ allowed: false, remaining: 0, retry_after: 42 }], error: null };
      },
    } as unknown as RateLimitAdmin;
    const result = await rateLimit('database-key', 3, 60_000, { admin });
    expect(result).toEqual({ allowed: false, retryAfter: 42, backend: 'postgres' });
    expect(calls).toEqual([
      {
        fn: 'consume_rate_limit',
        args: { p_key: 'database-key', p_limit: 3, p_window_seconds: 60 },
      },
    ]);
  });

  it('falls back to memory when the database limiter fails', async () => {
    const admin = {
      rpc: async () => ({ data: null, error: new Error('function missing') }),
    } as unknown as RateLimitAdmin;
    const result = await rateLimit('fallback', 1, 60_000, { admin });
    expect(result).toEqual({ allowed: true, retryAfter: 0, backend: 'memory' });
  });

  it('rejects invalid configuration rather than silently disabling enforcement', async () => {
    await expect(rateLimit('', 1, 60_000, { admin: null })).rejects.toThrow(
      'Invalid rate-limit configuration',
    );
    await expect(rateLimit('key', 0, 60_000, { admin: null })).rejects.toThrow(
      'Invalid rate-limit configuration',
    );
  });
});

describe('trusted client identification', () => {
  it('ignores spoofed forwarded headers outside a verified Vercel runtime', () => {
    const request = new NextRequest('https://example.test/', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'x-real-ip': '203.0.113.11',
      },
    });
    expect(clientAddress(request, {})).toBe('local');
  });

  it('uses only the platform header on Vercel and hashes the result', () => {
    const request = new NextRequest('https://example.test/', {
      headers: {
        'x-forwarded-for': '198.51.100.20',
        'x-vercel-forwarded-for': '203.0.113.10, 10.0.0.1',
      },
    });
    expect(clientAddress(request, { VERCEL: '1' })).toBe('203.0.113.10');
    const key = clientAddressKey(request, { VERCEL: '1' });
    expect(key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(key).not.toContain('203.0.113.10');
    expect(clientAddressKey(request, { VERCEL: '1' })).toBe(key);
  });

  it('does not trust a malformed platform address', () => {
    const request = new NextRequest('https://example.test/', {
      headers: { 'x-vercel-forwarded-for': 'evil<script>' },
    });
    expect(clientAddress(request, { VERCEL: '1' })).toBe('unknown');
  });
});

describe('CLI token validity', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');

  it('rejects expired and revoked tokens', () => {
    expect(
      isCliTokenActive({ expires_at: '2026-11-23T12:00:01.000Z', revoked_at: null }, now),
    ).toBe(true);
    expect(
      isCliTokenActive({ expires_at: '2026-11-23T11:59:59.000Z', revoked_at: null }, now),
    ).toBe(false);
    expect(
      isCliTokenActive(
        { expires_at: '2026-11-23T12:00:01.000Z', revoked_at: '2026-11-23T11:00:00.000Z' },
        now,
      ),
    ).toBe(false);
  });

  it('rejects malformed expiry values instead of treating them as valid', () => {
    expect(isCliTokenActive({ expires_at: 'not-a-date', revoked_at: null }, now)).toBe(false);
  });

  it('never lets cleanup failure break a valid CLI authentication', async () => {
    const noop = { rpc: async () => ({ error: null }) };
    expect(await cleanupCliTokens(noop, 'user-a')).toBe(true);

    const returnedError = { rpc: async () => ({ error: new Error('function missing') }) };
    await expect(cleanupCliTokens(returnedError, 'user-a')).resolves.toBe(false);

    const throws = {
      rpc: async (): Promise<{ error: null }> => {
        throw new Error('database unavailable');
      },
    };
    await expect(cleanupCliTokens(throws, 'user-a')).resolves.toBe(false);
  });
});
