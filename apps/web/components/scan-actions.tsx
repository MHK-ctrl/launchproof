'use client';

import { Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ScanActions({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm('Delete this scan and its findings? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/scans/${scanId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed.');
      router.push('/dashboard/scans');
      router.refresh();
    } catch {
      setError('The scan could not be deleted.');
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className="btn btn-secondary !py-2 !text-[13px]" href={`/api/scans/${scanId}/download`}>
        <Download size={14} aria-hidden="true" /> Download sanitized JSON
      </a>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="btn btn-secondary !border-[rgba(255,107,107,0.4)] !py-2 !text-[13px] !text-[var(--red)]"
      >
        <Trash2 size={14} aria-hidden="true" /> {deleting ? 'Deleting…' : 'Delete scan'}
      </button>
      {error ? <span className="text-xs text-[var(--red)]">{error}</span> : null}
    </div>
  );
}
