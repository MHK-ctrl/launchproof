import { apiError, isSameOrigin, jsonResponse } from '@/lib/api';
import { getApiSession, githubIdentity } from '@/lib/auth';
import { clearConnectToken } from '@/lib/github';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(): Promise<Response> {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const identity = githubIdentity(session.user);
  return jsonResponse({
    user: {
      id: session.user.id,
      email: identity.email,
      githubUsername: identity.username,
      avatarUrl: identity.avatarUrl,
    },
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  if (!isSameOrigin(request)) return apiError(403, 'forbidden', 'Request origin is not allowed.');

  const admin = createSupabaseAdminClient();
  const userId = session.user.id;
  // Delete the auth identity first. The schema cascades from auth.users -> profiles -> all
  // tenant rows, so a failure here leaves the account and its data intact and retryable.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return apiError(500, 'account_delete_failed', 'Account could not be deleted.');
  await admin.from('findings').delete().eq('user_id', userId);
  await admin.from('scans').delete().eq('user_id', userId);
  await admin.from('repositories').delete().eq('user_id', userId);
  await admin.from('cli_auth_requests').delete().eq('user_id', userId);
  await admin.from('cli_tokens').delete().eq('user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearConnectToken();
  return jsonResponse({ deleted: true });
}
