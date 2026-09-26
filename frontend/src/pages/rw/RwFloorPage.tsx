import { Lock, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ComponentKey, FloorDot, JobKind, PartHistoryView, RwStation, RwStationKey, ShopFloor } from '@/api/client';
import { PART_COLOR, PART_NAME, PartDot } from '@/components/rw/RwBits';
import { Provisional } from '@/components/estimates/EstimateBits';
import { fmtDate, fmtTime } from '@/lib/format';

const Dot = ({ d, onOpen, onDragStart }: { d: FloorDot; onOpen: () => void; onDragStart: () => void }) => (
  <button draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', `${d.jobId}|${d.key}`); onDragStart(); }} onClick={onOpen} data-testid={`floor-dot-${d.jobId}-${d.key}`} title={`${d.jobNumber} · ${d.label} · ${d.watchLabel}${d.tech ? ` · ${d.tech}` : ''}`} className={`group inline-flex items-center gap-1 rounded-full border bg-[#0f131a] px-1.5 py-0.5 text-[10px] text-slate-200 hover:-translate-y-px ${d.priority === 'urgent' ? 'border-rose-400' : d.priority === 'high' ? 'border-orange-400/70' : 'border-white/15'}`}>
    <span style={{ background: PART_COLOR[d.key] }} className="h-3 w-3 rounded-full" /><span className="font-mono">{d.jobNumber.slice(-4)}</span>{d.tech && <span className="text-slate-500">{d.tech}</span>}
  </button>
);

const Station = ({ s, dots, count, onDrop, onOpen, wide }: { s: RwStation; dots: FloorDot[]; count: number; onDrop: (e: React.DragEvent) => void; onOpen: (d: FloorDot) => void; wide?: boolean }) => {
  const [over, setOver] = useState(false); const safe = s.key.includes('safe');
  return <div data-testid={`floor-station-${s.key}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(e); }} className={`flex min-h-[110px] flex-col rounded-md border p-1.5 transition-colors ${over ? 'border-amber-400 bg-amber-400/10' : safe ? 'border-white/20 bg-black/30' : 'border-white/10 bg-black/20'} ${wide ? 'min-h-[240px]' : ''}`}>
    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400"><span className="inline-flex items-center gap-1">{safe && <Lock size={9} />}{s.label}</span><span data-testid={`floor-count-${s.key}`} className="font-mono">{count}</span></div>
    <div className="flex flex-wrap content-start gap-1">{dots.map((d) => <Dot key={`${d.jobId}-${d.key}`} d={d} onOpen={() => onOpen(d)} onDragStart={() => undefined} />)}</div>
  </div>;
};

export default function RwFloorPage() {
  const [m, setM] = useState<ShopFloor | null>(null); const [tech, setTech] = useState(''); const [kind, setKind] = useState<'' | JobKind>(''); const [hist, setHist] = useState<PartHistoryView | null>(null); const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const load = useCallback(() => api.getShopFloor({ tech: tech || undefined, kind: kind || undefined }).then(setM), [tech, kind]);
  useEffect(() => { void load(); }, [load]);
  const say = (tone: 'ok' | 'err', text: string) => { setMsg({ tone, text }); window.setTimeout(() => setMsg(null), tone === 'ok' ? 2500 : 6000); };
  const drop = (to: RwStationKey) => async (e: React.DragEvent) => { const [jobId, key] = e.dataTransfer.getData('text/plain').split('|'); if (!jobId) return; try { const d = await api.movePart(jobId, key as ComponentKey, to, 'drag'); say('ok', `${d.jobNumber} · ${d.label} → ${api.RW_STATIONS.find((s) => s.key === to)!.label}`); await load(); if (hist && hist.job.id === jobId && hist.part.key === key) setHist(await api.getPartHistory(jobId, key as ComponentKey)); } catch (x) { say('err', x instanceof Error ? x.message : 'Move failed'); } };
  const open = async (d: FloorDot) => setHist(await api.getPartHistory(d.jobId, d.key));
  if (!m) return null;
  const at = (k: RwStationKey) => m.dots.filter((d) => d.station === k); const st = (k: RwStationKey) => m.stations.find((s) => s.key === k)!;
  const head = m.stations.filter((s) => s.lane === 'head'); const band = m.stations.filter((s) => s.lane === 'band');
  const StationBox = ({ k, wide }: { k: RwStationKey; wide?: boolean }) => <Station s={st(k)} dots={at(k)} count={m.counts[k]} onDrop={(e) => void drop(k)(e)} onOpen={open} wide={wide} />;
  return <div data-testid="rw-floor-page" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-white">Shop Floor</h1><p className="text-xs text-slate-400">Live map · dots are physical parts coloured by part, never by status · drag a dot to move it · click a dot for its history <Provisional note="Two-lane (legacy RW) floor vs nine-lane RS map — MH to rule (Q57). Station names/positions to be corrected after the walk." /></p></div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-3 text-slate-400">{(['head', 'case', 'band'] as ComponentKey[]).map((k) => <span key={k} className="inline-flex items-center gap-1"><PartDot k={k} size={10} /> {PART_NAME[k]}</span>)}</span>
        <select data-testid="floor-filter-tech" value={tech} onChange={(e) => setTech(e.target.value)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All techs</option>{m.techs.map((t) => <option key={t}>{t}</option>)}</select>
        <select data-testid="floor-filter-kind" value={kind} onChange={(e) => setKind(e.target.value as '' | JobKind)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All job types</option><option value="service">Service</option><option value="small_job">Small job</option><option value="warranty">Warranty</option></select>
      </div>
    </div>
    {msg && <div data-testid="floor-message" className={`rounded-md px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-200'}`}>{msg.text}</div>}
    <div className="grid grid-cols-[1fr_200px] gap-3">
      <div className="space-y-3">
        <section data-testid="floor-lane-head" className="rounded-md border border-blue-400/30 bg-blue-950/10 p-2"><header className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">Head lane — watch head · case</header><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${head.length}, minmax(0, 1fr))` }}>{head.map((s) => <StationBox key={s.key} k={s.key} />)}</div></section>
        <section data-testid="floor-lane-band" className="rounded-md border border-green-400/30 bg-green-950/10 p-2"><header className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-green-200">Band lane — bracelet</header><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${band.length}, minmax(0, 1fr))` }}>{band.map((s) => <StationBox key={s.key} k={s.key} />)}</div></section>
      </div>
      <div className="grid grid-rows-2 gap-3"><StationBox k="final_assembly" wide /><StationBox k="finished" wide /></div>
    </div>
    {hist && <aside data-testid="floor-history" className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-white/10 bg-[#1f2630] text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between border-b border-white/10 p-4"><div><div className="flex items-center gap-2 text-base font-semibold"><PartDot k={hist.part.key} /> {PART_NAME[hist.part.key]} · <Link to={`/rw/jobs/${hist.job.id}`} className="font-mono text-amber-300 hover:underline">{hist.job.number}</Link></div><div className="text-xs text-slate-400">{hist.job.watch.brand} {hist.job.watch.model} · {hist.job.client.lastName} · custody {hist.part.custodyTech ?? '—'} · {hist.part.partStatus ?? 'derived'}</div></div><button data-testid="floor-history-close" onClick={() => setHist(null)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button></div>
      <div className="border-b border-white/10 p-3"><div className="mb-1 text-[10px] uppercase text-slate-500">Move to</div><div className="flex flex-wrap gap-1">{m.stations.filter((s) => s.lane === 'shared' || s.lane === (hist.part.key === 'band' ? 'band' : 'head')).map((s) => <button key={s.key} data-testid={`floor-history-move-${s.key}`} onClick={async () => { try { await api.movePart(hist.job.id, hist.part.key, s.key, 'drag'); say('ok', `→ ${s.label}`); await load(); setHist(await api.getPartHistory(hist.job.id, hist.part.key)); } catch (x) { say('err', x instanceof Error ? x.message : 'Move failed'); } }} className="rounded-full border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">{s.label}</button>)}</div>
        {hist.job.status !== 'ready_to_ship' && <button data-testid="floor-finish-job" onClick={async () => { try { await api.finishJob(hist.job.id); say('ok', `${hist.job.number} finished`); await load(); setHist(null); } catch (x) { say('err', x instanceof Error ? x.message : 'Blocked'); } }} className="mt-2 w-full rounded-md bg-amber-400 py-1.5 text-xs font-semibold text-[#161b22]">Mark job Finished (gate-checked)</button>}</div>
      <ul className="flex-1 divide-y divide-white/5 overflow-y-auto text-xs">{hist.moves.map((mv, i) => <li key={i} data-testid={`floor-history-row-${i}`} className="px-4 py-2"><div className="flex justify-between"><span className="font-medium">{mv.to ? api.RW_STATIONS.find((s) => s.key === mv.to)?.label : mv.status}</span><span className="text-slate-500">{fmtDate(mv.at)} {fmtTime(mv.at)}</span></div><div className="text-slate-400">{mv.from && `from ${api.RW_STATIONS.find((s) => s.key === mv.from)?.label} · `}{mv.status} · {mv.by} · {mv.via}{mv.note && ` · ${mv.note}`}</div></li>)}{!hist.moves.length && <li className="px-4 py-6 text-center text-slate-500">No moves yet — position is derived from job status.</li>}</ul>
    </aside>}
  </div>;
}
