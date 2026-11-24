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
const BATCH_USER = '33333333-3333-4333-8333-333333333333';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.profiles (id uuid primary key);
    create table public.repositories (id uuid primary key);
    create table public.scans (id uuid primary key);
    create table public.findings (id uuid primary key);
    create table public.cli_auth_requests (id uuid primary key);
    create view public.repository_scan_stats as select '00000000-0000-4000-8000-000000000000'::uuid as repository_id;
    create table public.cli_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles (id) on delete cascade,
      token_hash text not null unique,
      created_at timestamptz not null default now(),
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
    await expect(
      db.query("select * from public.consume_rate_limit('null-limit', null, 60)"),
    ).rejects.toBeTruthy();
    await expect(
      db.query("select * from public.consume_rate_limit('null-window', 1, null)"),
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

  it('grants the server role only the DML needed by the application', async () => {
    const result = await db.query<{
      profiles_select: boolean;
      profiles_insert: boolean;
      profiles_update: boolean;
      profiles_delete: boolean;
      tokens_delete: boolean;
      view_select: boolean;
      limiter_execute: boolean;
      client_select: boolean;
      client_execute: boolean;
    }>(`
      select
        has_table_privilege('service_role', 'public.profiles', 'SELECT') as profiles_select,
        has_table_privilege('service_role', 'public.profiles', 'INSERT') as profiles_insert,
        has_table_privilege('service_role', 'public.profiles', 'UPDATE') as profiles_update,
        has_table_privilege('service_role', 'public.profiles', 'DELETE') as profiles_delete,
        has_table_privilege('service_role', 'public.cli_tokens', 'DELETE') as tokens_delete,
        has_table_privilege('service_role', 'public.repository_scan_stats', 'SELECT') as view_select,
        has_function_privilege('service_role', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as limiter_execute,
        has_table_privilege('anon', 'public.profiles', 'SELECT') as client_select,
        has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'EXECUTE') as client_execute
    `);
    expect(result.rows[0]).toEqual({
      profiles_select: true,
      profiles_insert: true,
      profiles_update: true,
      profiles_delete: true,
      tokens_delete: true,
      view_select: true,
      limiter_execute: true,
      client_select: false,
      client_execute: false,
    });
  });

  it('keeps future tables closed to client roles by default', async () => {
    await db.exec('create table public.future_table (id integer primary key)');
    const result = await db.query<{ anon_select: boolean; service_select: boolean }>(`
      select
        has_table_privilege('anon', 'public.future_table', 'SELECT') as anon_select,
        has_table_privilege('service_role', 'public.future_table', 'SELECT') as service_select
    `);
    expect(result.rows[0]).toEqual({ anon_select: false, service_select: true });
  });

  it('cleans expired rate-limit buckets in bounded batches', async () => {
    await db.query(`
      insert into public.rate_limits (bucket, window_start, count, expires_at) values
        ('cleanup-old-1', now() - interval '2 hours', 1, now() - interval '2 hours'),
        ('cleanup-old-2', now() - interval '1 hour', 1, now() - interval '1 hour'),
        ('cleanup-old-3', now() - interval '30 minutes', 1, now() - interval '30 minutes'),
        ('cleanup-live-1', now(), 1, now() + interval '1 hour'),
        ('cleanup-live-2', now(), 1, now() + interval '1 hour')
    `);
    const first = await db.query<{ cleanup_rate_limits: number }>(
      'select public.cleanup_rate_limits(2)',
    );
    expect(Number(first.rows[0]?.cleanup_rate_limits)).toBe(2);
    const second = await db.query<{ cleanup_rate_limits: number }>(
      'select public.cleanup_rate_limits(2)',
    );
    expect(Number(second.rows[0]?.cleanup_rate_limits)).toBe(1);
    const remaining = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.rate_limits where bucket like 'cleanup-%'",
    );
    expect(Number(remaining.rows[0]?.count)).toBe(2);
    await expect(db.query('select public.cleanup_rate_limits(0)')).rejects.toBeTruthy();
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

  it('caps each cleanup batch and preserves the active token', async () => {
    await db.query('insert into public.profiles (id) values ($1)', [BATCH_USER]);
    await db.query(
      `insert into public.cli_tokens (user_id, token_hash, expires_at)
       select $1, 'batch-' || g, now() - interval '1 day'
       from generate_series(1, 105) as g`,
      [BATCH_USER],
    );
    await db.query(
      `insert into public.cli_tokens (user_id, token_hash, expires_at)
       values ($1, 'batch-active', now() + interval '1 day')`,
      [BATCH_USER],
    );

    expect((await db.query('select public.cleanup_cli_tokens($1)', [BATCH_USER])).rows[0]).toEqual({
      cleanup_cli_tokens: 100,
    });
    expect((await db.query('select public.cleanup_cli_tokens($1)', [BATCH_USER])).rows[0]).toEqual({
      cleanup_cli_tokens: 5,
    });
    const remaining = await db.query<{ token_hash: string }>(
      'select token_hash from public.cli_tokens where user_id = $1',
      [BATCH_USER],
    );
    expect(remaining.rows).toEqual([{ token_hash: 'batch-active' }]);
  });
});
