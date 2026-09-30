import * as api from '@/api/client';
import type { ConciergeLane, SwoStage } from '@/api/client';
import { fmtMoney } from '@/lib/format';

const TONE: Record<string, string> = { empty: 'text-ink-300', ok: 'text-ink', amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-1 ring-rose-300' };

// TRACK = the lane board: one row per vendor, one cell per stage with count · late · redo · oldest. Tap a count → slide-out with the cards; tap a vendor name → paid-not-back.
export const LaneBoard = ({ lanes, onOpenStage, onOutstanding, selected, pad }: { lanes: ConciergeLane[]; onOpenStage: (vendorId: string, stage: SwoStage) => void; onOutstanding: (vendorId: string) => void; selected?: { vendorId: string; stage: SwoStage } | null; pad?: boolean }) => (
  <div data-testid="concierge-board" className={`space-y-2 ${pad ? 'rounded-md bg-canvas p-2 text-ink' : ''}`}>
    {lanes.map((l) => { const noShip = l.vendor.ships === false; const prepay = l.vendor.paymentTerms === 'prepay';
      return <section key={l.vendor.id} data-testid={`lane-${l.vendor.id}`} data-ships={!noShip} className="rounded-md border border-line bg-surface">
        <div className="grid items-stretch" style={{ gridTemplateColumns: `${pad ? 180 : 240}px repeat(${l.stages.length}, minmax(0, 1fr))` }}>
          <div className="flex flex-col justify-center border-r border-line px-3 py-2">
            <button type="button" data-testid={`lane-name-${l.vendor.id}`} onClick={() => onOutstanding(l.vendor.id)} title="Outstanding: paid but not back" className="flex min-h-[32px] items-center gap-2 text-left text-[13px] font-semibold text-ink hover:underline">{l.vendor.name}<span data-testid={`lane-total-${l.vendor.id}`} className="rounded-full bg-canvas px-1.5 font-mono text-[10px] text-ink-600">{l.total}</span>{prepay && <span className="rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-800">prepay</span>}</button>
            <div className="truncate text-[10px] text-ink-400">{l.vendor.work} · {l.vendor.location}{noShip ? ' · in-house, no shipping' : api.isInternationalVendor(l.vendor) ? ' · international' : ' · domestic'}</div>
            {!noShip && <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px]">{l.unpaidCount > 0 && <span data-testid={`lane-unpaid-${l.vendor.id}`} className="text-ink-600">{l.unpaidCount} unpaid · {fmtMoney(l.unpaidTotal)}</span>}{prepay && <span data-testid={`lane-prepaid-${l.vendor.id}`} className="font-semibold text-amber-800">{fmtMoney(l.prepaidTotal)} paid · {l.prepaidNotBack} not back</span>}</div>}
          </div>
          {l.stages.map((c) => { const hi = selected?.vendorId === l.vendor.id && selected.stage === c.key; return <button key={c.key} type="button" data-testid={`cell-${l.vendor.id}-${c.key}`} data-count={c.count} data-late={c.late} data-redo={c.redo} data-tone={c.tone} data-selected={hi} onClick={() => c.count && onOpenStage(l.vendor.id, c.key)} className={`flex min-h-[44px] flex-col items-center justify-center border-r border-line/60 px-1 py-2 last:border-r-0 ${hi ? 'bg-brand-50 ring-2 ring-inset ring-brand' : ''} ${c.count ? 'hover:bg-canvas' : 'cursor-default'}`}>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">{c.label}</span>
            <span className={`mt-0.5 flex items-baseline gap-1 rounded-sm px-2 font-mono text-xl font-semibold leading-tight ${TONE[c.tone]}`}>{c.count}{c.late > 0 && <span className="text-xs text-rose-700">· {c.late} late</span>}{c.redo > 0 && <span className="text-xs text-amber-800">· {c.redo} redo</span>}</span>
            <span className="h-3 text-[10px] text-ink-400">{c.count && c.key !== 'fulfilled' ? `oldest: ${c.oldestDays}d` : ''}</span>
          </button>; })}
        </div>
      </section>; })}
  </div>
);
