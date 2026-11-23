'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { SampleReport, Severity } from '../lib/report';
import { SEVERITY_ORDER } from '../lib/report';
import { SeverityBadge, StatusPill } from './severity-badge';

type Tab = 'findings' | 'checks' | 'limits';
type Filter = 'all' | Severity;

function locationOf(finding: SampleReport['findings'][number]): string {
  if (finding.location?.file) {
    return `${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`;
  }
  return finding.location?.url ?? 'No location recorded';
}

export function ReportViewer() {
  const [report, setReport] = useState<SampleReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('findings');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/sample-report.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as SampleReport;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Could not load the sample report');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const findings = useMemo(() => {
    if (!report) return [];
    const needle = query.trim().toLowerCase();
    return report.findings.filter((finding) => {
      const matchesSeverity = filter === 'all' || finding.severity === filter;
      const text =
        `${finding.title} ${finding.description} ${finding.id} ${locationOf(finding)}`.toLowerCase();
      return matchesSeverity && (needle.length === 0 || text.includes(needle));
    });
  }, [report, filter, query]);

  if (error) {
    return (
      <div className="panel p-8 text-center">
        <ShieldAlert className="mx-auto text-[#ff9f6b]" size={26} />
        <h2 className="mt-3 text-lg font-semibold">The sample report is not available.</h2>
        <p className="mt-2 text-sm text-[#93a6bd]">
          {error}. Generate a report locally with{' '}
          <code className="font-mono text-[#6ef0b6]">launchproof test</code>.
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="panel flex items-center justify-center gap-3 p-12 text-sm text-[#93a6bd]">
        <Loader2 size={17} className="animate-spin text-[#3ddc97]" />
        Loading the generated sample report…
      </div>
    );
  }

  const gateColor = report.summary.gatePassed ? 'text-[#3ddc97]' : 'text-[#ff6b6b]';

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`panel p-5 ${report.summary.gatePassed ? '!border-[#24523f]' : '!border-[#512a2a]'}`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6e8199]">
            Release gate
          </p>
          <p className={`mt-2 flex items-center gap-2 text-2xl font-bold ${gateColor}`}>
            {report.summary.gatePassed ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {report.summary.gatePassed ? 'PASS' : 'FAIL'}
          </p>
          <p className="mt-1 text-[11px] text-[#7f93aa]">fail on {report.summary.failOn}+</p>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6e8199]">
            Findings
          </p>
          <p className="mt-2 text-2xl font-bold text-[#e8eff9]">{report.summary.totalFindings}</p>
          <p className="mt-1 text-[11px] text-[#7f93aa]">
            {report.summary.bySeverity.critical} critical · {report.summary.bySeverity.high} high
          </p>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6e8199]">Checks</p>
          <p className="mt-2 text-2xl font-bold text-[#e8eff9]">{report.summary.totalChecks}</p>
          <p className="mt-1 text-[11px] text-[#7f93aa]">
            {report.summary.byStatus.pass ?? 0} pass · {report.summary.byStatus.fail ?? 0} fail ·{' '}
            {report.summary.byStatus.warn ?? 0} warn
          </p>
        </div>
        <div className="panel p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6e8199]">Scan</p>
          <p className="mt-2 font-mono text-[12px] font-semibold text-[#e8eff9]">
            {report.meta.id}
          </p>
          <p className="mt-1 text-[11px] text-[#7f93aa]">
            {report.meta.mode} · {(report.meta.durationMs / 1000).toFixed(1)}s · v
            {report.meta.toolVersion}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href="/sample-report.json" download className="btn btn-secondary !py-2 !text-[12px]">
          <Download size={13} /> JSON
        </a>
        <a href="/sample-report.html" className="btn btn-secondary !py-2 !text-[12px]">
          <FileText size={13} /> Offline HTML
        </a>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-[#8499b0]">
          Generated locally · no project data uploaded
        </span>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-[#1c2938] pb-3">
        {(['findings', 'checks', 'limits'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] ${
              tab === item ? 'bg-[#10231c] text-[#6ef0b6]' : 'text-[#7f93aa] hover:text-[#e8eff9]'
            }`}
            aria-pressed={tab === item}
          >
            {item === 'limits' ? 'Limitations' : item}
          </button>
        ))}
      </div>

      {tab === 'findings' ? (
        <div className="mt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8499b0]"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search findings, files, IDs…"
                className="w-full !pl-9"
                aria-label="Search findings"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', ...SEVERITY_ORDER] as Filter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.05em] ${
                    filter === option
                      ? 'border-[#3ddc97] bg-[#0d2018] text-[#6ef0b6]'
                      : 'border-[#223043] text-[#7f93aa] hover:text-[#e8eff9]'
                  }`}
                  aria-pressed={filter === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-[#93a6bd]">
              No findings match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((finding) => (
                <article key={finding.id} className={`finding-card sev-${finding.severity}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={finding.severity} />
                    <span className="font-mono text-[10px] text-[#8499b0]">{finding.id}</span>
                    <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#8499b0]">
                      {finding.confidence} confidence · {finding.verification}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-[15px] font-semibold text-[#e8eff9]">
                    {finding.title}
                  </h3>
                  <p className="mt-1 break-all font-mono text-[10.5px] text-[#6ef0b6]">
                    {locationOf(finding)}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#a2b5ca]">
                    {finding.description}
                  </p>
                  <details className="mt-3 border-t border-[#1a2634] pt-3">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.08em] text-[#7f93aa]">
                      Impact, remediation & evidence
                    </summary>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8499b0]">
                          Impact
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[#a2b5ca]">
                          {finding.impact}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8499b0]">
                          Remediation
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[#a2b5ca]">
                          {finding.remediation}
                        </p>
                      </div>
                    </div>
                    {finding.evidence.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {finding.evidence.map((item, index) => (
                          <div key={`${item.label}-${index}`}>
                            <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#8499b0]">
                              {item.label}
                              {item.redacted ? ' · redacted' : ''}
                            </p>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[#1a2634] bg-[#070c13] p-3 font-mono text-[10.5px] text-[#b7c7da]">
                              {item.value}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'checks' ? (
        <div className="table-shell mt-5">
          <table className="report-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Check</th>
                <th>Summary</th>
                <th style={{ textAlign: 'right' }}>Findings</th>
                <th style={{ textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {report.checks.map((check) => (
                <tr key={check.id}>
                  <td>
                    <StatusPill status={check.status} />
                  </td>
                  <td className="whitespace-nowrap font-mono text-[11px] text-[#c3d2e4]">
                    {check.id}
                  </td>
                  <td className="text-[12px] text-[#93a6bd]">{check.summary}</td>
                  <td className="text-right font-mono text-[11px] text-[#7f93aa]">
                    {check.findings.length}
                  </td>
                  <td className="text-right font-mono text-[10px] text-[#8499b0]">
                    {Math.round(check.durationMs)} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'limits' ? (
        <div className="panel mt-5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ffd166]" />
            <div>
              <h3 className="text-[15px] font-semibold text-[#e8eff9]">
                What this report does not prove
              </h3>
              <ul className="mt-3 space-y-2">
                {report.limitations.map((limitation) => (
                  <li
                    key={limitation}
                    className="flex gap-2 text-[12.5px] leading-relaxed text-[#a2b5ca]"
                  >
                    <span className="text-[#8499b0]">—</span>
                    {limitation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {report.project ? (
            <div className="mt-6 border-t border-[#1c2938] pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8499b0]">
                Project profile
              </p>
              <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-3">
                <div>
                  <span className="text-[#6e8199]">Files scanned</span>
                  <br />
                  {report.project.filesScanned}
                </div>
                <div>
                  <span className="text-[#6e8199]">Frameworks</span>
                  <br />
                  {report.project.frameworks.join(', ') || 'none detected'}
                </div>
                <div>
                  <span className="text-[#6e8199]">Package manager</span>
                  <br />
                  {report.project.packageManager}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
