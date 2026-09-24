import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { PortalRequest, RequestCloseReason } from '@/api/client';
import { RcButton, RcCard, RcError, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const ClosePicker = ({ r, others, onDone }: { r: PortalRequest; others: PortalRequest[]; onDone: () => void }) => {
  const { client } = useRcSession();
  const [reason, setReason] = useState<RequestCloseReason | ''>('');
  const [dup, setDup] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ready = reason && (reason !== 'duplicate' || dup);
  const submit = async () => {
    setErr(null);
    try { await api.portalCloseRequest(client!.id, r.request.id, reason as RequestCloseReason, dup || undefined); onDone(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); }
  };
  return (
    <div className="mt-3 rounded-md border border-rc-line bg-white p-4" data-testid={`rc-close-picker-${r.request.id}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Why are you closing it?</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {api.REQUEST_CLOSE_REASONS.map((o) => (
          <button key={o.key} type="button" data-testid={`rc-close-reason-${o.key}`} onClick={() => setReason(o.key)} className={`h-9 rounded-full border px-3 text-sm transition-colors ${reason === o.key ? 'border-rc-ink bg-rc-ink text-rc-cream' : 'border-rc-line text-rc-ink hover:bg-rc-accentSoft'}`}>{o.label}</button>
        ))}
      </div>
      {reason === 'duplicate' && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Which request does it duplicate?</div>
          <select data-testid={`rc-close-dup-${r.request.id}`} value={dup} onChange={(e) => setDup(e.target.value)} className="h-10 w-full rounded-md border border-rc-line bg-white px-3 text-sm focus:border-rc-accent focus:outline-none">
            <option value="">Choose…</option>
            {others.map((o) => <option key={o.request.id} value={o.request.id}>{o.request.number} — {o.request.summary.slice(0, 60)}{o.request.summary.length > 60 ? '…' : ''}</option>)}
          </select>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <RcButton tone="danger" data-testid={`rc-close-confirm-${r.request.id}`} disabled={!ready} onClick={submit}>Close this request</RcButton>
        <RcButton tone="quiet" data-testid={`rc-close-cancel-${r.request.id}`} onClick={onDone}>Keep it open</RcButton>
      </div>
      <RcError text={err} />
    </div>
  );
};

const Row = ({ r, all, reload }: { r: PortalRequest; all: PortalRequest[]; reload: () => void }) => {
  const [closing, setClosing] = useState(false);
  const rq = r.request;
  const open = rq.status === 'new' || rq.status === 'quoted';
  return (
    <li data-testid={`rc-request-${rq.id}`} className={`py-4 ${open ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <span className="font-mono text-xs text-rc-muted">{rq.number}</span>
          {r.watch && <span className="ml-2 text-sm text-rc-muted">{r.watch.brand} {r.watch.model}</span>}
        </div>
        <span className="font-serif italic text-rc-ink" data-testid={`rc-request-status-${rq.id}`}>{r.statusLabel}</span>
      </div>
      <p className="mt-1 text-[15px] leading-relaxed">{rq.summary}</p>
      <div className="mt-1 text-xs text-rc-muted">
        {rcDate(rq.createdAt)} · {rq.source.replace('_', '-')}
        {!open && rq.closedNote && <span data-testid={`rc-request-closed-note-${rq.id}`}> · {rq.closedBy === 'client' ? 'You closed this' : 'Closed by our team'}{rq.closeReason === 'duplicate' && r.duplicateOf ? ` — duplicate of ${r.duplicateOf.number}` : rq.closeReason ? ` — ${api.REQUEST_CLOSE_REASONS.find((x) => x.key === rq.closeReason)?.label.toLowerCase()}` : ''}</span>}
      </div>
      {open && !closing && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {rq.estimateId && <Link to={`/rc/estimates/${rq.estimateId}`} data-testid={`rc-request-estimate-${rq.id}`} className="rounded-full border border-rc-line bg-rc-paper px-4 py-1.5 hover:border-rc-accent/60">See the estimate</Link>}
          {r.canClose ? (
            <button type="button" data-testid={`rc-request-close-${rq.id}`} onClick={() => setClosing(true)} className="rounded-full border border-rc-line px-4 py-1.5 text-rc-muted hover:border-rose-200 hover:text-rose-800">Close this request</button>
          ) : (
            <Link to={`/rc/messages?request=${rq.id}`} data-testid={`rc-request-message-${rq.id}`} className="inline-flex items-center gap-1 rounded-full border border-rc-line px-4 py-1.5 hover:border-rc-accent/60"><MessageCircle size={13} /> Message us about this request</Link>
          )}
        </div>
      )}
      {closing && <ClosePicker r={r} others={all.filter((o) => o.request.id !== rq.id)} onDone={() => { setClosing(false); reload(); }} />}
    </li>
  );
};

export const RcRequestsCard = ({ requests, reload }: { requests: PortalRequest[]; reload: () => void }) => {
  const [showClosed, setShowClosed] = useState(false);
  const open = requests.filter((r) => r.request.status === 'new' || r.request.status === 'quoted');
  const closed = requests.filter((r) => !open.includes(r));
  if (requests.length === 0) return null;
  return (
    <RcCard eyebrow="Your requests" title={open.length ? `${open.length} open` : 'No open requests'} testId="rc-requests">
      <ul className="divide-y divide-rc-line">{open.map((r) => <Row key={r.request.id} r={r} all={requests} reload={reload} />)}</ul>
      {closed.length > 0 && (
        <div className={open.length ? 'mt-2 border-t border-rc-line pt-3' : ''}>
          <button type="button" data-testid="rc-requests-closed-toggle" onClick={() => setShowClosed((v) => !v)} className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink">
            {showClosed ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {closed.length} closed request{closed.length === 1 ? '' : 's'}
          </button>
          {showClosed && <ul className="divide-y divide-rc-line" data-testid="rc-requests-closed">{closed.map((r) => <Row key={r.request.id} r={r} all={requests} reload={reload} />)}</ul>}
        </div>
      )}
    </RcCard>
  );
};
