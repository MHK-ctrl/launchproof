import { apiError, jsonResponse } from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { severityRanks } from '@/lib/dashboard-data';

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const { scanId } = await params;
  if (!isUuid(scanId)) return apiError(404, 'not_found', 'Scan not found.');

  const { data: scan } = await session.supabase
    .from('scans')
    .select('id')
    .eq('id', scanId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!scan) return apiError(404, 'not_found', 'Scan not found.');

  const { data, error } = await session.supabase
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .eq('user_id', session.user.id);
  if (error) return apiError(500, 'findings_failed', 'Could not load findings.');
  const ranks = severityRanks();
  const findings = (data ?? []).sort((a, b) => (ranks[b.severity] ?? 0) - (ranks[a.severity] ?? 0));
  return jsonResponse({ findings });
}
