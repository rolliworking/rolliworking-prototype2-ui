import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { ClientRating, Star as StarScore } from '@/api/client';
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
    {open && <RatingEditor rating={r} onClose={() => setOpen(false)} onSaved={(n) => { setR(n); }} />}
  </>;
};

const StarRow = ({ label, value, onPick, testId }: { label: string; value?: StarScore; onPick: (v: StarScore) => void; testId: string }) => (
  <div className="flex items-center gap-3"><span className="w-32 text-[13px] font-medium text-ink">{label}</span><div className="flex gap-1">{([1, 2, 3, 4, 5] as StarScore[]).map((v) => <button key={v} data-testid={`${testId}-${v}`} onClick={() => onPick(v)} aria-pressed={value === v} className="rounded p-1 hover:bg-canvas"><Star size={22} className={value !== undefined && v <= value ? 'fill-amber-400 text-amber-500' : 'text-ink-300'} /></button>)}</div><span className="w-8 font-mono text-sm text-ink-500">{value ?? '–'}</span></div>
);

// Two 5-star rows; every change logged (who / when / old → new). Concierge tier and up.
export const RatingEditor = ({ rating, onClose, onSaved }: { rating: ClientRating; onClose: () => void; onSaved: (r: ClientRating) => void }) => {
  const [r, setR] = useState(rating); const [err, setErr] = useState<string | null>(null);
  const pick = async (field: 'attitude' | 'communication', v: StarScore) => { try { const n = await api.setClientRating(r.clientId, { [field]: v }); setR(n); onSaved(n); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <Modal onClose={onClose} testId="rating-editor" width="w-[440px]">
    <div className="space-y-3 p-5">
      <div><div className="text-[14px] font-semibold text-ink">Client rating <span className="ml-2 font-mono text-ink-500" data-testid="rating-editor-badge">{r.badge}</span></div><p className="mt-0.5 text-xs text-ink-500">Attitude and Communication are set by staff; completed jobs is derived ({r.completed}) and never hand-set. Internal only — never shown to the client.</p></div>
      <StarRow label="Attitude" value={r.attitude} onPick={(v) => void pick('attitude', v)} testId="rating-attitude" />
      <StarRow label="Communication" value={r.communication} onPick={(v) => void pick('communication', v)} testId="rating-communication" />
      {err && <p className="text-xs text-rose-700">{err}</p>}
      <div><div className="mb-1 text-[10px] uppercase tracking-wide text-ink-400">Change log</div><ul data-testid="rating-history" className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-ink-600">{r.history.map((h, i) => <li key={i}>{fmtDate(h.at)} {fmtTime(h.at)} · <b>{h.by}</b> · {h.field} {h.from ?? '–'} → {h.to}</li>)}{!r.history.length && <li className="text-ink-400">Unrated — no changes yet.</li>}</ul></div>
    </div>
  </Modal>;
};
