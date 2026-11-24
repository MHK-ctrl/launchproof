import type { SupabaseClient } from '@supabase/supabase-js';

import type { FindingRow, ProfileRow, RepositoryRow, ScanRow } from '@/lib/database.types';

export type ScanWithRepository = ScanRow & {
  repositories: Pick<RepositoryRow, 'id' | 'full_name' | 'owner' | 'name'> | null;
};

export interface RepositoryStat {
  repository_id: string;
  user_id: string;
  scan_count: number;
  last_scan_at: string | null;
  last_successful_scan_at: string | null;
  latest_gate: 'passed' | 'failed' | 'not-verified' | null;
}

export interface ScanFilters {
  repositoryId?: string;
  gate?: 'passed' | 'failed' | 'not-verified';
  query?: string;
  page?: number;
  pageSize?: number;
}

export function severityRanks(): Record<string, number> {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
}

export function parseSeverityCounts(
  scan: Pick<ScanRow, 'severity_counts'>,
): Record<string, number> {
  const raw = scan.severity_counts;
  const result: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Object.keys(result)) {
      const value = (raw as Record<string, unknown>)[key];
      result[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
  }
  return result;
}

export function parseChecks(scan: Pick<ScanRow, 'checks'>): Array<{
  id: string;
  title: string;
  status: string;
  summary: string;
  details: string | null;
}> {
  if (!Array.isArray(scan.checks)) return [];
  return scan.checks.map((item) => {
    const record: Record<string, unknown> =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as unknown as Record<string, unknown>)
        : {};
    return {
      id: typeof record.id === 'string' ? record.id : '',
      title: typeof record.title === 'string' ? record.title : '',
      status: typeof record.status === 'string' ? record.status : 'not-verified',
      summary: typeof record.summary === 'string' ? record.summary : '',
      details: typeof record.details === 'string' ? record.details : null,
    };
  });
}

export function parseLimitations(scan: Pick<ScanRow, 'limitations'>): string[] {
  return Array.isArray(scan.limitations)
    ? scan.limitations.filter((item): item is string => typeof item === 'string')
    : [];
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function listRepositories(supabase: SupabaseClient): Promise<RepositoryRow[]> {
  const { data } = await supabase
    .from('repositories')
    .select('*')
    .order('updated_at', { ascending: false });
  return (data as RepositoryRow[] | null) ?? [];
}

export async function listRepositoryStats(supabase: SupabaseClient): Promise<RepositoryStat[]> {
  const { data } = await supabase.from('repository_scan_stats').select('*');
  return (data as RepositoryStat[] | null) ?? [];
}

export async function countScans(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from('scans').select('id', { count: 'exact', head: true });
  return count ?? 0;
}

export async function listRecentScans(
  supabase: SupabaseClient,
  limit = 8,
): Promise<ScanWithRepository[]> {
  const { data } = await supabase
    .from('scans')
    .select('*, repositories(id, full_name, owner, name)')
    .order('uploaded_at', { ascending: false })
    .limit(limit);
  return (data as ScanWithRepository[] | null) ?? [];
}

export async function listScans(
  supabase: SupabaseClient,
  filters: ScanFilters,
): Promise<{ scans: ScanWithRepository[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(filters.pageSize ?? 20)));
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('scans')
    .select('*, repositories(id, full_name, owner, name)', { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.repositoryId) query = query.eq('repository_id', filters.repositoryId);
  if (filters.gate) query = query.eq('security_gate', filters.gate);
  const search = filters.query?.replace(/[^A-Za-z0-9_.:/-]/g, '').slice(0, 80);
  if (search) query = query.or(`commit_sha.ilike.%${search}%,branch.ilike.%${search}%`);

  const { data, count } = await query;
  return {
    scans: (data as ScanWithRepository[] | null) ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getScan(
  supabase: SupabaseClient,
  scanId: string,
): Promise<ScanWithRepository | null> {
  const { data } = await supabase
    .from('scans')
    .select('*, repositories(id, full_name, owner, name)')
    .eq('id', scanId)
    .maybeSingle();
  return (data as ScanWithRepository | null) ?? null;
}

export async function getScanFindings(
  supabase: SupabaseClient,
  scanId: string,
): Promise<FindingRow[]> {
  const { data } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .order('severity', { ascending: true });
  const rows = (data as FindingRow[] | null) ?? [];
  const ranks = severityRanks();
  return rows.sort((a, b) => (ranks[b.severity] ?? 0) - (ranks[a.severity] ?? 0));
}

export async function getLatestScan(supabase: SupabaseClient): Promise<ScanWithRepository | null> {
  const rows = await listRecentScans(supabase, 1);
  return rows[0] ?? null;
}
