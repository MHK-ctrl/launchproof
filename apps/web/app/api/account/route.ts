import { deleteAccountForUser } from '@/lib/account-deletion';
import { apiError, isSameOrigin, jsonResponse } from '@/lib/api';
import { getApiSession, githubIdentity } from '@/lib/auth';
import { clearConnectToken } from '@/lib/github';
import { serverErrorResponse } from '@/lib/observability';
import { rateLimit } from '@/lib/rate-limit';
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

  const limit = await rateLimit(`account-delete:user:${session.user.id}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return apiError(429, 'rate_limited', 'Too many account deletion attempts.', {
      'Retry-After': String(limit.retryAfter),
    });
  }

  const admin = createSupabaseAdminClient();
  const userId = session.user.id;
  // Delete the auth identity first. The schema cascades from auth.users -> profiles -> all
  // tenant rows, so an auth failure leaves the account and its data intact and retryable.
  const deletion = await deleteAccountForUser(admin, userId);
  if (!deletion.ok) {
    return deletion.stage === 'auth'
      ? serverErrorResponse(
          request,
          'account_delete_failed',
          'account_delete_failed',
          'Account could not be deleted.',
        )
      : serverErrorResponse(
          request,
          'account_cleanup_incomplete',
          'account_cleanup_incomplete',
          'Sign-in was removed, but data cleanup is incomplete. Contact support before retrying.',
        );
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearConnectToken();
  return jsonResponse({ deleted: true });
}
