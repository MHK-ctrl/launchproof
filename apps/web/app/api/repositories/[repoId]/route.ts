import { apiError, isSameOrigin, jsonResponse } from '@/lib/api';
import { getApiSession } from '@/lib/auth';

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ repoId: string }> }) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const { repoId } = await params;
  if (!isUuid(repoId)) return apiError(404, 'not_found', 'Repository not found.');

  const { data } = await session.supabase
    .from('repositories')
    .select('*')
    .eq('id', repoId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!data) return apiError(404, 'not_found', 'Repository not found.');
  return jsonResponse({ repository: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');
  const { repoId } = await params;
  if (!isUuid(repoId)) return apiError(404, 'not_found', 'Repository not found.');

  const { data, error } = await session.supabase
    .from('repositories')
    .update({ connection_status: 'disconnected' })
    .eq('id', repoId)
    .eq('user_id', session.user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return apiError(404, 'not_found', 'Repository not found.');
  return jsonResponse({ disconnected: true });
}
