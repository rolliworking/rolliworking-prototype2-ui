import { Camera, MousePointerClick, ScanLine, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DestinationMap, type DestConfig, type DestNode } from '@/components/rw/DestinationMap';
import type { Run } from './SwoCard';

// CONCIERGE · ASSIGN = the /rw/assign component (DestinationMap: station boxes, glowing safes, dashed track, orange off-ramp) rendered with a VENDOR track config.
// Same contract as Assign / Move: look up a job → legal nodes light → click = destination → bottom bar → scan at commit for safes, reason for Back / Redo → COMMIT. No counts anywhere on this map.
export interface VendorNode extends DestNode { vendorId: string; node: string; stage?: SwoStage }
const shipNodes = (v: string): VendorNode[] => [
  { id: `${v}:queue`, vendorId: v, node: 'queue', stage: 'queue', keys: [], label: 'In queue', sub: 'waiting to be packed', row: v, col: 2 },
  { id: `${v}:box`, vendorId: v, node: 'box', keys: [], label: 'Outbound box', sub: 'custody scan · label prints on commit', row: v, col: 3, lock: true },
  { id: `${v}:sent`, vendorId: v, node: 'sent', stage: 'sent', keys: [], label: 'In route', sub: 'carrier · no scan', row: v, col: 4 },
  { id: `${v}:at_vendor`, vendorId: v, node: 'at_vendor', stage: 'at_vendor', keys: [], label: 'In progress', sub: "vendor's word · no scan", row: v, col: 5 },
  { id: `${v}:inbound`, vendorId: v, node: 'inbound', stage: 'inbound', keys: [], label: 'Returning', sub: 'return label · no scan', row: v, col: 6 },
  { id: `${v}:arrival`, vendorId: v, node: 'arrival', stage: 'received', keys: [], label: 'Received', sub: 'arrival scan · custody back', row: v, col: 7, lock: true },
  { id: `${v}:inspection`, vendorId: v, node: 'inspection', stage: 'inspection', keys: [], label: 'Inspection', sub: 'QC · redo off-ramp below', row: v, col: 8 },
  { id: `${v}:fulfilled`, vendorId: v, node: 'fulfilled', stage: 'fulfilled', keys: [], label: 'Fulfilled', sub: 'back in the job flow', row: v, col: 9 },
];
const handNodes = (v: string): VendorNode[] => [
  { id: `${v}:queue`, vendorId: v, node: 'queue', stage: 'queue', keys: [], label: 'In queue', sub: 'waiting for hand-off', row: v, col: 2 },
  { id: `${v}:handoff`, vendorId: v, node: 'handoff', keys: [], label: 'Hand-off', sub: 'custody scan to CM', row: v, col: 3, lock: true },
  { id: `${v}:at_vendor`, vendorId: v, node: 'at_vendor', stage: 'at_vendor', keys: [], label: 'In progress', sub: 'in-house · no shipping', row: v, col: 5 },
  { id: `${v}:inspection`, vendorId: v, node: 'inspection', stage: 'inspection', keys: [], label: 'Inspection', sub: 'QC · redo off-ramp below', row: v, col: 8 },
  { id: `${v}:fulfilled`, vendorId: v, node: 'fulfilled', stage: 'fulfilled', keys: [], label: 'Fulfilled', sub: 'back in the job flow', row: v, col: 9 },
];
const rowLabel = (l: ConciergeLane) => l.vendor.name.replace(' (CM)', '').toUpperCase().replace('CHYNA', 'CM');
export const vendorConfig = (lanes: ConciergeLane[]): DestConfig<VendorNode> => ({
  rows: lanes.flatMap((l) => [{ key: l.vendor.id, label: rowLabel(l), className: 'text-[10px] font-bold uppercase tracking-widest text-slate-300' }, { key: `${l.vendor.id}_ramp`, label: '', className: '', ramp: true }]),
  nodes: lanes.flatMap((l) => (l.vendor.ships !== false ? shipNodes(l.vendor.id) : handNodes(l.vendor.id))),
  tracks: lanes.map((l) => (l.vendor.ships !== false ? shipNodes(l.vendor.id) : handNodes(l.vendor.id)).map((n) => n.id)),
  ramps: lanes.map((l) => ({ from: `${l.vendor.id}:inspection`, leg: [], to: `${l.vendor.id}:${l.vendor.ships !== false ? 'box' : 'handoff'}` })),
  columns: '90px repeat(8, minmax(0, 1fr))', rowHeights: lanes.map(() => 'auto 18px').join(' '), rampDip: 30, safeCaptions: true,
  legend: { ramp: 'redo off-ramp (Inspection → Outbound box / Hand-off)', safe: '= a custody scan point' },
});

type MoveKind = 'custody' | 'status' | 'back' | 'redo';
export interface Legal { node: string; kind: MoveKind; to: SwoStage | 'redo'; label: string; nodeLabel: string }
// stage → node id on the track (Received lives on the arrival safe)
const nodeIdFor = (stage: SwoStage) => { const b = api.baseStage(stage); return b === 'received' ? 'arrival' : b; };
const nodeOf = (w: SwoWithRefs) => nodeIdFor(w.stage);
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
const HEALTH_TONE: Record<string, string> = { ok: 'bg-emerald-400/15 text-emerald-200', amber: 'bg-amber-400/20 text-amber-200', red: 'bg-rose-500/25 text-rose-200', dark: 'bg-rose-500/25 text-rose-200', muted: 'bg-white/10 text-slate-300' };

// Wedge scanner: a barcode scanner types fast then sends Enter — capture it whatever has focus (our own inputs handle Enter themselves)
const useWedge = (onCode: (code: string) => void, enabled = true) => {
  const buf = useRef(''); const last = useRef(0);
  useEffect(() => { if (!enabled) return; const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return; const now = Date.now(); if (now - last.current > 120) buf.current = ''; last.current = now; if (e.key === 'Enter') { const code = buf.current; buf.current = ''; if (code.length >= 3) { e.preventDefault(); onCode(code); } return; } if (e.key.length === 1) buf.current += e.key; }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onCode, enabled]);
};

export interface ActionMapProps { lanes: ConciergeLane[]; run: Run; onLookup: (ids: string[], title: string) => void; pad?: boolean; pickedId?: string | null; onPickedConsumed?: () => void; camera?: (onCode: (code: string) => void) => React.ReactNode; active?: boolean }
// Stays mounted (hidden) while TRACK is shown so the strip survives a flip between the views; the wedge listener only runs while visible
export const ActionMap = ({ lanes, run, onLookup, pad, pickedId, onPickedConsumed, camera, active = true }: ActionMapProps) => {
  const { user } = useAuth(); const rows = useMemo(() => lanes.flatMap((l) => l.rows), [lanes]); const cfg = useMemo(() => vendorConfig(lanes), [lanes]);
  const [q, setQ] = useState(''); const [sel, setSel] = useState<string[]>([]); const [dest, setDest] = useState<Legal | null>(null); const [scanned, setScanned] = useState<string[]>([]); const [scanQ, setScanQ] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null); const [cam, setCam] = useState(false);
  const selected = sel.map((id) => rows.find((r) => r.id === id)!).filter(Boolean); const vendorIds = Array.from(new Set(selected.map((w) => w.vendorId))); const vendorId = vendorIds.length === 1 ? vendorIds[0] : undefined;
  // legal set = intersection over every job in the strip (same node + same kind); several vendors → empty
  const legal = useMemo(() => { if (!selected.length || vendorIds.length > 1) return []; const sets = selected.map(legalFor); return sets[0].filter((l) => sets.every((s) => s.some((x) => x.node === l.node && x.kind === l.kind))); }, [selected, vendorIds.length]);
  const legalIds = useMemo(() => new Set(selected.length ? legal.map((l) => `${vendorId}:${l.node}`) : cfg.nodes.map((n) => n.id)), [legal, vendorId, selected.length, cfg]);
  const currentIds = useMemo(() => new Set(vendorId ? selected.map((w) => `${vendorId}:${nodeOf(w)}`) : []), [selected, vendorId]);
  const dimRows = useMemo(() => new Set(vendorId ? cfg.rows.filter((r) => r.key !== vendorId && r.key !== `${vendorId}_ramp`).map((r) => r.key) : []), [cfg, vendorId]);
  const find = useCallback((text: string) => { const t = text.trim().replace(/^E/i, '').toLowerCase(); if (!t) return null; const hit = (r: SwoWithRefs) => r.number.toLowerCase() === t || r.jobNumber.replace(/^E/, '').toLowerCase() === t || r.jobNumber.toLowerCase() === t || r.synth?.reference.toLowerCase() === t || r.outbound?.tracking.toLowerCase() === t; return rows.find((r) => r.stage !== 'fulfilled' && hit(r)) ?? rows.find(hit) ?? null; }, [rows]);
  const add = useCallback((text: string) => { const w = find(text); setErr(null); if (!w) { setErr(`No open vendor job matches “${text.trim()}”`); return; } setSel((s) => (s.includes(w.id) ? s : [...s, w.id])); setQ(''); setDest(null); setScanned([]); }, [find]);
  const remove = (id: string) => { setSel((s) => s.filter((x) => x !== id)); setScanned((s) => s.filter((x) => x !== id)); setDest(null); };
  const clear = () => { setSel([]); setDest(null); setScanned([]); setReason(''); setErr(null); };
  const scan = useCallback((text: string) => { const w = find(text); setScanQ(''); if (!w || !sel.includes(w.id)) { setErr(`Label “${text.trim()}” is not in the strip`); return; } setErr(null); setScanned((s) => (s.includes(w.id) ? s : [...s, w.id])); }, [find, sel]);
  const needsScan = !!dest && (dest.kind === 'custody' || dest.kind === 'redo'); const needsReason = !!dest && (dest.kind === 'back' || dest.kind === 'redo');
  useWedge(useCallback((code: string) => { if (dest && needsScan) scan(code); else add(code); }, [dest, needsScan, scan, add]), active);
  // a card tapped in TRACK's slide-out loads into the strip
  useEffect(() => { if (!pickedId) return; if (rows.some((r) => r.id === pickedId)) { setSel((s) => (s.includes(pickedId) ? s : [...s, pickedId])); setDest(null); setScanned([]); setErr(null); } onPickedConsumed?.(); }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (n: VendorNode) => { if (!selected.length) { setErr('Look up a job first — the map lights its legal destinations'); return; } const lg = legal.find((l) => l.node === n.node && n.vendorId === vendorId); if (!lg) return; setDest((d) => (d?.node === lg.node && d.kind === lg.kind ? null : lg)); setScanned([]); setReason(''); setErr(null); };
  const missing = sel.filter((id) => !scanned.includes(id)).length;
  const commit = async () => {
    if (!dest) return; const d = dest; const ids = [...sel];
    if (needsScan && missing) { setErr(`${d.nodeLabel} is a custody scan point — scan the label${ids.length > 1 ? 's' : ''} first (${scanned.length}/${ids.length} scanned). Nothing moved.`); return; }
    if (needsReason && !reason.trim()) { setErr(`${d.kind === 'redo' ? 'Redo' : 'Back'} needs a reason. Nothing moved.`); return; }
    const verb = d.kind === 'status' ? `status move by ${user?.shortName ?? 'staff'}` : d.kind === 'back' ? 'moved back' : d.kind === 'redo' ? 'redo opened → vendor' : d.node === 'box' ? 'packed · label printed · return label queued · vendor emailed' : d.node === 'arrival' ? 'arrival scan · custody back' : 'custody move';
    await run(async () => { for (const id of ids) { const w = rows.find((r) => r.id === id)!; if (d.kind === 'back') await api.sendBackSwo(id, reason); else if (d.kind === 'redo') await cz.startRedo(id, reason); else if (d.to === 'sent') { await api.createSwoOutboundLabel(id); await api.queueSwoReturnLabel(id, w.predictedCompletion); } else if ((d.to === 'inbound' || d.to === 'redo_inbound') && !w.returnLabel) { await api.queueSwoReturnLabel(id, w.predictedCompletion); await api.advanceSwo(id, d.to); } else await api.advanceSwo(id, d.to as SwoStage); } }, `${ids.length} job${ids.length === 1 ? '' : 's'} → ${d.nodeLabel} · ${selected[0]?.vendor.name ?? ''} · ${verb}`);
    clear();
  };
  const vendorName = selected[0]?.vendor.name ?? '';
  const inputCls = pad ? 'py-3 text-base' : 'py-2 text-sm';
  return <div data-testid="concierge-assign" data-pad={!!pad} className="space-y-3 rounded-md bg-[#161b22] p-4 text-slate-100">
    {/* HEADER — same two lines as /rw/assign */}
    <div><h2 className="text-lg font-semibold text-white">Assign / Move · vendors</h2><p data-testid="assign-header-hint" className="text-xs text-slate-400">Pick a destination on the map, scan the labels, press Commit. Nothing moves until you commit. Safes are custody scan points; everything else is the vendor's word.</p></div>
    {/* LOOKUP — same form as /rw/assign */}
    <form data-testid="action-lookup" onSubmit={(e) => { e.preventDefault(); add(q); }} className="flex max-w-3xl flex-wrap items-center gap-2">
      <div className="relative min-w-[260px] flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="action-lookup-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up ONE job · est # / ref # / barcode — scan more labels to pack a box" className={`w-full rounded-md border border-white/10 bg-[#0f131a] pl-8 pr-3 text-slate-100 ${inputCls}`} /></div>
      <button type="submit" data-testid="action-lookup-go" className={`rounded-md bg-amber-400 px-3 font-semibold text-[#161b22] ${inputCls}`}>Find</button>
      {selected.length > 0 && <button type="button" data-testid="action-clear" onClick={clear} className={`inline-flex items-center gap-1 rounded-md border border-white/15 px-3 text-slate-200 ${inputCls}`}><X size={13} /> Clear</button>}
      {camera && <button type="button" data-testid="action-camera" onClick={() => setCam((c) => !c)} aria-pressed={cam} className={`inline-flex items-center gap-1 rounded-md border border-white/15 px-3 text-slate-200 ${inputCls} ${cam ? 'border-accent bg-accent/15' : ''}`}><Camera size={14} /> Camera</button>}
      <span data-testid="action-wedge-note" className="inline-flex items-center gap-1 text-[10px] text-slate-500"><ScanLine size={11} /> scanner works with any focus</span>
    </form>
    {cam && camera && <div data-testid="action-camera-view">{camera((code) => { if (dest && needsScan) scan(code); else add(code); })}</div>}
    {err && <div data-testid="action-error" className="text-xs text-rose-300">{err}</div>}
    {/* JOB STRIP */}
    {selected.length > 0 && <div data-testid="action-strip" data-count={selected.length} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
      {selected.map((w) => { const h = cz.swoHealth(w); const ok = scanned.includes(w.id); return <div key={w.id} data-testid={`action-sel-${w.id}`} data-scanned={ok} className={`flex items-center gap-2 rounded-md border px-2 py-1 ${ok ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/15 bg-white/[0.04]'}`}>
        <span className="font-mono text-base font-semibold text-amber-300">{w.jobNumber.replace(/^E/, '')}</span>
        <span className="max-w-[180px] truncate" title={`${w.clientName} · ${w.watchLabel}`}>{w.clientName} · {w.watchLabel}</span>
        <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase">{w.vendor.name.replace(' (CM)', '')}</span>
        <span className="rounded bg-white/10 px-1.5 text-[10px]">{api.swoStageLabel(w.stage)}</span>
        <span data-testid={`action-health-${w.id}`} className={`rounded px-1.5 text-[10px] font-semibold ${HEALTH_TONE[h.tone]}`}>{h.label}</span>
        <span className="text-[10px] text-slate-500">pp {w.pointPerson ?? '—'}</span>
        {needsScan && <span data-testid={`action-scanstate-${w.id}`} className={`text-[10px] font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>{ok ? 'scanned ✓' : 'not yet'}</span>}
        <button type="button" data-testid={`action-remove-${w.id}`} onClick={() => remove(w.id)} aria-label="Remove" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white"><X size={12} /></button>
      </div>; })}
      <button type="button" data-testid="action-open-panel" onClick={() => onLookup(sel, `${vendorName} · ${selected.length} looked up`)} className="text-[11px] text-accent hover:underline">Open cards →</button>
      {vendorIds.length > 1 && <span data-testid="action-multi-vendor" className="text-[11px] text-amber-300">{vendorIds.length} vendors in the strip — no common destination; a box goes to one vendor</span>}
      {vendorIds.length === 1 && !legal.length && <span data-testid="action-no-legal" className="text-[11px] text-amber-300">no destination is legal for every job in the strip</span>}
    </div>}
    {/* MAP — the /rw/assign component with the vendor track config */}
    <DestinationMap<VendorNode> testId="vendor-destination-map" config={cfg} selectedId={dest && vendorId ? `${vendorId}:${dest.node}` : undefined} onSelect={pick} legal={selected.length ? legalIds : undefined} current={currentIds} dimRows={dimRows} />
    {!dest && <div data-testid="assign-hint" className="flex items-center gap-1.5 text-xs text-amber-200"><MousePointerClick size={12} /> {selected.length ? 'Click a station or safe above to choose the destination.' : 'Look up a job, then click a station or safe above to choose the destination.'}</div>}
    {/* BOTTOM BAR */}
    {dest && <div data-testid="action-bottom" data-kind={dest.kind} className={`sticky z-20 rounded-md border border-white/10 bg-[#1f2630] p-3 text-xs text-slate-200 shadow-2xl ${pad ? 'bottom-[76px]' : 'bottom-2'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div data-testid="action-bottom-title" className="text-sm font-semibold text-white">Move {sel.length} job{sel.length === 1 ? '' : 's'} → {dest.nodeLabel} · {vendorName}</div>
          <div data-testid="action-bottom-req" className="text-[11px] text-slate-400">{dest.label}{needsScan ? ` · requires the label scan${sel.length > 1 ? 's' : ''} at commit (${scanned.length}/${sel.length})` : dest.kind === 'status' ? ` · logged as a status move by ${user?.shortName ?? 'staff'}` : ''}</div>
        </div>
        {needsScan && <div className="flex items-center gap-1"><ScanLine size={14} className="text-slate-400" /><input data-testid="action-scan-input" value={scanQ} onChange={(e) => setScanQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') scan(scanQ); }} placeholder="scan the label" className={`w-44 rounded-md border border-white/10 bg-[#0f131a] px-2 font-mono text-slate-100 ${inputCls}`} /><button type="button" data-testid="action-scan-go" onClick={() => scan(scanQ)} className={`rounded-md border border-white/15 px-2 text-slate-200 ${inputCls}`}>Scan</button></div>}
        {needsReason && <input data-testid="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dest.kind === 'redo' ? 'What failed? (goes to the vendor)' : 'Reason (required)'} className={`w-64 rounded-md border border-white/10 bg-[#0f131a] px-2 text-slate-100 ${inputCls}`} />}
        <button type="button" data-testid="action-commit" aria-disabled={(needsScan && missing > 0) || (needsReason && !reason.trim())} onClick={() => void commit()} className={`rounded-md bg-amber-400 px-5 font-semibold text-[#161b22] ${inputCls} ${(needsScan && missing > 0) || (needsReason && !reason.trim()) ? 'opacity-50' : ''}`}>Commit{sel.length > 1 ? ` · ${sel.length} jobs` : ''}</button>
        <button type="button" data-testid="action-cancel-dest" onClick={() => { setDest(null); setScanned([]); setErr(null); }} className={`rounded-md border border-white/15 px-3 text-slate-200 ${inputCls}`}>Cancel</button>
      </div>
    </div>}
  </div>;
};
