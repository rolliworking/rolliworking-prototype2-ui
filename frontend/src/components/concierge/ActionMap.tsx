import { Box, Camera, Lock, ScanLine, Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { Run } from './SwoCard';

// ACTION view = the Shop Floor Assign / Move contract applied to vendors. Lookup bar on top → job strip → map (one horizontal track per vendor) → bottom bar with the chosen destination.
// Custody nodes (Outbound box · Hand-off · Received) need the label scan(s) at commit; status nodes are logged as the vendor's word; Back / Redo need a reason. NOTHING moves until COMMIT.
type NodeKind = 'stage' | 'box' | 'arrival' | 'handoff';
interface TNode { id: string; kind: NodeKind; stage?: SwoStage; label: string; sub?: string }
const nodesFor = (ships: boolean): TNode[] => ships
  ? [{ id: 'queue', kind: 'stage', stage: 'queue', label: 'In queue' }, { id: 'box', kind: 'box', label: 'Outbound box', sub: 'pack = scan jobs in · label prints on commit' }, { id: 'sent', kind: 'stage', stage: 'sent', label: 'In route' }, { id: 'at_vendor', kind: 'stage', stage: 'at_vendor', label: 'In progress' }, { id: 'inbound', kind: 'stage', stage: 'inbound', label: 'Returning' }, { id: 'arrival', kind: 'arrival', label: 'Received', sub: 'arrival scan · custody back' }, { id: 'inspection', kind: 'stage', stage: 'inspection', label: 'Inspection' }, { id: 'fulfilled', kind: 'stage', stage: 'fulfilled', label: 'Fulfilled' }]
  : [{ id: 'queue', kind: 'stage', stage: 'queue', label: 'In queue' }, { id: 'handoff', kind: 'handoff', label: 'Hand-off', sub: 'custody scan to CM' }, { id: 'at_vendor', kind: 'stage', stage: 'at_vendor', label: 'In progress' }, { id: 'inspection', kind: 'stage', stage: 'inspection', label: 'Inspection' }, { id: 'fulfilled', kind: 'stage', stage: 'fulfilled', label: 'Fulfilled' }];
type MoveKind = 'custody' | 'status' | 'back' | 'redo';
export interface Legal { node: string; kind: MoveKind; to: SwoStage | 'redo'; label: string; nodeLabel: string }
const legalFor = (w: SwoWithRefs): Legal[] => {
  const ships = w.vendor.ships !== false; const next = api.nextSwoStage(w.vendor, w.stage); const prev = api.prevSwoStage(w.vendor, w.stage); const out: Legal[] = [];
  if (next) {
    if (next === 'sent' || next === 'redo_sent') out.push({ node: 'box', kind: 'custody', to: next, nodeLabel: 'Outbound box', label: 'Pack into the outbound box — label prints, return label queued, vendor emailed on commit' });
    else if (next === 'received' || next === 'redo_received') out.push({ node: 'arrival', kind: 'custody', to: next, nodeLabel: 'Received', label: 'Arrival scan — custody back at the shop' });
    else if (!ships && (next === 'at_vendor' || next === 'redo_at_vendor')) out.push({ node: 'handoff', kind: 'custody', to: next, nodeLabel: 'Hand-off', label: 'Hand-off scan to CM — custody moves' });
    else if (!ships && next === 'inspection') out.push({ node: 'inspection', kind: 'custody', to: next, nodeLabel: 'Inspection', label: 'Hand-off scan back from CM' });
    else out.push({ node: nodeIdFor(next), kind: 'status', to: next, nodeLabel: api.swoStageLabel(next), label: `Status move → ${api.swoStageLabel(next)} — vendor's word, no scan` });
  }
  if (w.stage === 'inspection') out.push({ node: ships ? 'box' : 'handoff', kind: 'redo', to: 'redo', nodeLabel: ships ? 'Outbound box' : 'Hand-off', label: `Redo off-ramp — back to ${w.vendor.name}, reason required` });
  if (prev) out.push({ node: nodeIdFor(prev), kind: 'back', to: prev, nodeLabel: api.swoStageLabel(prev), label: `Back to ${api.swoStageLabel(prev)} — reason required` });
  return out;
};
// stage → node id on the track (Received lives on the arrival custody node)
const nodeIdFor = (stage: SwoStage) => { const b = api.baseStage(stage); return b === 'received' ? 'arrival' : b; };
const nodeOf = (w: SwoWithRefs) => nodeIdFor(w.stage);
const HEALTH_TONE: Record<string, string> = { ok: 'bg-emerald-400/15 text-emerald-200', amber: 'bg-amber-400/20 text-amber-200', red: 'bg-rose-500/25 text-rose-200', dark: 'bg-rose-500/25 text-rose-200', muted: 'bg-white/10 text-slate-300' };

// Wedge scanner: a barcode scanner types fast then sends Enter — capture it whatever has focus (our own inputs handle Enter themselves)
const useWedge = (onCode: (code: string) => void) => {
  const buf = useRef(''); const last = useRef(0);
  useEffect(() => { const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return; const now = Date.now(); if (now - last.current > 120) buf.current = ''; last.current = now; if (e.key === 'Enter') { const code = buf.current; buf.current = ''; if (code.length >= 3) { e.preventDefault(); onCode(code); } return; } if (e.key.length === 1) buf.current += e.key; }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onCode]);
};

export interface ActionMapProps { lanes: ConciergeLane[]; run: Run; onLookup: (ids: string[], title: string) => void; onOpenStage: (vendorId: string, stage: SwoStage) => void; pad?: boolean; pickedId?: string | null; onPickedConsumed?: () => void; camera?: (onCode: (code: string) => void) => React.ReactNode }
export const ActionMap = ({ lanes, run, onLookup, onOpenStage, pad, pickedId, onPickedConsumed, camera }: ActionMapProps) => {
  const { user } = useAuth(); const rows = useMemo(() => lanes.flatMap((l) => l.rows), [lanes]);
  const [q, setQ] = useState(''); const [sel, setSel] = useState<string[]>([]); const [dest, setDest] = useState<Legal | null>(null); const [scanned, setScanned] = useState<string[]>([]); const [scanQ, setScanQ] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null); const [cam, setCam] = useState(false);
  const selected = sel.map((id) => rows.find((r) => r.id === id)!).filter(Boolean); const vendorIds = Array.from(new Set(selected.map((w) => w.vendorId)));
  // legal set = intersection over every job in the strip (same node + same kind); several vendors → empty
  const legal = useMemo(() => { if (!selected.length || vendorIds.length > 1) return []; const sets = selected.map(legalFor); return sets[0].filter((l) => sets.every((s) => s.some((x) => x.node === l.node && x.kind === l.kind))); }, [selected, vendorIds.length]);
  const find = useCallback((text: string) => { const t = text.trim().replace(/^E/i, '').toLowerCase(); if (!t) return null; const hit = (r: SwoWithRefs) => r.number.toLowerCase() === t || r.jobNumber.replace(/^E/, '').toLowerCase() === t || r.jobNumber.toLowerCase() === t || r.synth?.reference.toLowerCase() === t || r.outbound?.tracking.toLowerCase() === t; return rows.find((r) => r.stage !== 'fulfilled' && hit(r)) ?? rows.find(hit) ?? null; }, [rows]);
  const add = useCallback((text: string) => { const w = find(text); setErr(null); if (!w) { setErr(`No open vendor job matches “${text.trim()}”`); return; } setSel((s) => (s.includes(w.id) ? s : [...s, w.id])); setQ(''); setDest(null); setScanned([]); }, [find]);
  const remove = (id: string) => { setSel((s) => s.filter((x) => x !== id)); setScanned((s) => s.filter((x) => x !== id)); setDest(null); };
  const clear = () => { setSel([]); setDest(null); setScanned([]); setReason(''); setErr(null); };
  const scan = useCallback((text: string) => { const w = find(text); setScanQ(''); if (!w || !sel.includes(w.id)) { setErr(`Label “${text.trim()}” is not in the strip`); return; } setErr(null); setScanned((s) => (s.includes(w.id) ? s : [...s, w.id])); }, [find, sel]);
  const needsScan = !!dest && (dest.kind === 'custody' || dest.kind === 'redo'); const needsReason = !!dest && (dest.kind === 'back' || dest.kind === 'redo');
  useWedge(useCallback((code: string) => { if (dest && needsScan) scan(code); else add(code); }, [dest, needsScan, scan, add]));
  // a card tapped in the slide-out loads into the strip
  useEffect(() => { if (!pickedId) return; if (rows.some((r) => r.id === pickedId)) { setSel((s) => (s.includes(pickedId) ? s : [...s, pickedId])); setDest(null); setScanned([]); setErr(null); } onPickedConsumed?.(); }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = sel.filter((id) => !scanned.includes(id)).length;
  const commit = async () => {
    if (!dest) return; const d = dest; const ids = [...sel];
    if (needsScan && missing) { setErr(`${d.nodeLabel} is a custody node — scan the label${ids.length > 1 ? 's' : ''} first (${scanned.length}/${ids.length} scanned). Nothing moved.`); return; }
    if (needsReason && !reason.trim()) { setErr(`${d.kind === 'redo' ? 'Redo' : 'Back'} needs a reason. Nothing moved.`); return; }
    const verb = d.kind === 'status' ? `status move by ${user?.shortName ?? 'staff'}` : d.kind === 'back' ? 'moved back' : d.kind === 'redo' ? 'redo opened → vendor' : d.node === 'box' ? 'packed · label printed · return label queued · vendor emailed' : d.node === 'arrival' ? 'arrival scan · custody back' : 'custody move';
    await run(async () => { for (const id of ids) { const w = rows.find((r) => r.id === id)!; if (d.kind === 'back') await api.sendBackSwo(id, reason); else if (d.kind === 'redo') await cz.startRedo(id, reason); else if (d.to === 'sent') { await api.createSwoOutboundLabel(id); await api.queueSwoReturnLabel(id, w.predictedCompletion); } else if ((d.to === 'inbound' || d.to === 'redo_inbound') && !w.returnLabel) { await api.queueSwoReturnLabel(id, w.predictedCompletion); await api.advanceSwo(id, d.to); } else await api.advanceSwo(id, d.to as SwoStage); } }, `${ids.length} job${ids.length === 1 ? '' : 's'} → ${d.nodeLabel} · ${selected[0]?.vendor.name ?? ''} · ${verb}`);
    clear();
  };
  const vendorName = selected[0]?.vendor.name ?? '';
  return <div data-testid="concierge-action" data-pad={!!pad} className="space-y-3">
    {/* 1 · LOOKUP BAR */}
    <div data-testid="action-lookup" className="rounded-md border border-white/10 bg-[#0b0e13] p-3 text-xs text-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Search size={12} /> Look up ONE job · est # / ref # / barcode</span>
        <input data-testid="action-lookup-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(q); }} placeholder="02015 · 126610LN · SWO-26-0049 · tracking #" className={`${pad ? 'h-12 text-base' : 'h-9'} min-w-[220px] flex-1 rounded-sm border border-white/15 bg-white/5 px-2 font-mono text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none`} />
        <button type="button" data-testid="action-lookup-go" onClick={() => add(q)} className={`${pad ? 'h-12 px-5 text-base' : 'h-9 px-3'} rounded-sm bg-accent font-semibold text-[#161b22]`}>Find</button>
        {camera && <button type="button" data-testid="action-camera" onClick={() => setCam((c) => !c)} aria-pressed={cam} className={`${pad ? 'h-12 px-4' : 'h-9 px-3'} inline-flex items-center gap-1 rounded-sm border border-white/20 text-slate-200 ${cam ? 'bg-accent/20 border-accent' : ''}`}><Camera size={16} /> Camera</button>}
        <span data-testid="action-wedge-note" className="inline-flex items-center gap-1 text-[10px] text-slate-500"><ScanLine size={11} /> scanner works with any focus · scan more labels to pack a box</span>
      </div>
      {cam && camera && <div data-testid="action-camera-view" className="mt-2">{camera((code) => { if (dest && needsScan) scan(code); else add(code); })}</div>}
      {err && <p data-testid="action-error" className="mt-2 rounded-sm bg-rose-500/15 px-2 py-1 text-[11px] text-rose-200">{err}</p>}
      {/* 2 · JOB STRIP */}
      {selected.length > 0 && <div data-testid="action-strip" data-count={selected.length} className="mt-2 flex flex-wrap items-center gap-1.5">
        {selected.map((w) => { const h = cz.swoHealth(w); const ok = scanned.includes(w.id); return <div key={w.id} data-testid={`action-sel-${w.id}`} data-scanned={ok} className={`flex items-center gap-2 rounded-sm border px-2 py-1 ${ok ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/15 bg-white/[0.04]'}`}>
          <span className="font-mono text-sm font-semibold text-white">{w.jobNumber.replace(/^E/, '')}</span>
          <span className="max-w-[160px] truncate text-slate-300" title={`${w.clientName} · ${w.watchLabel}`}>{w.clientName} · {w.watchLabel}</span>
          <span className="rounded-sm bg-white/10 px-1 text-[10px] text-slate-200">{w.vendor.name.replace(' (CM)', '')}</span>
          <span className="rounded-sm bg-white/10 px-1 text-[10px] text-slate-200">{api.swoStageLabel(w.stage)}</span>
          <span data-testid={`action-health-${w.id}`} className={`rounded-sm px-1 text-[10px] font-semibold ${HEALTH_TONE[h.tone]}`}>{h.label}</span>
          <span className="text-[10px] text-slate-400">pp {w.pointPerson ?? '—'}</span>
          {needsScan && <span data-testid={`action-scanstate-${w.id}`} className={`text-[10px] font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? 'scanned ✓' : 'not yet'}</span>}
          <button type="button" data-testid={`action-remove-${w.id}`} onClick={() => remove(w.id)} aria-label="Remove" className="grid h-6 w-6 place-items-center rounded-sm text-slate-400 hover:bg-white/10 hover:text-white"><X size={12} /></button>
        </div>; })}
        <button type="button" data-testid="action-open-panel" onClick={() => onLookup(sel, `${vendorName} · ${selected.length} looked up`)} className="text-[11px] text-accent hover:underline">Open cards →</button>
        <button type="button" data-testid="action-clear" onClick={clear} className="text-[11px] text-slate-400 hover:text-white">clear</button>
        {vendorIds.length > 1 && <span data-testid="action-multi-vendor" className="text-[11px] text-amber-300">{vendorIds.length} vendors in the strip — no common destination; a box goes to one vendor</span>}
        {vendorIds.length === 1 && !legal.length && <span data-testid="action-no-legal" className="text-[11px] text-amber-300">no destination is legal for every job in the strip</span>}
      </div>}
    </div>
    {/* 3 · MAP */}
    <div data-testid="action-map" className="space-y-2 rounded-md border border-white/10 bg-[#0b0e13] p-3">
      {lanes.map((l) => <Track key={l.vendor.id} lane={l} pad={!!pad} active={vendorIds.length === 1 && vendorIds[0] === l.vendor.id} dimmed={selected.length > 0 && !(vendorIds.length === 1 && vendorIds[0] === l.vendor.id)} current={vendorIds.length === 1 && vendorIds[0] === l.vendor.id ? Array.from(new Set(selected.map(nodeOf))) : []} legal={vendorIds[0] === l.vendor.id ? legal : []} dest={vendorIds[0] === l.vendor.id ? dest : null} redoLive={selected.some((w) => w.vendorId === l.vendor.id && (w.redoCycles.length > 0 || api.isRedoStage(w.stage)))} onPick={(lg) => { setDest(lg); setScanned([]); setReason(''); setErr(null); }} onCount={(st) => onOpenStage(l.vendor.id, st)} />)}
    </div>
    {/* 4 · BOTTOM BAR */}
    {dest && <div data-testid="action-bottom" data-kind={dest.kind} className={`sticky z-20 rounded-md border border-accent/50 bg-[#0f131a]/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur ${pad ? 'bottom-[76px]' : 'bottom-2'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div data-testid="action-bottom-title" className="text-sm font-semibold text-white">Move {sel.length} job{sel.length === 1 ? '' : 's'} → {dest.nodeLabel} · {vendorName}</div>
          <div data-testid="action-bottom-req" className="text-[11px] text-slate-400">{dest.label}{needsScan ? ` · requires the label scan${sel.length > 1 ? 's' : ''} at commit (${scanned.length}/${sel.length})` : dest.kind === 'status' ? ` · logged as a status move by ${user?.shortName ?? 'staff'}` : ''}</div>
        </div>
        {needsScan && <div className="flex items-center gap-1"><ScanLine size={14} className="text-slate-400" /><input data-testid="action-scan-input" value={scanQ} onChange={(e) => setScanQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(scanQ); }} placeholder="scan the label" className={`${pad ? 'h-12 text-base' : 'h-9'} w-44 rounded-sm border border-white/15 bg-white/5 px-2 font-mono text-slate-100 focus:border-accent focus:outline-none`} /><button type="button" data-testid="action-scan-go" onClick={() => scan(scanQ)} className={`${pad ? 'h-12 px-4' : 'h-9 px-2'} rounded-sm border border-white/20 text-slate-200`}>Scan</button></div>}
        {needsReason && <input data-testid="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dest.kind === 'redo' ? 'What failed? (goes to the vendor)' : 'Reason (required)'} className={`${pad ? 'h-12 text-base' : 'h-9'} w-64 rounded-sm border border-white/15 bg-white/5 px-2 text-slate-100 focus:border-accent focus:outline-none`} />}
        <button type="button" data-testid="action-commit" aria-disabled={(needsScan && missing > 0) || (needsReason && !reason.trim())} onClick={() => void commit()} className={`${pad ? 'h-12 px-6 text-base' : 'h-10 px-5'} rounded-sm bg-accent font-semibold text-[#161b22] ${(needsScan && missing > 0) || (needsReason && !reason.trim()) ? 'opacity-50' : ''}`}>COMMIT</button>
        <button type="button" data-testid="action-cancel-dest" onClick={() => { setDest(null); setScanned([]); setErr(null); }} className={`${pad ? 'h-12 px-4' : 'h-10 px-3'} rounded-sm border border-white/20 text-slate-200`}>Cancel</button>
      </div>
    </div>}
  </div>;
};

const Track = ({ lane, pad, active, dimmed, current, legal, dest, redoLive, onPick, onCount }: { lane: ConciergeLane; pad: boolean; active: boolean; dimmed: boolean; current: string[]; legal: Legal[]; dest: Legal | null; redoLive: boolean; onPick: (l: Legal) => void; onCount: (stage: SwoStage) => void }) => {
  const ships = lane.vendor.ships !== false; const nodes = nodesFor(ships); const host = useRef<HTMLDivElement>(null); const [arc, setArc] = useState<string | null>(null);
  const count = (n: TNode) => (n.stage ? lane.stages.find((s) => s.key === n.stage) : undefined);
  useLayoutEffect(() => { const h = host.current; if (!h) return; const from = h.querySelector<HTMLElement>('[data-node="inspection"]'); const to = h.querySelector<HTMLElement>(`[data-node="${ships ? 'box' : 'handoff'}"]`); if (!from || !to) return; const hb = h.getBoundingClientRect(); const a = from.getBoundingClientRect(); const b = to.getBoundingClientRect(); const x1 = a.left + a.width / 2 - hb.left + h.scrollLeft; const x2 = b.left + b.width / 2 - hb.left + h.scrollLeft; const y = a.bottom - hb.top; setArc(`M ${x1} ${y} C ${x1} ${y + 46}, ${x2} ${y + 46}, ${x2} ${y}`); }, [ships, lane.stages.length, pad]);
  const label = lane.vendor.name.replace(' (CM)', '').toUpperCase().replace('CHYNA', 'CM');
  return <div data-testid={`track-${lane.vendor.id}`} data-active={active} className={`relative grid items-center gap-2 rounded-md border px-2 pb-12 pt-2 transition-opacity ${pad ? 'grid-cols-[90px_1fr]' : 'grid-cols-[110px_1fr]'} ${active ? 'border-accent/50 bg-accent/[0.04]' : 'border-white/10'} ${dimmed ? 'opacity-40' : ''}`}>
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{label}<div className="text-[9px] font-normal normal-case tracking-normal text-slate-500">{lane.total} open{lane.vendor.paymentTerms === 'prepay' ? ' · prepay' : ''}</div></div>
    <div ref={host} className="relative flex items-center gap-0 overflow-x-auto overflow-y-visible pb-1" style={{ scrollbarWidth: 'thin' }}>
      {nodes.map((n, i) => { const lg = legal.find((x) => x.node === n.id); const c = count(n); const isCur = current.includes(n.id); const isDest = dest?.node === n.id && dest.kind === lg?.kind; const custody = n.kind !== 'stage'; const dim = legal.length > 0 && !lg && !isCur;
        return <div key={n.id} className="flex items-center">
          {i > 0 && <span className={`h-px shrink-0 ${pad ? 'w-4' : 'w-6'} ${active ? 'bg-accent/40' : 'bg-white/15'}`} />}
          <div data-node={n.id} className={`relative flex flex-col items-stretch rounded-md border transition-[opacity,border-color,box-shadow] ${pad ? 'min-w-[104px]' : 'min-w-[92px]'} ${custody ? 'border-white/25 bg-black/50' : 'border-white/15 bg-[#11151b]'} ${isCur ? 'node-pulse ring-2 ring-accent' : ''} ${lg ? 'border-accent shadow-[0_0_12px_rgba(92,225,255,0.35)]' : ''} ${isDest ? 'bg-accent/20 ring-2 ring-accent' : ''} ${dim ? 'opacity-30' : ''}`}>
            <button type="button" data-testid={`anode-${lane.vendor.id}-${n.id}`} data-legal={!!lg} data-current={isCur} aria-pressed={isDest} disabled={!lg} onClick={() => lg && onPick(lg)} title={lg?.label ?? n.sub ?? n.label} className={`flex flex-col items-center justify-center px-1.5 pt-1.5 text-center ${pad ? 'min-h-[52px]' : 'min-h-[44px]'} ${lg ? 'cursor-pointer hover:bg-accent/10' : 'cursor-default'}`}>
              {custody ? <span className="grid place-items-center">{n.kind === 'box' ? <Box size={20} className={lg ? 'text-accent' : 'text-slate-300'} /> : <Lock size={20} className={lg ? 'text-accent' : 'text-slate-300'} />}</span> : null}
              <span className="text-[10px] font-semibold leading-tight text-slate-200">{n.label}</span>
              {lg?.kind === 'back' && <span className="text-[8px] uppercase text-accent">back</span>}{lg?.kind === 'redo' && <span className="text-[8px] uppercase text-accent">redo</span>}
            </button>
            {c ? <button type="button" data-testid={`anode-count-${lane.vendor.id}-${n.id}`} data-count={c.count} data-late={c.late} onClick={() => c.count && onCount(n.stage!)} disabled={!c.count} title={c.count ? 'Tap for the cards' : 'empty'} className={`mx-1 mb-1 rounded-sm font-mono text-sm font-bold leading-tight ${pad ? 'min-h-[44px]' : 'min-h-[24px]'} ${c.late ? 'text-rose-300' : 'text-white'} ${c.count ? 'hover:bg-white/10' : 'opacity-50'}`}>{c.count}{c.late ? <span className="text-[9px]"> · {c.late} late</span> : null}{c.redo ? <span className="text-[9px] text-amber-300"> · {c.redo} redo</span> : null}</button> : <span className={`${pad ? 'h-[44px]' : 'h-[24px]'} mb-1 block`} />}
            {isDest && <span data-testid="anode-dest-tag" className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-accent px-1 text-[8px] font-bold uppercase text-[#161b22]">destination</span>}
          </div>
        </div>; })}
      {arc && <svg className="pointer-events-none absolute inset-x-0 top-0 h-[140px] w-full overflow-visible" aria-hidden><path data-testid={`redo-loop-${lane.vendor.id}`} data-live={redoLive} d={arc} fill="none" stroke={redoLive ? '#f59e0b' : 'rgba(245,158,11,0.45)'} strokeWidth={1.5} strokeDasharray={redoLive ? undefined : '4 4'} /></svg>}
    </div>
    <span className="absolute bottom-1 right-3 text-[9px] text-slate-500">redo off-ramp: Inspection → {ships ? 'outbound box' : 'hand-off'} (dashed until a redo is opened)</span>
  </div>;
};
