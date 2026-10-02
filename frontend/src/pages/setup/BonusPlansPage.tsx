import clsx from 'clsx';
import { ArrowLeft, BarChart3, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bz from '@/api/bonus';
import type { BonusPlan, BonusSettings } from '@/api/bonus';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { BonusPlanForm, blankDraft, draftFromPlan } from '@/components/bonus/BonusPlanForm';
import { fmtAmount } from '@/components/bonus/BonusBits';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtMoney } from '@/lib/format';

// Setup → Bonus plans (owner only, MH): working-day setting + one row per plan (staff · basis · period · target · payout · show-to-staff · active)
const WorkingDaysCard = ({ s, onSaved }: { s: BonusSettings; onSaved: (m: string) => void }) => {
  const [days, setDays] = useState<number[]>(s.workingDays); const [err, setErr] = useState<string | null>(null); useEffect(() => setDays(s.workingDays), [s]);
  const dirty = days.join() !== s.workingDays.join();
  return <Card title="Working days (pacing denominator)" subtitle="Pace = (actual ÷ elapsed working days) × period working days · revenue lands on the invoice date, counts on the completed date · history never changes, only the denominator" testId="bonus-working-days-card">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {bz.WEEKDAYS.map((w) => <button key={w.n} type="button" data-testid={`bonus-wd-${w.n}`} aria-pressed={days.includes(w.n)} onClick={() => setDays(days.includes(w.n) ? days.filter((x) => x !== w.n) : [...days, w.n].sort())} className={clsx('h-8 rounded-full border px-3 font-medium', days.includes(w.n) ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300')}>{w.label}</button>)}
      <span className="text-ink-400">Sun always closed</span>
      <Button size="sm" variant="primary" data-testid="bonus-wd-save" disabled={!dirty} onClick={async () => { try { setErr(null); await bz.setWorkingDays(days); onSaved(`Working days saved · ${bz.workingDaysLabel()}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>Save</Button>
      <span data-testid="bonus-wd-oct" className="ml-auto font-mono text-[11px] text-ink-500">Oct 2026 = {bz.workingDaysInMonth('2026-10')} working days · Sep = {bz.workingDaysInMonth('2026-09')}</span>
    </div>
    {err && <p className="mt-2 text-xs text-rose-700">{err}</p>}
  </Card>;
};

export default function BonusPlansPage() {
  const [plans, setPlans] = useState<(BonusPlan & { user: User })[]>([]); const [settings, setSettings] = useState<BonusSettings | null>(null); const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<ReturnType<typeof blankDraft> | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = () => Promise.all([bz.getBonusPlans().then(setPlans), bz.getBonusSettings().then(setSettings), api.getUsers().then((u) => setUsers(u.filter((x) => !x.disabled)))]);
  useEffect(() => { void load(); }, []);
  if (!api.isOwnerSync()) return <div data-testid="bonus-plans-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Bonus plans are owner-only (MH). Progress is on <Link to="/analytics/bonuses" className="underline">Analytics → Bonuses</Link> for MH and the Operations Manager.</div>;
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(null), 3500); void load(); };
  const flag = async (p: BonusPlan, f: 'showToStaff' | 'showPayout' | 'active') => { await bz.setBonusPlanFlag(p.id, f, !p[f]); say(`${f === 'showToStaff' ? 'Show to staff' : f === 'showPayout' ? 'Show payout' : 'Active'} → ${!p[f] ? 'on' : 'off'}`); };
  return <div data-testid="bonus-plans-page" className="space-y-3">
    <Link to="/setup" data-testid="bonus-plans-back" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Setup</Link>
    <PageHeader title="Bonus plans" subtitle="One plan per person · basis = the report it reads (never a client-side sum) · flat payout by default, optional tiers · Show to staff puts a progress card on their Hitlist (default on, so they stop asking)"
      action={<div className="flex items-center gap-2"><Link to="/analytics/bonuses" data-testid="bonus-plans-analytics" className="inline-flex h-7 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 hover:border-ink-300"><BarChart3 size={12} /> Analytics → Bonuses</Link><Button variant="primary" size="sm" data-testid="bonus-plans-add" onClick={() => setDraft(blankDraft(users[0]?.id ?? 'u-mam'))}><Plus size={12} /> Add plan</Button></div>} />
    {msg && <p data-testid="bonus-plans-msg" className="text-xs text-moss-700">{msg}</p>}
    {settings && <WorkingDaysCard s={settings} onSaved={say} />}
    {draft && <BonusPlanForm key={draft.id ?? 'new'} initial={draft} users={users} onSaved={(p) => { setDraft(null); say(`${draft.id ? 'Saved' : 'Added'} plan for ${plans.find((x) => x.userId === p.userId)?.user.shortName ?? users.find((u) => u.id === p.userId)?.shortName}`); }} onCancel={() => setDraft(null)} />}
    <Table testId="bonus-plans-table">
      <thead><tr><Th>Staff</Th><Th>Basis</Th><Th>Period</Th><Th>Effective from</Th><Th className="text-right">Target</Th><Th>Payout</Th><Th>Show to staff</Th><Th>Show payout $</Th><Th>Active</Th><Th>Note</Th><Th /></tr></thead>
      <tbody>{plans.map((p) => { const kind = bz.planKind(p); return <tr key={p.id} data-testid={`bonus-plan-row-${p.id}`} data-active={p.active} data-show-staff={p.showToStaff} className={clsx('align-top', !p.active && 'opacity-50')}>
        <Td className="font-medium text-ink">{p.user.shortName} <span className="text-ink-400">· {p.user.dutyLabel}</span></Td>
        <Td className="text-xs">{bz.BASIS_META[p.basis].label}<div className="font-mono text-[10px] text-ink-400">{p.basis === 'custom_view' ? p.customView?.name : bz.BASIS_META[p.basis].view}</div></Td>
        <Td className="text-xs">{bz.periodMonthsLabel(p.periodMonths)}</Td><Td className="font-mono text-xs">{bz.monthLabel(p.anchorMonth)}</Td>
        <Td data-testid={`bonus-plan-target-${p.id}`} className="text-right font-mono text-xs font-semibold text-ink">{fmtAmount(kind, p.target)}</Td>
        <Td data-testid={`bonus-plan-payout-${p.id}`} className="text-xs">{p.tiers.length ? <span className="space-x-1">{p.tiers.map((t) => <span key={t.pct} className="rounded-sm bg-canvas px-1 font-mono text-[11px]">{t.pct}% → {fmtMoney(t.payout)}</span>)}</span> : <span className="font-mono">{fmtMoney(p.flatPayout)} flat</span>}</Td>
        <Td><button type="button" data-testid={`bonus-plan-toggle-staff-${p.id}`} aria-pressed={p.showToStaff} onClick={() => void flag(p, 'showToStaff')} className={clsx('h-6 rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset', p.showToStaff ? 'bg-moss-50 text-moss-700 ring-moss-100' : 'bg-canvas text-ink-500 ring-line')}>{p.showToStaff ? 'On' : 'Off'}</button></Td>
        <Td><button type="button" data-testid={`bonus-plan-toggle-payout-${p.id}`} aria-pressed={p.showPayout} onClick={() => void flag(p, 'showPayout')} className={clsx('h-6 rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset', p.showPayout ? 'bg-moss-50 text-moss-700 ring-moss-100' : 'bg-canvas text-ink-500 ring-line')}>{p.showPayout ? 'On' : 'Off'}</button></Td>
        <Td><button type="button" data-testid={`bonus-plan-toggle-active-${p.id}`} aria-pressed={p.active} onClick={() => void flag(p, 'active')} className={clsx('h-6 rounded-full px-2 text-[11px] font-semibold ring-1 ring-inset', p.active ? 'bg-brand-50 text-brand ring-brand-100' : 'bg-canvas text-ink-500 ring-line')}>{p.active ? 'Active' : 'Paused'}</button></Td>
        <Td className="max-w-[220px] text-[11px] text-ink-500">{p.note}</Td>
        <Td><button type="button" data-testid={`bonus-plan-edit-${p.id}`} onClick={() => { setDraft(draftFromPlan(p)); window.scrollTo({ top: 0 }); }} className="inline-flex items-center gap-1 text-xs text-brand hover:underline"><Pencil size={11} /> Edit</button></Td>
      </tr>; })}{!plans.length && <EmptyRow colSpan={11} text="No plans yet" />}</tbody>
    </Table>
    <p className="text-[11px] text-ink-400">Views behind the bases: {bz.BASES.filter((k) => k !== 'custom_view').map((k) => <span key={k} className="mr-2 font-mono">{bz.BASIS_META[k].view}</span>)} · Joseph total is derived inside its view (Band Room − Matthew).</p>
  </div>;
}
