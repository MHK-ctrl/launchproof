import type { ReactNode } from 'react';

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86_400), 'day');
}

export function GateBadge({ gate }: { gate: string | null | undefined }) {
  const normalized = gate === 'passed' || gate === 'failed' ? gate : 'not-verified';
  return <span className={`status-pill status-${normalized}`}>{normalized.replace('-', ' ')}</span>;
}

export function ConnectionBadge({ status }: { status: string }) {
  return (
    <span className={`status-pill ${status === 'active' ? 'status-pass' : 'status-not-verified'}`}>
      {status}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="panel p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--subtle)]">
        {label}
      </p>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? 'text-[var(--accent)]' : ''}`}
      >
        {value}
      </div>
      {detail ? <div className="mt-1 text-xs text-[var(--muted)]">{detail}</div> : null}
    </div>
  );
}

export function SeverityBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries: Array<[string, number]> = [
    ['critical', counts.critical ?? 0],
    ['high', counts.high ?? 0],
    ['medium', counts.medium ?? 0],
    ['low', counts.low ?? 0],
    ['info', counts.info ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {entries.map(([severity, value]) => (
        <div
          key={severity}
          className="rounded-lg border border-[var(--border)] bg-[#070c13] px-3 py-2"
        >
          <span className={`sev sev-${severity}`}>{severity}</span>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{children}</div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
