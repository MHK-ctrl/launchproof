import type { NextResponse } from 'next/server';

import { apiError, noStoreRedirect } from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { appBaseUrl } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getApiSession();
  if (!session) {
    return noStoreRedirect(new URL('/login?next=/dashboard/repositories', request.url));
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      // GitHub has no read-only private-repository OAuth scope. `repo` is required to enumerate
      // private repository metadata; LaunchProof uses it only for GET requests and never stores it.
      scopes: 'read:user repo',
      redirectTo: `${appBaseUrl()}/auth/callback?next=/dashboard/repositories/connect&connect=github`,
    },
  });
  if (error || !data.url) {
    return apiError(502, 'github_oauth_unavailable', 'GitHub authorization could not be started.');
  }
  return noStoreRedirect(data.url);
}
