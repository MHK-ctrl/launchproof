import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ConnectionBadge,
  EmptyState,
  GateBadge,
  PageHeader,
  formatDate,
} from '@/components/dashboard-ui';
import { requireUser } from '@/lib/auth';
import { listRepositories, listRepositoryStats } from '@/lib/dashboard-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { disconnectRepository } from './actions';

export const metadata: Metadata = { title: 'Repositories' };

export default async function RepositoriesPage() {
  await requireUser('/dashboard/repositories');
  const supabase = await createSupabaseServerClient();
  const [repositories, stats] = await Promise.all([
    listRepositories(supabase),
    listRepositoryStats(supabase),
  ]);
  const statsByRepo = new Map(stats.map((item) => [item.repository_id, item]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Repositories"
        description="Connect repositories explicitly. LaunchProof stores repository metadata and scan summaries you upload; it does not clone or copy source code."
        action={
          <Link
            className="btn btn-primary !py-2 !text-[13px]"
            href="/dashboard/repositories/connect"
          >
            Connect repository
          </Link>
        }
      />

      <div className="panel p-5">
        {repositories.length === 0 ? (
          <EmptyState
            title="No connected repositories"
            action={
              <Link
                className="btn btn-primary !py-2 !text-[13px]"
                href="/dashboard/repositories/connect"
              >
                Connect GitHub repository
              </Link>
            }
          >
            After connecting, the CLI can upload sanitized scan summaries to the matching repository
            record.
          </EmptyState>
        ) : (
          <div className="table-shell">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Latest gate</th>
                  <th>Scans</th>
                  <th>Last scan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {repositories.map((repo) => {
                  const stat = statsByRepo.get(repo.id);
                  return (
                    <tr key={repo.id}>
                      <td>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium hover:text-[var(--accent)]"
                        >
                          {repo.full_name}
                        </a>
                        <div className="mt-1 text-[11px] text-[var(--subtle)]">
                          {repo.visibility} · {repo.default_branch ?? 'default branch unknown'}
                        </div>
                      </td>
                      <td>
                        <ConnectionBadge status={repo.connection_status} />
                      </td>
                      <td>
                        <GateBadge gate={stat?.latest_gate ?? null} />
                      </td>
                      <td>{stat?.scan_count ?? 0}</td>
                      <td className="text-[var(--muted)]">{formatDate(stat?.last_scan_at)}</td>
                      <td>
                        {repo.connection_status === 'active' ? (
                          <form
                            action={async () => {
                              'use server';
                              await disconnectRepository(repo.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-xs text-[var(--muted)] underline decoration-[#2b4055] hover:text-[var(--red)]"
                            >
                              Disconnect
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-[var(--subtle)]">Disconnected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
