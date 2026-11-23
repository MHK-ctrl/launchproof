import type { NextResponse } from 'next/server';

import { apiError, isSameOrigin, noStoreRedirect } from '@/lib/api';
import { clearConnectToken } from '@/lib/github';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return apiError(403, 'forbidden', 'Request origin is not allowed.');
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearConnectToken();
  return noStoreRedirect(new URL('/', request.url));
}
