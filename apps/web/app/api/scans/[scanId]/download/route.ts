import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api';
import { getApiSession } from '@/lib/auth';
import { getScan, getScanFindings } from '@/lib/dashboard-data';
import { rateLimit } from '@/lib/rate-limit';

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const session = await getApiSession();
  if (!session) return apiError(401, 'unauthorized', 'Authentication required.');
  const limit = await rateLimit(`scan-download:user:${session.user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return apiError(429, 'rate_limited', 'Too many report downloads.', {
      'Retry-After': String(limit.retryAfter),
    });
  }
  const { scanId } = await params;
  if (!isUuid(scanId)) return apiError(404, 'not_found', 'Scan not found.');

  const scan = await getScan(session.supabase, scanId);
  if (!scan || scan.user_id !== session.user.id) {
    return apiError(404, 'not_found', 'Scan not found.');
  }
  const findings = await getScanFindings(session.supabase, scanId);
  const body = {
    meta: {
      schemaVersion: 1 as const,
      id: scan.client_scan_id,
      toolVersion: scan.scanner_version,
      startedAt: scan.started_at,
      finishedAt: scan.completed_at,
      uploadedAt: scan.uploaded_at,
      projectName: scan.repositories?.full_name ?? 'repository',
      target: null,
      mode: 'cloud-summary',
      commitSha: scan.commit_sha,
      branch: scan.branch,
    },
    summary: scan.summary,
    checks: scan.checks,
    findings: findings.map((finding) => ({
      id: finding.finding_key,
      checkId: finding.rule_id,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      category: finding.category,
      remediation: finding.remediation,
      location: finding.relative_file_path
        ? { file: finding.relative_file_path, line: finding.line_number ?? undefined }
        : undefined,
    })),
    limitations: scan.limitations,
    note: 'Sanitized cloud summary. Source evidence and full local report are intentionally not stored.',
  };
  const safeName = scan.client_scan_id.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 120);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="launchproof-${safeName}.json"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
