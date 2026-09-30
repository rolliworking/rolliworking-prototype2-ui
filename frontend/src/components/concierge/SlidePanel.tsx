import { ArrowRight, MousePointerClick, Undo2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import * as cz from '@/api/concierge';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Code128, HubChips, useSwoBase } from './SwoBits';
import { SwoCard, type Run } from './SwoCard';

// Slide-out from the right edge: one third of the screen on desktop (board stays visible + scrollable), full-width sheet on a pad. Esc closes.
// Cards are grouped under their SWO (the box) — tick lines across groups, then move them together from the footer ("select 3 of 5 → Returning").
export type PanelState = { kind: 'stage'; vendorId: string; stage: SwoStage } | { kind: 'outstanding'; vendorId: string } | { kind: 'lookup'; swoIds: string[]; title: string } | null;
type Sel = { sel: Set<string>; toggle: (id: string) => void; toggleMany: (ids: string[], on: boolean) => void };
export const SlidePanel = ({ state, lanes, run, onClose, onPick, pad }: { state: PanelState; lanes: ConciergeLane[]; run: Run; onClose: () => void; onPick?: (w: SwoWithRefs) => void; pad?: boolean }) => {
  const [sel, setSel] = useState<Set<string>>(new Set()); const [reason, setReason] = useState(''); const [back, setBack] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!state) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [state, onClose]);
  useEffect(() => { setSel(new Set()); setBack(false); setReason(''); setErr(null); }, [state]);
  if (!state) return null;
  const lane = 'vendorId' in state ? lanes.find((l) => l.vendor.id === state.vendorId) : undefined;
  const all = lanes.flatMap((l) => l.rows); const ids = [...sel].filter((id) => all.some((w) => w.id === id));
  const s: Sel = { sel, toggle: (id) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; }), toggleMany: (list, on) => setSel((x) => { const n = new Set(x); list.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; }) };
  let title: ReactNode = ''; let body: ReactNode = null;
  if (state.kind === 'stage' && lane) {
    const rows = lane.rows.filter((r) => api.baseStage(r.stage) === state.stage); const split = lane.vendor.ships !== false && ['sent', 'at_vendor', 'inbound'].includes(state.stage);
    title = <>{lane.vendor.name} · {api.swoStageLabel(state.stage)} · <span data-testid="panel-count">{rows.length}</span></>;
    body = split ? <>
      <Sub label="ON TRACK" testId="group-on-track" rows={rows.filter((w) => !api.swoIsLate(w))} run={run} onPick={onPick} s={s} />
      <Sub label="OVERDUE" testId="group-overdue" tone="text-rose-700" rows={rows.filter(api.swoIsLate)} run={run} onPick={onPick} s={s} />
    </> : <Sub label={api.swoStageLabel(state.stage)} testId="group-stage" rows={rows} run={run} onPick={onPick} s={s} />;
  } else if (state.kind === 'outstanding' && lane) {
    title = <>{lane.vendor.name} · Outstanding — paid, not back</>;
    body = <Outstanding vendorId={lane.vendor.id} prepay={lane.vendor.paymentTerms === 'prepay'} run={run} lanes={lanes} />;
  } else if (state.kind === 'lookup') {
    const rows = all.filter((r) => state.swoIds.includes(r.id)); title = <>{state.title} · <span data-testid="panel-count">{rows.length}</span></>;
    body = <Sub label="Looked up" testId="group-lookup" rows={rows} run={run} onPick={onPick} s={s} />;
  }
  const move = async (dir: 'forward' | 'back') => {
    if (dir === 'back' && !reason.trim()) { setErr('Back needs a reason — one reason covers the batch.'); return; }
    setErr(null); const r = await api.moveSwoLines(ids, dir, dir === 'back' ? reason : undefined); setSel(new Set(r.refused.map((x) => x.lineId))); setBack(false); setReason('');
    await run(async () => undefined, `${r.moved.length} line${r.moved.length === 1 ? '' : 's'} moved ${dir}${r.refused.length ? ` · ${r.refused.length} refused — ${r.refused.map((x) => x.reason).join('; ')}` : ''}`);
  };
  return <aside data-testid="concierge-panel" data-kind={state.kind} className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas shadow-2xl transition-transform duration-200 ${pad ? '' : 'lg:w-1/3'}`} style={{ animation: 'slideIn 200ms ease-out' }}>
    <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3"><h2 data-testid="panel-title" className="text-sm font-semibold text-ink">{title}</h2><button type="button" data-testid="panel-close" onClick={onClose} aria-label="Close" className="ml-auto grid h-8 w-8 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><X size={16} /></button></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">{body}</div>
    {ids.length > 0 && <footer data-testid="panel-sel-bar" data-count={ids.length} className="border-t border-line bg-surface p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{ids.length} line{ids.length === 1 ? '' : 's'} selected</span>
        <Button size="sm" variant="primary" data-testid="panel-sel-forward" onClick={() => void move('forward')}>Forward <ArrowRight size={12} /></Button>
        <Button size="sm" data-testid="panel-sel-back" onClick={() => setBack((b) => !b)}><Undo2 size={12} /> Back…</Button>
        <button type="button" data-testid="panel-sel-clear" onClick={() => setSel(new Set())} className="ml-auto text-[11px] text-ink-500 hover:underline">clear</button></div>
      {back && <div className="mt-2 flex gap-1"><input autoFocus data-testid="panel-sel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the batch (required)" className={`${field} flex-1`} /><Button size="sm" variant="primary" data-testid="panel-sel-back-go" disabled={!reason.trim()} onClick={() => void move('back')}>Move back</Button></div>}
      {err && <div data-testid="panel-sel-error" className="mt-1 text-rose-700">{err}</div>}
    </footer>}
  </aside>;
};

const byHub = (rows: SwoWithRefs[]) => { const m = new Map<string, SwoWithRefs[]>(); rows.forEach((w) => { const k = w.hubId ?? w.id; m.set(k, [...(m.get(k) ?? []), w]); }); return [...m.entries()].map(([key, lines]) => ({ key, hub: lines[0].hubId ? api.hubForLineSync(lines[0].id) : null, lines })); };
const Sub = ({ label, testId, tone, rows, run, onPick, s }: { label: string; testId: string; tone?: string; rows: SwoWithRefs[]; run: Run; onPick?: (w: SwoWithRefs) => void; s: Sel }) => {
  const base = useSwoBase(); const groups = byHub(rows);
  return <section data-testid={testId} data-count={rows.length}>
    <h3 className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${tone ?? 'text-ink-500'}`}>{label} · {rows.length}</h3>
    <div className="space-y-3">{groups.map((g) => { const allOn = g.lines.every((w) => s.sel.has(w.id)); return <div key={g.key} data-testid={`hub-group-${g.key}`} data-lines={g.lines.length} className="rounded-md border border-line bg-surface/60 p-2">
      {g.hub && <div data-testid={`hub-group-header-${g.key}`} className="mb-2 flex flex-wrap items-center gap-2 border-b border-line pb-2 text-xs">
        <input type="checkbox" data-testid={`hub-group-check-${g.key}`} checked={allOn} onChange={(e) => s.toggleMany(g.lines.map((w) => w.id), e.target.checked)} aria-label={`Select every ${g.hub.number} line shown`} />
        <Code128 value={g.hub.barcode} height={20} scale={1} caption={false} testId={`hub-group-barcode-${g.key}`} />
        <Link to={`${base}/${g.hub.id}`} data-testid={`hub-group-open-${g.key}`} className="font-mono text-sm font-semibold text-brand hover:underline">{g.hub.number}</Link>
        <HubChips hv={g.hub} />
        <span className="ml-auto text-[10px] text-ink-500">{g.lines.length} of {g.hub.total} line{g.hub.total === 1 ? '' : 's'} here</span>
      </div>}
      <div className="space-y-2">{g.lines.map((w) => <div key={w.id} data-testid={`panel-line-${w.id}`} data-selected={s.sel.has(w.id)} className={`flex gap-2 ${s.sel.has(w.id) ? 'rounded-md ring-2 ring-brand/60' : ''}`}>
        <label className="flex items-start pt-3 pl-1"><input type="checkbox" data-testid={`panel-line-check-${w.id}`} checked={s.sel.has(w.id)} onChange={() => s.toggle(w.id)} aria-label={`Select ${w.jobNumber}`} /></label>
        <div className="min-w-0 flex-1">{onPick && <button type="button" data-testid={`panel-pick-${w.id}`} onClick={() => onPick(w)} className="mb-0.5 inline-flex min-h-[32px] items-center gap-1 rounded-sm border border-line bg-surface px-2 text-[11px] font-semibold text-ink-700 hover:border-ink-400 hover:bg-canvas"><MousePointerClick size={12} /> Assign · load {w.jobNumber.replace(/^E/, '')} into the lookup strip</button>}<SwoCard w={w} run={run} compact /></div>
      </div>)}</div>
    </div>; })}{!rows.length && <div className="text-[11px] text-ink-300">none</div>}</div>
  </section>;
};

const Outstanding = ({ vendorId, prepay, run, lanes }: { vendorId: string; prepay: boolean; run: Run; lanes: ConciergeLane[] }) => {
  const rows = lanes.find((l) => l.vendor.id === vendorId)?.rows.filter((w) => w.paid && !['received', 'inspection', 'fulfilled', 'redo_received'].includes(w.stage)) ?? [];
  const sorted = rows.map((w) => { const paidAt = w.invoices.find((i) => i.paid)?.paid?.at ?? w.paidAt ?? w.createdAt; const h = cz.swoHealth(w); return { w, paidAt, days: Math.round((Date.now() - new Date(paidAt).getTime()) / 86_400_000), amount: api.swoPaidTotal(w), h }; }).sort((a, b) => b.days - a.days);
  return <div>
    <p className="mb-2 text-[11px] text-ink-500">{prepay ? 'PREPAY vendor — every paid job that has not come back is exposure.' : 'Pay-on-receipt vendor — a paid-not-back job here is unusual.'} Total {fmtMoney(sorted.reduce((t, r) => t + r.amount, 0))} · {sorted.length} job{sorted.length === 1 ? '' : 's'} · sorted by days since payment.</p>
    <div className="space-y-2">{sorted.map((r) => <div key={r.w.id} data-testid={`outstanding-${r.w.id}`}><div className="mb-0.5 flex items-center gap-2 text-[11px]"><span className={`font-mono font-semibold ${r.days >= 60 ? 'text-rose-700' : 'text-ink'}`}>{r.days}d since paid</span><span className="text-ink-400">{fmtMoney(r.amount)} · {fmtDate(r.paidAt)}</span>{r.h.parentTarget && <span className={r.h.parentVariance! > 0 ? 'font-semibold text-rose-700' : 'text-moss-700'}>promised {fmtDate(r.h.parentTarget)} · {r.h.parentVariance! > 0 ? `${r.h.parentVariance} days late` : `${-r.h.parentVariance!} days ahead`}</span>}</div><SwoCard w={r.w} run={run} compact /></div>)}{!sorted.length && <div className="text-[11px] text-ink-400">Nothing paid and outstanding.</div>}</div>
  </div>;
};
