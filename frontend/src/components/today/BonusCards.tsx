import { ChevronRight, Lock, Target, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bz from '@/api/bonus';
import type { BonusProgress, BonusResult } from '@/api/bonus';
import { BonusDrawer, PaceChip, ProgressBar, fmtAmount, useAsOf } from '@/components/bonus/BonusBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtMoney } from '@/lib/format';

// Staff Hitlist card — their OWN plan only, only when the plan says Show to staff. Tap → weekly-breakdown drawer. Payout $ obeys the plan's Show payout toggle.
export const BonusProgressCard = ({ userId }: { userId: string }) => {
  const asOf = useAsOf(); const [items, setItems] = useState<BonusProgress[]>([]); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { void bz.getMyBonus(userId).then(setItems); }, [userId, asOf]);
  if (!items.length) return null; const sel = items.find((p) => p.plan.id === open);
  return <>
    <Card testId="bonus-progress-card" bodyClassName="p-0" className="border-l-[3px] border-brand" title={<span className="inline-flex items-center gap-2"><Target size={13} className="text-brand" /> Your bonus</span>} subtitle={`Where you stand as of ${bz.shortDay(asOf)} · pace on ${bz.workingDaysLabel()} working days · tap for the weekly breakdown`}>
      <ul className="divide-y divide-line/70">{items.map((p) => { const f = (n: number) => fmtAmount(p.kind, n); return <li key={p.plan.id}><button type="button" data-testid={`bonus-mine-${p.plan.id}`} data-status={p.status} onClick={() => setOpen(p.plan.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-canvas/70">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-ink">{p.period.label}</span><span className="text-ink-500">· {p.meta.label}</span><PaceChip status={p.status} testId={`bonus-mine-status-${p.plan.id}`} /></div>
          <div className="mt-1.5 flex items-baseline gap-2"><span data-testid={`bonus-mine-actual-${p.plan.id}`} className="font-mono text-lg font-semibold text-ink">{f(p.actual)}</span><span className="text-xs text-ink-500">of {f(p.target)} · {p.pct}%</span><span className="ml-auto font-mono text-[11px] text-ink-500">{p.remainingWd} working day{p.remainingWd === 1 ? '' : 's'} left</span></div>
          <div className="mt-1.5"><ProgressBar pct={p.pct} pacePct={p.pacePct} status={p.status} testId={`bonus-mine-bar-${p.plan.id}`} /></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 text-[11px] text-ink-600"><span>Pace → <b className="font-mono">{f(p.pace)}</b> ({p.pacePct}%)</span>{p.plan.showPayout && <span data-testid={`bonus-mine-payout-${p.plan.id}`}>{p.plan.tiers.length ? `Tiers ${p.plan.tiers.map((t) => `${t.pct}% → ${fmtMoney(t.payout)}`).join(' · ')}` : `${fmtMoney(p.plan.flatPayout)} when you reach it`} · on pace for <b className="font-mono">{fmtMoney(p.projectedPayout)}</b></span>}{p.lastResult && <span data-testid={`bonus-mine-last-${p.plan.id}`} className="text-ink-400">Last · {p.lastResult.period.label} {p.lastResult.status}{p.plan.showPayout && p.lastResult.payout ? ` · ${fmtMoney(p.lastResult.payout)}${p.lastResult.paidAt ? ' paid' : ''}` : ''}</span>}</div>
        </div><ChevronRight size={14} className="shrink-0 text-ink-300" /></button></li>; })}</ul>
    </Card>
    {sel && <BonusDrawer p={sel} onClose={() => setOpen(null)} showPayout={sel.plan.showPayout} />}
  </>;
};

// MH Hitlist card — closed periods with a payout not yet marked paid; disappears when every row is paid
export const BonusResultsCard = () => {
  const asOf = useAsOf(); const [rows, setRows] = useState<BonusResult[] | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => bz.getUnpaidBonusResults().then(setRows), []);
  useEffect(() => { void load(); }, [load, asOf]);
  if (!rows?.length) return null;
  const pay = async (r: BonusResult) => { try { await bz.markBonusPaid(r.plan.id, r.period.key); setMsg(`Paid · ${r.user.shortName} · ${r.period.label}`); window.setTimeout(() => setMsg(null), 3000); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } await load(); };
  return <Card testId="bonus-results-hitlist-card" bodyClassName="p-0" className="border-l-[3px] border-moss" title={<span className="inline-flex items-center gap-2"><Trophy size={13} className="text-moss-700" /> Bonus results · to pay <span data-testid="bonus-results-hitlist-count" className="font-mono text-[11px] text-ink-500">{rows.length}</span><span data-testid="bonus-results-hitlist-total" className="rounded-sm bg-moss-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-moss-700">{fmtMoney(rows.reduce((t, r) => t + r.payout, 0))}</span></span>} subtitle="Closed periods that reached their target · Mark paid locks the row · clears when every row is paid"
    action={<Link to="/analytics/bonuses" data-testid="bonus-results-hitlist-open" className="text-xs font-medium text-brand hover:underline">Analytics → Bonuses</Link>}>
    {msg && <p data-testid="bonus-results-hitlist-msg" className="px-4 pt-2 text-xs text-moss-700">{msg}</p>}
    <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-4 py-1.5">Staff</th><th className="py-1.5">Period</th><th className="py-1.5 text-right">Actual / target</th><th className="py-1.5 text-right">Payout</th><th className="py-1.5 pr-4" /></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id} data-testid={`bonus-results-hitlist-row-${r.plan.id}-${r.period.key}`} className="border-t border-line/70">
        <td className="px-4 py-1.5 font-medium text-ink">{r.user.shortName} <span className="font-normal text-ink-400">· {bz.BASIS_META[r.plan.basis].label}</span></td><td className="py-1.5">{r.period.label}{r.closedBy !== 'system' && <span className="ml-1 text-[10px] text-amber-800">closed early</span>}</td>
        <td className="py-1.5 text-right font-mono">{fmtAmount(r.kind, r.actual)} <span className="text-ink-400">/ {fmtAmount(r.kind, r.target)}</span></td><td className="py-1.5 text-right font-mono font-semibold text-moss-700">{fmtMoney(r.payout)}{r.tier && <span className="ml-1 font-normal text-ink-400">tier {r.tier.pct}%</span>}</td>
        <td className="py-1.5 pr-4 text-right"><Button size="sm" variant="primary" data-testid={`bonus-results-hitlist-pay-${r.plan.id}-${r.period.key}`} onClick={() => void pay(r)}><Lock size={10} /> Mark paid</Button></td>
      </tr>)}</tbody></table>
  </Card>;
};
