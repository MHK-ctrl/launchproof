import path from 'node:path';

import type { LaunchProofConfig } from './config/schema.js';
import { createCheck, createFinding } from './checks.js';
import { readTextFile } from './fs-utils.js';
import type { CheckResult, Finding } from './types.js';
import type { HttpClient } from './http/client.js';
import { isLoopbackHost, truncate } from './util.js';

interface MigrationFile {
  path: string;
  name: string;
  content: string;
}

interface TableReference {
  table: string;
  file: string;
}

function normalizeTable(raw: string): string {
  return raw
    .replaceAll('"', '')
    .replace(/^public\./i, '')
    .trim();
}

function collectTables(migrations: MigrationFile[]): TableReference[] {
  const tables: TableReference[] = [];
  const seen = new Set<string>();
  for (const migration of migrations) {
    const pattern =
      /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?public"?\.)?"?[A-Za-z_][A-Za-z0-9_]*"?)/gi;
    for (const match of migration.content.matchAll(pattern)) {
      const table = normalizeTable(match[1] ?? '');
      if (!table || seen.has(table.toLowerCase())) continue;
      seen.add(table.toLowerCase());
      tables.push({ table, file: migration.path });
    }
  }
  return tables;
}

function tableHasRls(migrations: MigrationFile[], table: string): boolean {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:"?public"?\\.)?"?${escaped}"?\\s+enable\\s+row\\s+level\\s+security`,
    'i',
  );
  return migrations.some((migration) => pattern.test(migration.content));
}

function tableHasPolicy(migrations: MigrationFile[], table: string): boolean {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `create\\s+policy[\\s\\S]{0,80}?\\bon\\s+(?:"?public"?\\.)?"?${escaped}"?\\b`,
    'i',
  );
  return migrations.some((migration) => pattern.test(migration.content));
}

export interface SupabaseCheckOptions {
  config: LaunchProofConfig;
  rootDir: string;
  client?: HttpClient;
}

export async function runSupabaseChecks(options: SupabaseCheckOptions): Promise<CheckResult[]> {
  const started = Date.now();
  const { config } = options;
  if (!config.supabase.enabled) {
    return [
      createCheck({
        id: 'database.supabase-rls',
        title: 'Supabase row-level security',
        category: 'database',
        status: 'skipped',
        summary: 'Supabase analysis is disabled in configuration.',
        durationMs: 0,
      }),
    ];
  }

  const dir = path.resolve(options.rootDir, config.supabase.migrationsDir);
  const relative = path.relative(options.rootDir, dir);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return [
      createCheck({
        id: 'database.supabase-rls',
        title: 'Supabase row-level security',
        category: 'database',
        status: 'error',
        summary: 'The configured Supabase migrations directory is outside the project.',
        error: 'supabase.migrationsDir must point inside the project directory.',
        durationMs: 0,
      }),
    ];
  }

  let entries: string[] = [];
  try {
    const { promises: fs } = await import('node:fs');
    entries = (await fs.readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  } catch {
    entries = [];
  }
  const noMigrations = entries.length === 0;

  const migrations: MigrationFile[] = [];
  for (const name of entries.slice(0, 40)) {
    const result = await readTextFile(path.join(dir, name), 1_000_000);
    if (result && !result.binary) {
      migrations.push({
        path: `${config.supabase.migrationsDir}/${name}`,
        name,
        content: result.text,
      });
    }
  }
  const tables = collectTables(migrations);
  const findings: Finding[] = [];
  const allSql = migrations.map((migration) => migration.content).join('\n');

  for (const reference of tables) {
    if (!tableHasRls(migrations, reference.table)) {
      findings.push(
        createFinding({
          checkId: 'database.supabase-rls',
          title: `Row-level security is not enabled on "${reference.table}"`,
          description: `A table is created in migrations without an ALTER TABLE ... ENABLE ROW LEVEL SECURITY statement. With the anon key, Supabase exposes tables that have RLS disabled.`,
          severity: 'high',
          confidence: 'high',
          verification: 'observed',
          category: 'database',
          impact:
            'Anyone with the public anon key may be able to read, insert, update, or delete every row in the table.',
          remediation: `Enable row-level security and add explicit policies for the operations you support:\n  alter table public.${reference.table} enable row level security;\n  create policy "owner reads" on public.${reference.table} for select using (auth.uid() = user_id);`,
          evidence: [{ kind: 'sql', label: 'Table', value: reference.table }],
          location: { file: reference.file },
          references: ['https://supabase.com/docs/guides/database/postgres/row-level-security'],
          key: `rls:${reference.table}`,
        }),
      );
    } else if (!tableHasPolicy(migrations, reference.table)) {
      findings.push(
        createFinding({
          checkId: 'database.supabase-rls',
          title: `"${reference.table}" has RLS enabled but no matching policy`,
          description:
            'RLS is enabled, but no CREATE POLICY statement was found in the migration set. The table will deny access to the anon and authenticated roles by default.',
          severity: 'low',
          confidence: 'medium',
          verification: 'pattern',
          category: 'database',
          impact: 'Features that should read this table may fail for signed-in users.',
          remediation: `Add narrowly scoped policies for ${reference.table}, or confirm that deny-all is intentional.`,
          evidence: [{ kind: 'sql', label: 'Table', value: reference.table }],
          location: { file: reference.file },
          key: `rls:policy-missing:${reference.table}`,
        }),
      );
    }
  }

  if (/create\s+policy[\s\S]{0,500}?using\s*\(\s*true\s*\)/gi.test(allSql)) {
    findings.push(
      createFinding({
        checkId: 'database.supabase-rls',
        title: 'RLS policy allows every row',
        description:
          'At least one policy uses USING (true), which permits access to all rows for the applicable role.',
        severity: 'high',
        confidence: 'medium',
        verification: 'pattern',
        category: 'database',
        impact: 'RLS is technically enabled but provides no row isolation.',
        remediation:
          'Replace USING (true) with an ownership or membership predicate such as auth.uid() = user_id.',
        location: { file: config.supabase.migrationsDir },
        references: ['https://supabase.com/docs/guides/database/postgres/row-level-security'],
        key: 'rls:policy-true',
      }),
    );
  }

  if (
    /create\s+(?:or\s+replace\s+)?function[\s\S]{0,400}?security\s+definer(?![^;]*set\s+search_path)/i.test(
      allSql,
    )
  ) {
    findings.push(
      createFinding({
        checkId: 'database.supabase-rls',
        title: 'SECURITY DEFINER function without a fixed search_path',
        description:
          'A SECURITY DEFINER function does not pin search_path. A caller can potentially redirect unqualified object references.',
        severity: 'medium',
        confidence: 'medium',
        verification: 'pattern',
        category: 'database',
        impact: 'Privilege escalation through function resolution is possible in some deployments.',
        remediation:
          'Add "set search_path = public" (or a narrower schema) to every SECURITY DEFINER function.',
        references: [
          'https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker',
        ],
        key: 'rls:security-definer',
      }),
    );
  }

  if (/storage\.buckets[\s\S]{0,300}?public[\s\S]{0,40}?true/i.test(allSql)) {
    findings.push(
      createFinding({
        checkId: 'database.supabase-rls',
        title: 'A storage bucket is configured as public',
        description: 'A storage bucket is created with public access enabled.',
        severity: 'medium',
        confidence: 'medium',
        verification: 'pattern',
        category: 'database',
        impact: 'Anyone with an object URL can retrieve uploaded files.',
        remediation:
          'Keep buckets private and serve files through signed URLs or an authorized server route.',
        key: 'storage:public-bucket',
      }),
    );
  }

  const checks: CheckResult[] = [
    createCheck({
      id: 'database.supabase-rls',
      title: 'Supabase row-level security (static)',
      category: 'database',
      status: noMigrations
        ? 'skipped'
        : findings.some((f) => f.severity === 'high' || f.severity === 'critical')
          ? 'fail'
          : findings.length > 0
            ? 'warn'
            : 'pass',
      summary: noMigrations
        ? `No SQL migrations were found in ${config.supabase.migrationsDir}; static RLS analysis was skipped.`
        : tables.length === 0
          ? 'No CREATE TABLE statements were found in the migrations.'
          : `${tables.length} table(s) reviewed in ${migrations.length} migration(s); ${findings.length} policy issue(s) found.`,
      findings,
      evidence: [
        { kind: 'metric', label: 'Migrations parsed', value: String(migrations.length) },
        { kind: 'metric', label: 'Tables discovered', value: String(tables.length) },
      ],
      details: noMigrations
        ? 'Static RLS analysis requires SQL migrations under supabase/migrations.'
        : 'Static SQL parsing cannot prove the policy state of a deployed database. Apply migrations to a staging project and test with real anon and authenticated tokens.',
      durationMs: Date.now() - started,
    }),
  ];

  const live = config.supabase.live;
  if (!live) {
    return checks;
  }

  const liveStarted = Date.now();
  const key = process.env[live.anonKeyEnv];
  if (!key) {
    checks.push(
      createCheck({
        id: 'database.supabase-live',
        title: 'Supabase live RLS probe',
        category: 'database',
        status: 'skipped',
        summary: `The anon key environment variable ${live.anonKeyEnv} is not set, so no live probe was performed.`,
        durationMs: 0,
      }),
    );
    return checks;
  }
  if (!options.client) {
    checks.push(
      createCheck({
        id: 'database.supabase-live',
        title: 'Supabase live RLS probe',
        category: 'database',
        status: 'skipped',
        summary: 'A live probe requires an HTTP client and network authorization.',
        durationMs: 0,
      }),
    );
    return checks;
  }
  if (live.tables.length === 0) {
    checks.push(
      createCheck({
        id: 'database.supabase-live',
        title: 'Supabase live RLS probe',
        category: 'database',
        status: 'skipped',
        summary: 'Live Supabase probing is configured without any tables.',
        durationMs: 0,
      }),
    );
    return checks;
  }

  const liveFindings: Finding[] = [];
  const results: string[] = [];
  let inconclusive = 0;
  for (const table of live.tables.slice(0, 8)) {
    const url = `${live.url.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${live.maxRows}`;
    try {
      const response = await options.client.request(url, {
        headers: { apikey: key, authorization: `Bearer ${key}` },
      });
      results.push(`${table}: HTTP ${response.status}`);
      if (response.status !== 200 && response.status !== 401 && response.status !== 403) {
        inconclusive += 1;
      }
      if (response.status === 200) {
        let rows = 0;
        try {
          const parsed = JSON.parse(response.bodyText) as unknown;
          rows = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          rows = 0;
        }
        liveFindings.push(
          createFinding({
            checkId: 'database.supabase-live',
            title: `Anon role can read table "${table}"`,
            description: `A request using the public anon key received HTTP 200${rows > 0 ? ` and returned ${rows} row(s)` : ' with no rows'}. The SELECT policy does not isolate this table from anonymous access.`,
            severity: rows > 0 ? 'critical' : 'medium',
            confidence: 'high',
            verification: 'observed',
            category: 'database',
            impact:
              rows > 0
                ? 'Anyone can read real data from the table using credentials shipped to every browser.'
                : 'Anonymous reads are permitted. Data exposure depends on the current contents and future inserts.',
            remediation:
              'Restrict SELECT policies to authenticated owners, and verify with the anon key that the response is 401/403 or an empty result.',
            evidence: [
              { kind: 'http', label: 'Table', value: table },
              { kind: 'http', label: 'Status', value: String(response.status) },
              { kind: 'metric', label: 'Rows returned', value: String(rows) },
            ],
            location: { url: `${live.url.replace(/\/+$/, '')}/rest/v1/${table}` },
            key: `supabase-live:${table}`,
          }),
        );
      }
    } catch (error) {
      inconclusive += 1;
      results.push(
        `${table}: ${truncate(error instanceof Error ? error.message : 'request failed', 120)}`,
      );
    }
  }

  checks.push(
    createCheck({
      id: 'database.supabase-live',
      title: 'Supabase live RLS probe',
      category: 'database',
      status: liveFindings.length > 0 ? 'fail' : inconclusive > 0 ? 'warn' : 'pass',
      summary:
        liveFindings.length > 0
          ? `${liveFindings.length} table(s) are readable with the public anon key.`
          : inconclusive > 0
            ? `${inconclusive} table probe(s) returned an inconclusive status or network error; no protection pass is claimed.`
            : 'Anon-key requests were rejected with 401/403 or returned no readable table data.',
      findings: liveFindings,
      evidence: results.map((value) => ({ kind: 'text' as const, label: 'Probe', value })),
      details: isLoopbackHost(new URL(live.url).hostname)
        ? 'The live probe targeted a loopback Supabase-compatible endpoint.'
        : 'Only a single-row SELECT probe per table was executed. Write policies and column-level grants were not tested.',
      durationMs: Date.now() - liveStarted,
    }),
  );
  return checks;
}
