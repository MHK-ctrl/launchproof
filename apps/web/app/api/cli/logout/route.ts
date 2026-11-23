import { apiError, jsonResponse } from '@/lib/api';
import { resolveCliToken } from '@/lib/cli-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request): Promise<Response> {
  const identity = await resolveCliToken(request);
  if (!identity) return apiError(401, 'unauthorized', 'A valid CLI token is required.');
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('cli_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', identity.tokenId)
    .eq('user_id', identity.userId);
  if (error) return apiError(500, 'logout_failed', 'CLI token could not be revoked.');
  return jsonResponse({ revoked: true });
}
