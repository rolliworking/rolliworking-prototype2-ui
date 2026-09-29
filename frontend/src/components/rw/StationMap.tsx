import { Lock, UserPlus } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { FloorDot, RwStationKey } from '@/api/client';
import { PART_COLOR } from '@/components/rw/RwBits';

// Station map = two tracks (WATCH / BRACELET) with a manager-gated branch-and-return Polish leg under each. Lock = the part is in a manager's safe.
export type MapRow = 'wat' | 'wat_ramp' | 'bra' | 'bra_ramp';
export interface MapNode { id: string; keys: RwStationKey[]; label: string; row: MapRow; col: number; lock?: boolean; owner?: string; assign?: boolean; sub?: string; free?: boolean }
export const NODES: MapNode[] = [
  { id: 'pre_approval', keys: ['pre_approval'], label: 'Pre-approval', row: 'wat', col: 2 },
  { id: 'pre_queue', keys: ['pre_queue'], label: 'Pre-queue', row: 'wat', col: 3, lock: true, owner: 'MM', sub: 'in safe · awaiting bench pickup' },
  { id: 'assign_wm', keys: ['wm_bench_1', 'wm_bench_2', 'wm_bench_3'], label: 'Assign watchmaker', row: 'wat', col: 4, assign: true, sub: 'WM Bench 1–3' },
  { id: 'uncase', keys: ['uncase'], label: 'Uncase', row: 'wat', col: 5 },
  { id: 'safe_polish_in', keys: ['mgr_safe_polish_in'], label: 'Manager safe', row: 'wat_ramp', col: 6, lock: true, owner: 'Vienna', sub: 'waiting · scan OUT to polisher' },
  { id: 'polish_room', keys: ['polish_room'], label: 'Assign refinisher', row: 'wat_ramp', col: 7, assign: true, sub: 'Polish Room · case (+ bracelet when not split)' },
  { id: 'safe_polish_out', keys: ['mgr_safe_polish_out'], label: 'Manager safe', row: 'wat_ramp', col: 8, lock: true, owner: 'Vienna', sub: 'waiting · scan OUT back to WM' },
  { id: 'movement', keys: ['movement_service'], label: 'Movement service', row: 'wat', col: 9 },
  { id: 'parts', keys: ['parts_approval'], label: 'Parts approval', row: 'wat', col: 10 },
  { id: 'recase', keys: ['recase_test'], label: 'Recase + test', row: 'wat', col: 11 },
  { id: 'safe_head', keys: ['into_safe_head', 'safe_await_band'], label: 'Manager safe', row: 'wat', col: 12, lock: true, owner: 'MM', sub: 'head waits here for the bracelet' },
  { id: 'band_pre', keys: ['band_pre_queue'], label: 'Pre-queue', row: 'bra', col: 3, lock: true, owner: 'JV', sub: 'in safe · awaiting band tech' },
  { id: 'assign_band', keys: ['band_assign'], label: 'Assign band tech', row: 'bra', col: 4, assign: true },
  { id: 'band_safe_in', keys: ['band_mgr_safe_in'], label: 'Manager safe', row: 'bra_ramp', col: 6, lock: true, owner: 'JV', sub: 'waiting · scan OUT to refinisher' },
  { id: 'refinish', keys: ['refinish'], label: 'Assign refinisher', row: 'bra_ramp', col: 7, assign: true, sub: 'Polish Room · bracelet (split jobs)' },
  { id: 'band_safe_out', keys: ['band_mgr_safe_out'], label: 'Manager safe', row: 'bra_ramp', col: 8, lock: true, owner: 'JV', sub: 'waiting · scan OUT back to band tech' },
  { id: 'band_qc', keys: ['band_qc'], label: 'QC inspect', row: 'bra', col: 9 },
  { id: 'safe_band', keys: ['into_safe_band', 'safe_await_head'], label: 'Manager safe', row: 'bra', col: 12, lock: true, owner: 'JV', sub: 'bracelet waits here for the head' },
];
const ROW_INDEX: Record<MapRow, number> = { wat: 1, wat_ramp: 2, bra: 3, bra_ramp: 4 };
const TRACK_LINES: string[][] = [['pre_approval', 'pre_queue', 'assign_wm', 'uncase', 'movement', 'parts', 'recase', 'safe_head'], ['band_pre', 'assign_band', 'band_qc', 'safe_band']];
const RAMPS: { from: string; leg: string[]; to: string }[] = [{ from: 'uncase', leg: ['safe_polish_in', 'polish_room', 'safe_polish_out'], to: 'movement' }, { from: 'assign_band', leg: ['band_safe_in', 'refinish', 'band_safe_out'], to: 'band_qc' }];

// Badge code by room / custodian: W · <watchmaker> (head lane), P · <refinisher> (polish leg), B · <band tech> (band lane), FA / T / ✓ for the shared column
export const roomCode = (d: FloorDot): string => { const s = d.station; const who = d.tech ? ` · ${d.tech}` : ''; if (s === 'final_assembly') return `FA${who}`; if (s === 'testing') return `T${who}`; if (s === 'finished') return `✓${who}`; if (s === 'polish_room' || s === 'refinish' || s.includes('polish')) return `P${who}`; if (s.startsWith('band') || s === 'into_safe_band' || s === 'safe_await_head') return `B${who}`; return `W${who}`; };
const Dot = ({ d, onOpen, focus }: { d: FloorDot; onOpen: () => void; focus?: Set<string> }) => {
  const hit = focus?.has(d.jobId); const dim = focus && !hit;
  return <button draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', `${d.jobId}|${d.key}`)} onClick={onOpen} data-testid={`floor-dot-${d.jobId}-${d.key}`} data-focus={hit ? 'true' : undefined} title={`${d.jobNumber} · ${d.label} · ${d.watchLabel}${d.tech ? ` · ${d.tech}` : ' · UNASSIGNED'}${d.itemLabel ? ` · ${d.itemLabel}` : ''}`} className={`inline-flex items-center gap-1 rounded-full border bg-[#0f131a] px-1.5 py-0.5 text-[10px] text-slate-200 hover:-translate-y-px ${dim ? 'opacity-20' : ''} ${hit ? 'ring-2 ring-accent' : ''} ${d.priority === 'urgent' ? 'border-rose-400' : d.priority === 'high' ? 'border-orange-400/70' : 'border-white/15'}`}>
    <span style={{ background: PART_COLOR[d.key] }} className="h-3 w-3 rounded-full" /><span className="font-mono">{hit ? d.estimateNumber ?? d.jobNumber : d.jobNumber.slice(-4)}</span>{hit ? <span className="rounded bg-amber-400/20 px-1 font-semibold text-amber-200">{roomCode(d)}{d.itemLabel ? ` · ${d.itemLabel}` : ''}</span> : d.tech ? <span className="text-slate-500">{d.tech}</span> : <span className="text-amber-300">?</span>}
  </button>;
};

const Node = ({ n, dots, onDrop, onOpen, onSelect, selected, focus }: { n: MapNode; dots: FloorDot[]; onDrop: (e: React.DragEvent) => void; onOpen: (d: FloorDot) => void; onSelect?: (n: MapNode) => void; selected?: boolean; focus?: Set<string> }) => {
  const [over, setOver] = useState(false); const needs = n.assign && dots.some((d) => !d.tech);
  return <div data-node={n.id} data-testid={`map-node-${n.id}`} data-lock={!!n.lock} data-needs-assign={!!needs} style={n.free ? undefined : { gridColumn: n.col, gridRow: ROW_INDEX[n.row] }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(e); }} onClick={onSelect ? (e) => { if ((e.target as HTMLElement).closest('button')) return; onSelect(n); } : undefined} data-selected={selected ? 'true' : undefined}
    className={`relative z-10 flex min-h-[92px] flex-col rounded-md border p-1.5 transition-colors ${onSelect ? 'cursor-pointer hover:border-accent/60' : ''} ${selected ? 'ring-2 ring-accent border-accent' : ''} ${over ? 'border-amber-400 bg-amber-400/10' : n.lock ? 'border-white/25 bg-black/50' : needs ? 'border-amber-400/70 bg-[#0b0e13]' : n.assign ? 'border-white/15 bg-[#0b0e13]' : 'border-white/10 bg-black/20'}`}>
    <div className="mb-1 flex items-start justify-between gap-1 text-[10px] text-slate-300"><span className="inline-flex items-center gap-1 font-semibold">{n.lock ? <Lock size={10} className="text-amber-300" /> : n.assign ? <UserPlus size={10} className={needs ? 'text-amber-300' : 'text-slate-500'} /> : null}{n.label}</span><span data-testid={`map-count-${n.id}`} className="font-mono text-slate-400">{dots.length}</span></div>
    {(n.sub || n.owner) && <div className="mb-1 text-[9px] leading-tight text-slate-500">{n.owner && <span className="text-amber-200/80">{n.owner}'s safe</span>}{n.owner && n.sub && ' · '}{n.sub}</div>}
    {needs && <div data-testid={`map-assign-cta-${n.id}`} className="mb-1 rounded-sm bg-amber-400/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">{n.label} needed</div>}
    <div className="flex flex-wrap content-start gap-1">{dots.map((d) => <Dot key={`${d.jobId}-${d.key}`} d={d} onOpen={() => onOpen(d)} focus={focus} />)}</div>
  </div>;
};

export const targetKey = (n: MapNode, dots: FloorDot[]): RwStationKey => (n.keys.length > 1 ? [...n.keys].sort((a, b) => dots.filter((d) => d.station === a).length - dots.filter((d) => d.station === b).length)[0] : n.keys[0]);
export const SHARED_NODES: MapNode[] = [{ id: 'final', keys: ['final_assembly'], label: 'Final assembly', row: 'wat', col: 13, free: true }, { id: 'testing', keys: ['testing'], label: 'Testing', row: 'wat', col: 13, free: true }, { id: 'finished', keys: ['finished'], label: 'Finished', row: 'wat', col: 13, free: true }];
const center = (r: DOMRect, host: DOMRect, side: 'l' | 'r' | 't' | 'b') => ({ x: side === 'l' ? r.left - host.left : side === 'r' ? r.right - host.left : r.left - host.left + r.width / 2, y: side === 't' ? r.top - host.top : side === 'b' ? r.bottom - host.top : r.top - host.top + r.height / 2 });
export const StationMap = ({ dots, onDrop, onOpen, onSelect, selectedId, focus }: { dots: FloorDot[]; onDrop: (to: RwStationKey, e: React.DragEvent) => void; onOpen: (d: FloorDot) => void; onSelect?: (n: MapNode) => void; selectedId?: string; focus?: Set<string> }) => {
  const host = useRef<HTMLDivElement>(null); const [paths, setPaths] = useState<{ d: string; kind: 'track' | 'ramp' | 'merge' }[]>([]); const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const draw = () => {
      const hb = el.getBoundingClientRect(); const rect = (id: string) => el.querySelector<HTMLElement>(`[data-node="${id}"]`)?.getBoundingClientRect(); const out: typeof paths = [];
      TRACK_LINES.forEach((line) => line.forEach((id, i) => { const a = rect(id); const b = rect(line[i + 1]); if (!a || !b) return; const p = center(a, hb, 'r'); const q = center(b, hb, 'l'); out.push({ kind: 'track', d: `M${p.x},${p.y} L${q.x},${q.y}` }); }));
      RAMPS.forEach((r) => { const f = rect(r.from); const t = rect(r.to); const legs = r.leg.map(rect); if (!f || !t || legs.some((x) => !x)) return; const p = center(f, hb, 'b'); const s0 = center(legs[0]!, hb, 'l'); out.push({ kind: 'ramp', d: `M${p.x},${p.y} C${p.x},${s0.y} ${p.x + 10},${s0.y} ${s0.x},${s0.y}` }); legs.forEach((lg, i) => { const nx = legs[i + 1]; if (!lg || !nx) return; const a = center(lg, hb, 'r'); const b = center(nx, hb, 'l'); out.push({ kind: 'ramp', d: `M${a.x},${a.y} L${b.x},${b.y}` }); }); const e = center(legs[legs.length - 1]!, hb, 'r'); const q = center(t, hb, 'b'); out.push({ kind: 'ramp', d: `M${e.x},${e.y} C${q.x - 10},${e.y} ${q.x},${e.y} ${q.x},${q.y}` }); });
      const fa = rect('final'); ['safe_head', 'safe_band'].forEach((id) => { const a = rect(id); if (!a || !fa) return; const p = center(a, hb, 'r'); const q = center(fa, hb, 'l'); out.push({ kind: 'merge', d: `M${p.x},${p.y} C${p.x + 30},${p.y} ${q.x - 30},${q.y} ${q.x},${q.y}` }); });
      setPaths(out); setSize({ w: el.scrollWidth, h: el.scrollHeight });
    };
    draw(); const ro = new ResizeObserver(draw); ro.observe(el); return () => ro.disconnect();
  }, [dots]);
  const at = (keys: RwStationKey[]) => dots.filter((d) => keys.includes(d.station));
  const dropTo = (n: MapNode) => (e: React.DragEvent) => onDrop(targetKey(n, dots), e);
  return <div data-testid="station-map" ref={host} className="relative rounded-md border border-white/10 bg-[#141920] p-3">
    <svg data-testid="station-map-lines" className="pointer-events-none absolute inset-0 z-0" width={size.w} height={size.h}>{paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.kind === 'ramp' ? '#f59e0b' : p.kind === 'merge' ? '#94a3b8' : '#64748b'} strokeWidth={p.kind === 'ramp' ? 2 : 1.5} strokeDasharray={p.kind === 'ramp' ? undefined : '5 5'} opacity={p.kind === 'ramp' ? 0.9 : 0.7} />)}</svg>
    <div className="relative grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: '64px repeat(11, minmax(0, 1fr)) 150px', gridTemplateRows: 'repeat(4, auto)' }}>
      <div style={{ gridColumn: 1, gridRow: 1 }} className="self-center text-[10px] font-bold uppercase tracking-widest text-blue-300" data-testid="track-label-wat">WAT</div>
      <div style={{ gridColumn: 1, gridRow: 2 }} className="self-center text-[9px] uppercase tracking-wide text-amber-300/80">polish leg</div>
      <div style={{ gridColumn: 1, gridRow: 3 }} className="self-center text-[10px] font-bold uppercase tracking-widest text-green-300" data-testid="track-label-bra">BRA</div>
      <div style={{ gridColumn: 1, gridRow: 4 }} className="self-center text-[9px] uppercase tracking-wide text-amber-300/80">polish leg</div>
      {NODES.map((n) => <Node key={n.id} n={n} dots={at(n.keys)} onDrop={dropTo(n)} onOpen={onOpen} onSelect={onSelect} selected={selectedId === n.id} focus={focus} />)}
      <div style={{ gridColumn: 13, gridRow: '1 / span 4' }} className="grid grid-rows-3 gap-2">
        {([['final', 'final_assembly', 'Final assembly'], ['testing', 'testing', 'Testing'], ['finished', 'finished', 'Finished']] as [string, RwStationKey, string][]).map(([id, k, label]) => <Node key={id} n={{ id, keys: [k], label, row: 'wat', col: 13, free: true }} dots={at([k])} onDrop={(e) => onDrop(k, e)} onOpen={onOpen} onSelect={onSelect} selected={selectedId === id} focus={focus} />)}
      </div>
    </div>
    <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-slate-400" /> track</span><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-amber-400" /> manager-gated polish off-ramp (scan IN → refinisher · scan OUT → back)</span><span className="inline-flex items-center gap-1"><Lock size={10} className="text-amber-300" /> = physically in that manager's safe</span><span className="inline-flex items-center gap-1"><UserPlus size={10} className="text-amber-300" /> needs assignment</span></div>
  </div>;
};
