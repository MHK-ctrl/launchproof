'use client';

import { createBrowserClient } from '@supabase/ssr';

import { secureCookieOptions } from '@/lib/cookie-options';
import { getSupabasePublicConfig } from '@/lib/env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const origin = typeof window === 'undefined' ? null : window.location.origin;
  return createBrowserClient(url, anonKey, { cookieOptions: secureCookieOptions(origin) });
}
