import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Clock3, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { TimeBoardRow, WeekView } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { FlagChips } from '@/components/time/TimeBits';
import { DIVS, Export, Flags, Settings, WeekGrid, type Div } from '@/components/time/TimeManagerPanels';
import { PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime } from '@/lib/format';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PRESENCE: Record<TimeBoardRow['presence'], string> = { away: 'bg-ink-300', with_client: 'bg-amber-500', at_bench: 'bg-emerald-500' };
const PRESENCE_LABEL: Record<TimeBoardRow['presence'], string> = { away: 'away', with_client: 'with client', at_bench: 'at bench' };

// Who's in right now — the same facts the directory presence dots read (clock state + calls + front desk sign-ins)
const TodayBoard = ({ division, tick }: { division: Div; tick: number }) => {
  const [rows, setRows] = useState<TimeBoardRow[]>([]);
  useEffect(() => { void api.getTimeBoard(division).then(setRows); const t = setInterval(() => void api.getTimeBoard(division).then(setRows), 30_000); return () => clearInterval(t); }, [division, tick]);
  const on = rows.filter((r) => r.onClock);
  return <Card title={`On the clock · ${on.length} of ${rows.length}`} subtitle="Presence is derived, never toggled: clocked out → away · on a call or signed in at a Front Desk → with client · else at bench" testId="time-today-board" bodyClassName="p-0">
    <ul className="divide-y divide-line/70">{rows.map((r) => <li key={r.user.id} data-testid={`time-row-${r.user.id}`} data-on={r.onClock} data-presence={r.presence} className={clsx('flex items-center gap-3 px-4 py-2 text-xs', !r.onClock && 'opacity-70')}>
      <span className={clsx('grid h-8 w-8 place-items-center rounded-full font-mono text-[11px] font-semibold', r.onClock ? 'bg-ink text-white' : 'bg-canvas text-ink-500')}>{r.user.shortName.slice(0, 2)}</span>
      <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{r.user.shortName} <span className="font-normal text-ink-500">· {r.user.dutyLabel}</span></div><div className="text-[11px] text-ink-500">{r.onClock ? `in since ${fmtTime(r.since!)} · ${r.sinceLocation}` : r.lastPunch ? `last ${r.lastPunch.kind.toUpperCase()} ${fmtDate(r.lastPunch.at)} ${fmtTime(r.lastPunch.at)} · ${r.lastPunch.location}` : 'no punches yet'}</div></div>
      <span data-testid={`time-presence-${r.user.id}`} className="inline-flex items-center gap-1.5 text-[11px] text-ink-600"><span className={clsx('inline-block h-2 w-2 rounded-full', PRESENCE[r.presence])} /> {PRESENCE_LABEL[r.presence]} <span className="text-ink-400">· {r.presenceDetail}</span></span>
      <span data-testid={`time-hours-${r.user.id}`} className="w-16 text-right font-mono text-ink">{r.todayHours.toFixed(2)} h</span>
      {r.lastPunch?.source === 'rgtime' && <span title="migrated from RGTime" className="rounded-sm bg-canvas px-1 text-[9px] uppercase text-ink-400">rgtime</span>}
    </li>)}{!rows.length && <li className="px-4 py-6 text-center text-xs text-ink-400">Nobody in this division.</li>}</ul>
  </Card>;
};

const MyWeek = ({ userId }: { userId: string }) => {
  const [offset, setOffset] = useState(0); const [view, setView] = useState<WeekView | null>(null);
  useEffect(() => { void api.getMyWeek(userId, offset).then(setView); }, [userId, offset]);
  const row = view?.rows[0]; const today = new Date().toISOString().slice(0, 10);
  return <Card title="My week" subtitle={view ? `${fmtDate(view.start)} – ${fmtDate(view.end)}${offset === 0 ? ' · this week' : ''}` : '…'} testId="time-my-week" action={<div className="flex items-center gap-2"><button data-testid="rg-myweek-prev" onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas"><ChevronLeft size={14} /></button><span data-testid="rg-myweek-total" className="font-mono text-sm font-semibold text-ink">{row ? row.total.toFixed(2) : '…'} h</span><button data-testid="rg-myweek-next" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas disabled:opacity-40"><ChevronRight size={14} /></button></div>} bodyClassName="p-0">
    <ul data-testid="rg-myweek-days" className="divide-y divide-line/70">{row?.days.map((d, i) => <li key={d.date} data-testid={`rg-myweek-day-${d.date}`} data-open={d.open} className={clsx('px-4 py-2', d.open && d.date !== today && 'bg-amber-50/60')}>
      <div className="flex items-center justify-between text-xs"><span className="font-semibold text-ink">{DOW[i]} <span className="font-normal text-ink-500">{fmtDate(`${d.date}T12:00:00`)}</span></span><span className={clsx('font-mono', d.open ? 'text-amber-700' : 'text-ink')}>{d.hours ? `${d.hours.toFixed(2)} h` : '—'}{d.open && (d.date === today ? ' · on the clock' : ' · missed clock-out')}</span></div>
      {d.punches.length > 0 && <ul className="mt-1 space-y-0.5 text-[11px]">{d.punches.map((p) => <li key={p.id} data-testid={`rg-myweek-punch-${p.id}`} className="flex items-center gap-2"><span className={clsx('w-8 font-semibold uppercase', p.kind === 'in' ? 'text-moss-700' : 'text-ink-500')}>{p.kind}</span><span className="flex-1 text-ink-500">{p.location}</span><FlagChips punch={p} /><span className="font-mono">{fmtTime(p.at)}</span></li>)}</ul>}
    </li>)}</ul>
  </Card>;
};

const TABS = ['today', 'week', 'flags', 'export', 'settings'] as const;
type Tab = (typeof TABS)[number];
// Desktop Time Clock `/time` (replaces RGTime /rg/manager + /rg/week): board · week grid · flags + corrections · payroll CSV · geofence + clock points
export default function TimeClockPage() {
  const { user } = useAuth(); const [params, setParams] = useSearchParams();
  const manager = user!.accessTier !== 'concierge' || user!.roles.includes('supervisor');
  const tab = (TABS.includes(params.get('tab') as Tab) && (manager || params.get('tab') === 'today' || params.get('tab') === 'week') ? params.get('tab') : 'today') as Tab;
  const [division, setDivision] = useState<Div>(user!.division === 'both' ? 'all' : user!.division); const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return <div data-testid="time-clock-page" className="space-y-4">
    <PageHeader title="Time clock" subtitle="One clock for the building: NFC tag tap or the wall pad (Touch ID / PIN) → who's in → week → flags → payroll. RGTime history migrated (source rgtime)." action={<div className="flex items-center gap-2"><Link to="/time/pad" data-testid="time-open-pad" className="inline-flex h-8 items-center gap-1 rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink-700 hover:border-ink-300"><Clock3 size={13} /> Open the pad <ExternalLink size={11} /></Link>{manager && <select data-testid="rg-week-division" value={division} onChange={(e) => setDivision(e.target.value as Div)} className="h-8 rounded-sm border border-line bg-surface px-2 text-xs">{DIVS().map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>}</div>} />
    <div className="flex items-center gap-1 border-b border-line" data-testid="time-tabs">{TABS.filter((t) => manager || t === 'today' || t === 'week').map((t) => <button key={t} type="button" data-testid={`rg-mgr-tab-${t}`} onClick={() => setParams({ tab: t })} className={clsx('-mb-px inline-flex h-9 items-center border-b-2 px-3 text-xs font-medium capitalize', tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink')}>{t === 'today' ? 'Who’s in' : t}</button>)}</div>
    {tab === 'today' && <div className="grid grid-cols-[1fr_380px] gap-4"><TodayBoard division={manager ? division : user!.division === 'both' ? 'all' : user!.division} tick={tick} /><MyWeek userId={user!.id} /></div>}
    {tab === 'week' && (manager ? <WeekGrid mgr={user!} division={division} tick={tick} onChange={bump} /> : <MyWeek userId={user!.id} />)}
    {tab === 'flags' && manager && <Flags mgr={user!} division={division} tick={tick} onChange={bump} />}
    {tab === 'export' && manager && <Export division={division} />}
    {tab === 'settings' && manager && <Settings mgr={user!} />}
  </div>;
}
