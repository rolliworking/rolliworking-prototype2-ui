import { Nfc, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClockState, Punch } from '@/api/client';
import { fmtTime } from '@/lib/format';
import { useRg } from './RgShell';

export const PunchList = ({ punches, testId }: { punches: Punch[]; testId: string }) => (
  <ul data-testid={testId} className="divide-y divide-line/70 text-xs">
    {punches.map((p) => <li key={p.id} data-testid={`rg-punch-${p.id}`} className="flex items-center justify-between px-3 py-2"><span className={`w-9 font-semibold uppercase ${p.kind === 'in' ? 'text-moss-700' : 'text-ink-500'}`}>{p.kind}</span><span className="flex-1 text-ink-500">{p.location}{p.simulated && <span className="ml-1 text-[10px] text-amber-700">· simulated</span>}</span><span className="font-mono text-ink">{fmtTime(p.at)}</span></li>)}
    {!punches.length && <li className="px-3 py-4 text-center text-ink-400">No punches yet today</li>}
  </ul>
);

export default function RgHomePage() {
  const { user } = useRg(); const nav = useNavigate();
  const [state, setState] = useState<ClockState | null>(null); const [tag, setTag] = useState('');
  useEffect(() => { api.getClockState(user.id).then(setState); }, [user.id]);
  const tags = api.getNfcTags().filter((t) => user.division === 'both' || t.division === user.division);
  return <div data-testid="rg-home" className="space-y-4">
    <section data-testid="rg-status" className={`rounded-lg p-4 text-white ${state?.onClock ? 'bg-moss' : 'bg-ink-700'}`}>
      <div className="text-[11px] uppercase tracking-wide text-white/70">{user.displayName}</div>
      <div data-testid="rg-status-label" className="mt-1 text-2xl font-semibold">{state ? state.onClock ? 'On the clock' : 'Off the clock' : '…'}</div>
      {state?.onClock && <div data-testid="rg-status-since" className="text-sm text-white/80">since {fmtTime(state.since!)} · {state.sinceLocation}</div>}
      {state && <div className="mt-2 text-xs text-white/70">{state.todayHours.toFixed(2)} h today</div>}
    </section>

    <section className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">Today’s punches</div>
      <PunchList punches={state?.todayPunches ?? []} testId="rg-today-punches" />
    </section>

    <section data-testid="rg-simulate" className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-900"><Nfc size={14} /> Simulate NFC tap <span className="font-normal text-amber-800/70">(prototype — no NFC in the preview)</span></div>
      <p className="text-[11px] text-amber-900/80">A real tag is written with <span className="font-mono">/rg/clock?tag=&lt;id&gt;</span>; tapping opens the same page this picker does.</p>
      <div className="flex gap-2"><select data-testid="rg-tag-select" value={tag} onChange={(e) => setTag(e.target.value)} className="flex-1 rounded-md border border-line bg-surface px-2 py-2 text-sm"><option value="">Choose a tag…</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.label} · {api.RG_DIVISION_LABEL[t.division]}</option>)}</select><button data-testid="rg-tag-go" disabled={!tag} onClick={() => nav(`/rg/clock?tag=${tag}&sim=1`)} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Tap</button></div>
    </section>

    {user.accessTier === 'manager' && <Link to="/rg/manager" data-testid="rg-manager-link" className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink hover:bg-canvas"><ShieldCheck size={16} className="text-ink-500" /> Manager view — week’s hours per person</Link>}
  </div>;
}
