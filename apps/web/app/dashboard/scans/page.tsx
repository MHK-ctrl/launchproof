import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, GateBadge, PageHeader, formatDate } from '@/components/dashboard-ui';
import { requireUser } from '@/lib/auth';
import { listRepositories, listScans } from '@/lib/dashboard-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Scans' };

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ repository?: string; gate?: string; q?: string; page?: string }>;
}) {
  await requireUser('/dashboard/scans');
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const gate =
    params.gate === 'passed' || params.gate === 'failed' || params.gate === 'not-verified'
      ? params.gate
      : undefined;
  const page = Number(params.page ?? '1');
  const [repositories, result] = await Promise.all([
    listRepositories(supabase),
    listScans(supabase, {
      repositoryId: params.repository,
      gate,
      query: params.q,
      page: Number.isFinite(page) ? page : 1,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Scans"
        description="Uploaded scan summaries for repositories you own in LaunchProof. Source code and secrets are never uploaded."
      />

      <div className="panel p-5">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" method="get">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search commit SHA or branch"
            aria-label="Search scans"
          />
          <select
            className="select"
            name="repository"
            defaultValue={params.repository ?? ''}
            aria-label="Repository filter"
          >
            <option value="">All repositories</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.full_name}
              </option>
            ))}
          </select>
          <select className="select" name="gate" defaultValue={gate ?? ''} aria-label="Gate filter">
            <option value="">All gates</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="not-verified">Not verified</option>
          </select>
          <button type="submit" className="btn btn-secondary !py-2 !text-[13px]">
            Filter
          </button>
        </form>

        {result.scans.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="No scans found">
              Upload a scan with <code className="mono">launchproof scan . --upload</code>, or
              adjust filters.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="table-shell mt-5">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Gate</th>
                    <th>Status</th>
                    <th>Findings</th>
                    <th>Commit / branch</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scans.map((scan) => (
                    <tr key={scan.id}>
                      <td>
                        <Link
                          className="font-medium hover:text-[var(--accent)]"
                          href={`/dashboard/scans/${scan.id}`}
                        >
                          {scan.repositories?.full_name ?? 'Repository'}
                        </Link>
                        <div className="mt-1 font-mono text-[11px] text-[var(--subtle)]">
                          {scan.client_scan_id}
                        </div>
                      </td>
                      <td>
                        <GateBadge gate={scan.security_gate} />
                      </td>
                      <td>
                        <span className="status-pill status-not-verified">{scan.scan_status}</span>
                      </td>
                      <td>{scan.total_findings}</td>
                      <td className="font-mono text-[11px] text-[var(--muted)]">
                        {scan.commit_sha?.slice(0, 12) ?? scan.branch ?? '—'}
                      </td>
                      <td className="text-[var(--muted)]">{formatDate(scan.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{result.total} scans</span>
              <span>
                Page {result.page} of {totalPages}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
