import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/dashboard-ui';
import { getApiSession, requireUser, safeNextPath } from '@/lib/auth';
import { sha256 } from '@/lib/crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Authorize CLI',
  robots: { index: false, follow: false, nocache: true },
};

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

async function approveCliAction(formData: FormData) {
  'use server';
  const session = await getApiSession();
  if (!session) redirect('/login?next=/dashboard/settings');
  const requestId = String(formData.get('requestId') ?? '');
  const code = String(formData.get('code') ?? '');
  if (!isUuid(requestId) || !/^lp_code_[A-Za-z0-9_-]{20,}$/.test(code)) {
    redirect('/cli/authorize?error=invalid');
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('cli_auth_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (
    !data ||
    data.expires_at <= new Date().toISOString() ||
    data.consumed_at ||
    sha256(code) !== data.code_hash
  ) {
    redirect('/cli/authorize?error=expired');
  }
  const { error } = await admin
    .from('cli_auth_requests')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', data.id)
    .eq('user_id', session.user.id);
  if (error) redirect('/cli/authorize?error=approval');
  const callback = new URL(`http://127.0.0.1:${data.redirect_port}/callback`);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', data.state);
  redirect(callback.toString());
}

export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string; code?: string; error?: string }>;
}) {
  const params = await searchParams;
  const requestId = params.request ?? '';
  const code = params.code ?? '';
  const nextPath = safeNextPath(
    `/cli/authorize?request=${encodeURIComponent(requestId)}&code=${encodeURIComponent(code)}`,
  );
  const user = await requireUser(nextPath);
  const admin = createSupabaseAdminClient();
  const validShape = isUuid(requestId) && /^lp_code_[A-Za-z0-9_-]{20,}$/.test(code);
  const { data: request } = validShape
    ? await admin
        .from('cli_auth_requests')
        .select('id,redirect_port,expires_at,approved_at,consumed_at')
        .eq('id', requestId)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };
  const expired = !request || request.expires_at <= new Date().toISOString() || request.consumed_at;

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-lg p-8">
        <PageHeader
          eyebrow="CLI authorization"
          title="Approve this command line?"
          description="A LaunchProof CLI process on this computer is asking to upload sanitized scan summaries to your account."
        />
        {params.error ? (
          <p className="mt-4 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
            This authorization request is no longer valid. Start the CLI login again.
          </p>
        ) : null}
        {expired ? (
          <div className="mt-5 rounded-lg border border-[var(--border)] bg-[#08111a] p-4 text-sm text-[var(--muted)]">
            This request has expired or was already used. Run{' '}
            <code className="mono">launchproof login</code> again.
          </div>
        ) : (
          <>
            <dl className="mt-5 space-y-2 rounded-lg border border-[var(--border)] bg-[#08111a] p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--subtle)]">Loopback port</dt>
                <dd className="mono">{request.redirect_port}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--subtle)]">Expires</dt>
                <dd>{new Date(request.expires_at).toLocaleTimeString()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--subtle)]">Account</dt>
                <dd>{user.email ?? user.id.slice(0, 8)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              Only approve if you just ran <code className="mono">launchproof login</code>. Uploads
              remain explicit and sanitized; source code and secrets are not sent.
            </p>
            <form action={approveCliAction} className="mt-5 flex flex-wrap gap-3">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="code" value={code} />
              <button type="submit" className="btn btn-primary">
                Approve CLI
              </button>
              <Link href="/dashboard/settings" className="btn btn-secondary">
                Cancel
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
