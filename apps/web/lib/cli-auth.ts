import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sha256 } from '@/lib/crypto';

export interface CliIdentity {
  userId: string;
  tokenId: string;
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(lp_cli_[A-Za-z0-9_-]{20,})$/.exec(value);
  return match?.[1] ?? null;
}

export async function resolveCliToken(request: Request): Promise<CliIdentity | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('cli_tokens')
    .select('id,user_id,expires_at,revoked_at')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (error || !data || data.revoked_at || data.expires_at <= now) {
    return null;
  }
  await admin.from('cli_tokens').update({ last_used_at: now }).eq('id', data.id);
  return { userId: data.user_id, tokenId: data.id };
}
