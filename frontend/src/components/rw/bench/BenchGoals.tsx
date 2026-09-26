import { Check, X } from 'lucide-react';
import { useState } from 'react';
import type { BenchGoals as Goals, GoalMonth } from '@/api/client';
import { PART_COLOR, PART_NAME } from '@/components/rw/RwBits';

const TYPES = ['head', 'case', 'band'] as const;

// Pace-line for the current month: where "on track" would be today, rendered as a marker — no judgment language
const PaceBar = ({ g }: { g: Goals }) => {
  const pct = Math.min(100, (g.current.actual / Math.max(1, g.current.goal)) * 100); const pacePct = Math.min(100, (g.paceTarget / Math.max(1, g.current.goal)) * 100); const diff = g.current.actual - g.paceTarget;
  return <div data-testid="bench-goal-current" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <div className="flex flex-wrap items-baseline gap-3"><span className="text-sm uppercase tracking-wide text-slate-400">{g.current.label} · this month</span><span data-testid="bench-goal-actual" className="font-mono text-4xl font-bold text-slate-100">{g.current.actual}<span className="text-xl text-slate-500"> / {g.current.goal}</span></span><span data-testid="bench-goal-pace" className="ml-auto text-sm text-slate-300">pace line today · <span className="font-mono">{g.paceTarget}</span> <span className="text-slate-500">({diff >= 0 ? '+' : ''}{diff})</span> · day {g.dayOfMonth}/{g.daysInMonth}</span></div>
    <div className="relative mt-3 h-5 rounded-full bg-white/[0.06]">
      <div className="h-5 rounded-full bg-amber-400/80" style={{ width: `${pct}%` }} />
      <div data-testid="bench-pace-marker" className="absolute -top-1.5 h-8 w-0.5 bg-slate-100" style={{ left: `calc(${pacePct}% - 1px)` }} title={`Pace line · ${g.paceTarget}`} />
    </div>
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">{TYPES.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PART_COLOR[k] }} /> {PART_NAME[k]} <span className="font-mono text-slate-200">{g.current.byType[k]}</span></span>)}</div>
  </div>;
};

const MonthDetail = ({ m }: { m: GoalMonth }) => {
  const max = Math.max(1, ...m.byWeek.map((w) => w.count));
  return <div data-testid={`bench-month-detail-${m.key}`} className="mt-2 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 animate-rise">
    <div><div className="mb-2 text-xs uppercase tracking-wide text-slate-400">{m.label} · by week</div><div className="flex items-end gap-2">{m.byWeek.map((w) => <div key={w.label} className="flex flex-1 flex-col items-center gap-1"><span className="font-mono text-sm text-slate-200">{w.count}</span><div className="w-full rounded-t-md bg-amber-400/70" style={{ height: `${Math.max(4, (w.count / max) * 72)}px` }} /><span className="text-[11px] text-slate-500">{w.label}</span></div>)}</div></div>
    <div><div className="mb-2 text-xs uppercase tracking-wide text-slate-400">by component type</div><ul className="space-y-1.5">{TYPES.map((k) => <li key={k} data-testid={`bench-month-type-${m.key}-${k}`} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full" style={{ background: PART_COLOR[k] }} /><span className="w-24 text-slate-300">{PART_NAME[k]}</span><div className="h-3 flex-1 rounded-full bg-white/[0.06]"><div className="h-3 rounded-full" style={{ width: `${(m.byType[k] / Math.max(1, m.actual)) * 100}%`, background: PART_COLOR[k] }} /></div><span className="w-8 text-right font-mono text-slate-100">{m.byType[k]}</span></li>)}</ul><div className={`mt-3 text-sm ${m.hit ? 'text-emerald-300' : 'text-rose-300'}`}>{m.hit ? `Goal hit · ${m.actual}/${m.goal}` : `Goal missed · ${m.actual}/${m.goal} · short by ${m.goal - m.actual}`}</div></div>
  </div>;
};

// Goal history strip — past 6 months, goal vs actual, hit/missed shown with equal weight. Tap a tile to expand it.
export const BenchGoalsSection = ({ g }: { g: Goals }) => {
  const [open, setOpen] = useState<string | null>(null); const sel = g.history.find((m) => m.key === open);
  return <section data-testid="bench-goals" className="space-y-3">
    <PaceBar g={g} />
    <div data-testid="bench-goal-history" className="grid grid-cols-3 gap-2 sm:grid-cols-6">{g.history.map((m) => <button key={m.key} data-testid={`bench-month-${m.key}`} aria-pressed={open === m.key} onClick={() => setOpen(open === m.key ? null : m.key)} className={`flex min-h-[84px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition-transform active:scale-[0.98] ${m.hit ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-rose-500/60 bg-rose-500/10'} ${open === m.key ? 'ring-2 ring-slate-100/70' : ''}`}>
      <div className="flex w-full items-center justify-between"><span className="text-sm font-semibold text-slate-200">{m.label}</span>{m.hit ? <span data-testid={`bench-month-hit-${m.key}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[#0b0f14]"><Check size={15} strokeWidth={3} /></span> : <span data-testid={`bench-month-missed-${m.key}`} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white"><X size={15} strokeWidth={3} /></span>}</div>
      <div className="font-mono text-xl font-bold text-slate-100">{m.actual}<span className="text-sm text-slate-400">/{m.goal}</span></div>
      <div className={`text-[11px] font-semibold uppercase ${m.hit ? 'text-emerald-300' : 'text-rose-300'}`}>{m.hit ? 'hit' : `missed · −${m.goal - m.actual}`}</div>
    </button>)}</div>
    {sel && <MonthDetail m={sel} />}
  </section>;
};
