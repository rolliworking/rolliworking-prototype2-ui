import clsx from 'clsx';
import { Check, Paperclip, Send, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { PartsRequestWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export const PartsRequestPill = ({ status }: { status: string }) => <StatusPill status={status === 'pending' || status === 'awaiting_client' ? 'awaiting_customer_approval' : status === 'pending_review' ? 'in_review' : status === 'approved' ? 'approved' : status === 'rejected' || status === 'declined' ? 'declined' : 'draft'} />;

// Chat-style lookup with the SCRIPTED assistant + attach → submit; supervisors decide inline
export const PartsChat = ({ request: r0, onChange }: { request: PartsRequestWithRefs; onChange: (r: PartsRequestWithRefs) => void }) => {
  const { user } = useAuth();
  const [r, setR] = useState(r0);
  const [text, setText] = useState('');
  const [note, setNote] = useState(r0.note ?? '');
  const [decision, setDecision] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => setR(r0), [r0]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [r.chat.length]);
  const apply = (p: Promise<PartsRequestWithRefs>) => p.then((x) => { setR(x); onChange(x); setErr(null); }).catch((e) => setErr(e instanceof Error ? e.message : 'Failed'));
  const send = () => { if (!text.trim()) return; const t = text; setText(''); void apply(api.partsChat(r.id, t)); };
  const decided = r.status === 'approved' || r.status === 'rejected';
  const isSupervisor = user?.accessTier === 'manager';

  return (
    <div data-testid={`parts-chat-${r.id}`} className="grid grid-cols-[1fr_300px] gap-4">
      <div className="flex h-[420px] flex-col rounded-md border border-line bg-canvas/40">
        <div className="flex-1 space-y-2 overflow-y-auto p-3" data-testid="parts-chat-log">
          {r.chat.map((m) => (
            <div key={m.id} className={clsx('max-w-[85%] rounded-md px-3 py-2 text-[13px]', m.role === 'user' ? 'ml-auto bg-ink text-white' : 'bg-surface text-ink shadow-card')} data-testid={`chat-${m.role}-${m.id}`}>
              <div>{m.text}</div>
              {m.suggestions && m.suggestions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.suggestions.map((s) => { const p = api.partsById(s.partId); return p && (
                    <li key={s.partId} className="flex items-center gap-2 rounded-sm border border-line bg-canvas px-2 py-1 text-xs">
                      <span className="font-mono font-semibold text-ink">{p.partNumber}</span><span className="truncate text-ink-700">{p.name}</span><span className="text-ink-400">· {s.reason}</span><span className={clsx('ml-auto tabular', p.stock === 0 ? 'text-rose-700' : 'text-ink-400')}>{p.stock === 0 ? 'backorder' : `${p.stock} in stock`}</span>
                      {!decided && <button type="button" data-testid={`attach-${s.partId}`} onClick={() => void apply(api.attachPart(r.id, s.partId))} className={clsx('inline-flex h-6 items-center gap-1 rounded-sm px-1.5 font-medium', r.partId === s.partId ? 'bg-moss text-white' : 'bg-ink text-white hover:bg-ink-700')}>{r.partId === s.partId ? <><Check size={10} /> attached</> : <><Paperclip size={10} /> attach</>}</button>}
                    </li>); })}
                </ul>
              )}
              <div className={clsx('mt-0.5 text-[10px]', m.role === 'user' ? 'text-white/60' : 'text-ink-400')}>{fmtTime(m.at)}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {!decided && <div className="flex gap-1.5 border-t border-line p-2"><input data-testid="parts-chat-input" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="What do you need? e.g. crystal ring for a 16613" className={`${field} flex-1`} /><Button variant="primary" data-testid="parts-chat-send" onClick={send} className="h-8"><Send size={12} /></Button></div>}
      </div>
      <div className="space-y-3 text-xs">
        <div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-ink">{r.number}</span><PartsRequestPill status={r.status} /><Provisional note="Assistant is scripted over the seeded catalog — no AI" /></div>
        <div className="text-ink-500"><Link to={`/jobs/${r.job.id}`} className="font-mono text-ink hover:underline">{r.job.number}</Link> · {fullName(r.client)} · {r.watch.brand} {r.watch.model} <span className="font-mono">{r.watch.reference}</span></div>
        <div className="rounded-sm border border-line bg-surface p-2.5" data-testid="parts-attached">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Attached part</div>
          {r.part ? <div className="mt-1"><div className="font-mono font-semibold text-ink">{r.part.partNumber}</div><div className="text-ink-700">{r.part.name}</div><div className="text-ink-400">fits {r.part.compatibleRefs.join(', ')}</div></div> : <div className="mt-1 text-ink-400">Nothing attached yet — pick a suggestion.</div>}
        </div>
        {!decided && <input data-testid="parts-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the supervisor (optional)" className={`${field} block w-full`} />}
        {r.status === 'draft' && <Button variant="primary" data-testid="parts-submit" disabled={!r.partId} onClick={() => void apply(api.submitPartsRequest(r.id, note))} className="w-full"><Wrench size={12} /> Submit for approval</Button>}
        {r.status === 'pending' && <div className="text-ink-500">Submitted {fmtDate(r.requestedAt)} {fmtTime(r.requestedAt)} by {r.requestedBy} · waiting for a supervisor</div>}
        {r.status === 'pending' && isSupervisor && (
          <div className="space-y-1.5 rounded-sm border border-amber-200 bg-amber-50/50 p-2.5" data-testid="parts-decision">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Supervisor decision</div>
            <input data-testid="parts-decision-note" value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Note (required to reject)" className={`${field} block w-full`} />
            <div className="flex gap-1.5"><Button variant="primary" data-testid="parts-approve" onClick={() => void apply(api.approvePartsRequest(r.id, decision))} className="flex-1"><ThumbsUp size={12} /> Approve</Button><Button data-testid="parts-reject" onClick={() => void apply(api.rejectPartsRequest(r.id, decision))} className="flex-1 !text-rose-700"><ThumbsDown size={12} /> Reject</Button></div>
            <p className="text-[10px] text-amber-900/70">Approve confirms part ↔ ref and saves the search words as aliases (parts knowledge). Places a parts hold if the job can take one.</p>
          </div>
        )}
        {decided && <div data-testid="parts-decided" className={clsx('rounded-sm p-2.5', r.status === 'approved' ? 'bg-moss-50 text-moss-700' : 'bg-rose-50 text-rose-700')}>{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.decidedBy} · {r.decidedAt && `${fmtDate(r.decidedAt)} ${fmtTime(r.decidedAt)}`}{r.decisionNote && <div className="mt-0.5 text-ink-700">{r.decisionNote}</div>}</div>}
        {err && <p data-testid="parts-error" className="font-medium text-rose-700">{err}</p>}
        {r.searchTerms.length > 0 && <div className="text-ink-400">Search terms: {r.searchTerms.map((t) => `“${t}”`).join(', ')}</div>}
      </div>
    </div>
  );
};

export const PartsRequestModal = ({ request, onClose, onChange }: { request: PartsRequestWithRefs; onClose: () => void; onChange: (r: PartsRequestWithRefs) => void }) => (
  <Modal onClose={onClose} testId="parts-modal" width="w-[900px]" title={`Parts request · ${request.number}`}><div className="p-4"><PartsChat request={request} onChange={onChange} /></div></Modal>
);
