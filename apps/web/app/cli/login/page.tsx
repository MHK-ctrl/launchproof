import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/dashboard-ui';
import { getApiSession, requireUser } from '@/lib/auth';
import { randomToken, sha256 } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CLI login',
  robots: { index: false, follow: false, nocache: true },
};

function validRequest(state: string, challenge: string, port: number): boolean {
  return (
    /^[A-Za-z0-9_-]{16,128}$/.test(state) &&
    /^[A-Za-z0-9_-]{43,128}$/.test(challenge) &&
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535
  );
}

async function startLoginAction(formData: FormData) {
  'use server';
  const session = await getApiSession();
  if (!session) redirect('/login?next=/dashboard/settings');

  const state = String(formData.get('state') ?? '');
  const challenge = String(formData.get('challenge') ?? '');
  const port = Number(formData.get('port') ?? '0');
  if (!validRequest(state, challenge, port)) {
    redirect('/cli/login?error=invalid');
  }

  const limit = await rateLimit(`cli-login:${session.user.id}`, 10, 60_000);
  if (!limit.allowed) {
    redirect('/cli/login?error=rate_limited');
  }

  const admin = createSupabaseAdminClient();
  const code = `lp_code_${randomToken(32)}`;
  const { data, error } = await admin
    .from('cli_auth_requests')
    .insert({
      user_id: session.user.id,
      state,
      code_hash: sha256(code),
      code_challenge: challenge,
      redirect_port: port,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    redirect('/cli/login?error=unavailable');
  }
  redirect(
    `/cli/authorize?request=${encodeURIComponent(data.id)}&code=${encodeURIComponent(code)}`,
  );
}

export default async function CliLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; challenge?: string; port?: string; error?: string }>;
}) {
  const params = await searchParams;
  const state = params.state ?? '';
  const challenge = params.challenge ?? '';
  const port = Number(params.port ?? '0');
  const nextPath = `/cli/login?state=${encodeURIComponent(state)}&challenge=${encodeURIComponent(challenge)}&port=${encodeURIComponent(String(port))}`;
  const user = await requireUser(nextPath);
  const shapeValid = validRequest(state, challenge, port);

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-lg p-8">
        <PageHeader
          eyebrow="CLI login"
          title={shapeValid ? 'Authorize this command line?' : 'Invalid CLI request'}
          description={
            shapeValid
              ? 'A LaunchProof CLI process on this computer is asking to create a revocable upload token for your account.'
              : 'Run launchproof login again to create a new authorization request.'
          }
        />
        {params.error ? (
          <p className="mt-4 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
            {params.error === 'rate_limited'
              ? 'Too many authorization attempts. Wait a minute and try again.'
              : 'The authorization request could not be created. Confirm the cloud database is configured and try again.'}
          </p>
        ) : null}
        {shapeValid ? (
          <>
            <dl className="mt-5 space-y-2 rounded-lg border border-[var(--border)] bg-[#08111a] p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--subtle)]">Loopback port</dt>
                <dd className="mono">{port}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--subtle)]">Account</dt>
                <dd>{user.email ?? user.id.slice(0, 8)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              Approving creates a revocable CLI token. The token is shown only to the local CLI
              process. Uploads still require an explicit <code className="mono">--upload</code>{' '}
              flag. Source code, secrets, and local paths are never uploaded.
            </p>
            <form action={startLoginAction} className="mt-5 flex flex-wrap gap-3">
              <input type="hidden" name="state" value={state} />
              <input type="hidden" name="challenge" value={challenge} />
              <input type="hidden" name="port" value={port} />
              <button type="submit" className="btn btn-primary">
                Authorize CLI
              </button>
              <a href="/dashboard/settings" className="btn btn-secondary">
                Cancel
              </a>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
