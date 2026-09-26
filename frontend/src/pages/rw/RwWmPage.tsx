import { Hammer, Lock, Package, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { FloorDot, JobWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { KindPill } from '@/components/jobs/JobBits';
import { Clock, PartLocations, PinSwitch, ScanInput } from '@/components/rw/RwBits';
import { StatusPill } from '@/components/ui/Pills';

type Card = { job: JobWithRefs; parts: FloorDot[] };

const RequestPart = ({ job, onDone }: { job: JobWithRefs; onDone: (m: string) => void }) => {
  const [open, setOpen] = useState(false); const [desc, setDesc] = useState(''); const [qty, setQty] = useState(1); const [err, setErr] = useState<string | null>(null);
  if (!open) return <button data-testid={`wm-request-part-${job.id}`} onClick={() => setOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm text-slate-200 hover:bg-white/10"><Package size={16} /> Request part</button>;
  return <form data-testid={`wm-request-form-${job.id}`} onSubmit={async (e) => { e.preventDefault(); try { const r = await api.requestPartSimple(job.id, desc, qty, 'wm'); onDone(`${r.number} pending · ${desc} ×${qty}`); setOpen(false); setDesc(''); setQty(1); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } }} className="flex flex-wrap items-center gap-2"><input data-testid={`wm-request-desc-${job.id}`} autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Part description" className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-[#0f131a] px-3 text-sm text-slate-100" /><input data-testid={`wm-request-qty-${job.id}`} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="min-h-[44px] w-20 rounded-xl border border-white/15 bg-[#0f131a] px-3 text-sm text-slate-100" /><button data-testid={`wm-request-submit-${job.id}`} className="min-h-[44px] rounded-xl bg-amber-400 px-4 text-sm font-semibold text-[#161b22]">Send</button><button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-2 text-sm text-slate-400">Cancel</button>{err && <span className="text-xs text-rose-400">{err}</span>}</form>;
};

// Full-screen bench mode for the signed-in tech (shared terminal → PIN switch)
export default function RwWmPage() {
  const { user } = useAuth(); const [cards, setCards] = useState<Card[]>([]); const [flash, setFlash] = useState<string | null>(null); const [mode, setMode] = useState<'safe' | 'refinish'>('safe');
  const load = useCallback(() => (user ? api.getWmRoom(user.id).then((r) => setCards(r.cards)) : Promise.resolve()), [user]);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3500); };
  return <div data-testid="rw-wm-page" className="flex h-full flex-col">
    <header className="flex items-center gap-4 border-b border-white/10 bg-[#0f131a] px-5 py-3"><Hammer size={22} className="text-amber-400" /><div><div className="text-xl font-semibold text-white">{user?.displayName.split(' — ')[0]}’s bench</div><div className="text-xs text-slate-400">{cards.length} job{cards.length === 1 ? '' : 's'} assigned · Watchmaker Room</div></div><div className="ml-auto flex items-center gap-4"><Clock /><PinSwitch big /><Link to="/rw" className="text-xs text-slate-400 hover:text-white">exit bench mode</Link></div></header>
    <div className="grid flex-1 grid-cols-[1fr_340px] gap-4 overflow-hidden p-4">
      <div className="space-y-3 overflow-y-auto pr-1">
        {flash && <p data-testid="wm-flash" className="rounded-xl bg-emerald-950/60 px-4 py-2 text-sm text-emerald-300">{flash}</p>}
        {cards.map(({ job: j, parts }) => <article key={j.id} data-testid={`wm-card-${j.id}`} className="rounded-2xl border border-white/10 bg-[#1f2630] p-4">
          <div className="flex flex-wrap items-center gap-3"><Link to={`/rw/jobs/${j.id}`} className="font-mono text-2xl font-semibold text-white hover:underline">{j.number}</Link><span className="text-lg text-slate-200">{j.watch.brand} {j.watch.model}</span><span className="font-mono text-sm text-slate-500">{j.watch.reference} · {j.watch.serial}</span><KindPill kind={j.kind} /><StatusPill status={api.awaitingComponents(j) ? 'awaiting_components' : j.status} />{api.activeHold(j) && <span className="rounded-full bg-rose-950/60 px-2 py-0.5 text-xs text-rose-300">on hold · {api.activeHold(j)!.type}</span>}</div>
          <div className="mt-3"><PartLocations parts={parts} /></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><RequestPart job={j} onDone={say} />{parts.filter((p) => p.station !== 'finished').map((p) => <button key={p.key} data-testid={`wm-to-safe-${j.id}-${p.key}`} onClick={async () => { try { await api.movePart(j.id, p.key, p.key === 'band' ? 'into_safe_band' : 'into_safe_head', 'wm'); say(`${j.number} · ${p.label} → Into safe`); await load(); } catch (x) { say(x instanceof Error ? x.message : 'Failed'); } }} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm text-slate-200 hover:bg-white/10"><Lock size={14} /> {p.label} → safe</button>)}</div>
        </article>)}
        {!cards.length && <p className="py-10 text-center text-slate-500">Nothing assigned to {user?.shortName}. Ask the supervisor or use Bulk Assign.</p>}
      </div>
      <aside className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4"><div className="text-sm font-semibold text-white">Send a part by scan</div><p className="text-xs text-slate-400">Pick the destination, then scan the watch label — same pattern as the station scanner.</p>
        <div className="grid grid-cols-2 gap-2">{(['safe', 'refinish'] as const).map((m) => <button key={m} data-testid={`wm-mode-${m}`} onClick={() => setMode(m)} className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-sm ${mode === m ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-white/15 text-slate-300'}`}>{m === 'safe' ? <Lock size={14} /> : <Sparkles size={14} />} {m === 'safe' ? 'Into safe' : 'Refinishing'}</button>)}</div>
        <ScanInput big testId="wm-scan" placeholder="Scan watch label…" onScan={async (code) => { const d = await api.sendPartByScan(code, mode); say(`${d.jobNumber} · ${d.label} → ${api.RW_STATIONS.find((s) => s.key === d.station)!.label}`); await load(); }} /></aside>
    </div>
  </div>;
}
