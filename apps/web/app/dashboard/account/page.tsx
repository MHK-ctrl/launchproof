import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/dashboard-ui';
import { getApiSession, githubIdentity, requireUser } from '@/lib/auth';
import { clearConnectToken } from '@/lib/github';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Account' };

async function deleteAccountAction(formData: FormData) {
  'use server';
  const confirmation = String(formData.get('confirmation') ?? '');
  if (confirmation !== 'DELETE') {
    redirect('/dashboard/account?error=confirmation');
  }
  const session = await getApiSession();
  if (!session) redirect('/login?next=/dashboard/account');

  const admin = createSupabaseAdminClient();
  const userId = session.user.id;
  // Delete the auth identity first. The schema cascades from auth.users -> profiles -> tenant rows,
  // so a failure leaves the account intact rather than deleting data without deleting the login.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) redirect('/dashboard/account?error=delete');
  await admin.from('findings').delete().eq('user_id', userId);
  await admin.from('scans').delete().eq('user_id', userId);
  await admin.from('repositories').delete().eq('user_id', userId);
  await admin.from('cli_auth_requests').delete().eq('user_id', userId);
  await admin.from('cli_tokens').delete().eq('user_id', userId);
  await admin.from('profiles').delete().eq('id', userId);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  await clearConnectToken();
  redirect('/?account=deleted');
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser('/dashboard/account');
  const params = await searchParams;
  const identity = githubIdentity(user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Account"
        description="Your LaunchProof account is identified by GitHub sign-in. Deleting it permanently removes private dashboard data and scan history."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[var(--subtle)]">GitHub</dt>
              <dd className="font-medium">{identity.username ?? 'Connected account'}</dd>
            </div>
            <div>
              <dt className="text-[var(--subtle)]">Email</dt>
              <dd className="font-medium">{identity.email ?? 'Not provided by GitHub'}</dd>
            </div>
            <div>
              <dt className="text-[var(--subtle)]">User ID</dt>
              <dd className="font-mono text-xs text-[var(--muted)]">{user.id}</dd>
            </div>
          </dl>
        </div>

        <div className="panel border-[rgba(255,107,107,0.35)] p-5">
          <h2 className="text-base font-semibold text-[var(--red)]">Delete account</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            This permanently deletes your profile, connected repository metadata, scans, findings,
            and CLI tokens. Local files created by the CLI are not touched.
          </p>
          {params.error === 'confirmation' ? (
            <p className="mt-3 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
              Type DELETE exactly to confirm account deletion.
            </p>
          ) : null}
          {params.error === 'delete' ? (
            <p className="mt-3 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
              The account could not be deleted. No data was removed; try again.
            </p>
          ) : null}
          <form action={deleteAccountAction} className="mt-4 space-y-3">
            <label className="block text-xs text-[var(--subtle)]" htmlFor="confirmation">
              Type <span className="font-mono text-[var(--text)]">DELETE</span> to confirm
            </label>
            <input id="confirmation" name="confirmation" className="w-full" autoComplete="off" />
            <button
              type="submit"
              className="btn btn-secondary !border-[rgba(255,107,107,0.5)] !text-[var(--red)]"
            >
              Permanently delete account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
