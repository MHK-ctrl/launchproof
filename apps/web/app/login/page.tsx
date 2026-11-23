import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser, safeNextPath } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the LaunchProof private scan dashboard with GitHub.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getCurrentUser();
  if (user) redirect(next);

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="panel w-full max-w-md p-8">
        <p className="eyebrow">Private dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in with GitHub</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Your account is used only to identify your LaunchProof workspace. GitHub repository access
          is requested separately when you explicitly connect a repository.
        </p>
        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-xl border border-[var(--orange)]/40 bg-[var(--orange)]/10 p-4 text-sm">
            <p className="font-semibold text-[var(--orange)]">
              Cloud authentication is not configured.
            </p>
            <p className="mt-2 text-[var(--muted)]">
              Set <code className="mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then configure the GitHub
              provider in Supabase. See <code className="mono">CLOUD_DASHBOARD_SETUP.md</code>.
            </p>
          </div>
        ) : (
          <LoginForm next={next} />
        )}
        {params.error ? (
          <p className="mt-4 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
            Sign-in did not complete.{' '}
            {params.error === 'auth' ? 'Try again or check the callback URL.' : ''}
          </p>
        ) : null}
        <p className="mt-6 text-xs leading-5 text-[var(--subtle)]">
          By signing in you agree to the{' '}
          <Link className="text-[var(--accent)] hover:underline" href="/security">
            security and data-handling model
          </Link>
          . Local scans do not require an account.
        </p>
      </div>
    </div>
  );
}
