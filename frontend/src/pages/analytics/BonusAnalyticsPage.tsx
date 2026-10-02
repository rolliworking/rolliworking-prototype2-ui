import clsx from 'clsx';
import { Download, Eye, EyeOff, Lock, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bz from '@/api/bonus';
import type { BonusProgress, BonusResult } from '@/api/bonus';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AsOfControl, BonusDrawer, PaceChip, ProgressBar, fmtAmount, fmtPeriodDates, useAsOf } from '@/components/bonus/BonusBits';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoney } from '@/lib/format';

// /analytics/bonuses — MH + Operations Manager. One card per open plan (actual · target · pace · working days · projected payout), totals row, closed periods (automatic at period end, early by MH) with Mark paid + CSV.
const PlanCard = ({ p, onOpen }: { p: BonusProgress; onOpen: () => void }) => {
  const f = (n: number) => fmtAmount(p.kind, n);
  return <button type="button" data-testid={`bonus-card-${p.plan.id}`} data-status={p.status} data-user={p.user.shortName} onClick={onOpen} className={clsx('block w-full rounded-md bg-surface p-4 text-left shadow-card ring-1 ring-transparent transition-[box-shadow,transform] hover:-translate-y-px hover:ring-line', p.status === 'reached' && 'border-l-[3px] border-moss', p.status === 'on_pace' && 'border-l-[3px] border-brand', p.status === 'behind' && 'border-l-[3px] border-rose-500')}>
    <div className="flex items-start justify-between gap-2">
      <div><div className="text-[13px] font-semibold text-ink">{p.user.shortName} <span className="font-normal text-ink-400">· {p.user.dutyLabel}</span></div><div className="text-[11px] text-ink-500">{p.meta.label} · <span data-testid={`bonus-card-period-${p.plan.id}`}>{p.period.label}</span> · {fmtPeriodDates(p.period)}</div></div>
      <PaceChip status={p.status} testId={`bonus-card-status-${p.plan.id}`} />
    </div>
    <div className="mt-3 flex items-baseline gap-2"><span data-testid={`bonus-card-actual-${p.plan.id}`} className="font-mono text-2xl font-semibold tracking-tight text-ink">{f(p.actual)}</span><span className="text-xs text-ink-500">of <span data-testid={`bonus-card-target-${p.plan.id}`} className="font-mono font-semibold text-ink">{f(p.target)}</span></span><span data-testid={`bonus-card-pct-${p.plan.id}`} className="ml-auto font-mono text-xs text-ink-600">{p.pct}%</span></div>
    <div className="mt-2"><ProgressBar pct={p.pct} pacePct={p.pacePct} status={p.status} testId={`bonus-card-bar-${p.plan.id}`} /></div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
      <div><div className="text-ink-400">Working days</div><div data-testid={`bonus-card-wd-${p.plan.id}`} className="font-mono text-ink-700">{p.elapsedWd}/{p.periodWd} · {p.remainingWd} left</div></div>
      <div><div className="text-ink-400">Pace → period</div><div data-testid={`bonus-card-pace-${p.plan.id}`} className="font-mono text-ink-700">{f(p.pace)} <span className="text-ink-400">({p.pacePct}%)</span></div></div>
      <div><div className="text-ink-400">Projected bonus</div><div data-testid={`bonus-card-projected-${p.plan.id}`} className={clsx('font-mono font-semibold', p.projectedPayout > 0 ? 'text-moss-700' : 'text-ink-400')}>{fmtMoney(p.projectedPayout)}{p.projectedTier && <span className="ml-1 font-normal text-ink-400">tier {p.projectedTier.pct}%</span>}</div></div>
    </div>
    <div className="mt-3 flex items-center gap-2 text-[10px] text-ink-400">
      <span data-testid={`bonus-card-visibility-${p.plan.id}`} className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 ring-1 ring-inset', p.plan.showToStaff ? 'bg-moss-50 text-moss-700 ring-moss-100' : 'bg-canvas text-ink-500 ring-line')}>{p.plan.showToStaff ? <Eye size={10} /> : <EyeOff size={10} />} {p.plan.showToStaff ? 'shown to staff' : 'hidden from staff'}</span>
      {p.plan.tiers.length ? <span>tiers {p.plan.tiers.map((t) => `${t.pct}%`).join(' · ')}</span> : <span>flat {fmtMoney(p.plan.flatPayout)}</span>}
      {p.lastResult && <span data-testid={`bonus-card-last-${p.plan.id}`} className="ml-auto">last · {p.lastResult.period.label} {p.lastResult.status}{p.lastResult.payout ? ` · ${fmtMoney(p.lastResult.payout)}` : ''}</span>}
    </div>
  </button>;
};

export default function BonusAnalyticsPage() {
  const { user } = useAuth(); const asOf = useAsOf();
  const [progress, setProgress] = useState<BonusProgress[]>([]); const [results, setResults] = useState<BonusResult[]>([]); const [open, setOpen] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([bz.getBonusProgress().then(setProgress), bz.getBonusResults().then(setResults)]), []);
  useEffect(() => { void load(); }, [load, asOf]);
  if (!bz.canSeeBonusAnalytics(user)) return <div data-testid="bonus-analytics-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Bonus analytics are for MH and the Operations Manager.</div>;
  const owner = api.isOwnerSync(); const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 3500); };
  const pay = async (r: BonusResult) => { try { setErr(null); await bz.markBonusPaid(r.plan.id, r.period.key); say(`Marked paid · ${r.user.shortName} · ${r.period.label} · ${fmtMoney(r.payout)}`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const csv = () => { const blob = new Blob([bz.resultsCsv(results)], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bonus-results-asof-${asOf}.csv`; a.click(); URL.revokeObjectURL(a.href); say(`CSV · ${results.length} rows`); };
  const totalProjected = progress.reduce((t, p) => t + p.projectedPayout, 0); const count = (s: string) => progress.filter((p) => p.status === s).length; const unpaid = results.filter((r) => r.payout > 0 && !r.paidAt);
  const sel = progress.find((p) => p.plan.id === open);
  return <div data-testid="bonus-analytics-page" className="space-y-4">
    <PageHeader title="Bonuses" subtitle={`Actuals read from the bonus views (revenue by invoice date · counts by completed date) · pace on ${bz.workingDaysLabel()} working days · Oct 2026 = ${bz.workingDaysInMonth('2026-10')}`}
      action={owner ? <Link to="/setup/bonus-plans" data-testid="bonus-analytics-setup" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 hover:border-ink-300"><Settings size={12} /> Setup → Bonus plans</Link> : undefined} />
    <AsOfControl />
    {msg && <p data-testid="bonus-analytics-msg" className="text-xs text-moss-700">{msg}</p>}{err && <p data-testid="bonus-analytics-error" className="text-xs text-rose-700">{err}</p>}
    <div data-testid="bonus-summary" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {[['Open plans', String(progress.length), 'bonus-sum-open'], ['Reached', String(count('reached')), 'bonus-sum-reached'], ['On pace', String(count('on_pace')), 'bonus-sum-onpace'], ['Behind', String(count('behind')), 'bonus-sum-behind'], ['Projected payout', fmtMoney(totalProjected), 'bonus-sum-projected']].map(([l, v, id]) => <div key={id} data-testid={id} className="rounded-md bg-surface px-4 py-3 shadow-card"><div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{l}</div><div className="mt-1 font-mono text-xl font-semibold text-ink">{v}</div></div>)}
    </div>
    <div data-testid="bonus-cards" data-count={progress.length} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {progress.map((p) => <PlanCard key={p.plan.id} p={p} onOpen={() => setOpen(p.plan.id)} />)}
      {!progress.length && <div data-testid="bonus-cards-empty" className="col-span-full rounded-md border border-dashed border-line px-4 py-8 text-center text-xs text-ink-400">No open periods as of {bz.shortDay(asOf)}.</div>}
    </div>
    <div data-testid="bonus-totals" className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md bg-ink px-4 py-3 text-xs text-white">
      <span className="font-semibold uppercase tracking-wide text-white/70">Totals · open periods</span>
      <span>Projected payout <b data-testid="bonus-totals-projected" className="font-mono text-base">{fmtMoney(totalProjected)}</b></span>
      <span>If every target is reached <b data-testid="bonus-totals-max" className="font-mono">{fmtMoney(progress.reduce((t, p) => t + p.payoutIfReached, 0))}</b></span>
      <span className="ml-auto text-white/70">Closed · unpaid <b data-testid="bonus-totals-unpaid" className="font-mono text-white">{fmtMoney(unpaid.reduce((t, r) => t + r.payout, 0))}</b> across {unpaid.length} row{unpaid.length === 1 ? '' : 's'}</span>
    </div>

    <Card title={<span className="inline-flex items-center gap-2"><Lock size={12} /> Closed periods <span className="font-mono text-[11px] text-ink-400">{results.length}</span></span>} subtitle="Automatic the day after the period ends · MH may close early with a reason · Mark paid locks the row · rows stay on MH's Hitlist until paid" testId="bonus-results-card" bodyClassName="p-0"
      action={<Button size="sm" data-testid="bonus-results-csv" onClick={csv} disabled={!results.length}><Download size={12} /> CSV</Button>}>
      <Table testId="bonus-results-table">
        <thead><tr><Th>Staff</Th><Th>Basis</Th><Th>Period</Th><Th className="text-right">Actual</Th><Th className="text-right">Target</Th><Th className="text-right">%</Th><Th>Result</Th><Th className="text-right">Payout</Th><Th>Closed</Th><Th>Paid</Th></tr></thead>
        <tbody>{results.map((r) => <tr key={r.id} data-testid={`bonus-result-${r.plan.id}-${r.period.key}`} data-status={r.status} data-paid={!!r.paidAt} className="align-top">
          <Td className="font-medium text-ink">{r.user.shortName}</Td><Td className="text-xs">{bz.BASIS_META[r.plan.basis].label}</Td><Td className="text-xs">{r.period.label}<div className="text-[10px] text-ink-400">{fmtPeriodDates(r.period)}</div></Td>
          <Td className="text-right font-mono text-xs font-semibold">{fmtAmount(r.kind, r.actual)}</Td><Td className="text-right font-mono text-xs">{fmtAmount(r.kind, r.target)}</Td><Td className="text-right font-mono text-xs">{r.pct}%</Td>
          <Td><PaceChip status={r.status} testId={`bonus-result-status-${r.plan.id}-${r.period.key}`} /></Td>
          <Td data-testid={`bonus-result-payout-${r.plan.id}-${r.period.key}`} className={clsx('text-right font-mono text-xs font-semibold', r.payout ? 'text-moss-700' : 'text-ink-400')}>{fmtMoney(r.payout)}{r.tier && <span className="ml-1 font-normal text-ink-400">tier {r.tier.pct}%</span>}</Td>
          <Td className="text-[11px] text-ink-500">{r.closedBy === 'system' ? <>auto · {bz.shortDay(r.closedAt)}</> : <span data-testid={`bonus-result-early-${r.plan.id}-${r.period.key}`} className="text-amber-800">early · {r.closedBy} · {bz.shortDay(r.closedAt)}<div className="text-ink-500">{r.earlyReason}</div></span>}</Td>
          <Td className="text-[11px]">{r.paidAt ? <span data-testid={`bonus-result-paid-${r.plan.id}-${r.period.key}`} className="inline-flex items-center gap-1 text-moss-700"><Lock size={10} /> paid · {r.paidBy} · {fmtDate(r.paidAt)}</span> : r.payout > 0 ? (owner ? <Button size="sm" variant="primary" data-testid={`bonus-result-pay-${r.plan.id}-${r.period.key}`} onClick={() => void pay(r)}>Mark paid</Button> : <span className="text-amber-800">unpaid</span>) : <span className="text-ink-400">—</span>}</Td>
        </tr>)}{!results.length && <EmptyRow colSpan={10} text={`No closed periods as of ${bz.shortDay(asOf)}`} />}</tbody>
      </Table>
    </Card>
    {sel && <BonusDrawer p={sel} onClose={() => setOpen(null)} canCloseEarly={owner} onChanged={() => void load()} />}
  </div>;
}
