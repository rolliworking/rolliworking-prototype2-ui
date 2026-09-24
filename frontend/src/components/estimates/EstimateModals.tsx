import { Mail, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { EstimateRevision, EstimateWithRefs, QuoteContext } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { LineEditor } from './LineEditor';
import { EstimateStatusPill, QuoteContextStrip } from './EstimateBits';
import { fmtDate, fmtMoneyCents, fmtTime, fullName } from '@/lib/format';

const Modal = ({ children, onClose, testId, width = 'w-[720px]' }: { children: React.ReactNode; onClose: () => void; testId: string; width?: string }) => (
  <div data-testid={testId} className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
    <div className={`${width} max-h-[90vh] overflow-y-auto rounded-md bg-surface shadow-pop animate-rise`} onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>
);

export const SendModal = ({ estimate: e, onClose, onSent }: { estimate: EstimateWithRefs; onClose: () => void; onSent: () => void }) => {
  const [ctx, setCtx] = useState<QuoteContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.getQuoteContext(e.clientId, e.watchId, e.id).then(setCtx);
  }, [e]);
  const send = async () => {
    setBusy(true);
    try {
      await api.sendEstimate(e.id);
      onSent();
    } catch (er) {
      setErr(er instanceof Error ? er.message : 'Send failed');
      setBusy(false);
    }
  };
  const again = e.status === 'sent';
  return (
    <Modal onClose={onClose} testId="send-modal">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="text-[14px] font-semibold text-ink">Review & {again ? 'send again' : 'send'} — {e.number} rev {e.revision}</div>
        <button type="button" onClick={onClose} data-testid="send-close" className="text-ink-500 hover:text-ink"><X size={14} /></button>
      </div>
      <div className="space-y-4 p-5">
        {ctx && <QuoteContextStrip clientEstimates={ctx.clientEstimates} watchEstimates={ctx.watchEstimates} clientName={fullName(e.client)} />}
        <div className="rounded-md border border-line bg-canvas/50 p-4 text-[13px]" data-testid="send-preview">
          <div className="mb-2 grid grid-cols-[70px_1fr] gap-y-0.5 text-xs"><span className="text-ink-400">To</span><span>{fullName(e.client)} &lt;{e.client.email}&gt;</span><span className="text-ink-400">Subject</span><span className="font-medium">{again ? 'Updated estimate' : 'Your estimate'} {e.number}{e.watch ? ` — ${e.watch.brand} ${e.watch.model}` : ''}</span></div>
          <p>Hello {e.client.firstName},</p>
          <ul className="my-2 space-y-0.5">{e.lines.map((l) => <li key={l.id} className="flex justify-between"><span>• {l.description} × {l.qty}</span><span className="tabular">{fmtMoneyCents(l.qty * l.unitPrice)}</span></li>)}</ul>
          <p className="font-semibold">Total {fmtMoneyCents(e.total)} · valid until {fmtDate(e.validUntil)}</p>
          <p className="mt-2 text-ink-500">{e.messageNotes}</p>
        </div>
        {err && <p className="text-xs font-medium text-rose-700">{err}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-400">Queues to the Outbox — nothing ever sends. Status → sent, sent-at set.</span>
          <div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="send-confirm" disabled={busy} onClick={send}><Mail size={13} /> {busy ? 'Queuing…' : 'Queue email'}</Button></div>
        </div>
      </div>
    </Modal>
  );
};

export const DeclineModal = ({ estimate: e, onClose, onDone }: { estimate: EstimateWithRefs; onClose: () => void; onDone: () => void }) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const decline = async () => {
    try {
      await api.declineEstimate(e.id, reason);
      onDone();
    } catch (er) {
      setErr(er instanceof Error ? er.message : 'Decline failed');
    }
  };
  return (
    <Modal onClose={onClose} testId="decline-modal" width="w-[460px]">
      <div className="p-5">
        <div className="text-[14px] font-semibold text-ink">Decline {e.number}</div>
        <p className="mt-1 text-xs text-ink-500">Client said no. A reason is required; the estimate can be reopened to draft later.</p>
        <textarea data-testid="decline-reason" autoFocus rows={3} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Reason (required)" className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:outline-none" />
        {err && <p data-testid="decline-error" className="mt-1 text-xs font-medium text-rose-700">{err}</p>}
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" className="!bg-rose-700 hover:!bg-rose-800" data-testid="decline-confirm" onClick={decline}>Decline estimate</Button></div>
      </div>
    </Modal>
  );
};

export const RevisionHistory = ({ estimate: e }: { estimate: EstimateWithRefs }) => {
  const [open, setOpen] = useState<EstimateRevision | null>(null);
  if (e.revisions.length === 0) return <p className="text-xs text-ink-400" data-testid="revisions-empty">Revision {e.revision} · no prior versions.</p>;
  return (
    <div data-testid="revision-history">
      <ul className="divide-y divide-line/70">
        <li className="flex items-center gap-3 py-1.5 text-xs"><span className="font-mono font-semibold text-ink">rev {e.revision}</span><span className="text-moss-700">current</span><span className="ml-auto tabular">{fmtMoneyCents(e.total)}</span></li>
        {e.revisions.map((r) => (
          <li key={r.revision} className="flex items-center gap-3 py-1.5 text-xs" data-testid={`revision-${r.revision}`}>
            <span className="font-mono font-semibold text-ink">rev {r.revision}</span>
            <EstimateStatusPill status={r.status} />
            <span className="text-ink-400">{r.savedBy} · {fmtDate(r.savedAt)} {fmtTime(r.savedAt)}</span>
            <span className="ml-auto tabular">{fmtMoneyCents(r.total)}</span>
            <button type="button" data-testid={`revision-${r.revision}-view`} onClick={() => setOpen(r)} className="text-brand hover:underline">View</button>
          </li>
        ))}
      </ul>
      {open && (
        <Modal onClose={() => setOpen(null)} testId="revision-modal">
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="text-[14px] font-semibold">{e.number} — revision {open.revision} (read-only snapshot)</div><button type="button" data-testid="revision-close" onClick={() => setOpen(null)} className="text-ink-500 hover:text-ink"><X size={14} /></button></div>
          <div className="p-5"><LineEditor lines={open.lines} onChange={() => undefined} readOnly blankTaxableDefault />{open.clientNotes && <p className="mt-3 text-xs text-ink-500">Client notes: {open.clientNotes}</p>}</div>
        </Modal>
      )}
    </div>
  );
};
