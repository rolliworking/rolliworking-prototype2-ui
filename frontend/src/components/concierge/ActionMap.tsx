import { Box, Lock, ScanLine, Search, X } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import type { Run } from './SwoCard';

// ACTION view = the Shop Floor click-map treatment applied to vendors. One horizontal track per vendor, stage nodes in the lane's shape, custody points as the safe icon
// (outbound box before In route · arrival at Received · hand-off for CM). Look up ONE job (or scan several), the map lights the legal nodes, click one, scan the label(s), Commit. Nothing moves until commit; a click alone never changes custody.
type NodeKind = 'stage' | 'box' | 'arrival' | 'handoff';
interface TNode { id: string; kind: NodeKind; stage?: SwoStage; label: string; sub?: string }
const nodesFor = (ships: boolean): TNode[] => ships
  ? [{ id: 'queue', kind: 'stage', stage: 'queue', label: 'In queue' }, { id: 'box', kind: 'box', label: 'Outbound box', sub: 'pack = scan jobs in · label prints on commit' }, { id: 'sent', kind: 'stage', stage: 'sent', label: 'In route' }, { id: 'at_vendor', kind: 'stage', stage: 'at_vendor', label: 'In progress' }, { id: 'inbound', kind: 'stage', stage: 'inbound', label: 'Returning' }, { id: 'arrival', kind: 'arrival', label: 'Received', sub: 'arrival scan · custody back' }, { id: 'inspection', kind: 'stage', stage: 'inspection', label: 'Inspection' }, { id: 'fulfilled', kind: 'stage', stage: 'fulfilled', label: 'Fulfilled' }]
  : [{ id: 'queue', kind: 'stage', stage: 'queue', label: 'In queue' }, { id: 'handoff', kind: 'handoff', label: 'Hand-off', sub: 'custody scan to CM' }, { id: 'at_vendor', kind: 'stage', stage: 'at_vendor', label: 'In progress' }, { id: 'inspection', kind: 'stage', stage: 'inspection', label: 'Inspection' }, { id: 'fulfilled', kind: 'stage', stage: 'fulfilled', label: 'Fulfilled' }];
type MoveKind = 'custody' | 'status' | 'back' | 'redo';
interface Legal { node: string; kind: MoveKind; to: SwoStage | 'redo'; label: string }
// Legal destinations for one SWO — node ids on ITS vendor's track
const legalFor = (w: SwoWithRefs): Legal[] => {
  const ships = w.vendor.ships !== false; const next = api.nextSwoStage(w.vendor, w.stage); const prev = api.prevSwoStage(w.vendor, w.stage); const out: Legal[] = [];
  if (next) {
    if (next === 'sent' || next === 'redo_sent') out.push({ node: 'box', kind: 'custody', to: next, label: 'Pack into the outbound box — label prints on commit' });
    else if (next === 'received' || next === 'redo_received') out.push({ node: 'arrival', kind: 'custody', to: next, label: 'Arrival scan — custody back at shop' });
    else if (!ships && (next === 'at_vendor' || next === 'redo_at_vendor')) out.push({ node: 'handoff', kind: 'custody', to: next, label: 'Hand-off scan to CM' });
    else if (!ships && next === 'inspection') out.push({ node: 'inspection', kind: 'custody', to: next, label: 'Hand-off scan back from CM' });
    else out.push({ node: api.baseStage(next), kind: 'status', to: next, label: `Status move → ${api.swoStageLabel(next)} (vendor's word, no scan, logged)` });
  }
  if (w.stage === 'inspection') out.push({ node: ships ? 'box' : 'handoff', kind: 'redo', to: 'redo', label: `Redo off-ramp — back to ${w.vendor.name} (reason required)` });
  if (prev) out.push({ node: api.baseStage(prev), kind: 'back', to: prev, label: `Back to ${api.swoStageLabel(prev)} (reason required)` });
  return out;
};
const nodeOf = (w: SwoWithRefs) => api.baseStage(w.stage);

export const ActionMap = ({ lanes, run, onLookup }: { lanes: ConciergeLane[]; run: Run; onLookup: (ids: string[], title: string) => void }) => {
  const rows = useMemo(() => lanes.flatMap((l) => l.rows), [lanes]);
  const [q, setQ] = useState(''); const [sel, setSel] = useState<string[]>([]); const [dest, setDest] = useState<Legal | null>(null); const [scanned, setScanned] = useState<string[]>([]); const [scanQ, setScanQ] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null);
  const selected = sel.map((id) => rows.find((r) => r.id === id)!).filter(Boolean); const vendorId = selected[0]?.vendorId;
  const legal = useMemo(() => { if (!selected.length) return []; const sets = selected.map(legalFor); return sets[0].filter((l) => sets.every((s) => s.some((x) => x.node === l.node && x.kind === l.kind))); }, [selected]);
  const find = (text: string) => { const t = text.trim().replace(/^E/i, '').toLowerCase(); if (!t) return null; return rows.find((r) => r.stage !== 'fulfilled' && (r.number.toLowerCase() === t || r.jobNumber.replace(/^E/, '').toLowerCase() === t || r.synth?.reference.toLowerCase() === t || r.jobNumber.toLowerCase() === t)) ?? rows.find((r) => r.number.toLowerCase() === t || r.jobNumber.replace(/^E/, '').toLowerCase() === t) ?? null; };
  const lookup = () => { const w = find(q); setErr(null); if (!w) { setErr(`No open vendor job matches “${q}”`); return; } if (selected.length && w.vendorId !== selected[0].vendorId) { setErr(`${w.number} is on ${w.vendor.name}'s track — scan jobs for one vendor at a time`); return; } if (selected.length && nodeOf(w) !== nodeOf(selected[0])) { setErr(`${w.number} is at ${api.swoStageLabel(w.stage)} — the scanned set must share a stage to move together`); return; } if (!sel.includes(w.id)) setSel([...sel, w.id]); setQ(''); setDest(null); setScanned([]); };
  const clear = () => { setSel([]); setDest(null); setScanned([]); setReason(''); setErr(null); };
  const scan = () => { const w = find(scanQ); setScanQ(''); if (!w || !sel.includes(w.id)) { setErr(`Label ${scanQ} is not in the scanned set`); return; } setErr(null); if (!scanned.includes(w.id)) setScanned([...scanned, w.id]); };
  const needsScan = dest && (dest.kind === 'custody' || dest.kind === 'redo'); const needsReason = dest && (dest.kind === 'back' || dest.kind === 'redo'); const ready = !!dest && (!needsScan || scanned.length === sel.length) && (!needsReason || reason.trim().length > 0);
  const commit = async () => { if (!dest) return; const d = dest; const ids = [...sel]; await run(async () => { for (const id of ids) { const w = rows.find((r) => r.id === id)!; if (d.kind === 'back') await api.sendBackSwo(id, reason); else if (d.kind === 'redo') await cz.startRedo(id, reason); else if (d.to === 'sent') await api.createSwoOutboundLabel(id); else if ((d.to === 'inbound' || d.to === 'redo_inbound') && !w.returnLabel) { await api.queueSwoReturnLabel(id, w.predictedCompletion); await api.advanceSwo(id, d.to); } else await api.advanceSwo(id, d.to as SwoStage); } }, `${ids.length} job${ids.length === 1 ? '' : 's'} · ${d.kind === 'status' ? 'status move' : d.kind === 'back' ? 'moved back' : d.kind === 'redo' ? 'redo opened' : 'custody move'} committed`); clear(); };
  return <div data-testid="concierge-action" className="grid gap-3 lg:grid-cols-[320px_1fr]">
    <aside data-testid="action-lookup" className="rounded-md border border-white/10 bg-[#0b0e13] p-3 text-xs text-slate-200">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Search size={12} /> Look up a job · est # · ref # · barcode · SWO #</div>
      <div className="mt-1 flex gap-1"><input data-testid="action-lookup-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} placeholder="02015 · 126610LN · SWO-26-0049" className="h-9 flex-1 rounded-sm border border-white/15 bg-white/5 px-2 font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none" /><button type="button" data-testid="action-lookup-go" onClick={lookup} className="h-9 rounded-sm bg-amber-400 px-3 font-semibold text-[#161b22]">Add</button></div>
      <p className="mt-1 text-[10px] text-slate-500">Scan several labels before choosing a destination and they move together — that is how a box to Chronosky gets packed.</p>
      {err && <p data-testid="action-error" className="mt-1 rounded-sm bg-rose-500/15 px-2 py-1 text-[11px] text-rose-200">{err}</p>}
      {selected.length > 0 && <div data-testid="action-selection" className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase text-slate-400"><span>{selected.length} scanned · {selected[0].vendor.name} · {api.swoStageLabel(selected[0].stage)}</span><button type="button" data-testid="action-clear" onClick={clear} className="inline-flex items-center gap-0.5 hover:text-white"><X size={10} /> clear</button></div>
        {selected.map((w) => { const h = cz.swoHealth(w); const paid = cz.paidChip(w); return <div key={w.id} data-testid={`action-sel-${w.id}`} data-scanned={scanned.includes(w.id)} className={`rounded-sm border px-2 py-1 ${scanned.includes(w.id) ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'}`}>
          <div className="flex items-center gap-2"><span className="font-mono font-semibold text-white">{w.jobNumber.replace(/^E/, '')}</span><span className="font-mono text-[10px] text-slate-400">{w.number}</span>{scanned.includes(w.id) && <span className="ml-auto text-[10px] font-semibold text-emerald-300">scanned ✓</span>}</div>
          <div className="truncate text-slate-300">{w.clientName} · {w.watchLabel}</div>
          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]"><span className={`rounded-sm px-1 font-semibold ${h.tone === 'ok' ? 'bg-emerald-400/15 text-emerald-200' : h.tone === 'amber' ? 'bg-amber-400/20 text-amber-200' : h.tone === 'dark' || h.tone === 'red' ? 'bg-rose-500/25 text-rose-200' : 'bg-white/10 text-slate-300'}`}>{h.label}</span>{w.redoCycles.length > 0 && <span className="rounded-sm bg-amber-400/20 px-1 font-semibold text-amber-200">REDO ×{w.redoCycles.length}</span>}{paid.kind !== 'none' && w.vendor.ships !== false && <span className="rounded-sm bg-white/10 px-1 text-slate-200">{paid.text}</span>}<span className="rounded-sm bg-white/10 px-1 text-slate-300">pp {w.pointPerson}</span></div>
        </div>; })}
        <button type="button" data-testid="action-open-panel" onClick={() => onLookup(sel, `${selected[0].vendor.name} · ${selected.length} looked up`)} className="text-[11px] text-accent hover:underline">Open full cards in the panel →</button>
      </div>}
      {dest && <div data-testid="action-step" data-kind={dest.kind} className="mt-3 rounded-sm border border-accent/50 bg-accent/10 p-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">Destination</div><div className="text-slate-100">{dest.label}</div>
        {needsScan && <div className="mt-2"><div className="flex items-center gap-1 text-[10px] uppercase text-slate-400"><ScanLine size={11} /> Scan label(s) · {scanned.length}/{sel.length}</div><div className="mt-1 flex gap-1"><input data-testid="action-scan-input" value={scanQ} onChange={(e) => setScanQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(); }} placeholder="scan or type the label" className="h-8 flex-1 rounded-sm border border-white/15 bg-white/5 px-2 font-mono text-slate-100 focus:outline-none" /><button type="button" data-testid="action-scan-go" onClick={scan} className="h-8 rounded-sm border border-white/20 px-2 text-slate-200">Scan</button></div></div>}
        {!needsScan && <p className="mt-1 text-[10px] text-slate-400">No scan — this is a status move between two non-custody nodes; it is logged as the vendor's word.</p>}
        {needsReason && <label className="mt-2 block text-[10px] uppercase text-slate-400">Reason (required)<input data-testid="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-0.5 h-8 w-full rounded-sm border border-white/15 bg-white/5 px-2 text-slate-100 focus:outline-none" /></label>}
        <button type="button" data-testid="action-commit" disabled={!ready} onClick={() => void commit()} className="mt-2 h-10 w-full rounded-sm bg-accent font-semibold text-[#161b22] disabled:opacity-40">Commit{sel.length > 1 ? ` · ${sel.length} jobs` : ''}</button>
      </div>}
    </aside>
    <div className="space-y-2 overflow-x-auto rounded-md border border-white/10 bg-[#0b0e13] p-3">
      {lanes.map((l) => <Track key={l.vendor.id} lane={l} active={vendorId === l.vendor.id} current={selected.length && vendorId === l.vendor.id ? nodeOf(selected[0]) : undefined} legal={vendorId === l.vendor.id ? legal : []} dest={vendorId === l.vendor.id ? dest : null} redoLive={selected.some((w) => w.vendorId === l.vendor.id && (w.redoCycles.length > 0 || api.isRedoStage(w.stage)))} onPick={(lg) => { setDest(lg); setScanned([]); setReason(''); setErr(null); }} />)}
    </div>
  </div>;
};

const Track = ({ lane, active, current, legal, dest, redoLive, onPick }: { lane: ConciergeLane; active: boolean; current?: string; legal: Legal[]; dest: Legal | null; redoLive: boolean; onPick: (l: Legal) => void }) => {
  const ships = lane.vendor.ships !== false; const nodes = nodesFor(ships); const host = useRef<HTMLDivElement>(null); const [arc, setArc] = useState<string | null>(null);
  const count = (n: TNode) => (n.stage ? lane.stages.find((s) => s.key === n.stage) : undefined);
  useLayoutEffect(() => { const h = host.current; if (!h) return; const from = h.querySelector<HTMLElement>('[data-node="inspection"]'); const to = h.querySelector<HTMLElement>(`[data-node="${ships ? 'box' : 'handoff'}"]`); if (!from || !to) return; const hb = h.getBoundingClientRect(); const a = from.getBoundingClientRect(); const b = to.getBoundingClientRect(); const x1 = a.left + a.width / 2 - hb.left; const x2 = b.left + b.width / 2 - hb.left; const y = a.bottom - hb.top; setArc(`M ${x1} ${y} C ${x1} ${y + 46}, ${x2} ${y + 46}, ${x2} ${y}`); }, [ships, lane.stages.length]);
  const label = lane.vendor.name.replace(' (CM)', '').toUpperCase().replace('CHYNA', 'CM');
  return <div data-testid={`track-${lane.vendor.id}`} data-active={active} className={`relative grid grid-cols-[110px_1fr] items-center gap-2 rounded-md border px-2 pb-12 pt-2 ${active ? 'border-accent/50 bg-accent/[0.04]' : 'border-white/10'}`}>
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{label}<div className="text-[9px] font-normal normal-case tracking-normal text-slate-500">{lane.total} open{lane.vendor.paymentTerms === 'prepay' ? ' · prepay' : ''}</div></div>
    <div ref={host} className="relative flex items-center gap-0">
      {nodes.map((n, i) => { const lg = legal.find((x) => x.node === n.id); const c = count(n); const isCur = current === n.id; const isDest = dest?.node === n.id && dest.kind === lg?.kind; const custody = n.kind !== 'stage';
        return <div key={n.id} className="flex items-center">
          {i > 0 && <span className={`h-px w-6 ${active ? 'bg-accent/40' : 'bg-white/15'}`} />}
          <button type="button" data-node={n.id} data-testid={`anode-${lane.vendor.id}-${n.id}`} data-legal={!!lg} data-current={isCur} aria-pressed={isDest} disabled={!lg} onClick={() => lg && onPick(lg)} title={lg?.label ?? n.sub ?? n.label}
            className={`relative flex min-h-[64px] min-w-[86px] flex-col items-center justify-center rounded-md border px-1.5 py-1 text-center transition-[transform,border-color,box-shadow] ${custody ? 'border-white/25 bg-black/50' : 'border-white/15 bg-[#11151b]'} ${isCur ? 'ring-2 ring-sky-400' : ''} ${lg ? 'cursor-pointer border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)] hover:scale-105' : 'opacity-90'} ${isDest ? 'bg-accent/20 ring-2 ring-accent' : ''} ${legal.length && !lg && !isCur ? 'opacity-40' : ''}`}>
            {custody ? <span className="grid place-items-center">{n.kind === 'box' ? <Box size={22} className="text-amber-300" /> : <Lock size={22} className="text-amber-300" />}</span> : null}
            <span className="text-[10px] font-semibold leading-tight text-slate-200">{n.label}</span>
            {c && <span data-testid={`anode-count-${lane.vendor.id}-${n.id}`} className={`font-mono text-sm font-bold ${c.late ? 'text-rose-300' : 'text-white'}`}>{c.count}{c.late ? <span className="text-[9px]"> · {c.late} late</span> : null}{c.redo ? <span className="text-[9px] text-amber-300"> · {c.redo} redo</span> : null}</span>}
            {lg?.kind === 'back' && <span className="text-[8px] uppercase text-amber-300">back</span>}{lg?.kind === 'redo' && <span className="text-[8px] uppercase text-amber-300">redo</span>}
            {isDest && <span data-testid="anode-dest-tag" className="absolute -bottom-2 rounded-sm bg-amber-400 px-1 text-[8px] font-bold uppercase text-[#161b22]">destination</span>}
          </button>
        </div>; })}
      {arc && <svg className="pointer-events-none absolute inset-x-0 top-0 h-[120px] w-full overflow-visible" aria-hidden><path data-testid={`redo-loop-${lane.vendor.id}`} data-live={redoLive} d={arc} fill="none" stroke={redoLive ? '#f59e0b' : 'rgba(245,158,11,0.45)'} strokeWidth={1.5} strokeDasharray={redoLive ? undefined : '4 4'} /></svg>}
    </div>
    <span className="absolute bottom-1 right-3 text-[9px] text-slate-500">redo off-ramp: Inspection → {ships ? 'outbound box' : 'hand-off'} (dashed until a redo is opened)</span>
  </div>;
};
