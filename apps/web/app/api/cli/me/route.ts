import { apiError, jsonResponse } from '@/lib/api';
import { resolveCliToken } from '@/lib/cli-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request): Promise<Response> {
  const identity = await resolveCliToken(request);
  if (!identity) return apiError(401, 'unauthorized', 'A valid CLI token is required.');
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: token }] = await Promise.all([
    admin
      .from('profiles')
      .select('github_username,avatar_url,email')
      .eq('id', identity.userId)
      .maybeSingle(),
    admin
      .from('cli_tokens')
      .select('expires_at,last_used_at')
      .eq('id', identity.tokenId)
      .maybeSingle(),
  ]);
  return jsonResponse({
    authenticated: true,
    user: {
      githubUsername: profile?.github_username ?? null,
      email: profile?.email ?? null,
    },
    token: {
      expiresAt: token?.expires_at ?? null,
      lastUsedAt: token?.last_used_at ?? null,
    },
  });
}
