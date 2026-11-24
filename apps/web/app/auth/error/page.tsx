import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign-in error',
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  missing_code: 'GitHub did not return an authorization code.',
  exchange_failed: 'The sign-in code could not be exchanged for a session.',
  missing_github_repository_token:
    'GitHub did not return the repository permission. Reconnect and approve the GitHub repository prompt.',
  callback_failed: 'The authentication callback could not be completed.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <div className="container flex min-h-[65vh] items-center justify-center py-16">
      <div className="panel w-full max-w-lg p-8">
        <p className="eyebrow">Authentication</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign-in could not be completed</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {MESSAGES[reason ?? ''] ?? 'An authentication error occurred.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/login">
            Try again
          </Link>
          <Link className="btn btn-secondary" href="/">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
