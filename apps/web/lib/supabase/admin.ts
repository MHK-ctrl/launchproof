import { createClient } from '@supabase/supabase-js';

import { getSupabasePublicConfig, requireServerEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * Service-role client for narrowly scoped server operations:
 * CLI token lookup/exchange, CLI-token uploads, and permanent account deletion.
 *
 * Never import this module from a Client Component. The key is not public.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const serviceRoleKey = requireServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
