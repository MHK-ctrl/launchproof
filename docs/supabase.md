# Supabase review

LaunchProof has a static RLS review and an optional live read probe. Neither uses a service-role key.

## Static review

```json
{ "supabase": { "enabled": true, "migrationsDir": "supabase/migrations" } }
```

The scanner reads SQL migration files (up to 40) and looks for:

- `CREATE TABLE` without a matching `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the migration set
- tables with RLS enabled but no matching policy (low severity; may be intentional deny-all)
- policies using `USING (true)` (high severity: RLS enabled but no row isolation)
- `SECURITY DEFINER` functions without a fixed `search_path`
- public storage buckets

Static parsing cannot prove the state of a deployed database. Policies can be added in later
migrations, changed manually, or managed outside this directory. The finding's evidence names the
table and file, not credentials.

## Live read probe

```json
{
  "supabase": {
    "live": {
      "url": "https://staging-project.supabase.co",
      "anonKeyEnv": "SUPABASE_ANON_KEY",
      "tables": ["profiles", "orders"],
      "maxRows": 1
    }
  }
}
```

Requirements:

- `scan.network: true`
- the Supabase URL must pass authorization scope (non-loopback requires explicit authorization)
- `SUPABASE_ANON_KEY` (or the configured variable) must be set
- table names must be explicitly listed

The probe sends one `GET /rest/v1/<table>?select=*&limit=1` per table with the anon key. A 200
response is reported: critical if rows are returned, medium if the read is permitted but empty. 401
and 403 are treated as protected. The key is never printed or placed in evidence.

## What is not tested

- Write policies, updates, deletes, or storage upload policies
- Column-level grants
- Authenticated-user RLS behavior (the probe uses the anon key only)
- Realtime subscriptions or edge functions
- Service-role behavior

Test those against a staging project with dedicated identities. Do not run write probes against
production.

## Safe defaults

Static review is enabled but does nothing if no migrations exist. Live probing is absent unless
configured. The live probe is read-only and bounded to one row per listed table (max 8 tables).
