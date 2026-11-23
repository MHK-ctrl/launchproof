import type { NextResponse } from 'next/server';

import { safeNextPath, syncProfile } from '@/lib/auth';
import { noStoreRedirect } from '@/lib/api';
import { setConnectToken } from '@/lib/github';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'));
  const wantsGitHubConnect = url.searchParams.get('connect') === 'github';
  const error = url.searchParams.get('error');

  if (error || !code) {
    return noStoreRedirect(
      new URL(`/auth/error?reason=${encodeURIComponent(error ?? 'missing_code')}`, url.origin),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !data.user) {
      return noStoreRedirect(new URL('/auth/error?reason=exchange_failed', url.origin));
    }
    await syncProfile(data.user);
    if (wantsGitHubConnect) {
      const providerToken = data.session?.provider_token;
      if (!providerToken) {
        return noStoreRedirect(
          new URL('/auth/error?reason=missing_github_repository_token', url.origin),
        );
      }
      await setConnectToken(providerToken, data.user.id);
    }
    return noStoreRedirect(new URL(next, url.origin));
  } catch {
    return noStoreRedirect(new URL('/auth/error?reason=callback_failed', url.origin));
  }
}
