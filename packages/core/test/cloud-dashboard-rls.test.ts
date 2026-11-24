import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  '../../../supabase/migrations/202611230001_cloud_dashboard.sql',
);

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

let db: PGlite;

async function asUser<T>(userId: string, action: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
  try {
    return await action();
  } finally {
    await db.exec('reset role');
  }
}

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public to authenticated;
    grant usage on schema public to anon;
  `);

  const migration = await readFile(migrationPath, 'utf8');
  await db.exec(migration);

  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'a@example.test', '{"user_name":"user-a"}'),
      ($2, 'b@example.test', '{"user_name":"user-b"}')`,
    [USER_A, USER_B],
  );

  await asUser(USER_A, async () => {
    await db.query(
      `insert into public.repositories
        (id, user_id, github_repository_id, owner, name, full_name, html_url, visibility)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, 1001, 'a', 'repo-a', 'a/repo-a', 'https://github.com/a/repo-a', 'public')`,
      [USER_A],
    );
    await db.query(
      `insert into public.scans
        (id, user_id, repository_id, client_scan_id, security_gate, scanner_version, total_checks, total_findings)
       values ('a1111111-1111-4111-8111-111111111111', $1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'LP-A', 'failed', '0.1.0', 2, 1)`,
      [USER_A],
    );
    await db.query(
      `insert into public.findings
        (id, user_id, scan_id, finding_key, rule_id, severity, title, description)
       values ('a2222222-2222-4222-8222-222222222222', $1, 'a1111111-1111-4111-8111-111111111111', 'FND-A', 'SECRET-1', 'high', 'A finding', 'Only A may read this.')`,
      [USER_A],
    );
  });

  await asUser(USER_B, async () => {
    await db.query(
      `insert into public.repositories
        (id, user_id, github_repository_id, owner, name, full_name, html_url, visibility)
       values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', $1, 2002, 'b', 'repo-b', 'b/repo-b', 'https://github.com/b/repo-b', 'private')`,
      [USER_B],
    );
    await db.query(
      `insert into public.scans
        (id, user_id, repository_id, client_scan_id, security_gate, scanner_version, total_checks, total_findings)
       values ('b1111111-1111-4111-8111-111111111111', $1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'LP-B', 'passed', '0.1.0', 1, 0)`,
      [USER_B],
    );
  });
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('cloud dashboard RLS isolation', () => {
  it('creates profiles from auth.users', async () => {
    const profiles = await rows<{ id: string; github_username: string }>(
      'select id, github_username from public.profiles order by github_username',
    );
    expect(profiles).toEqual([
      { id: USER_A, github_username: 'user-a' },
      { id: USER_B, github_username: 'user-b' },
    ]);
  });

  it('shows each user only their own repositories, scans, and findings', async () => {
    const result = await asUser(USER_A, async () => ({
      repositories: await rows<{ full_name: string }>('select full_name from public.repositories'),
      scans: await rows<{ client_scan_id: string }>('select client_scan_id from public.scans'),
      findings: await rows<{ finding_key: string }>('select finding_key from public.findings'),
    }));
    expect(result.repositories).toEqual([{ full_name: 'a/repo-a' }]);
    expect(result.scans).toEqual([{ client_scan_id: 'LP-A' }]);
    expect(result.findings).toEqual([{ finding_key: 'FND-A' }]);

    const b = await asUser(USER_B, async () => ({
      repositories: await rows<{ full_name: string }>('select full_name from public.repositories'),
      scans: await rows<{ client_scan_id: string }>('select client_scan_id from public.scans'),
      findings: await rows<{ finding_key: string }>('select finding_key from public.findings'),
    }));
    expect(b.repositories).toEqual([{ full_name: 'b/repo-b' }]);
    expect(b.scans).toEqual([{ client_scan_id: 'LP-B' }]);
    expect(b.findings).toEqual([]);
  });

  it('cannot read another user record by primary key', async () => {
    const scans = await asUser(USER_B, () =>
      rows('select id from public.scans where id = $1', ['a1111111-1111-4111-8111-111111111111']),
    );
    expect(scans).toEqual([]);
    const findings = await asUser(USER_B, () =>
      rows('select id from public.findings where id = $1', [
        'a2222222-2222-4222-8222-222222222222',
      ]),
    );
    expect(findings).toEqual([]);
  });

  it('does not let a user spoof user_id on insert', async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          `insert into public.repositories
            (user_id, github_repository_id, owner, name, full_name, html_url, visibility)
           values ($1, 9999, 'a', 'spoof', 'a/spoof', 'https://github.com/a/spoof', 'public')`,
          [USER_A],
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it('cannot attach a scan to another user repository', async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          `insert into public.scans
            (user_id, repository_id, client_scan_id, security_gate, scanner_version)
           values ($1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'LP-B-CROSS', 'passed', '0.1.0')`,
          [USER_B],
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it('cannot attach a finding to another user scan', async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          `insert into public.findings
            (user_id, scan_id, finding_key, rule_id, severity, title, description)
           values ($1, 'a1111111-1111-4111-8111-111111111111', 'CROSS', 'X', 'high', 'cross', 'cross')`,
          [USER_B],
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it('scopes updates and deletes to the owner', async () => {
    const update = await asUser(USER_B, () =>
      db.query(
        `update public.repositories set name = 'hijacked'
         where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`,
      ),
    );
    expect(update.affectedRows).toBe(0);
    const del = await asUser(USER_B, () =>
      db.query(`delete from public.scans where id = 'a1111111-1111-4111-8111-111111111111'`),
    );
    expect(del.affectedRows).toBe(0);
    const stillThere = await asUser(USER_A, () =>
      rows('select id from public.scans where id = $1', ['a1111111-1111-4111-8111-111111111111']),
    );
    expect(stillThere).toHaveLength(1);
  });

  it('does not expose another user through the aggregate view', async () => {
    const stats = await asUser(USER_B, () =>
      rows<{ repository_id: string; scan_count: number }>(
        'select repository_id, scan_count from public.repository_scan_stats',
      ),
    );
    expect(stats).toHaveLength(1);
    expect(stats[0]?.repository_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(Number(stats[0]?.scan_count)).toBe(1);
  });

  it('denies anonymous table access', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.query('select id from public.repositories')).rejects.toBeTruthy();
    } finally {
      await db.exec('reset role');
    }
  });
});
