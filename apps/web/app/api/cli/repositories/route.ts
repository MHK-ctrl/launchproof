import { apiError, jsonResponse } from '@/lib/api';
import { resolveCliToken } from '@/lib/cli-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request): Promise<Response> {
  const identity = await resolveCliToken(request);
  if (!identity) return apiError(401, 'unauthorized', 'A valid CLI token is required.');
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('repositories')
    .select('id,full_name,owner,name,visibility,connection_status,default_branch')
    .eq('user_id', identity.userId)
    .eq('connection_status', 'active')
    .order('full_name', { ascending: true });
  if (error) return apiError(500, 'repository_list_failed', 'Could not load repositories.');
  return jsonResponse({ repositories: data ?? [] });
}
