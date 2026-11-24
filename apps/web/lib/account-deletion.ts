/**
 * Account deletion is ordered deliberately: remove the Supabase Auth identity first so a retry
 * cannot resurrect a partially deleted account, then verify the application rows were removed.
 * A cleanup failure is reported separately from an auth failure and is never presented as success.
 */

export interface AccountDeletionAdmin {
  auth: {
    admin: {
      deleteUser(userId: string): Promise<{ error: unknown | null }>;
    };
  };
  from(table: string): {
    delete(): {
      eq(column: string, value: string): PromiseLike<{ error: unknown | null }>;
    };
  };
}

export type AccountDeletionResult = { ok: true } | { ok: false; stage: 'auth' | 'cleanup' };

const APPLICATION_TABLES = [
  'findings',
  'scans',
  'repositories',
  'cli_auth_requests',
  'cli_tokens',
] as const;

export async function deleteAccountForUser(
  admin: AccountDeletionAdmin,
  userId: string,
): Promise<AccountDeletionResult> {
  try {
    const identity = await admin.auth.admin.deleteUser(userId);
    if (identity.error) return { ok: false, stage: 'auth' };
  } catch {
    return { ok: false, stage: 'auth' };
  }

  try {
    const cleanup = await Promise.all([
      ...APPLICATION_TABLES.map((table) => admin.from(table).delete().eq('user_id', userId)),
      admin.from('profiles').delete().eq('id', userId),
    ]);
    if (cleanup.some((result) => result.error)) return { ok: false, stage: 'cleanup' };
  } catch {
    return { ok: false, stage: 'cleanup' };
  }
  return { ok: true };
}
