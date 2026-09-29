import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import * as cz from '@/api/concierge';
import { fmtDate, fmtMoney } from '@/lib/format';
import { SwoCard, type Run } from './SwoCard';

// Slide-out from the right edge: one third of the screen on desktop (board stays visible + scrollable), full-width sheet on a pad. Esc closes.
export type PanelState = { kind: 'stage'; vendorId: string; stage: SwoStage } | { kind: 'outstanding'; vendorId: string } | { kind: 'lookup'; swoIds: string[]; title: string } | null;
export const SlidePanel = ({ state, lanes, run, onClose }: { state: PanelState; lanes: ConciergeLane[]; run: Run; onClose: () => void }) => {
  useEffect(() => { if (!state) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [state, onClose]);
  if (!state) return null;
  const lane = 'vendorId' in state ? lanes.find((l) => l.vendor.id === state.vendorId) : undefined;
  let title: ReactNode = ''; let body: ReactNode = null;
  if (state.kind === 'stage' && lane) {
    const rows = lane.rows.filter((r) => api.baseStage(r.stage) === state.stage); const split = lane.vendor.ships !== false && ['sent', 'at_vendor', 'inbound'].includes(state.stage);
    title = <>{lane.vendor.name} · {api.swoStageLabel(state.stage)} · <span data-testid="panel-count">{rows.length}</span></>;
    body = split ? <>
      <Sub label="ON TRACK" testId="group-on-track" rows={rows.filter((w) => !api.swoIsLate(w))} run={run} />
      <Sub label="OVERDUE" testId="group-overdue" tone="text-rose-700" rows={rows.filter(api.swoIsLate)} run={run} />
    </> : <Sub label={api.swoStageLabel(state.stage)} testId="group-stage" rows={rows} run={run} />;
  } else if (state.kind === 'outstanding' && lane) {
    title = <>{lane.vendor.name} · Outstanding — paid, not back</>;
    body = <Outstanding vendorId={lane.vendor.id} prepay={lane.vendor.paymentTerms === 'prepay'} run={run} lanes={lanes} />;
  } else if (state.kind === 'lookup') {
    const rows = lanes.flatMap((l) => l.rows).filter((r) => state.swoIds.includes(r.id)); title = <>{state.title} · <span data-testid="panel-count">{rows.length}</span></>;
    body = <Sub label="Looked up" testId="group-lookup" rows={rows} run={run} />;
  }
  return <aside data-testid="concierge-panel" data-kind={state.kind} className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-canvas shadow-2xl transition-transform duration-200 lg:w-1/3" style={{ animation: 'slideIn 200ms ease-out' }}>
    <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    <header className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3"><h2 data-testid="panel-title" className="text-sm font-semibold text-ink">{title}</h2><button type="button" data-testid="panel-close" onClick={onClose} aria-label="Close" className="ml-auto grid h-8 w-8 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><X size={16} /></button></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">{body}</div>
  </aside>;
};

const Sub = ({ label, testId, tone, rows, run }: { label: string; testId: string; tone?: string; rows: SwoWithRefs[]; run: Run }) => <section data-testid={testId} data-count={rows.length}>
  <h3 className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${tone ?? 'text-ink-500'}`}>{label} · {rows.length}</h3>
  <div className="space-y-2">{rows.map((w) => <SwoCard key={w.id} w={w} run={run} compact />)}{!rows.length && <div className="text-[11px] text-ink-300">none</div>}</div>
</section>;

const Outstanding = ({ vendorId, prepay, run, lanes }: { vendorId: string; prepay: boolean; run: Run; lanes: ConciergeLane[] }) => {
  const rows = lanes.find((l) => l.vendor.id === vendorId)?.rows.filter((w) => w.paid && !['received', 'inspection', 'fulfilled', 'redo_received'].includes(w.stage)) ?? [];
  const sorted = rows.map((w) => { const paidAt = w.invoices.find((i) => i.paid)?.paid?.at ?? w.paidAt ?? w.createdAt; const h = cz.swoHealth(w); return { w, paidAt, days: Math.round((Date.now() - new Date(paidAt).getTime()) / 86_400_000), amount: api.swoPaidTotal(w), h }; }).sort((a, b) => b.days - a.days);
  return <div>
    <p className="mb-2 text-[11px] text-ink-500">{prepay ? 'PREPAY vendor — every paid job that has not come back is exposure.' : 'Pay-on-receipt vendor — a paid-not-back job here is unusual.'} Total {fmtMoney(sorted.reduce((t, r) => t + r.amount, 0))} · {sorted.length} job{sorted.length === 1 ? '' : 's'} · sorted by days since payment.</p>
    <div className="space-y-2">{sorted.map((r) => <div key={r.w.id} data-testid={`outstanding-${r.w.id}`}><div className="mb-0.5 flex items-center gap-2 text-[11px]"><span className={`font-mono font-semibold ${r.days >= 60 ? 'text-rose-700' : 'text-ink'}`}>{r.days}d since paid</span><span className="text-ink-400">{fmtMoney(r.amount)} · {fmtDate(r.paidAt)}</span>{r.h.parentTarget && <span className={r.h.parentVariance! > 0 ? 'font-semibold text-rose-700' : 'text-moss-700'}>promised {fmtDate(r.h.parentTarget)} · {r.h.parentVariance! > 0 ? `${r.h.parentVariance} days late` : `${-r.h.parentVariance!} days ahead`}</span>}</div><SwoCard w={r.w} run={run} compact /></div>)}{!sorted.length && <div className="text-[11px] text-ink-400">Nothing paid and outstanding.</div>}</div>
  </div>;
};
