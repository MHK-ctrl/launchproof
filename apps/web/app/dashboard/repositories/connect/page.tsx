import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, PageHeader } from '@/components/dashboard-ui';
import { requireUser } from '@/lib/auth';
import { clearConnectToken, listGitHubRepositories, readConnectToken } from '@/lib/github';
import { connectRepository } from '../actions';

export const metadata: Metadata = { title: 'Connect repository' };

export default async function ConnectRepositoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser('/dashboard/repositories/connect');
  const params = await searchParams;
  const token = await readConnectToken(user.id);
  let repositories: Awaited<ReturnType<typeof listGitHubRepositories>> = [];
  let loadError: string | null = null;

  if (token) {
    try {
      repositories = await listGitHubRepositories(token);
    } catch (error) {
      loadError =
        error instanceof Error ? error.message : 'GitHub repositories could not be loaded.';
      await clearConnectToken();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Repositories"
        title="Connect a GitHub repository"
        description="This step requests GitHub's repository scope so LaunchProof can enumerate repositories, including private ones. GitHub does not offer a read-only private-repository OAuth scope; LaunchProof issues only GET requests and never stores the token in the database."
        action={
          <Link className="btn btn-secondary !py-2 !text-[13px]" href="/dashboard/repositories">
            Back
          </Link>
        }
      />

      <div className="panel p-5">
        {!token ? (
          <EmptyState
            title="Grant repository metadata access"
            action={
              <a className="btn btn-primary !py-2 !text-[13px]" href="/api/github/connect">
                Continue to GitHub
              </a>
            }
          >
            LaunchProof asks for GitHub's `repo` scope only when you connect a repository. That
            scope is broad at GitHub (there is no read-only private-repo OAuth scope); LaunchProof
            uses it only to list repository metadata, keeps it in an encrypted 15-minute cookie, and
            never writes it to the database. Revoke the grant anytime in GitHub settings.
          </EmptyState>
        ) : loadError ? (
          <EmptyState
            title="GitHub access could not be used"
            action={
              <a className="btn btn-primary !py-2 !text-[13px]" href="/api/github/connect">
                Reconnect GitHub
              </a>
            }
          >
            {loadError}
          </EmptyState>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[#08111a] px-4 py-3 text-sm">
              <p className="text-[var(--muted)]">
                Select a repository to connect. The server verifies the repository ID with GitHub
                before storing metadata.
              </p>
              <a
                className="text-xs text-[var(--accent)] hover:underline"
                href="/api/github/connect"
              >
                Refresh access
              </a>
            </div>
            {params.error ? (
              <p className="mb-4 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/10 px-3 py-2 text-xs text-[var(--red)]">
                {params.error}
              </p>
            ) : null}
            {repositories.length === 0 ? (
              <EmptyState title="No repositories visible">
                GitHub returned no repositories for this account and permission grant.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {repositories.map((repo) => (
                  <li
                    key={repo.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{repo.fullName}</p>
                      <p className="text-[11px] text-[var(--subtle)]">
                        {repo.visibility} · {repo.defaultBranch ?? 'default branch unknown'}
                      </p>
                    </div>
                    <form
                      action={async () => {
                        'use server';
                        const result = await connectRepository(repo.id);
                        if (!result.ok) {
                          const { redirect } = await import('next/navigation');
                          redirect(
                            `/dashboard/repositories/connect?error=${encodeURIComponent(result.message)}`,
                          );
                        }
                        const { redirect } = await import('next/navigation');
                        redirect('/dashboard/repositories');
                      }}
                    >
                      <button type="submit" className="btn btn-secondary !py-1.5 !text-xs">
                        Connect
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
