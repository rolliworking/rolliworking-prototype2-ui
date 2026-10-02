import clsx from 'clsx';
import { Bell, ExternalLink, FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { RequestRow } from '@/api/client';
import * as hl from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { RequestLines } from '@/components/requests/RequestLines';
import { field } from '@/components/rs/RsBits';
import { WbpClientRows } from '@/components/shared/WbpDots';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { RightSheet } from '@/components/ui/RightSheet';
import { fmtDate, fmtMoney, fmtTime, fullName, relativeTime } from '@/lib/format';

const SOURCE_LABEL: Record<RequestRow['source'], string> = { web: 'Web form', kiosk: 'Kiosk', email: 'Email', call: 'Phone call', walk_in: 'Walk-in', portal: 'Portal', staff: 'Staff · on behalf' };
const LEG_LABEL: Record<string, string> = { W: 'Watch', B: 'Band', P: 'Polish', PM: 'Watch (PM)' };
export const requestIsOpen = (r: Pick<RequestRow, 'status'>) => r.status === 'new' || r.status === 'quoted';

// Notify… — a hand-off is a MESSAGE, so it goes where messages go (Internal tree), linked to the request. The request itself stays unowned / untagged.
const Notify = ({ r, onDone }: { r: RequestRow; onDone: (msg: string) => void }) => {
  const { user } = useAuth();
  const staff = api.getDivisionStaff(r.division ?? api.getSessionDivision()).filter((u) => u.id !== user?.id);
  const [open, setOpen] = useState(false); const [to, setTo] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    if (!to) { setErr('Pick who to notify'); return; }
    try { await hl.sendMessage({ to: { type: 'user', shortName: to }, text: `Request ${r.number} — ${fullName(r.client)} · ${r.summary.slice(0, 140)}${r.summary.length > 140 ? '…' : ''}\n/requests/${r.id}${note.trim() ? `\n${note.trim()}` : ''}` }); await api.markRequestNotified(r.id, to); setOpen(false); setTo(''); setNote(''); setErr(null); onDone(`Notified ${to} — message in their Inbox · request stays unowned`); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not notify'); }
  };
  return <span className="inline-flex flex-wrap items-center gap-1.5">
    <Button size="sm" data-testid="request-notify" aria-pressed={open} onClick={() => setOpen((v) => !v)}><Bell size={12} /> Notify…</Button>
    {open && <form data-testid="request-notify-form" className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <select data-testid="request-notify-to" value={to} onChange={(e) => setTo(e.target.value)} className={field}><option value="">Who…</option>{staff.map((u) => <option key={u.id} value={u.shortName}>{u.shortName} — {u.displayName}</option>)}</select>
      <input data-testid="request-notify-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className={clsx(field, 'w-44')} />
      <Button size="sm" type="submit" variant="primary" data-testid="request-notify-send">Send</Button>
      {err && <span data-testid="request-notify-error" className="text-[11px] text-rose-700">{err}</span>}
    </form>}
  </span>;
};

// Submission slide-out from the Requests page: the intake record itself — what they wrote · photos · watch · legs · range · Create estimate · Client 360 · Notify. Never creates an Inbox thread.
export const RequestSheet = ({ r, onClose, onChanged }: { r: RequestRow; onClose: () => void; onChanged: (msg?: string) => void }) => {
  const watch = r.watch ?? api.watchByIdSync(r.watchId); const legs = api.requestLegsSync(r); const range = api.requestInstantRangeSync(r);
  const title = <span className="flex items-center gap-2"><span>Request</span><span className="font-mono">{r.number}</span><StatusPill status={r.status} /></span>;
  return <RightSheet title={title} onClose={onClose} testId="request-sheet" kind="request">
    <section data-testid="request-sheet-client" className="rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><Link to={`/clients/${r.clientId}`} data-testid="request-sheet-client-link" className="text-sm font-semibold text-brand hover:underline">{fullName(r.client)}</Link><RatingBadge clientId={r.clientId} testId="request-sheet-rating" /><WbpClientRows clientId={r.clientId} testId="request-sheet-wbp" /><span data-testid="request-sheet-source" className="ml-auto rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 ring-1 ring-line">{SOURCE_LABEL[r.source]}</span></div>
      <div className="mt-1 text-ink-500">{r.client.email} · {r.client.phone} · received {relativeTime(r.createdAt)} · {r.createdBy} · {r.station}</div>
      <div className="mt-1 text-[11px] text-ink-400">Unowned intake record — not an Inbox thread. The Inbox gets a row only when the client writes on it.</div>
    </section>
    <section data-testid="request-sheet-submission" className="rounded-md border border-line bg-surface p-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">What the client wrote</div>
      <p data-testid="request-sheet-text" className="mt-0.5 whitespace-pre-line text-[13px] text-ink-800">{r.summary}{r.kiosk?.notes ? `\n\n${r.kiosk.notes}` : ''}</p>
      {r.photos?.length ? <div data-testid="request-sheet-photos" data-count={r.photos.length} className="mt-2 flex flex-wrap gap-1.5">{r.photos.map((p) => <img key={p.id} src={p.dataUrl} alt={p.fileName ?? ''} title={p.note ?? p.fileName} className="h-16 w-20 rounded-sm border border-line object-cover" />)}</div> : null}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Watch</div><div data-testid="request-sheet-watch">{watch ? `${watch.brand} ${watch.model} · ${watch.reference}` : 'Not captured yet'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Bracelet</div><div>{watch?.bracelet ?? 'Not captured'}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Legs</div><div data-testid="request-sheet-legs" className="flex gap-1">{legs.length ? legs.map((l) => <span key={l} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{l} · {LEG_LABEL[l]}</span>) : <span className="text-ink-400">Not captured</span>}</div></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Instant range</div><div data-testid="request-sheet-range">{range ? <span className="font-semibold text-ink">{fmtMoney(range.low)} – {fmtMoney(range.high)}<span className="ml-1 font-normal text-ink-400">from the quote key · not a promise</span></span> : <span className="text-ink-400">No quote key yet</span>}</div></div>
      </div>
    </section>
    {r.lines?.length ? <RequestLines r={r} /> : null}
    <section data-testid="request-sheet-actions" className="rounded-md border border-line bg-surface p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {r.estimateId ? <Link to={`/estimates/${r.estimateId}`} data-testid="request-sheet-open-estimate"><Button size="sm">Open estimate</Button></Link> : requestIsOpen(r) && <Link to={`/estimates/new?request=${r.id}`} data-testid="request-sheet-create-estimate"><Button size="sm" variant="primary"><FilePlus2 size={12} /> Create estimate</Button></Link>}
        <Link to={`/clients/${r.clientId}?hit=req-${r.id}`} data-testid="request-sheet-client360" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-canvas"><ExternalLink size={12} /> Client 360</Link>
        <Notify r={r} onDone={onChanged} />
      </div>
      {r.notified?.length ? <div data-testid="request-sheet-notified" className="mt-2 text-[11px] text-ink-500">notified: {r.notified.map((n) => `${n.to} (${n.by} · ${fmtDate(n.at)} ${fmtTime(n.at)})`).join(' · ')}</div> : null}
    </section>
  </RightSheet>;
};
