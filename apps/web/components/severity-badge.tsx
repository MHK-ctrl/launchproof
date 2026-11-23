import type { Severity } from '../lib/report';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const label = severity === 'info' ? 'info' : severity;
  return <span className={`sev sev-${severity}`}>{label}</span>;
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{status.replace('-', ' ')}</span>;
}
