import clsx from 'clsx';
import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { StaffInboxThread } from '@/api/client';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime, fullName, relativeTime } from '@/lib/format';

const Thread = ({ t, reload }: { t: StaffInboxThread; reload: () => void }) => {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (t.unread) void api.markThreadRead(t.client.id).then(reload); }, [t.client.id, t.unread, reload]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try { await api.replyToClient(t.client.id, text, t.watch?.id); setText(''); reload(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Failed'); }
  };
  return (
    <Card title={fullName(t.client)} subtitle={`${t.client.email} · ${t.client.phone}${t.watch ? ` · re ${t.watch.brand} ${t.watch.model}` : ''}`} action={<Link to={`/clients/${t.client.id}`} className="text-xs text-brand hover:underline" data-testid="inbox-open-client">Client 360</Link>} bodyClassName="p-0" testId={`inbox-thread-${t.client.id}`}>
      <ol className="max-h-[420px] space-y-2 overflow-y-auto p-4" data-testid="inbox-messages">
        {t.messages.map((m) => (
          <li key={m.id} data-testid={`inbox-message-${m.id}`} className={clsx('flex', m.from === 'staff' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[78%] rounded-md px-3 py-2 text-[13px]', m.from === 'staff' ? 'bg-brand-50 text-ink' : 'bg-canvas text-ink-700')}>
              <p>{m.text}</p>
              <div className="mt-0.5 text-[11px] text-ink-400">{m.from === 'staff' ? `${m.by} · reply queued to Outbox` : m.by} · {fmtDate(m.at)} {fmtTime(m.at)}</div>
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input data-testid="inbox-reply-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the client… (lands in RolliConnect + queues an email)" className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-brand focus:bg-surface focus:outline-none" />
        <Button type="submit" variant="primary" size="sm" data-testid="inbox-reply-send" disabled={!text.trim()}><Send size={12} /> Reply</Button>
      </form>
      {err && <p className="px-3 pb-2 text-xs text-rose-700" data-testid="inbox-error">{err}</p>}
    </Card>
  );
};

// Staff inbox for RolliConnect messages — one thread per client
export default function InboxPage() {
  const { data: threads, reload } = useAsync(() => api.getStaffInbox(), []);
  const [sel, setSel] = useState<string | null>(null);
  const list = threads ?? [];
  const current = list.find((t) => t.client.id === sel) ?? list[0];
  return (
    <div data-testid="inbox-page">
      <PageHeader title="Inbox" subtitle="Messages from clients in RolliConnect. Replies queue an email to the Outbox — nothing sends." testId="inbox-header" />
      <div className="grid grid-cols-12 gap-4">
        <Card title="Threads" subtitle={`${list.reduce((n, t) => n + t.unread, 0)} unread`} bodyClassName="p-0" className="col-span-4" testId="inbox-threads">
          <ul className="divide-y divide-line/70">
            {list.map((t) => (
              <li key={t.client.id}>
                <button type="button" data-testid={`inbox-thread-btn-${t.client.id}`} onClick={() => setSel(t.client.id)} className={clsx('flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors', current?.client.id === t.client.id ? 'bg-brand-50' : 'hover:bg-canvas')}>
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', t.unread ? 'bg-brand' : 'bg-transparent')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2"><span className={clsx('truncate', t.unread ? 'font-semibold text-ink' : 'text-ink-700')}>{fullName(t.client)}</span><span className="shrink-0 text-[11px] text-ink-400">{relativeTime(t.lastAt)}</span></span>
                    <span className="block truncate text-ink-500">{t.messages[t.messages.length - 1].text}</span>
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-400">No client messages yet.</li>}
          </ul>
        </Card>
        <div className="col-span-8">{current && <Thread key={current.client.id} t={current} reload={reload} />}</div>
      </div>
    </div>
  );
}
