import { createHash } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type RateLimitAdmin = ReturnType<typeof createSupabaseAdminClient>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  backend: 'postgres' | 'memory';
}

interface RateWindow {
  count: number;
  resetAt: number;
}

const MAX_MEMORY_WINDOWS = 10_000;
const rateWindows = new Map<string, RateWindow>();

/**
 * Per-process fallback. This is intentionally small and bounded: it protects a single
 * instance if the database limiter is unavailable, but it is not a global security boundary.
 */
export function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = rateWindows.get(key);
  if (!existing || existing.resetAt <= now) {
    if (rateWindows.size >= MAX_MEMORY_WINDOWS) {
      for (const [entryKey, entry] of rateWindows) {
        if (entry.resetAt <= now) rateWindows.delete(entryKey);
      }
      // If every retained window is still live, discard the oldest insertion. The map is
      // bounded so an attacker cannot grow process memory without limit.
      while (rateWindows.size >= MAX_MEMORY_WINDOWS) {
        const oldest = rateWindows.keys().next().value;
        if (oldest === undefined) break;
        rateWindows.delete(oldest);
      }
    }
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, backend: 'memory' };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      backend: 'memory',
    };
  }
  return { allowed: true, retryAfter: 0, backend: 'memory' };
}

export function resetMemoryRateLimiter(): void {
  rateWindows.clear();
}

function adminClient() {
  try {
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

/**
 * Atomic fixed-window limiter backed by Postgres when the service-role client and the
 * consume_rate_limit function are available. If the database path fails (missing function,
 * transient outage, local setup), the bounded per-process limiter is used instead.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: { admin?: RateLimitAdmin | null } = {},
): Promise<RateLimitResult> {
  if (key.length === 0 || key.length > 200 || limit < 1 || windowMs < 1_000) {
    throw new Error('Invalid rate-limit configuration.');
  }

  const admin = options.admin === undefined ? adminClient() : options.admin;
  if (admin) {
    try {
      const { data, error } = await admin.rpc('consume_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1_000),
      });
      const row = data?.[0];
      if (!error && row) {
        return {
          allowed: row.allowed,
          retryAfter: row.retry_after,
          backend: 'postgres',
        };
      }
    } catch {
      // Fall through to the local limiter. Do not log the key or the database error body.
    }
  }

  return memoryRateLimit(key, limit, windowMs);
}

export function clientAddress(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  // Only trust a header set by the hosting platform. On a developer machine or an unknown
  // proxy, x-forwarded-for/x-real-ip are caller-controlled and must not be a security input.
  const onVercel = environment.VERCEL === '1' || Boolean(environment.VERCEL_ENV);
  if (!onVercel) return 'local';
  const trusted = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (trusted && /^[0-9a-fA-F:.]{2,64}$/.test(trusted)) return trusted;
  return 'unknown';
}

/** Hash the trusted address so rate-limit rows never need to store a raw client IP. */
export function clientAddressKey(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return `ip:${createHash('sha256').update(clientAddress(request, environment)).digest('hex')}`;
}
