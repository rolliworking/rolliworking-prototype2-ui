import clsx from 'clsx';
import { Mail, MailX } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { OutboxEmail } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime } from '@/lib/format';

export default function OutboxPage() {
  const { data } = useAsync(() => api.getOutbox());
  const [open, setOpen] = useState<OutboxEmail | null>(null);

  useEffect(() => {
    if (data && !open) setOpen(data[0] ?? null);
  }, [data, open]);

  return (
    <div data-testid="outbox-page">
      <div className="mb-3 inline-flex items-center gap-2 rounded-sm bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900" data-testid="outbox-banner">
        <MailX size={13} /> Outbox is a holding area — nothing is ever sent from this prototype.
      </div>
      <div className="grid grid-cols-[380px_1fr] gap-4">
        <Card title="Pending emails" subtitle={`${data?.length ?? 0} queued`} bodyClassName="py-1" testId="outbox-list-card">
          <ul className="-mx-4 divide-y divide-line/70" data-testid="outbox-list">
            {(data ?? []).map((e) => (
              <li key={e.id}>
                <button type="button" data-testid={`outbox-item-${e.id}`} onClick={() => setOpen(e)} className={clsx('flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors', open?.id === e.id ? 'bg-brand-50/70' : 'hover:bg-canvas/70')}>
                  <Mail size={14} className="mt-0.5 shrink-0 text-ink-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{e.subject}</span>
                    <span className="block truncate text-xs text-ink-500">{e.toName} · {e.to}</span>
                    <span className="block text-[11px] text-ink-400">{fmtDate(e.createdAt)} {fmtTime(e.createdAt)} · {e.createdBy} · {e.station}</span>
                  </span>
                  <span className="shrink-0 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">pending</span>
                </button>
              </li>
            ))}
            {data && data.length === 0 && <li className="px-4 py-8 text-center text-xs text-ink-400">Outbox is empty.</li>}
          </ul>
        </Card>

        <Card title="Preview" testId="outbox-preview-card">
          {open ? (
            <div data-testid="outbox-preview" className="animate-rise">
              <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
                <dt className="text-ink-400">To</dt><dd className="text-ink">{open.toName} &lt;{open.to}&gt;</dd>
                <dt className="text-ink-400">Subject</dt><dd className="font-medium text-ink">{open.subject}</dd>
                <dt className="text-ink-400">Regarding</dt><dd className="font-mono text-ink-700">{open.relatedRef}</dd>
                <dt className="text-ink-400">Queued by</dt><dd className="text-ink-700">{open.createdBy} · {open.station} · {fmtDate(open.createdAt)} {fmtTime(open.createdAt)}</dd>
              </dl>
              <pre className="mt-4 whitespace-pre-wrap rounded-md border border-line bg-canvas p-4 font-sans text-[13px] leading-5 text-ink-700" data-testid="outbox-body">{open.body}</pre>
            </div>
          ) : (
            <p className="text-xs text-ink-400">Select an email to preview it.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
