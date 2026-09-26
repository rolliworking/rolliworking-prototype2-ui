import { AlertTriangle, Check, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { PickTaskView } from '@/api/client';
import { Clock, PinSwitch, ScanInput } from '@/components/rw/RwBits';

const PickCard = ({ t, onDone }: { t: PickTaskView; onDone: (m: string) => void }) => {
  const short = t.onHand < t.qty; const [found, setFound] = useState(false); const [loc, setLoc] = useState(''); const [err, setErr] = useState<string | null>(null);
  const act = async (a: 'picked' | 'short' | 'found') => { try { await api.pickAction(t.id, a, loc); onDone(a === 'picked' ? `${t.part.name} picked ×${t.qty} · allocated to ${t.job.number}` : a === 'short' ? `${t.part.name} short → on order` : `Location updated → ${loc}`); setFound(false); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } };
  return <article data-testid={`pick-card-${t.id}`} className={`space-y-3 rounded-3xl border p-5 ${t.status !== 'open' ? 'opacity-60' : short ? 'border-rose-500/60 bg-rose-950/30' : 'border-white/10 bg-[#1f2630]'}`}>
    <div className="flex flex-wrap items-baseline gap-3"><span className="text-xl font-semibold text-white">{t.part.name}</span><span className="font-mono text-sm text-slate-400">{t.part.partNumber}</span>{t.status !== 'open' && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase text-slate-300">{t.status}</span>}</div>
    <div className="flex flex-wrap items-center gap-3 text-base"><span data-testid={`pick-location-${t.id}`} className="inline-flex items-center gap-1.5 rounded-2xl bg-white/5 px-3 py-1.5 text-slate-100"><MapPin size={16} className="text-amber-300" /> {t.location}</span><span data-testid={`pick-qty-${t.id}`} className={`rounded-2xl px-3 py-1.5 font-mono ${short ? 'bg-rose-600 text-white' : 'bg-white/5 text-slate-100'}`}>{t.onHand} on hand · pick {t.qty}</span><span className="text-sm text-slate-400">for <Link to={`/rw/jobs/${t.job.id}`} className="font-mono text-amber-300">{t.job.number}</Link> · {t.job.watch.brand} {t.job.watch.model}</span></div>
    {short && t.status === 'open' && <p data-testid={`pick-alert-${t.id}`} className="inline-flex items-center gap-2 text-base font-bold text-rose-300"><AlertTriangle size={18} /> {t.onHand === 0 ? 'Location shows 0' : `Only ${t.onHand} here — need ${t.qty}`}</p>}
    {t.status === 'open' && <div className="flex flex-wrap gap-2">
      {!short && <button data-testid={`pick-picked-${t.id}`} onClick={() => act('picked')} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-amber-400 px-5 text-base font-semibold text-[#161b22]"><Check size={18} /> Picked</button>}
      <button data-testid={`pick-short-${t.id}`} onClick={() => act('short')} className="min-h-[48px] rounded-2xl bg-orange-500 px-5 text-base font-semibold text-white">Short — order</button>
      <button data-testid={`pick-found-${t.id}`} onClick={() => setFound((f) => !f)} className="min-h-[48px] rounded-2xl border border-white/20 px-5 text-base font-semibold text-slate-100">Found elsewhere</button>
    </div>}
    {found && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act('found'); }}><input data-testid={`pick-found-input-${t.id}`} autoFocus value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Actual location, e.g. Cabinet C · Drawer 4 · Bin 2" className="min-h-[48px] flex-1 rounded-2xl border border-white/15 bg-[#0f131a] px-4 text-base text-slate-100" /><button data-testid={`pick-found-save-${t.id}`} className="min-h-[48px] rounded-2xl bg-amber-400 px-5 font-semibold text-[#161b22]">Save</button></form>}
    {err && <p className="text-sm text-rose-300">{err}</p>}
  </article>;
};

export default function RwPickingPage() {
  const [q, setQ] = useState<{ tasks: PickTaskView[]; remaining: number; shortsToday: number } | null>(null); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(() => api.getPickingQueue().then(setQ), []);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3500); void load(); };
  return <div data-testid="rw-picking-page" className="flex h-full flex-col text-slate-100">
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-4 border-b border-white/10 bg-[#0f131a] px-5 py-3"><div className="text-2xl font-semibold text-white">Picking queue</div>
      {q && <div data-testid="pick-summary" className="flex gap-2 text-base"><span data-testid="pick-remaining" className="rounded-2xl bg-white/5 px-4 py-2"><span className="font-mono text-xl font-semibold text-white">{q.remaining}</span> <span className="text-slate-400">picks remaining</span></span><span data-testid="pick-shorts" className="rounded-2xl bg-white/5 px-4 py-2"><span className="font-mono text-xl font-semibold text-white">{q.shortsToday}</span> <span className="text-slate-400">shorts flagged today</span></span></div>}
      <div className="ml-auto flex items-center gap-4"><Clock /><PinSwitch big /><Link to="/rw/pad" className="text-sm text-slate-400">← pad</Link></div></header>
    <main className="flex-1 space-y-4 overflow-y-auto p-5">
      <ScanInput big testId="pick-scan" placeholder="Scan a bin label (part # or location) to confirm the top matching pick…" onScan={async (code) => { const t = q?.tasks.find((x) => x.status === 'open' && (x.part.partNumber.toLowerCase() === code.toLowerCase() || x.location.toLowerCase() === code.toLowerCase() || x.part.id === code)); if (!t) throw new Error(`No open pick matches ${code}`); await api.pickAction(t.id, 'picked'); say(`${t.part.name} picked by scan`); }} />
      {flash && <p data-testid="pick-flash" className="rounded-2xl bg-emerald-950/60 px-4 py-3 text-base text-emerald-300">{flash}</p>}
      <div className="grid gap-4 md:grid-cols-2">{q?.tasks.map((t) => <PickCard key={t.id} t={t} onDone={say} />)}{q && !q.tasks.length && <p className="py-10 text-center text-lg text-slate-500">Nothing to pick.</p>}</div>
    </main>
  </div>;
}
