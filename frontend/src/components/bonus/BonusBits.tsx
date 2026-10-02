import clsx from 'clsx';
import { CalendarClock, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as bz from '@/api/bonus';
import type { BasisKind, BonusProgress, PaceStatus } from '@/api/bonus';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { RightSheet } from '@/components/ui/RightSheet';
import { fmtMoney } from '@/lib/format';

// Shared bonus UI — amounts, pace chip, progress bar with the pace marker, the NOT-KEEPER "As of" control, the weekly-breakdown drawer
export const fmtAmount = (kind: BasisKind, n: number) => (kind === 'revenue' ? fmtMoney(Math.round(n / 100)) : String(n));
export const fmtPeriodDates = (p: { start: string; end: string }) => `${bz.shortDay(p.start)} – ${bz.shortDay(p.end)}`;

const PACE: Record<PaceStatus | 'missed', { label: string; tone: string }> = {
  reached: { label: 'Reached', tone: 'bg-moss-50 text-moss-700 ring-moss-100' },
  on_pace: { label: 'On pace', tone: 'bg-brand-50 text-brand ring-brand-100' },
  behind: { label: 'Behind', tone: 'bg-rose-50 text-rose-700 ring-rose-100' },
  missed: { label: 'Missed', tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
};
export const PaceChip = ({ status, testId }: { status: PaceStatus | 'missed'; testId?: string }) => <span data-testid={testId} data-status={status} className={clsx('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', PACE[status].tone)}>{PACE[status].label}</span>;

// Bar = actual vs target; the thin marker = where the pace projection lands (clamped at 150 %)
export const ProgressBar = ({ pct, pacePct, status, testId }: { pct: number; pacePct: number; status: PaceStatus; testId?: string }) => {
  const w = Math.min(100, pct / 1.5); const m = Math.min(100, pacePct / 1.5); const t = 100 / 1.5;
  return <div data-testid={testId} data-pct={pct} data-pace-pct={pacePct} className="relative h-2.5 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-inset ring-line">
    <div className={clsx('h-full rounded-full transition-[width] duration-500', status === 'reached' ? 'bg-moss' : status === 'on_pace' ? 'bg-brand' : 'bg-rose-500')} style={{ width: `${w}%` }} />
    <div className="absolute inset-y-0 w-px bg-ink" style={{ left: `${t}%` }} title="Target" />
    <div className="absolute -top-0.5 h-3.5 w-0.5 rounded-sm bg-amber-600" style={{ left: `calc(${m}% - 1px)` }} title={`Pace ${pacePct}%`} />
  </div>;
};

export const useAsOf = () => { const [asOf, set] = useState(bz.getAsOf()); useEffect(() => { const h = () => set(bz.getAsOf()); window.addEventListener(bz.AS_OF_EVENT, h); return () => window.removeEventListener(bz.AS_OF_EVENT, h); }, []); return asOf; };

// NOT-KEEPER: prototype time-travel so pacing and the automatic EOM close can be walked today
export const AsOfControl = () => {
  const asOf = useAsOf(); const [draft, setDraft] = useState(asOf); useEffect(() => setDraft(asOf), [asOf]);
  return <div data-testid="bonus-asof" data-asof={asOf} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
    <CalendarClock size={13} /><span className="font-semibold">As of</span>
    <input data-testid="bonus-asof-input" type="date" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft && draft !== asOf) bz.setAsOf(draft); }} onKeyDown={(e) => { if (e.key === 'Enter' && draft) bz.setAsOf(draft); }} className={`${field} font-mono`} />
    <span className="text-amber-800/70">quick picks</span>
    {bz.AS_OF_PICKS.map((d) => <button key={d} type="button" data-testid={`bonus-asof-pick-${d}`} aria-pressed={asOf === d} onClick={() => bz.setAsOf(d)} className={clsx('h-7 rounded-full border px-2.5 font-mono text-[11px] font-medium', asOf === d ? 'border-ink bg-ink text-white' : 'border-amber-300 bg-white text-amber-900 hover:border-ink-400')}>{bz.shortDay(d)}</button>)}
    <span data-testid="bonus-asof-notkeeper" className="ml-auto rounded-sm bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-900 ring-1 ring-amber-300" title="Prototype-only control. In Keeper the as-of date is always today.">NOT-KEEPER · prototype time-travel</span>
  </div>;
};

// Weekly-breakdown drawer — the same sheet from the analytics card and the staff Hitlist card; owner may close the period early from here
export const BonusDrawer = ({ p, onClose, canCloseEarly, onChanged, showPayout = true }: { p: BonusProgress; onClose: () => void; canCloseEarly?: boolean; onChanged?: () => void; showPayout?: boolean }) => {
  const [reason, setReason] = useState(''); const [closing, setClosing] = useState(false); const [err, setErr] = useState<string | null>(null);
  const closeEarly = async () => { try { setErr(null); await bz.closeBonusPeriodEarly(p.plan.id, reason); onChanged?.(); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const f = (n: number) => fmtAmount(p.kind, n);
  return <RightSheet testId="bonus-drawer" kind={p.plan.id} onClose={onClose} title={<span className="inline-flex items-center gap-2">{p.user.shortName} · {p.meta.label} <span className="font-normal text-ink-500">· {p.period.label}</span></span>}
    footer={canCloseEarly ? <div data-testid="bonus-close-early" className="space-y-2 text-xs">
      {!closing ? <button type="button" data-testid="bonus-close-early-open" onClick={() => setClosing(true)} className="inline-flex items-center gap-1 text-ink-600 hover:text-ink"><Lock size={11} /> Close this period early…</button>
        : <><p className="text-ink-600">Closes <b>{p.period.label}</b> today ({bz.shortDay(p.asOf)}) with the actual frozen at {f(p.actual)}. Reason is required and goes to the audit log.</p>
          <div className="flex items-center gap-2"><input data-testid="bonus-close-early-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason — e.g. plan restructured from Nov" className={`${field} flex-1`} /><Button size="sm" variant="primary" data-testid="bonus-close-early-confirm" disabled={!reason.trim()} onClick={() => void closeEarly()}>Close period</Button><button type="button" data-testid="bonus-close-early-cancel" onClick={() => { setClosing(false); setReason(''); }} className="text-ink-500 hover:text-ink">Cancel</button></div>
          {err && <p data-testid="bonus-close-early-error" className="text-rose-700">{err}</p>}</>}
    </div> : undefined}>
    <div className="rounded-md bg-surface p-3 text-xs shadow-card">
      <div className="flex items-baseline justify-between"><span data-testid="bonus-drawer-actual" className="font-mono text-lg font-semibold text-ink">{f(p.actual)}</span><span className="text-ink-500">of <span data-testid="bonus-drawer-target" className="font-mono font-semibold text-ink">{f(p.target)}</span> · {p.pct}%</span></div>
      <div className="mt-2"><ProgressBar pct={p.pct} pacePct={p.pacePct} status={p.status} testId="bonus-drawer-bar" /></div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-ink-600">
        <div><div className="text-ink-400">Working days</div><div data-testid="bonus-drawer-wd" className="font-mono">{p.elapsedWd} of {p.periodWd} · {p.remainingWd} left</div></div>
        <div><div className="text-ink-400">Pace</div><div data-testid="bonus-drawer-pace" className="font-mono">{f(p.pace)} · {p.pacePct}%</div></div>
        <div><div className="text-ink-400">Status</div><PaceChip status={p.status} testId="bonus-drawer-status" /></div>
      </div>
      {showPayout && <p data-testid="bonus-drawer-payout" className="mt-2 text-[11px] text-ink-600">{p.plan.tiers.length ? <>Tiers: {p.plan.tiers.map((t) => <span key={t.pct} className={clsx('mr-1.5 rounded-sm px-1 font-mono', p.projectedTier?.pct === t.pct ? 'bg-moss-50 text-moss-700 ring-1 ring-moss-100' : 'bg-canvas')}>{t.pct}% → {fmtMoney(t.payout)}</span>)} · projected <b className="font-mono">{fmtMoney(p.projectedPayout)}</b></> : <>Payout {fmtMoney(p.plan.flatPayout)} when the target is reached · projected <b className="font-mono">{fmtMoney(p.projectedPayout)}</b></>}</p>}
      <p className="mt-1 text-[10px] text-ink-400">{p.meta.view} · {p.meta.dated === 'invoice' ? 'by invoice date' : 'by completed date'} · {bz.workingDaysLabel()}</p>
    </div>
    <div className="rounded-md bg-surface shadow-card">
      <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">By week</div>
      <table className="w-full text-xs" data-testid="bonus-drawer-weeks"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-3 py-1.5">Week</th><th className="py-1.5 text-right">WD</th><th className="py-1.5 text-right">Actual</th><th className="py-1.5 text-right">Cumulative</th><th className="py-1.5 pr-3 text-right">Pace line</th></tr></thead>
        <tbody>{p.weekly.map((w) => <tr key={w.start} data-testid={`bonus-week-${w.start}`} data-future={w.future || undefined} className={clsx('border-t border-line/70', w.future && 'text-ink-300')}>
          <td className="px-3 py-1.5">{w.label}</td><td className="py-1.5 text-right font-mono">{w.wd}</td><td className="py-1.5 text-right font-mono">{w.future ? '—' : f(w.actual)}</td><td className={clsx('py-1.5 text-right font-mono', !w.future && w.cumActual >= w.paceLine ? 'text-moss-700' : !w.future ? 'text-rose-700' : '')}>{w.future ? '—' : f(w.cumActual)}</td><td className="py-1.5 pr-3 text-right font-mono text-ink-500">{f(w.paceLine)}</td>
        </tr>)}</tbody></table>
    </div>
    <div className="rounded-md bg-surface shadow-card">
      <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">View rows · {p.rows.length}</div>
      <ul data-testid="bonus-drawer-rows" className="max-h-72 divide-y divide-line/70 overflow-y-auto text-xs">{p.rows.map((r, i) => <li key={`${r.date}-${i}`} className="flex items-center justify-between px-3 py-1"><span className="font-mono text-ink-500">{bz.shortDay(r.date)}</span><span className="font-mono text-ink-400">{r.ref}</span><span className="font-mono font-semibold text-ink">{f(r.amount)}</span></li>)}{!p.rows.length && <li className="px-3 py-3 text-ink-400">No rows yet this period.</li>}</ul>
    </div>
  </RightSheet>;
};
