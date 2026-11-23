# Supabase Migration Tracking — Safe Reconciliation Workflow

**Status:** migrations 001 and 002 are applied to the hosted project manually; the migration ledger is
**absent**. Migration 003 (`security_hardening`) is prepared in the repository but **not applied** to
the hosted database. No hosted database mutation was performed in Phase 21.3.

This document is for the owner. Do not run `supabase db push`, `db reset`, or any destructive command
against the hosted project until the ledger has been reconciled and the plan has been reviewed.

## 1. Current state

| Version      | Name                            | Hosted state     | Repository file                                                        |
| ------------ | ------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| 202611230001 | cloud_dashboard                 | Applied manually | `supabase/migrations/202611230001_cloud_dashboard.sql`                 |
| 202611230002 | revoke_default_table_privileges | Applied manually | `supabase/migrations/202611230002_revoke_default_table_privileges.sql` |
| 202611230003 | security_hardening              | **Not applied**  | `supabase/migrations/202611230003_security_hardening.sql`              |

Evidence for 001/002 being applied: the Phase 21 and 21.2 hosted catalog audit found six tables with RLS
enabled, 16 policies, composite tenant foreign keys, triggers, the `repository_scan_stats` view, zero
`anon` table grants, and no `authenticated` `TRUNCATE` grant. The hosted RLS suite passed 17/17 twice.
This is operational evidence, not a ledger record.

**The absence of `supabase_migrations.schema_migrations` means the CLI cannot know what is applied.**
Do not infer that the hosted schema is empty, and do not replay migrations to "repair" the ledger.

## 2. Why this is safe to reconcile

The ledger is only bookkeeping. Recording a version does not run its SQL. The prepared
`supabase/manual/20261123_reconcile_migration_ledger.sql`:

- verifies the expected tables, RLS state, and composite tenant foreign key **before** writing;
- creates `supabase_migrations.schema_migrations` only if it does not exist;
- inserts versions 001 and 002 with `on conflict do nothing`;
- refuses to commit if either version is missing afterward;
- does not alter application tables, policies, functions, or rows.

It does **not** record 003. Migration 003 must be applied as its own reviewed change.

## 3. Owner workflow — read-only verification first

Run these in the Supabase SQL editor against project `ypqpqgnviphwxddrpieq` and keep the output for the
deployment record. These queries do not modify data.

```sql
-- Tables, RLS, and row-security flags
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles', 'repositories', 'scans', 'findings', 'cli_auth_requests', 'cli_tokens',
    'repository_scan_stats'
  )
order by c.relname;

-- Policies
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Table grants to API roles
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- Composite tenant foreign keys
select conname, conrelid::regclass as table_name, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
order by conname;

-- Migration ledger (expected to be absent before reconciliation)
select to_regclass('supabase_migrations.schema_migrations') as ledger;
```

Expected: six application tables plus the view; RLS true on the six tables; no `anon` grants; no
`TRUNCATE` for `authenticated`; composite `(repository_id, user_id)` / `(scan_id, user_id)` foreign keys.

If any check differs, **stop**. Do not record the migration as applied until the discrepancy is
understood and fixed additively.

## 4. Reconcile the ledger

1. Confirm the target project ref in the dashboard URL is `ypqpqgnviphwxddrpieq`.
2. Take a backup/snapshot if the plan and authorization permit it.
3. Open `supabase/manual/20261123_reconcile_migration_ledger.sql`, review it, and run it as one
   transaction in the SQL editor.
4. Verify:

   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```

   Expected exactly two rows: `202611230001` and `202611230002`.

5. Do not run migration 003 in the same step.

## 5. Apply migration 003 safely

Migration 003 adds one server-only table, its expiry index, and two functions; it does not alter existing
tables or rows.

1. Read `supabase/migrations/202611230003_security_hardening.sql`.
2. Prefer a linked CLI dry run if available and already authenticated:
   `supabase migration list --linked` should now show 001/002 as applied and 003 as pending.
   Use `supabase db push --dry-run` only after confirming the linked project and reviewing the output.
3. Apply 003 through the SQL editor or an approved `supabase db push`, during a low-traffic window.
4. Verify the new objects and keep the output:

   ```sql
   select proname, pg_get_function_identity_arguments(oid) as args
   from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('consume_rate_limit', 'cleanup_cli_tokens');

   select indexname from pg_indexes
   where schemaname = 'public' and indexname = 'rate_limits_expires_at_idx';

   select version, name from supabase_migrations.schema_migrations order by version;
   ```

5. If 003 fails, it is additive and can be rolled back by dropping only the new functions/index after
   confirming nothing depends on them. Never reset the database.

## 6. Future migration rules

- Every schema change is a new timestamped file under `supabase/migrations/`; never edit an applied
  migration.
- Apply through the linked CLI, or SQL editor only when the CLI is unavailable, and record the version.
- Before pushing, inspect `supabase migration list --linked` and `supabase db push --dry-run`.
- Never use `supabase db reset`, `drop schema`, `truncate`, or a migration that rewrites production
  tables without an explicit, reviewed backup and authorization.
- Add a local PGlite test for tenant-isolation, grant, and idempotency effects before applying.
- Hosted verification is a separate step; a local pass is not hosted evidence.

## 7. Honest status labels

- **VERIFIED (hosted):** 001/002 effects, as recorded in Phase 21/21.2 catalog and RLS evidence.
- **COMPLETED — LOCAL:** migration 003 and its tests; reconciliation SQL.
- **BLOCKED / OWNER ACTION:** creating the hosted ledger and applying 003. Neither was authorized in
  Phase 21.3.
- **NOT TESTED:** `supabase` CLI dry run and `migration list`, because the hosted ledger does not yet
  exist and no hosted mutation was authorized.
