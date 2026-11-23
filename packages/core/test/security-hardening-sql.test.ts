import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  '../../../supabase/migrations/202611230003_security_hardening.sql',
);

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.profiles (id uuid primary key);
    create table public.cli_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles (id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      revoked_at timestamptz
    );
  `);
  const migration = await readFile(migrationPath, 'utf8');
  await db.exec(migration);
  // The migration must be safe to re-run if a deployment is interrupted and retried.
  await db.exec(migration);
}, 60_000);

afterAll(async () => {
  await db.close();
});

async function consume(key: string, limit = 2, seconds = 60) {
  const result = await db.query<{
    allowed: boolean;
    remaining: number;
    retry_after: number;
  }>('select * from public.consume_rate_limit($1, $2, $3)', [key, limit, seconds]);
  return result.rows[0]!;
}

describe('postgres rate limiter', () => {
  it('enforces a fixed window atomically', async () => {
    expect(await consume('fixed-window', 2)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await consume('fixed-window', 2)).toMatchObject({ allowed: true, remaining: 0 });
    const limited = await consume('fixed-window', 2);
    expect(limited.allowed).toBe(false);
    expect(limited.retry_after).toBeGreaterThan(0);
  });

  it('does not allow concurrent requests to exceed the limit', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => consume('concurrent', 3)));
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  it('resets after the window expires', async () => {
    await consume('reset', 1);
    expect((await consume('reset', 1)).allowed).toBe(false);
    await db.query(
      "update public.rate_limits set expires_at = clock_timestamp() - interval '1 second' where bucket = 'reset'",
    );
    expect(await consume('reset', 1)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('keeps buckets isolated', async () => {
    await consume('user-a', 1);
    expect((await consume('user-a', 1)).allowed).toBe(false);
    expect((await consume('user-b', 1)).allowed).toBe(true);
  });

  it('rejects invalid keys and limits instead of creating an unbounded row', async () => {
    await expect(
      db.query("select * from public.consume_rate_limit('', 1, 60)"),
    ).rejects.toBeTruthy();
    await expect(
      db.query("select * from public.consume_rate_limit(repeat('x', 201), 1, 60)"),
    ).rejects.toBeTruthy();
    await expect(
      db.query("select * from public.consume_rate_limit('bad-limit', 0, 60)"),
    ).rejects.toBeTruthy();
  });

  it('denies anon and authenticated callers the limiter table and function', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query('select * from public.rate_limits limit 1')).rejects.toBeTruthy();
        await expect(
          db.query("select * from public.consume_rate_limit('client-call', 1, 60)"),
        ).rejects.toBeTruthy();
      } finally {
        await db.exec('reset role');
      }
    }
  });
});

describe('CLI token cleanup', () => {
  beforeAll(async () => {
    await db.query('insert into public.profiles (id) values ($1), ($2)', [USER, OTHER_USER]);
    await db.query(
      `insert into public.cli_tokens (user_id, token_hash, expires_at, revoked_at) values
        ($1, 'active', now() + interval '1 day', null),
        ($1, 'expired', now() - interval '1 day', null),
        ($1, 'revoked', now() + interval '1 day', now()),
        ($2, 'other-active', now() + interval '1 day', null),
        ($2, 'other-expired', now() - interval '1 day', null)`,
      [USER, OTHER_USER],
    );
  });

  it('removes only expired and revoked tokens for the requested user', async () => {
    const result = await db.query<{ cleanup_cli_tokens: number }>(
      'select public.cleanup_cli_tokens($1)',
      [USER],
    );
    expect(Number(result.rows[0]?.cleanup_cli_tokens)).toBe(2);
    const remaining = await db.query<{ token_hash: string }>(
      'select token_hash from public.cli_tokens where user_id = $1 order by token_hash',
      [USER],
    );
    expect(remaining.rows).toEqual([{ token_hash: 'active' }]);
    const other = await db.query<{ token_hash: string }>(
      'select token_hash from public.cli_tokens where user_id = $1 order by token_hash',
      [OTHER_USER],
    );
    expect(other.rows.map((row) => row.token_hash)).toEqual(['other-active', 'other-expired']);
  });

  it('is safe to run with no matching tokens', async () => {
    const result = await db.query<{ cleanup_cli_tokens: number }>(
      'select public.cleanup_cli_tokens($1)',
      ['33333333-3333-4333-8333-333333333333'],
    );
    expect(Number(result.rows[0]?.cleanup_cli_tokens)).toBe(0);
  });
});
