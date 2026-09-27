import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { WeekView } from '@/api/client';
import { fmtDate, fmtTime } from '@/lib/format';
import { FlagChips } from './RgBits';
import { useRg } from './RgShell';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Employee's own week: punches, daily totals, amber open punch for a missed clock-out
export default function RgWeekPage() {
  const { user, queued } = useRg(); const [offset, setOffset] = useState(0); const [view, setView] = useState<WeekView | null>(null);
  useEffect(() => { api.getMyWeek(user.id, offset).then(setView); }, [user.id, offset, queued]);
  const row = view?.rows[0]; const today = new Date().toISOString().slice(0, 10);
  return <div data-testid="rg-week-page" className="space-y-3">
    <div className="flex items-center justify-between">
      <button data-testid="rg-myweek-prev" onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas"><ChevronLeft size={14} /></button>
      <div data-testid="rg-myweek-range" className="text-xs font-semibold text-ink">{view ? `${fmtDate(view.start)} – ${fmtDate(view.end)}${offset === 0 ? ' · this week' : ''}` : '…'}</div>
      <button data-testid="rg-myweek-next" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas disabled:opacity-40"><ChevronRight size={14} /></button>
    </div>
    <div className="rounded-lg bg-ink px-4 py-3 text-white"><div className="text-[11px] uppercase tracking-wide text-white/70">Week total</div><div data-testid="rg-myweek-total" className="text-3xl font-semibold">{row ? row.total.toFixed(2) : '…'} h</div></div>
    <ul data-testid="rg-myweek-days" className="space-y-2">{row?.days.map((d, i) => <li key={d.date} data-testid={`rg-myweek-day-${d.date}`} data-open={d.open} className={`rounded-lg border bg-surface ${d.open && d.date !== today ? 'border-amber-300' : 'border-line'}`}>
      <div className="flex items-center justify-between px-3 py-2 text-xs"><span className="font-semibold text-ink">{DOW[i]} <span className="font-normal text-ink-500">{fmtDate(`${d.date}T12:00:00`)}</span></span><span className={`font-mono ${d.open ? 'text-amber-700' : 'text-ink'}`}>{d.hours ? `${d.hours.toFixed(2)} h` : '—'}{d.open && (d.date === today ? ' · on the clock' : ' · missed clock-out')}</span></div>
      {d.punches.length > 0 && <ul className="divide-y divide-line/70 border-t border-line text-xs">{d.punches.map((p) => <li key={p.id} data-testid={`rg-myweek-punch-${p.id}`} className="flex items-center gap-2 px-3 py-1.5"><span className={`w-8 font-semibold uppercase ${p.kind === 'in' ? 'text-moss-700' : 'text-ink-500'}`}>{p.kind}</span><span className="flex-1 text-ink-500">{p.location}</span><FlagChips punch={p} /><span className="font-mono">{fmtTime(p.at)}</span></li>)}</ul>}
    </li>)}</ul>
  </div>;
}
