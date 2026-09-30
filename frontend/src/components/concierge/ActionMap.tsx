import { Camera, MousePointerClick, ScanLine, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage, SwoWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DestinationMap, type DestConfig, type DestNode } from '@/components/rw/DestinationMap';
import type { Run } from './SwoCard';

// CONCIERGE · ASSIGN = the /rw/assign component (DestinationMap: station boxes, glowing safes, dashed track, orange off-ramp) rendered with a VENDOR track config.
// Destination-first: arm a node → scan labels → COMMIT (batch). Lookup-first still lights the legal nodes. No counts anywhere on this map.
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


// ---- DESTINATION-FIRST (MH): arm a station or safe, scan any number of labels, COMMIT moves every legal chip in one event. Lookup-first still works — either order lands in the same commit. ----
interface Chip { id: string; scanned: boolean }
type Verdict = { ok: true; legal: Legal } | { ok: false; reason: string };
const judge = (w: SwoWithRefs, dest: VendorNode): Verdict => {
  if (w.vendorId !== dest.vendorId) return { ok: false, reason: `wrong vendor — on ${w.vendor.name.replace(' (CM)', '')}'s lane` };
  const lg = legalFor(w).find((l) => l.node === dest.node);
  if (lg) return { ok: true, legal: lg };
  if (nodeOf(w) === dest.node) return { ok: false, reason: `already at ${dest.label}` };
  const next = api.nextSwoStage(w.vendor, w.stage);
  return { ok: false, reason: `not legal from ${api.swoStageLabel(w.stage)}${next ? ` — next is ${api.swoStageLabel(next)}` : ' — lane is complete'}` };
};

export interface ActionMapProps { lanes: ConciergeLane[]; run: Run; onLookup: (ids: string[], title: string) => void; pad?: boolean; pickedId?: string | null; onPickedConsumed?: () => void; camera?: (onCode: (code: string) => void) => React.ReactNode; active?: boolean }
// Stays mounted (hidden) while TRACK is shown so the strip AND the armed destination survive a flip between the views; the wedge listener only runs while visible
export const ActionMap = ({ lanes, run, onLookup, pad, pickedId, onPickedConsumed, camera, active = true }: ActionMapProps) => {
  const { user } = useAuth(); const rows = useMemo(() => lanes.flatMap((l) => l.rows), [lanes]); const cfg = useMemo(() => vendorConfig(lanes), [lanes]);
  const [q, setQ] = useState(''); const [chips, setChips] = useState<Chip[]>([]); const [dest, setDest] = useState<VendorNode | null>(null); const [scanQ, setScanQ] = useState(''); const [reason, setReason] = useState(''); const [err, setErr] = useState<string | null>(null); const [cam, setCam] = useState(false);
  const rowOf = useCallback((id: string) => rows.find((r) => r.id === id), [rows]);
  const strip = chips.map((c) => ({ chip: c, w: rowOf(c.id)! })).filter((x) => x.w);
  const vendorIds = Array.from(new Set(strip.map((x) => x.w.vendorId))); const stripVendor = vendorIds.length === 1 ? vendorIds[0] : undefined;
  // verdict per chip against the armed destination
  const judged = strip.map(({ chip, w }) => ({ chip, w, v: dest ? judge(w, dest) : null }));
  const legalChips = judged.filter((x) => x.v?.ok) as { chip: Chip; w: SwoWithRefs; v: { ok: true; legal: Legal } }[];
  const refused = judged.filter((x) => x.v && !x.v.ok);
  const destIsCustody = !!dest && (dest.lock === true); const needsScan = legalChips.filter((x) => destIsCustody && !x.chip.scanned);
  const ready = legalChips.filter((x) => !destIsCustody || x.chip.scanned);
  const needsReason = legalChips.some((x) => x.v.legal.kind === 'back' || x.v.legal.kind === 'redo');
  // lookup-first lighting: with chips from ONE vendor and no destination armed, the common legal nodes light (soft — every node stays armable)
  const lit = useMemo(() => { if (dest || !strip.length || !stripVendor) return undefined; const sets = strip.map((x) => legalFor(x.w)); const common = sets[0].filter((l) => sets.every((s) => s.some((y) => y.node === l.node && y.kind === l.kind))); return new Set(common.map((l) => `${stripVendor}:${l.node}`)); }, [dest, strip, stripVendor]);
  const currentIds = useMemo(() => new Set(strip.map((x) => `${x.w.vendorId}:${nodeOf(x.w)}`)), [strip]);
  const focusVendor = dest?.vendorId ?? stripVendor;
  const dimRows = useMemo(() => new Set(focusVendor ? cfg.rows.filter((r) => r.key !== focusVendor && r.key !== `${focusVendor}_ramp`).map((r) => r.key) : []), [cfg, focusVendor]);
  const find = useCallback((text: string) => { const t = text.trim().replace(/^E/i, '').toLowerCase(); if (!t) return null; const hit = (r: SwoWithRefs) => r.number.toLowerCase() === t || r.jobNumber.replace(/^E/, '').toLowerCase() === t || r.jobNumber.toLowerCase() === t || r.synth?.reference.toLowerCase() === t || r.outbound?.tracking.toLowerCase() === t; return rows.find((r) => r.stage !== 'fulfilled' && hit(r)) ?? rows.find(hit) ?? null; }, [rows]);
  // typed lookup = not a custody scan; wedge / camera / scan box = the custody scan itself
  const addChip = useCallback((text: string, scanned: boolean) => { const w = find(text); if (!w) { setErr(`No open vendor job matches “${text.trim()}”`); return; } setErr(null); setChips((s) => (s.some((c) => c.id === w.id) ? s.map((c) => (c.id === w.id ? { ...c, scanned: c.scanned || scanned } : c)) : [...s, { id: w.id, scanned }])); }, [find]);
  const lookup = useCallback((text: string) => { addChip(text, false); setQ(''); }, [addChip]);
  const scan = useCallback((text: string) => { addChip(text, true); setScanQ(''); }, [addChip]);
  const remove = (id: string) => setChips((s) => s.filter((c) => c.id !== id));
  const clearStrip = () => { setChips([]); setReason(''); setErr(null); };
  const disarm = () => { setDest(null); setReason(''); setErr(null); };
  useWedge(scan, active);
  useEffect(() => { if (!active) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') disarm(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [active]);
  // a card tapped in TRACK's slide-out loads into the strip (as a lookup, not a scan)
  useEffect(() => { if (!pickedId) return; if (rows.some((r) => r.id === pickedId)) { setChips((s) => (s.some((c) => c.id === pickedId) ? s : [...s, { id: pickedId, scanned: false }])); setErr(null); } onPickedConsumed?.(); }, [pickedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const arm = (n: VendorNode) => { setDest((d) => (d?.id === n.id ? null : n)); setReason(''); setErr(null); };
  const destVendor = dest ? lanes.find((l) => l.vendor.id === dest.vendorId)?.vendor.name ?? '' : '';
  const commit = async () => {
    if (!dest || !ready.length) return; const d = dest;
    if (needsReason && !reason.trim()) { setErr(`${legalChips.some((x) => x.v.legal.kind === 'redo') ? 'Redo' : 'Back'} needs a reason — one reason covers the batch. Nothing moved.`); return; }
    const moved = ready.map((x) => x.w.id); const kinds = new Set(ready.map((x) => x.v.legal.kind));
    const verb = kinds.has('back') ? 'moved back' : kinds.has('redo') ? 'redo opened → vendor' : d.node === 'box' ? 'packed · label printed · return label queued · vendor emailed' : d.node === 'arrival' ? 'arrival scan · custody back' : d.lock ? 'custody scan' : `status move by ${user?.shortName ?? 'staff'}`;
    await run(async () => { for (const { w, v } of ready) { const lg = v.legal; if (lg.kind === 'back') await api.sendBackSwo(w.id, reason); else if (lg.kind === 'redo') await cz.startRedo(w.id, reason); else if (lg.to === 'sent') { await api.createSwoOutboundLabel(w.id); await api.queueSwoReturnLabel(w.id, w.predictedCompletion); } else if ((lg.to === 'inbound' || lg.to === 'redo_inbound') && !w.returnLabel) { await api.queueSwoReturnLabel(w.id, w.predictedCompletion); await api.advanceSwo(w.id, lg.to); } else await api.advanceSwo(w.id, lg.to as SwoStage); } }, `${moved.length} → ${d.label} · ${destVendor} · ${verb}${refused.length ? ` · ${refused.length} refused (still in the strip)` : ''}`);
    setChips((s) => s.filter((c) => !moved.includes(c.id))); setReason('');
  };
  const inputCls = pad ? 'py-3 text-base' : 'py-2 text-sm';
  const canCommit = ready.length > 0 && (!needsReason || !!reason.trim());
  return <div data-testid="concierge-assign" data-pad={!!pad} data-armed={dest?.id ?? ''} className="space-y-3 rounded-md bg-[#161b22] p-4 text-slate-100">
    <div><h2 className="text-lg font-semibold text-white">Assign / Move · vendors</h2><p data-testid="assign-header-hint" className="text-xs text-slate-400">Click a station or safe to arm it as the destination, scan any number of labels, press Commit — every legal chip moves in one event. Lookup first works too. Safes are custody scan points; everything else is the vendor's word.</p></div>
    {/* LOOKUP — optional */}
    <form data-testid="action-lookup" onSubmit={(e) => { e.preventDefault(); lookup(q); }} className="flex max-w-3xl flex-wrap items-center gap-2">
      <div className="relative min-w-[260px] flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="action-lookup-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Optional · look up a job by est # / ref # / barcode — or just scan" className={`w-full rounded-md border border-white/10 bg-[#0f131a] pl-8 pr-3 text-slate-100 ${inputCls}`} /></div>
      <button type="submit" data-testid="action-lookup-go" className={`rounded-md bg-amber-400 px-3 font-semibold text-[#161b22] ${inputCls}`}>Find</button>
      {chips.length > 0 && <button type="button" data-testid="action-clear" onClick={clearStrip} className={`inline-flex items-center gap-1 rounded-md border border-white/15 px-3 text-slate-200 ${inputCls}`}><X size={13} /> Clear strip</button>}
      {camera && <button type="button" data-testid="action-camera" onClick={() => setCam((c) => !c)} aria-pressed={cam} className={`inline-flex items-center gap-1 rounded-md border border-white/15 px-3 text-slate-200 ${inputCls} ${cam ? 'border-accent bg-accent/15' : ''}`}><Camera size={14} /> Camera</button>}
      <span data-testid="action-wedge-note" className="inline-flex items-center gap-1 text-[10px] text-slate-500"><ScanLine size={11} /> scanner works with any focus · Esc disarms</span>
    </form>
    {cam && camera && <div data-testid="action-camera-view">{camera(scan)}</div>}
    {err && <div data-testid="action-error" className="text-xs text-rose-300">{err}</div>}
    {/* STRIP — every scan is a chip; refused chips stay red with the reason and are excluded from the commit */}
    {strip.length > 0 && <div data-testid="action-strip" data-count={strip.length} data-legal={legalChips.length} data-refused={refused.length} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
      {judged.map(({ chip, w, v }) => { const h = cz.swoHealth(w); const bad = !!v && !v.ok; const good = !!v?.ok && (!destIsCustody || chip.scanned); const tone = bad ? 'border-rose-400/70 bg-rose-500/15' : good ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/15 bg-white/[0.04]'; return <div key={w.id} data-testid={`action-sel-${w.id}`} data-scanned={chip.scanned} data-verdict={v ? (v.ok ? 'legal' : 'refused') : 'pending'} className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 ${tone}`}>
        <span className="font-mono text-base font-semibold text-amber-300">{w.jobNumber.replace(/^E/, '')}</span>
        <span className="max-w-[180px] truncate" title={`${w.clientName} · ${w.watchLabel}`}>{w.clientName} · {w.watchLabel}</span>
        <span className="rounded bg-white/10 px-1.5 text-[10px] uppercase">{w.vendor.name.replace(' (CM)', '')}</span>
        <span className="rounded bg-white/10 px-1.5 text-[10px]">{api.swoStageLabel(w.stage)}</span>
        <span data-testid={`action-health-${w.id}`} className={`rounded px-1.5 text-[10px] font-semibold ${HEALTH_TONE[h.tone]}`}>{h.label}</span>
        {bad && <span data-testid={`action-refused-${w.id}`} className="text-[10px] font-semibold text-rose-300">refused · {(v as { reason: string }).reason}</span>}
        {!bad && destIsCustody && v?.ok && <span data-testid={`action-scanstate-${w.id}`} className={`text-[10px] font-semibold ${chip.scanned ? 'text-emerald-300' : 'text-amber-300'}`}>{chip.scanned ? 'scanned ✓' : 'looked up · needs the label scan'}</span>}
        <button type="button" data-testid={`action-remove-${w.id}`} onClick={() => remove(w.id)} aria-label="Remove" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white"><X size={12} /></button>
      </div>; })}
      <button type="button" data-testid="action-open-panel" onClick={() => onLookup(strip.map((x) => x.w.id), `${strip.length} in the strip`)} className="text-[11px] text-accent hover:underline">Open cards →</button>
      {!dest && vendorIds.length > 1 && <span data-testid="action-multi-vendor" className="text-[11px] text-amber-300">{vendorIds.length} vendors in the strip — arm a destination; chips from the other lanes will be refused</span>}
      {!dest && lit && lit.size === 0 && <span data-testid="action-no-legal" className="text-[11px] text-amber-300">no destination is legal for every job in the strip</span>}
    </div>}
    {/* MAP — every node armable; lookup-first lights the common legal nodes */}
    <DestinationMap<VendorNode> testId="vendor-destination-map" config={cfg} selectedId={dest?.id} onSelect={arm} legal={lit} softLegal current={currentIds} dimRows={dimRows} />
    {!dest && <div data-testid="assign-hint" className="flex items-center gap-1.5 text-xs text-amber-200"><MousePointerClick size={12} /> {strip.length ? 'Click a station or safe to arm the destination — lit nodes are legal for every chip.' : 'Click a station or safe to arm it as the destination, then scan labels. Or look up a job first.'}</div>}
    {/* BOTTOM BAR — armed destination */}
    {dest && <div data-testid="action-bottom" data-kind={destIsCustody ? 'custody' : needsReason ? 'reason' : 'status'} className={`sticky z-20 rounded-md border border-accent/40 bg-[#1f2630] p-3 text-xs text-slate-200 shadow-2xl ${pad ? 'bottom-[76px]' : 'bottom-2'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div data-testid="action-bottom-title" className="text-sm font-semibold text-white">{strip.length ? `Move ${ready.length} → ${dest.label} · ${destVendor}` : `Destination: ${dest.label} · ${destVendor} — scan labels`}</div>
          <div data-testid="action-bottom-req" className="text-[11px] text-slate-400">
            {!strip.length ? `${dest.lock ? 'Custody scan point — each scan is the custody scan.' : `Status node — logged as a status move by ${user?.shortName ?? 'staff'}.`} Scan any number of labels, or look up a job above. Esc disarms.`
              : [refused.length ? `${refused.length} refused — excluded from the commit` : '', needsScan.length ? `${needsScan.length} looked up, not scanned — scan the label${needsScan.length > 1 ? 's' : ''} or they stay behind` : '', needsReason ? 'Back / Redo in the batch — one reason required' : '', dest.lock ? 'scans are the custody scans' : `status move by ${user?.shortName ?? 'staff'}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex items-center gap-1"><ScanLine size={14} className="text-slate-400" /><input data-testid="action-scan-input" value={scanQ} onChange={(e) => setScanQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scan(scanQ); } }} placeholder="scan a label" className={`w-44 rounded-md border border-white/10 bg-[#0f131a] px-2 font-mono text-slate-100 ${inputCls}`} /><button type="button" data-testid="action-scan-go" onClick={() => scan(scanQ)} className={`rounded-md border border-white/15 px-2 text-slate-200 ${inputCls}`}>Scan</button></div>
        {needsReason && <input data-testid="action-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={legalChips.some((x) => x.v.legal.kind === 'redo') ? 'What failed? (one reason for the batch · goes to the vendor)' : 'Reason for the batch (required)'} className={`w-72 rounded-md border border-white/10 bg-[#0f131a] px-2 text-slate-100 ${inputCls}`} />}
        <button type="button" data-testid="action-commit" aria-disabled={!canCommit} onClick={() => void commit()} className={`rounded-md bg-amber-400 px-5 font-semibold text-[#161b22] ${inputCls} ${canCommit ? '' : 'opacity-50'}`}>COMMIT{ready.length ? ` · ${ready.length}` : ''}</button>
        <button type="button" data-testid="action-cancel-dest" onClick={disarm} className={`rounded-md border border-white/15 px-3 text-slate-200 ${inputCls}`}>Disarm</button>
      </div>
    </div>}
  </div>;
};
