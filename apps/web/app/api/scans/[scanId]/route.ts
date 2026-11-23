import { apiError, isSameOrigin, jsonResponse } from '@/lib/api';
import { getApiSession } from '@/lib/auth';

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const { scanId } = await params;
  if (!isUuid(scanId)) return apiError(404, 'not_found', 'Scan not found.');

  const { data } = await session.supabase
    .from('scans')
    .select('*, repositories(id, full_name, owner, name)')
    .eq('id', scanId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!data) return apiError(404, 'not_found', 'Scan not found.');
  return jsonResponse({ scan: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');
  const { scanId } = await params;
  if (!isUuid(scanId)) return apiError(404, 'not_found', 'Scan not found.');

  const { data } = await session.supabase
    .from('scans')
    .delete()
    .eq('id', scanId)
    .eq('user_id', session.user.id)
    .select('id')
    .maybeSingle();
  if (!data) return apiError(404, 'not_found', 'Scan not found.');
  return jsonResponse({ deleted: true });
}
