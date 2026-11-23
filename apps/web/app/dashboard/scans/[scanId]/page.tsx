import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GateBadge, PageHeader, SeverityBreakdown, formatDate } from '@/components/dashboard-ui';
import { ScanActions } from '@/components/scan-actions';
import { SeverityBadge, StatusPill } from '@/components/severity-badge';
import { requireUser } from '@/lib/auth';
import {
  getScan,
  getScanFindings,
  parseChecks,
  parseLimitations,
  parseSeverityCounts,
} from '@/lib/dashboard-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Scan detail' };

export default async function ScanDetailPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) notFound();
  const user = await requireUser(`/dashboard/scans/${scanId}`);
  const supabase = await createSupabaseServerClient();
  const scan = await getScan(supabase, scanId);
  if (!scan || scan.user_id !== user.id) notFound();
  const findings = await getScanFindings(supabase, scanId);
  const severityCounts = parseSeverityCounts(scan);
  const checks = parseChecks(scan);
  const limitations = parseLimitations(scan);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scan detail"
        title={scan.repositories?.full_name ?? 'Scan'}
        description="This page shows only the sanitized summary and findings stored for this scan. Raw source files, secrets, and full local paths are not uploaded."
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-secondary !py-2 !text-[13px]" href="/dashboard/scans">
              All scans
            </Link>
            <ScanActions scanId={scan.id} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
            Security gate
          </p>
          <div className="mt-2">
            <GateBadge gate={scan.security_gate} />
          </div>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
            Findings
          </p>
          <p className="mt-2 text-2xl font-semibold">{scan.total_findings}</p>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
            Uploaded
          </p>
          <p className="mt-2 text-sm font-medium">{formatDate(scan.uploaded_at)}</p>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
            Commit / branch
          </p>
          <p className="mt-2 font-mono text-sm">
            {scan.commit_sha?.slice(0, 12) ?? scan.branch ?? '—'}
          </p>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-base font-semibold">Severity counts</h2>
        <div className="mt-4">
          <SeverityBreakdown counts={severityCounts} />
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="text-base font-semibold">Findings</h2>
        {findings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No findings were uploaded for this scan.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {findings.map((finding) => (
              <article key={finding.id} className={`finding-card sev-${finding.severity}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  <span className="font-mono text-[11px] text-[var(--subtle)]">
                    {finding.rule_id}
                  </span>
                  {finding.category ? (
                    <span className="chip !py-0.5 !text-[10px]">{finding.category}</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{finding.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{finding.description}</p>
                {finding.relative_file_path ? (
                  <p className="mt-2 font-mono text-[11px] text-[var(--subtle)]">
                    {finding.relative_file_path}
                    {finding.line_number ? `:${finding.line_number}` : ''}
                  </p>
                ) : null}
                {finding.remediation ? (
                  <p className="mt-3 text-sm text-[#cfe0f2]">
                    <span className="font-semibold text-[var(--text)]">Remediation: </span>
                    {finding.remediation}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-5">
        <h2 className="text-base font-semibold">Check results</h2>
        <div className="table-shell mt-4">
          <table className="report-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <tr key={check.id}>
                  <td>
                    <div className="font-medium">{check.title || check.id}</div>
                    <div className="font-mono text-[11px] text-[var(--subtle)]">{check.id}</div>
                  </td>
                  <td>
                    <StatusPill status={check.status} />
                  </td>
                  <td className="text-[var(--muted)]">{check.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {limitations.length > 0 ? (
        <div className="panel p-5">
          <h2 className="text-base font-semibold">Limitations</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {limitations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
