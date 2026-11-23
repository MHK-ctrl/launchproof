import { apiError, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { resolveCliToken } from '@/lib/cli-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { storeScanForUser } from '@/lib/scan-store';

export async function GET(request: Request): Promise<Response> {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const url = new URL(request.url);
  const repositoryId = url.searchParams.get('repositoryId');
  const gate = url.searchParams.get('gate');
  const q =
    url.searchParams
      .get('q')
      ?.replace(/[^A-Za-z0-9_.:/-]/g, '')
      .slice(0, 80) ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get('pageSize') ?? '20') || 20),
  );
  const from = (page - 1) * pageSize;

  let query = session.supabase
    .from('scans')
    .select('*, repositories(id, full_name, owner, name)', { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (repositoryId) query = query.eq('repository_id', repositoryId);
  if (gate === 'passed' || gate === 'failed' || gate === 'not-verified')
    query = query.eq('security_gate', gate);
  if (q) query = query.or(`commit_sha.ilike.%${q}%,branch.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) return apiError(500, 'scan_list_failed', 'Could not load scans.');
  return jsonResponse({ scans: data ?? [], total: count ?? 0, page, pageSize });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request, 2_000_000);
  if (!body.ok) return body.response;

  const cli = await resolveCliToken(request);
  if (cli) {
    const admin = createSupabaseAdminClient();
    const result = await storeScanForUser(admin, cli.userId, body.value);
    if (!result.ok) return apiError(result.status, result.code, result.message);
    return jsonResponse({ scanId: result.scanId, findingsStored: result.findingsStored }, 201);
  }

  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');

  const result = await storeScanForUser(session.supabase, session.user.id, body.value);
  if (!result.ok) return apiError(result.status, result.code, result.message);
  return jsonResponse({ scanId: result.scanId, findingsStored: result.findingsStored }, 201);
}
