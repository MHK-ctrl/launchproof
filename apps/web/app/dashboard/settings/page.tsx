import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { PageHeader } from '@/components/dashboard-ui';
import { getApiSession, requireUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Settings' };

async function revokeCliTokensAction() {
  'use server';
  const session = await getApiSession();
  if (!session) redirect('/login?next=/dashboard/settings');
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('cli_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .is('revoked_at', null);
  revalidatePath('/dashboard/settings');
  redirect(error ? '/dashboard/settings?error=revoke' : '/dashboard/settings?revoked=1');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; revoked?: string }>;
}) {
  const user = await requireUser('/dashboard/settings');
  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from('cli_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Settings"
        description="Manage CLI upload access and review the data-handling model for cloud scans."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-base font-semibold">CLI upload</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Uploads are explicit. The CLI authenticates through a browser flow, stores a short-lived
            revocable token in macOS Keychain when available, and never prints tokens.
          </p>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[#08111a] px-4 py-3 text-sm">
            <p>
              <span className="text-[var(--subtle)]">Active CLI tokens:</span> {count ?? 0}
            </p>
            <p className="mt-1 text-[var(--subtle)]">
              Tokens expire after 7 days. You can revoke every active token now; the CLI will need
              `launchproof login` again.
            </p>
          </div>
          {params.error === 'revoke' ? (
            <p className="mt-3 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
              The tokens could not be revoked. Try again before relying on revocation.
            </p>
          ) : null}
          {params.revoked ? (
            <p className="mt-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)]">
              All active CLI tokens were revoked.
            </p>
          ) : null}
          <form action={revokeCliTokensAction} className="mt-3">
            <button type="submit" className="btn btn-secondary !py-2 !text-xs" disabled={!count}>
              Revoke all CLI tokens
            </button>
          </form>
          <div className="code-block mt-4">
            <span className="prompt">$</span> launchproof login{'\n'}
            <span className="prompt">$</span> launchproof scan . --upload{'\n'}
            <span className="dim"># or upload a local report:</span>
            {'\n'}
            <span className="prompt">$</span> launchproof upload --file .launchproof/latest.json
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-base font-semibold">Privacy</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>
              Uploaded: sanitized findings, check summaries, counts, timestamps, repository
              metadata, commit SHA/branch if present.
            </li>
            <li>
              Not uploaded: source code, raw files, secrets, `.env` values, full local paths,
              unnecessary logs.
            </li>
            <li>Local reports remain on disk even when upload fails or is disabled.</li>
          </ul>
          <Link
            className="mt-4 inline-flex text-sm text-[var(--accent)] hover:underline"
            href="/security"
          >
            Read security and data flow
          </Link>
        </div>
      </div>
    </div>
  );
}
