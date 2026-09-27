import { Lock, UserPlus } from 'lucide-react';
import type { FloorDot } from '@/api/client';
import { PART_NAME, PartDot } from '@/components/rw/RwBits';
import { useLayoutEffect, useRef, useState } from 'react';
import { NODES, SHARED_NODES, type MapNode } from '@/components/rw/StationMap';

// Destination-only map: same station structure as the Shop Floor board, but NO job badges / counts — just clickable generic nodes.
const ROW: Record<MapNode['row'], number> = { wat: 1, wat_ramp: 2, bra: 3, bra_ramp: 4 };
// Pre-approval / Pre-queue are not scan-to destinations — dropped from this map entirely
const HIDDEN = new Set(['pre_approval', 'pre_queue', 'band_pre']);
const DEST_NODES = NODES.filter((n) => !HIDDEN.has(n.id));
const TRACKS = [['assign_wm', 'uncase', 'movement', 'parts', 'recase', 'safe_head'], ['assign_band', 'band_qc', 'safe_band']];
const RAMPS = [{ from: 'uncase', leg: ['safe_polish_in', 'polish_room', 'safe_polish_out'], to: 'movement' }, { from: 'assign_band', leg: ['band_safe_in', 'refinish', 'band_safe_out'], to: 'band_qc' }];
// Layout-unit geometry (offset*, not getBoundingClientRect) so the overlay stays aligned when the map is embedded zoomed/scaled (corner widget)
interface Box { left: number; top: number; width: number; height: number }
const pt = (r: Box, side: 'l' | 'r' | 'b') => ({ x: side === 'l' ? r.left : side === 'r' ? r.left + r.width : r.left + r.width / 2, y: side === 'b' ? r.top + r.height : r.top + r.height / 2 });

// Single-job lookup is the ONLY time job data appears here: that job's own parts, nothing else
const Node = ({ n, selected, onSelect, marks = [] }: { n: MapNode; selected: boolean; onSelect: (n: MapNode) => void; marks?: FloorDot[] }) => (
  <button type="button" data-node={n.id} data-testid={`dest-node-${n.id}`} data-lock={!!n.lock} aria-pressed={selected} onClick={() => onSelect(n)} style={n.free ? undefined : { gridColumn: n.col, gridRow: ROW[n.row] }}
    className={`relative z-10 flex min-h-[72px] flex-col items-start rounded-md border p-2 text-left transition-colors ${selected ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400' : n.lock ? 'border-white/25 bg-black/50 hover:border-amber-300/60' : 'border-white/15 bg-[#0b0e13] hover:border-amber-300/60'}`}>
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-200">{n.lock ? <Lock size={11} className="text-amber-300" /> : n.assign ? <UserPlus size={11} className="text-slate-400" /> : null}{n.label}</span>
    {n.sub && <span className="mt-0.5 text-[9px] leading-tight text-slate-500">{n.sub}</span>}
    {marks.length > 0 && <span data-testid={`dest-mark-${n.id}`} className="mt-1 flex flex-wrap gap-1">{marks.map((d) => <span key={d.key} data-testid={`dest-mark-${d.jobId}-${d.key}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/60 bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-100"><PartDot k={d.key} size={8} /> {PART_NAME[d.key]}{d.tech ? <span className="text-amber-200/70">· {d.tech}</span> : null}</span>)}</span>}
    {selected && <span data-testid="dest-selected-tag" className="mt-1 rounded-sm bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#161b22]">destination</span>}
  </button>
);

export const DestinationMap = ({ selectedId, onSelect, focus = [] }: { selectedId?: string; onSelect: (n: MapNode) => void; focus?: FloorDot[] }) => {
  const marksFor = (n: MapNode) => focus.filter((d) => n.keys.includes(d.station));
  const host = useRef<HTMLDivElement>(null); const [paths, setPaths] = useState<{ d: string; ramp: boolean }[]>([]); const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const draw = () => {
      const rect = (id: string): Box | undefined => { const n = el.querySelector<HTMLElement>(`[data-node="${id}"]`); if (!n) return undefined; let left = 0, top = 0; for (let o: HTMLElement | null = n; o && o !== el; o = o.offsetParent as HTMLElement | null) { left += o.offsetLeft; top += o.offsetTop; } return { left, top, width: n.offsetWidth, height: n.offsetHeight }; }; const out: typeof paths = [];
      TRACKS.forEach((line) => line.forEach((id, i) => { const a = rect(id); const b = rect(line[i + 1]); if (!a || !b) return; const p = pt(a, 'r'); const q = pt(b, 'l'); out.push({ ramp: false, d: `M${p.x},${p.y} L${q.x},${q.y}` }); }));
      RAMPS.forEach((r) => { const f = rect(r.from); const t = rect(r.to); const legs = r.leg.map(rect); if (!f || !t || legs.some((x) => !x)) return; const p = pt(f, 'b'); const s0 = pt(legs[0]!, 'l'); out.push({ ramp: true, d: `M${p.x},${p.y} C${p.x},${s0.y} ${p.x + 10},${s0.y} ${s0.x},${s0.y}` }); legs.forEach((lg, i) => { const nx = legs[i + 1]; if (!lg || !nx) return; const a = pt(lg, 'r'); const b = pt(nx, 'l'); out.push({ ramp: true, d: `M${a.x},${a.y} L${b.x},${b.y}` }); }); const e = pt(legs[legs.length - 1]!, 'r'); const q = pt(t, 'b'); out.push({ ramp: true, d: `M${e.x},${e.y} C${q.x - 10},${e.y} ${q.x},${e.y} ${q.x},${q.y}` }); });
      const fa = rect('final'); ['safe_head', 'safe_band'].forEach((id) => { const a = rect(id); if (!a || !fa) return; const p = pt(a, 'r'); const q = pt(fa, 'l'); out.push({ ramp: false, d: `M${p.x},${p.y} C${p.x + 30},${p.y} ${q.x - 30},${q.y} ${q.x},${q.y}` }); });
      setPaths(out); setSize({ w: el.scrollWidth, h: el.scrollHeight });
    };
    draw(); const ro = new ResizeObserver(draw); ro.observe(el); return () => ro.disconnect();
  }, [focus.length]);
  return <div data-testid="destination-map" ref={host} className="relative rounded-md border border-white/10 bg-[#141920] p-3">
    <svg className="pointer-events-none absolute inset-0 z-0" width={size.w} height={size.h}>{paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.ramp ? '#f59e0b' : '#64748b'} strokeWidth={p.ramp ? 2 : 1.5} strokeDasharray={p.ramp ? undefined : '5 5'} opacity={0.8} />)}</svg>
    <div className="relative grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: '64px repeat(11, minmax(0, 1fr)) 150px', gridTemplateRows: 'repeat(4, auto)' }}>
      <div style={{ gridColumn: 1, gridRow: 1 }} className="self-center text-[10px] font-bold uppercase tracking-widest text-blue-300">WAT</div>
      <div style={{ gridColumn: 1, gridRow: 2 }} className="self-center text-[9px] uppercase tracking-wide text-amber-300/80">polish leg</div>
      <div style={{ gridColumn: 1, gridRow: 3 }} className="self-center text-[10px] font-bold uppercase tracking-widest text-green-300">BRA</div>
      <div style={{ gridColumn: 1, gridRow: 4 }} className="self-center text-[9px] uppercase tracking-wide text-amber-300/80">polish leg</div>
      {DEST_NODES.map((n) => <Node key={n.id} n={n} selected={selectedId === n.id} onSelect={onSelect} marks={marksFor(n)} />)}
      <div style={{ gridColumn: 13, gridRow: '1 / span 4' }} className="grid grid-rows-3 gap-2">{SHARED_NODES.map((n) => <Node key={n.id} n={n} selected={selectedId === n.id} onSelect={onSelect} marks={marksFor(n)} />)}</div>
    </div>
    <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-slate-400" /> track</span><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-amber-400" /> manager-gated polish off-ramp</span><span className="inline-flex items-center gap-1"><Lock size={10} className="text-amber-300" /> = a manager's safe</span></div>
  </div>;
};
