import type { Metadata } from 'next';
import Link from 'next/link';

import {
  EmptyState,
  GateBadge,
  MetricCard,
  PageHeader,
  SeverityBreakdown,
  formatDate,
} from '@/components/dashboard-ui';
import { requireUser } from '@/lib/auth';
import {
  countScans,
  listRecentScans,
  listRepositories,
  listRepositoryStats,
  parseSeverityCounts,
} from '@/lib/dashboard-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Overview' };

export default async function DashboardOverviewPage() {
  await requireUser('/dashboard');
  const supabase = await createSupabaseServerClient();
  const [repositories, stats, recentScans, scanCount] = await Promise.all([
    listRepositories(supabase),
    listRepositoryStats(supabase),
    listRecentScans(supabase, 8),
    countScans(supabase),
  ]);

  const activeRepos = repositories.filter((repo) => repo.connection_status === 'active');
  const statsByRepo = new Map(stats.map((item) => [item.repository_id, item]));
  const failedScans = recentScans.filter((scan) => scan.security_gate === 'failed').length;
  const latest = recentScans[0] ?? null;
  const latestCounts = latest ? parseSeverityCounts(latest) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="Private scan data for your account. Every record shown here is scoped to the authenticated user on the server."
        action={
          <Link
            className="btn btn-primary !py-2 !text-[13px]"
            href="/dashboard/repositories/connect"
          >
            Connect repository
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Connected repositories"
          value={activeRepos.length}
          detail={`${repositories.length} total records`}
        />
        <MetricCard label="Stored scans" value={scanCount} detail="Explicit CLI uploads only" />
        <MetricCard
          label="Recent failed gates"
          value={failedScans}
          detail="In the last 8 uploaded scans"
        />
        <MetricCard
          label="Latest gate"
          value={latest ? <GateBadge gate={latest.security_gate} /> : '—'}
          detail={latest ? formatDate(latest.uploaded_at) : 'No scans uploaded yet'}
          accent={latest?.security_gate === 'passed'}
        />
      </div>

      {latestCounts ? (
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
                Latest severity counts
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {latest?.repositories?.full_name ?? 'Repository'} · {latest?.client_scan_id}
              </p>
            </div>
            {latest ? (
              <Link
                className="btn btn-secondary !py-2 !text-[13px]"
                href={`/dashboard/scans/${latest.id}`}
              >
                Open latest scan
              </Link>
            ) : null}
          </div>
          <div className="mt-4">
            <SeverityBreakdown counts={latestCounts} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Recent scans</h2>
            <Link className="text-xs text-[var(--accent)] hover:underline" href="/dashboard/scans">
              View all
            </Link>
          </div>
          {recentScans.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No scans uploaded"
                action={
                  <Link className="btn btn-primary !py-2 !text-[13px]" href="/get-started">
                    CLI upload steps
                  </Link>
                }
              >
                Run a local scan, then upload it explicitly with{' '}
                <code className="mono">launchproof scan . --upload</code>. LaunchProof never uploads
                source code or secrets.
              </EmptyState>
            </div>
          ) : (
            <div className="table-shell mt-4">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Gate</th>
                    <th>Findings</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => (
                    <tr key={scan.id}>
                      <td>
                        <Link
                          className="font-medium text-[var(--text)] hover:text-[var(--accent)]"
                          href={`/dashboard/scans/${scan.id}`}
                        >
                          {scan.repositories?.full_name ?? 'Repository'}
                        </Link>
                        <div className="mt-1 font-mono text-[11px] text-[var(--subtle)]">
                          {scan.commit_sha?.slice(0, 12) ?? scan.branch ?? 'no commit'}
                        </div>
                      </td>
                      <td>
                        <GateBadge gate={scan.security_gate} />
                      </td>
                      <td>{scan.total_findings}</td>
                      <td className="text-[var(--muted)]">{formatDate(scan.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Repositories</h2>
            <Link
              className="text-xs text-[var(--accent)] hover:underline"
              href="/dashboard/repositories"
            >
              Manage
            </Link>
          </div>
          {repositories.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No repositories connected"
                action={
                  <Link
                    className="btn btn-primary !py-2 !text-[13px]"
                    href="/dashboard/repositories/connect"
                  >
                    Connect GitHub repository
                  </Link>
                }
              >
                Connect a repository to associate uploaded scan results. Repository metadata only;
                source code is not copied.
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {repositories.slice(0, 6).map((repo) => {
                const stat = statsByRepo.get(repo.id);
                return (
                  <li
                    key={repo.id}
                    className="rounded-lg border border-[var(--border)] bg-[#08111a] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{repo.full_name}</p>
                        <p className="text-[11px] text-[var(--subtle)]">
                          {stat?.scan_count ?? 0} scans ·{' '}
                          {stat?.last_scan_at
                            ? `last ${formatDate(stat.last_scan_at)}`
                            : 'no scans'}
                        </p>
                      </div>
                      <GateBadge gate={stat?.latest_gate ?? null} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
