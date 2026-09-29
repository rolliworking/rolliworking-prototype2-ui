import { ChevronDown, ChevronRight, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { DeptDashboard, PadCard, PadRoom, PaceStatus } from '@/api/client';
import { ScanInput } from '@/components/rw/RwBits';
import { useFmtMoney } from '@/components/MoneyContext';
import { Chip } from './PadBits';

const PACE: Record<PaceStatus, { label: string; cls: string }> = { ahead: { label: 'ahead', cls: 'bg-emerald-700 text-emerald-50' }, on_pace: { label: 'on pace', cls: 'bg-sky-700 text-sky-50' }, behind: { label: 'behind', cls: 'bg-rose-700 text-rose-50' } };

// Reusable department goal tracker (gauge + history hit/miss) — same component for WM and Band rooms, re-parameterised
export const DeptGoalTracker = ({ d, onChanged }: { d: DeptDashboard; onChanged: () => void }) => {
  const fmtMoney = useFmtMoney();
  const g = d.goals; const pct = Math.min(100, Math.round((g.actualMtd / g.goal) * 100)); void onChanged;
  return <section data-testid="dept-goal" className="rounded-[28px] border border-white/10 bg-[#1f2630] p-5">
    <div className="flex flex-wrap items-center gap-3"><Target size={20} className="text-amber-400" /><h2 className="text-xl font-bold text-white">{d.label} · {g.history.at(-1)?.label} revenue</h2><span data-testid="dept-pace" className={`rounded-full px-3 py-1 text-sm font-bold uppercase ${PACE[g.pace].cls}`}>{PACE[g.pace].label}</span>
      <span className="ml-auto text-sm text-slate-400">goal <span data-testid="dept-goal-total" className="font-mono text-white">{fmtMoney(g.goal)}</span> <span data-testid="dept-goal-derived" className="text-xs text-slate-500">= sum of the team’s goals · edit on Team</span></span></div>
    <div className="mt-3 flex items-end gap-6"><div><div data-testid="dept-actual" className="font-mono text-4xl font-bold text-white">{fmtMoney(g.actualMtd)}</div><div className="text-sm text-slate-400">so far · day {g.dayOfMonth} of {g.daysInMonth}</div></div><div><div data-testid="dept-projected" className="font-mono text-2xl text-slate-200">{fmtMoney(g.projected)}</div><div className="text-sm text-slate-400">projected month-end at today’s run-rate</div></div></div>
    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${g.pace === 'behind' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
    <ul data-testid="dept-history" className="mt-4 grid grid-cols-4 gap-2 text-sm">{g.history.map((m) => <li key={m.key} data-testid={`dept-month-${m.key}`} data-hit={m.hit} className={`rounded-2xl border p-3 ${m.current ? 'border-amber-400/50' : m.hit ? 'border-emerald-500/40' : 'border-rose-500/40'}`}><div className="text-slate-400">{m.label}{m.current && ' · now'}</div><div className="font-mono text-white">{fmtMoney(m.actual)} <span className="text-slate-500">/ {fmtMoney(m.goal)}</span></div><div className={`text-xs font-bold uppercase ${m.current ? 'text-amber-300' : m.hit ? 'text-emerald-300' : 'text-rose-300'}`}>{m.current ? 'in progress' : m.hit ? 'hit' : 'missed'}</div></li>)}</ul>
  </section>;
};

const CardRow = ({ c, extra }: { c: PadCard; extra?: string }) => { const nav = useNavigate(); return <li data-testid={`dash-job-${c.job.id}`}><button onClick={() => nav(`/rw/jobs/${c.job.id}`)} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-white/5"><span className="font-mono text-base font-semibold text-white">{c.job.number}</span><span className="flex-1 truncate text-sm text-slate-300">{c.job.watch.brand} {c.job.watch.model} · {c.job.client.lastName}</span><span className="text-xs text-slate-400">{c.stageLabel}{extra ? ` · ${extra}` : ''}</span></button></li>; };

const Accordion = ({ id, title, cards, tone, extra }: { id: string; title: string; cards: PadCard[]; tone: 'rose' | 'amber' | 'blue' | 'neutral'; extra?: (c: PadCard) => string }) => {
  const [open, setOpen] = useState(false);
  return <section data-testid={`dash-section-${id}`} className="rounded-[28px] border border-white/10 bg-[#1f2630]">
    <button data-testid={`dash-toggle-${id}`} onClick={() => setOpen(!open)} className="flex min-h-[64px] w-full items-center gap-3 px-5 text-left">{open ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}<span className="text-lg font-semibold text-white">{title}</span><Chip tone={cards.length ? tone : 'neutral'} testId={`dash-count-${id}`}>{cards.length}</Chip></button>
    {open && <ul data-testid={`dash-list-${id}`} className="border-t border-white/10 p-2">{cards.map((c) => <CardRow key={c.job.id} c={c} extra={extra?.(c)} />)}{!cards.length && <li className="px-3 py-4 text-center text-slate-500">Nothing here.</li>}</ul>}
  </section>;
};

export const PadDashboard = ({ tick, room = 'wm' }: { tick: number; room?: PadRoom }) => {
  const [d, setD] = useState<DeptDashboard | null>(null); const [openTech, setOpenTech] = useState<string | null>(null); const nav = useNavigate();
  const load = () => api.getDeptDashboard(room).then(setD);
  useEffect(() => { void load(); }, [tick, room]);
  if (!d) return null;
  return <div data-testid="pad-dashboard" className="space-y-4">
    <div className="rounded-[28px] border border-amber-400/30 bg-amber-400/5 p-4"><ScanInput big testId="dash-scan" placeholder="Scan a job barcode → opens its record" onScan={async (code) => { const c = await api.getPadPartsContext(code); nav(`/rw/jobs/${c.job.id}`); }} /></div>
    <DeptGoalTracker d={d} onChanged={() => void load()} />
    <section data-testid="dash-tech-strip" className="flex flex-wrap gap-2">{d.techs.map((t) => <span key={t.user.id} data-testid={`dash-pace-${t.user.id}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/5 px-4 text-sm"><span className="font-semibold text-white">{t.user.shortName}</span><span className="font-mono text-slate-400">{t.actual}/{t.goal}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${PACE[t.pace].cls}`}>{PACE[t.pace].label}</span></span>)}</section>
    <section data-testid="dash-funnel" className="rounded-[28px] border border-white/10 bg-[#1f2630] p-4"><div className="flex items-baseline gap-3"><span className="font-mono text-3xl font-bold text-white">{d.totalJobs}</span><span className="text-slate-400">department jobs</span></div><div className="mt-3 flex flex-wrap gap-2">{d.funnel.filter((f) => f.count).map((f) => <span key={f.stage} data-testid={`dash-funnel-${f.stage}`} className="rounded-xl bg-white/5 px-3 py-2 text-sm"><span className="font-mono text-lg font-bold text-white">{f.count}</span> <span className="text-slate-400">{f.label}</span></span>)}</div></section>
    <div className="grid gap-3 lg:grid-cols-2">
      <Accordion id="stuck" title={`Stuck · ${d.stuckDays}+ days in stage`} cards={d.stuck} tone="rose" extra={(c) => `${api.jobDaysInStage(c.job)} d`} />
      <Accordion id="problem" title="Problem jobs · hold / failed QC / manager review" cards={d.problem} tone="rose" />
      <Accordion id="parts" title="Awaiting parts" cards={d.awaitingParts} tone="amber" extra={(c) => `${c.pendingParts} pending`} />
      <Accordion id="testing" title="Testing / QC · not on anyone’s bench count" cards={d.testing} tone="blue" />
    </div>
    <section data-testid="dash-roster" className="rounded-[28px] border border-white/10 bg-[#1f2630] p-4"><h2 className="text-lg font-semibold text-white">Team roster · active jobs (testing excluded)</h2>
      <ul className="mt-2 divide-y divide-white/5">{d.techs.map((t) => <li key={t.user.id}><button data-testid={`dash-roster-${t.user.id}`} onClick={() => setOpenTech(openTech === t.user.id ? null : t.user.id)} className="flex min-h-[52px] w-full items-center gap-3 text-left"><span className="w-20 font-semibold text-white">{t.user.shortName}</span><span className="text-sm text-slate-400">{t.user.dutyLabel}</span><span className="ml-auto font-mono text-lg text-white" data-testid={`dash-active-${t.user.id}`}>{t.activeJobs}</span><span className="text-xs text-slate-500">active{t.testingJobs ? ` · ${t.testingJobs} in testing` : ''}</span>{openTech === t.user.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        {openTech === t.user.id && <ul data-testid={`dash-roster-list-${t.user.id}`} className="pb-2">{t.cards.map((c) => <CardRow key={c.job.id} c={c} />)}{!t.cards.length && <li className="px-3 py-2 text-sm text-slate-500">No active jobs.</li>}</ul>}</li>)}</ul></section>
  </div>;
};

// Team tab — each member's individual monthly $ goal is editable here; the department goal above is their sum (read-only, recomputed live)
export const PadTeam = ({ room, onChanged }: { room: PadRoom; onChanged: () => void }) => {
  const fmtMoney = useFmtMoney();
  const [t, setT] = useState<Awaited<ReturnType<typeof api.getTeamGoals>> | null>(null); const [edit, setEdit] = useState<string | null>(null); const [v, setV] = useState(''); const [err, setErr] = useState<string | null>(null);
  const load = () => api.getTeamGoals(room).then(setT);
  useEffect(() => { void load(); }, [room]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return null;
  const save = async (short: string) => { try { await api.setTechGoal(short, Number(v)); setEdit(null); setErr(null); await load(); onChanged(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <div data-testid="pad-team" className="space-y-4">
    <section className="rounded-[28px] border border-white/10 bg-[#1f2630] p-5"><div className="flex flex-wrap items-baseline gap-3"><h2 className="text-xl font-bold text-white">{t.label} · team goals</h2><span className="ml-auto text-sm text-slate-400">department goal <span data-testid="team-total" className="font-mono text-2xl font-bold text-white">{fmtMoney(t.total)}</span> <span className="text-slate-500">= sum of {t.rows.length} individual goals</span></span></div>
      <ul className="mt-4 divide-y divide-white/5">{t.rows.map((r) => <li key={r.user.id} data-testid={`team-row-${r.user.id}`} className="flex flex-wrap items-center gap-3 py-3"><span className="w-24 text-lg font-semibold text-white">{r.user.shortName}</span><span className="w-52 text-sm text-slate-400">{r.user.dutyLabel}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${PACE[r.pace].cls}`}>{PACE[r.pace].label}</span><span className="text-sm text-slate-400">{fmtMoney(r.actualMtd)} so far · {r.activeJobs} active</span>
        {edit === r.user.shortName ? <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); void save(r.user.shortName); }}><input data-testid={`team-goal-input-${r.user.id}`} inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value)} className="min-h-[44px] w-36 rounded-xl border border-white/15 bg-[#0f131a] px-3 font-mono text-white" /><button data-testid={`team-goal-save-${r.user.id}`} className="min-h-[44px] rounded-xl bg-amber-400 px-4 font-semibold text-[#161b22]">Save</button><button type="button" onClick={() => setEdit(null)} className="min-h-[44px] rounded-xl bg-white/10 px-3 text-slate-200">Cancel</button></form>
          : <button data-testid={`team-goal-edit-${r.user.id}`} onClick={() => { setEdit(r.user.shortName); setV(String(r.goal)); }} className="ml-auto min-h-[44px] rounded-xl bg-white/5 px-4 font-mono text-lg text-white underline decoration-dotted"><span data-testid={`team-goal-${r.user.id}`}>{fmtMoney(r.goal)}</span> <span className="text-xs text-slate-400">/ month</span></button>}</li>)}</ul>
      {err && <p data-testid="team-error" className="mt-2 text-sm text-rose-300">{err}</p>}
    </section>
  </div>;
};
