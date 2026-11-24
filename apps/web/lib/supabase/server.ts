import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { secureCookieOptions } from '@/lib/cookie-options';
import { appBaseUrl, getSupabasePublicConfig } from '@/lib/env';

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookieOptions: secureCookieOptions(appBaseUrl()),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. apps/web/proxy.ts refreshes the session.
        }
      },
    },
  });
}
