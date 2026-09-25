import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Division, User, WeekView } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';
import { useRg } from './RgShell';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RgManagerPage() {
  const { user } = useRg();
  const [mgr, setMgr] = useState<User | null>(null);
  return <div data-testid="rg-manager-page" className="space-y-3">
    <Link to="/rg" className="text-xs text-ink-500 underline">← RGTime</Link>
    {mgr ? <WeekGrid mgr={mgr} /> : <ManagerGate preselect={user} onVerified={setMgr} />}
  </div>;
}

function ManagerGate({ preselect, onVerified }: { preselect: User; onVerified: (u: User) => void }) {
  const managers = api.rgAllStaff().filter((u) => u.accessTier === 'manager');
  const [userId, setUserId] = useState(preselect.accessTier === 'manager' ? preselect.id : ''); const [pw, setPw] = useState(''); const [err, setErr] = useState<string | null>(null);
  return <div data-testid="rg-manager-gate" className="space-y-3 rounded-lg border border-line bg-surface p-4">
    <h1 className="text-base font-semibold text-ink">Manager view</h1>
    <p className="text-xs text-ink-500">Card + password, manager tier only — even on a remembered phone.</p>
    <div className="grid grid-cols-2 gap-2">{managers.map((u) => <button key={u.id} data-testid={`rg-mgr-card-${u.id}`} onClick={() => setUserId(u.id)} className={`rounded-md border p-2 text-left text-xs ${userId === u.id ? 'border-ink bg-canvas' : 'border-line hover:bg-canvas'}`}><div className="font-semibold">{u.shortName}</div><div className="text-ink-500">{u.dutyLabel}</div></button>)}</div>
    {userId && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); api.rgVerifyManager(userId, pw.trim()).then(onVerified).catch((x) => setErr(x.message)); }}><input data-testid="rg-mgr-password" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" className="flex-1 rounded-md border border-line px-2 py-2 text-sm" /><Button variant="primary" data-testid="rg-mgr-open">Open</Button></form>}
    {err && <p data-testid="rg-mgr-error" className="text-xs text-rose-700">{err}</p>}
  </div>;
}

function WeekGrid({ mgr }: { mgr: User }) {
  const [division, setDivision] = useState<Division>(mgr.division === 'both' ? 'rolliworks' : mgr.division);
  const [offset, setOffset] = useState(0); const [view, setView] = useState<WeekView | null>(null); const [openDay, setOpenDay] = useState<string | null>(null);
  useEffect(() => { api.getWeekHours(division, offset).then(setView); }, [division, offset]);
  const detail = view && openDay ? view.rows.flatMap((r) => r.days.filter((d) => `${r.user.id}:${d.date}` === openDay).map((d) => ({ r, d })))[0] : undefined;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1"><button data-testid="rg-week-prev" onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas"><ChevronLeft size={14} /></button><button data-testid="rg-week-next" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas disabled:opacity-40"><ChevronRight size={14} /></button></div>
      <div data-testid="rg-week-range" className="text-xs font-semibold text-ink">{view ? `${fmtDate(view.start)} – ${fmtDate(view.end)}${offset === 0 ? ' · this week' : offset === -1 ? ' · last week' : ''}` : '…'}</div>
      {mgr.division === 'both' ? <select data-testid="rg-week-division" value={division} onChange={(e) => setDivision(e.target.value as Division)} className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs">{(['rolliworks', 'rollishop'] as Division[]).map((d) => <option key={d} value={d}>{api.RG_DIVISION_LABEL[d]}</option>)}</select> : <span className="text-xs text-ink-500">{api.RG_DIVISION_LABEL[division]}</span>}
    </div>
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table data-testid="rg-week-grid" className="w-full text-[11px]">
        <thead><tr className="border-b border-line text-left text-ink-500"><th className="px-2 py-1.5 font-medium">Staff</th>{DOW.map((d) => <th key={d} className="px-1 py-1.5 text-center font-medium">{d}</th>)}<th className="px-2 py-1.5 text-right font-medium">Week</th></tr></thead>
        <tbody className="divide-y divide-line/70">{view?.rows.map((r) => <tr key={r.user.id} data-testid={`rg-week-row-${r.user.id}`}>
          <td className="px-2 py-1.5 font-semibold text-ink">{r.user.shortName}{r.openNow && <span data-testid={`rg-week-open-${r.user.id}`} className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-moss align-middle" title="on the clock now" />}</td>
          {r.days.map((d) => <td key={d.date} className="px-1 py-1.5 text-center"><button data-testid={`rg-week-cell-${r.user.id}-${d.date}`} onClick={() => setOpenDay(openDay === `${r.user.id}:${d.date}` ? null : `${r.user.id}:${d.date}`)} className={`min-w-[30px] rounded px-1 py-0.5 font-mono ${d.hours ? 'text-ink hover:bg-canvas' : 'text-ink-300'} ${d.open ? 'bg-amber-50 text-amber-800' : ''}`} title={d.open ? 'open punch — no clock-out yet' : undefined}>{d.hours ? d.hours.toFixed(1) : '·'}</button></td>)}
          <td data-testid={`rg-week-total-${r.user.id}`} className="px-2 py-1.5 text-right font-mono font-semibold text-ink">{r.total.toFixed(1)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-[10px] text-ink-400">Hours are paired in→out punches at {api.RG_DIVISION_LABEL[division]} tags. Amber = open punch (still clocked in or forgot to clock out). Tap a day for the punches.</p>
    {detail && <div data-testid="rg-day-detail" className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs"><span className="font-semibold text-ink">{detail.r.user.shortName} · {fmtDate(`${detail.d.date}T12:00:00`)}</span><span className="text-ink-500">{detail.d.hours.toFixed(2)} h{detail.d.open ? ' · open' : ''}</span></div>
      <ul className="divide-y divide-line/70 text-xs">{detail.d.punches.map((p) => <li key={p.id} className="flex justify-between px-3 py-1.5"><span className={`font-semibold uppercase ${p.kind === 'in' ? 'text-moss-700' : 'text-ink-500'}`}>{p.kind}</span><span className="text-ink-500">{p.location}</span><span className="font-mono">{fmtTime(p.at)}</span></li>)}{!detail.d.punches.length && <li className="px-3 py-3 text-center text-ink-400">No punches</li>}</ul>
    </div>}
  </div>;
}
