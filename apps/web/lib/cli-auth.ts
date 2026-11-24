import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sha256 } from '@/lib/crypto';

export interface CliIdentity {
  userId: string;
  tokenId: string;
}

interface CliTokenState {
  expires_at: string;
  revoked_at: string | null;
}

interface CliCleanupAdmin {
  rpc: (
    fn: 'cleanup_cli_tokens',
    args: { p_user_id: string },
  ) => PromiseLike<{ error: unknown | null }>;
}

export async function cleanupCliTokens(admin: CliCleanupAdmin, userId: string): Promise<boolean> {
  try {
    const { error } = await admin.rpc('cleanup_cli_tokens', { p_user_id: userId });
    return !error;
  } catch {
    return false;
  }
}

export function isCliTokenActive(token: CliTokenState, now = Date.now()): boolean {
  if (token.revoked_at) return false;
  const expiresAt = Date.parse(token.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
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
  const now = Date.now();
  const { data, error } = await admin
    .from('cli_tokens')
    .select('id,user_id,expires_at,revoked_at')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (error || !data || !isCliTokenActive(data, now)) {
    return null;
  }
  await admin
    .from('cli_tokens')
    .update({ last_used_at: new Date(now).toISOString() })
    .eq('id', data.id);

  // Opportunistic, per-user cleanup. The SQL function only removes expired or revoked rows, so
  // the token that just authenticated cannot be deleted. Failure is non-fatal and is retried on
  // the next CLI request.
  await cleanupCliTokens(admin, data.user_id);
  return { userId: data.user_id, tokenId: data.id };
}
