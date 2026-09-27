import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as api from '@/api/client';
import type { ClientRating, ClientReviews, Star as StarScore } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtTime } from '@/lib/format';

// STAFF-ONLY. Compact 5/3/2 badge: Attitude / Communication (staff-set) / completed jobs (derived). Never render inside /rc or view-as-client.
export const RatingBadge = ({ clientId, editable, size = 'sm', testId }: { clientId: string; editable?: boolean; size?: 'sm' | 'md'; testId?: string }) => {
  const [r, setR] = useState<ClientRating>(() => api.clientRatingSync(clientId)); const [open, setOpen] = useState(false);
  useEffect(() => { setR(api.clientRatingSync(clientId)); }, [clientId]);
  const unrated = r.attitude === undefined && r.communication === undefined;
  const cls = `inline-flex items-center gap-1 rounded-sm border font-mono font-semibold tabular-nums ${size === 'md' ? 'px-2 py-0.5 text-sm' : 'px-1.5 py-0.5 text-[11px]'} ${unrated ? 'border-line bg-canvas text-ink-400' : (r.attitude ?? 5) <= 2 || (r.communication ?? 5) <= 2 ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-line bg-surface text-ink'}`;
  const inner = <><Star size={size === 'md' ? 12 : 10} className={unrated ? 'text-ink-300' : 'text-amber-500'} />{r.badge}</>;
  return <>
    {editable ? <button data-testid={testId ?? `rating-badge-${clientId}`} title={r.tooltip} onClick={() => setOpen(true)} className={`${cls} hover:border-ink-300`}>{inner}</button> : <span data-testid={testId ?? `rating-badge-${clientId}`} title={r.tooltip} className={cls}>{inner}</span>}
    {open && createPortal(<RatingEditor rating={r} onClose={() => setOpen(false)} onSaved={(n) => { setR(n); }} />, document.body)}
  </>;
};

const StarRow = ({ label, value, onPick, testId }: { label: string; value?: StarScore; onPick: (v: StarScore) => void; testId: string }) => (
  <div className="flex items-center gap-3"><span className="w-32 text-[13px] font-medium text-ink">{label}</span><div className="flex gap-1">{([1, 2, 3, 4, 5] as StarScore[]).map((v) => <button key={v} data-testid={`${testId}-${v}`} onClick={() => onPick(v)} aria-pressed={value === v} className="rounded p-1 hover:bg-canvas"><Star size={22} className={value !== undefined && v <= value ? 'fill-amber-400 text-amber-500' : 'text-ink-300'} /></button>)}</div><span className="w-8 font-mono text-sm text-ink-500">{value ?? '–'}</span></div>
);

// Per-staff review panel: everyone rates independently (A / C); N = jobs that person handled for this client. Aggregate badge = mean of the latest review per staff. Internal only.
export const RatingEditor = ({ rating, onClose, onSaved }: { rating: ClientRating; onClose: () => void; onSaved: (r: ClientRating) => void }) => {
  const [v, setV] = useState<ClientReviews | null>(null); const [a, setA] = useState<StarScore | undefined>(); const [c, setC] = useState<StarScore | undefined>(); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState<string | null>(null);
  const load = () => api.getClientReviews(rating.clientId).then((r) => { setV(r); onSaved(r.aggregate); if (r.mine) { setA(r.mine.attitude); setC(r.mine.communication); setNote(r.mine.note ?? ''); } });
  useEffect(() => { void load(); }, [rating.clientId]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => { if (!a || !c) { setErr('Pick both stars'); return; } try { const r = await api.submitClientReview(rating.clientId, { attitude: a, communication: c, note }); setV(r); onSaved(r.aggregate); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const agg = v?.aggregate ?? rating;
  return <Modal onClose={onClose} testId="rating-editor" width="w-[560px]">
    <div className="space-y-3 p-5">
      <div><div className="text-[14px] font-semibold text-ink">Client reviews <span className="ml-2 font-mono text-ink-500" data-testid="rating-editor-badge">{agg.badge}</span></div><p className="mt-0.5 text-xs text-ink-500">A = attitude · C = communication · N = jobs handled. The badge is the rounded mean of each person’s latest review; completed jobs ({agg.completed}) is derived. Internal only — never shown to the client.</p></div>
      <ul data-testid="review-list" className="divide-y divide-line rounded-md border border-line">{(v?.reviews ?? []).map((r) => <li key={r.id} data-testid={`review-${r.by.toLowerCase()}`}>
        <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-canvas"><span className="w-16 font-semibold text-ink">{r.by}</span><span className="font-mono text-ink" data-testid={`review-badge-${r.by.toLowerCase()}`}>A{r.attitude} · C{r.communication} · N{r.jobsHandled}</span><span className="ml-auto text-[10px] text-ink-400">{fmtDate(r.at)}</span>{r.note && <span className="rounded bg-yellow-50 px-1 text-[10px] text-yellow-800">note</span>}</button>
        {open === r.id && <div data-testid={`review-detail-${r.by.toLowerCase()}`} className="border-t border-line bg-canvas/60 px-3 py-2 text-[11px] text-ink-700"><div className="flex gap-4"><span>Attitude <b>{r.attitude}</b>/5</span><span>Communication <b>{r.communication}</b>/5</span><span>Jobs handled <b>{r.jobsHandled}</b></span></div><div className="mt-1 text-ink-600">{r.note ?? <span className="text-ink-400">No note</span>}</div><div className="mt-1 text-[10px] text-ink-400">{fmtDate(r.at)} {fmtTime(r.at)} · {r.station}</div></div>}
      </li>)}{v && !v.reviews.length && <li className="px-3 py-3 text-center text-xs text-ink-400">No reviews yet — yours will be the first.</li>}</ul>
      <div className="rounded-md border border-line p-3"><div className="mb-2 text-[12px] font-semibold text-ink">{v?.mine ? 'Update my review' : 'My review'}</div>
        <StarRow label="Attitude" value={a} onPick={setA} testId="rating-attitude" />
        <StarRow label="Communication" value={c} onPick={setC} testId="rating-communication" />
        <textarea data-testid="review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note for colleagues (internal)" className="mt-2 w-full rounded-sm border border-line px-2 py-1 text-xs" />
        <div className="mt-2 flex items-center gap-2"><button data-testid="review-submit" onClick={() => void submit()} className="rounded-sm bg-ink px-3 py-1.5 text-xs font-semibold text-white">Save review</button>{err && <p className="text-xs text-rose-700">{err}</p>}</div></div>
      <div><div className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">Aggregate change log</div><ul data-testid="rating-history" className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-ink-600">{agg.history.map((h, i) => <li key={i}>{fmtDate(h.at)} {fmtTime(h.at)} · <b>{h.by}</b> · {h.field} {h.from ?? '–'} → {h.to}</li>)}{!agg.history.length && <li className="text-ink-400">Unrated — no changes yet.</li>}</ul></div>
    </div>
  </Modal>;
};
