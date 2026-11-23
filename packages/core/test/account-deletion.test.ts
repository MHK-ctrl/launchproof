import { describe, expect, it } from 'vitest';

import { deleteAccountForUser, type AccountDeletionAdmin } from '@/lib/account-deletion';

function fakeAdmin(
  options: { authFails?: boolean; cleanupFailsOn?: string; cleanupThrowsOn?: string } = {},
) {
  const deletedTables: string[] = [];
  const filters: Array<{ table: string; column: string; value: string }> = [];
  const admin: AccountDeletionAdmin = {
    auth: {
      admin: {
        async deleteUser() {
          return { error: options.authFails ? new Error('auth failure') : null };
        },
      },
    },
    from(table: string) {
      deletedTables.push(table);
      return {
        delete() {
          return {
            eq(column: string, value: string) {
              filters.push({ table, column, value });
              if (options.cleanupThrowsOn === table) throw new Error('cleanup exception');
              return Promise.resolve({
                error: options.cleanupFailsOn === table ? new Error('cleanup failure') : null,
              });
            },
          };
        },
      };
    },
  };
  return { admin, deletedTables, filters };
}

describe('account deletion', () => {
  it('does not remove application rows when the auth identity cannot be deleted', async () => {
    const { admin, deletedTables } = fakeAdmin({ authFails: true });
    const result = await deleteAccountForUser(admin, 'user-1');
    expect(result).toEqual({ ok: false, stage: 'auth' });
    expect(deletedTables).toEqual([]);
  });

  it('deletes every tenant-scoped table and the profile for the same user', async () => {
    const { admin, filters } = fakeAdmin();
    const result = await deleteAccountForUser(admin, 'user-1');
    expect(result).toEqual({ ok: true });
    expect(filters).toEqual([
      { table: 'findings', column: 'user_id', value: 'user-1' },
      { table: 'scans', column: 'user_id', value: 'user-1' },
      { table: 'repositories', column: 'user_id', value: 'user-1' },
      { table: 'cli_auth_requests', column: 'user_id', value: 'user-1' },
      { table: 'cli_tokens', column: 'user_id', value: 'user-1' },
      { table: 'profiles', column: 'id', value: 'user-1' },
    ]);
  });

  it('reports incomplete cleanup instead of claiming complete deletion', async () => {
    const { admin } = fakeAdmin({ cleanupFailsOn: 'scans' });
    const result = await deleteAccountForUser(admin, 'user-1');
    expect(result).toEqual({ ok: false, stage: 'cleanup' });
  });

  it('treats thrown auth and cleanup exceptions as failures', async () => {
    const authThrows = {
      auth: {
        admin: {
          deleteUser: async () => {
            throw new Error('auth unavailable');
          },
        },
      },
      from: () => {
        throw new Error('must not clean up after auth exception');
      },
    } as unknown as AccountDeletionAdmin;
    await expect(deleteAccountForUser(authThrows, 'user-1')).resolves.toEqual({
      ok: false,
      stage: 'auth',
    });

    const { admin } = fakeAdmin({ cleanupThrowsOn: 'findings' });
    await expect(deleteAccountForUser(admin, 'user-1')).resolves.toEqual({
      ok: false,
      stage: 'cleanup',
    });
  });
});
