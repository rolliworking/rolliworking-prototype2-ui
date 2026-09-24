import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcButton, RcCard, RcError } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function RcMessagesPage() {
  const { client } = useRcSession();
  const [params] = useSearchParams();
  const requestId = params.get('request') ?? undefined;
  const { data: home } = useAsync(() => api.portalGetHome(client!.id), []);
  const req = requestId ? home?.requests.find((r) => r.request.id === requestId)?.request : undefined;
  const watchId = params.get('watch') ?? req?.watchId ?? undefined;
  const { data: msgs, reload } = useAsync(() => api.portalGetMessages(client!.id), []);
  const { data: watches } = useAsync(() => api.getWatchesForClient(client!.id), []);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);
  const watch = watches?.find((w) => w.id === watchId);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body = req && !text.startsWith(`Re ${req.number}`) ? `Re ${req.number}: ${text}` : text;
    try { await api.portalSendMessage(client!.id, body, watchId); setText(''); reload(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); }
  };

  return (
    <div className="space-y-6" data-testid="rc-messages-page">
      <div>
        <h1 className="font-serif text-4xl font-light tracking-tight">Messages</h1>
        <p className="mt-2 text-[15px] text-rc-muted">A person on our team reads and replies — usually within a business day.</p>
      </div>
      <RcCard testId="rc-thread">
        <ol className="space-y-4" data-testid="rc-message-list">
          {(msgs ?? []).map((m) => (
            <li key={m.id} data-testid={`rc-message-${m.id}`} className={`flex ${m.from === 'client' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${m.from === 'client' ? 'rounded-br-sm bg-rc-ink text-rc-cream' : 'rounded-bl-sm bg-rc-accentSoft text-rc-ink'}`}>
                <p className="text-[15px] leading-relaxed">{m.text}</p>
                <div className={`mt-1 text-[11px] ${m.from === 'client' ? 'text-rc-cream/60' : 'text-rc-muted'}`}>{m.from === 'client' ? 'You' : `${m.by} · RolliSuite`} · {when(m.at)}{m.watchId && watches ? ` · re ${watches.find((w) => w.id === m.watchId)?.model ?? ''}` : ''}</div>
              </div>
            </li>
          ))}
          {msgs && msgs.length === 0 && <li className="text-[15px] text-rc-muted">No messages yet. Say hello.</li>}
        </ol>
        <div ref={endRef} />
        <form onSubmit={send} className="mt-6 border-t border-rc-line pt-4">
          {(watch || req) && <div className="mb-2 text-xs text-rc-muted" data-testid="rc-message-context">About {req ? `request ${req.number}` : ''}{req && watch ? ' · ' : ''}{watch ? `your ${watch.brand} ${watch.model}` : ''}</div>}
          <div className="flex gap-2">
            <textarea data-testid="rc-message-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write to our team…" className="flex-1 resize-none rounded-md border border-rc-line bg-white px-3 py-2 text-[15px] focus:border-rc-accent focus:outline-none focus:ring-2 focus:ring-rc-accent/20" />
            <RcButton type="submit" data-testid="rc-message-send" disabled={!text.trim()}><Send size={15} /> Send</RcButton>
          </div>
          <RcError text={err} />
        </form>
      </RcCard>
    </div>
  );
}
