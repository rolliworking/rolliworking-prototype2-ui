import * as api from '@/api/client';
import { UserPlus } from 'lucide-react';
import type { FloorDot } from '@/api/client';
import { PART_NAME, PartDot } from '@/components/rw/RwBits';
import { ComponentWaitChips } from '@/components/jobs/ComponentWaitChips';
import { useLayoutEffect, useRef, useState } from 'react';
import { NODES, SHARED_NODES, type MapNode } from '@/components/rw/StationMap';

// Destination-only map: station-style nodes + glowing safes (custody scan points), dashed track lines, orange curved off-ramps. NO job badges / counts — just clickable generic nodes.
// ONE component, parameterised by a DestConfig: the Shop Floor tracks (/rw/assign) and the vendor tracks (/concierge ASSIGN) are two configs of the same map.
export interface DestNode { id: string; keys: string[]; label: string; sub?: string; row: string; col: number; lock?: boolean; assign?: boolean; free?: boolean; owner?: string }
export interface DestRow { key: string; label: string; className: string; ramp?: boolean }
export interface DestRamp { from: string; leg: string[]; to: string }
export interface DestConfig<N extends DestNode = DestNode> {
  rows: DestRow[]; nodes: N[]; tracks: string[][]; ramps: DestRamp[]; shared?: N[]; merges?: { from: string[]; to: string }; columns: string; rowHeights?: string; sharedCol?: number;
  legend: { ramp: string; safe: string }; safeCaptions?: boolean; rampDip?: number;
}
// ---- Shop Floor config (default): WAT / polish leg / BRA + the shared Final QC → Payment → Shipping column ----
const HIDDEN = new Set(['pre_approval', 'pre_queue', 'band_pre']);
const INLINE_BAND = new Set(['band_safe_in', 'refinish', 'band_safe_out']);
const SHARED_LABELS: Record<string, string> = { final: 'Final QC / Invoicing', testing: 'Awaiting Payment', finished: 'Awaiting Shipping' };
export const SHOP_FLOOR_CONFIG: DestConfig<MapNode> = {
  rows: [{ key: 'wat', label: 'WAT', className: 'text-[10px] font-bold uppercase tracking-widest text-blue-300' }, { key: 'wat_ramp', label: 'polish leg', className: 'text-[9px] uppercase tracking-wide text-amber-300/80', ramp: true }, { key: 'bra', label: 'BRA', className: 'text-[10px] font-bold uppercase tracking-widest text-green-300' }],
  nodes: NODES.filter((n) => !HIDDEN.has(n.id)).map((n) => (INLINE_BAND.has(n.id) ? { ...n, row: 'bra' as const } : n)),
  shared: SHARED_NODES.map((n) => ({ ...n, label: SHARED_LABELS[n.id] ?? n.label })), sharedCol: 13,
  tracks: [['assign_wm', 'uncase', 'movement', 'parts', 'recase', 'safe_head'], ['assign_band', 'band_safe_in', 'refinish', 'band_safe_out', 'band_qc', 'safe_band']],
  ramps: [{ from: 'uncase', leg: ['safe_polish_in', 'polish_room', 'safe_polish_out'], to: 'movement' }],
  merges: { from: ['safe_head', 'safe_band'], to: 'final' },
  columns: '64px repeat(11, minmax(0, 1fr)) 150px',
  legend: { ramp: 'manager-gated polish off-ramp', safe: "= a manager's safe" },
};
// Layout-unit geometry (offset*, not getBoundingClientRect) so the overlay stays aligned when the map is embedded zoomed/scaled (corner widget)
interface Box { left: number; top: number; width: number; height: number }
const pt = (r: Box, side: 'l' | 'r' | 'b') => ({ x: side === 'l' ? r.left : side === 'r' ? r.left + r.width : r.left + r.width / 2, y: side === 'b' ? r.top + r.height : r.top + r.height / 2 });

// Single-job lookup is the ONLY time job data appears here: that job's own parts, nothing else
const Marks = ({ n, marks }: { n: DestNode; marks: FloorDot[] }) => marks.length ? <span data-testid={`dest-mark-${n.id}`} className="mt-1 flex flex-wrap justify-center gap-1">{marks.map((d) => <span key={d.key} data-testid={`dest-mark-${d.jobId}-${d.key}`} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/60 bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-100"><PartDot k={d.key} size={8} /> {PART_NAME[d.key]}{d.tech ? <span className="text-amber-200/70">· {d.tech}</span> : null}</span>)}{Array.from(new Set(marks.map((d) => d.jobId))).map((jid) => <ComponentWaitChips key={jid} jobId={jid} dark compact />)}</span> : null;
const Node = <N extends DestNode>({ n, rowIndex, selected, current, legal, lit, dim, caption, onSelect, marks = [] }: { n: N; rowIndex: Record<string, number>; selected: boolean; current: boolean; legal: boolean; lit: boolean; dim: boolean; caption?: boolean; onSelect: (n: N) => void; marks?: FloorDot[] }) => {
  const style = n.free ? undefined : { gridColumn: n.col, gridRow: rowIndex[n.row] };
  const state = `${current ? 'node-pulse ring-2 ring-accent ' : ''}${dim ? 'opacity-30 ' : ''}`;
  if (n.lock) return (
    // Safe = just the glowing safe image (a custody scan point), no box. Still a clickable destination.
    <button type="button" data-node={n.id} data-testid={`dest-node-${n.id}`} data-lock="true" data-legal={legal} data-current={current} aria-pressed={selected} disabled={!legal} aria-label={n.label} title={n.sub ? `${n.label} · ${n.sub}` : n.label} onClick={() => onSelect(n)} style={style}
      className={`relative z-10 flex min-h-[72px] flex-col items-center justify-center rounded-md p-1 transition-transform hover:scale-105 disabled:cursor-default disabled:hover:scale-100 ${state}${selected ? 'rounded-md bg-amber-400/15 ring-2 ring-accent' : ''}`}>
      <img src="/safe.png" alt={n.label} data-testid="safe-icon" className={`h-16 w-16 object-contain ${lit ? 'drop-shadow-[0_0_10px_rgba(92,225,255,0.65)]' : 'drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]'}`} />
      {caption && <span className="mt-0.5 text-[10px] font-semibold text-slate-200">{n.label}</span>}
      {caption && n.sub && <span className="text-[9px] leading-tight text-slate-500">{n.sub}</span>}
      <Marks n={n} marks={marks} />
      {selected && <span data-testid="dest-selected-tag" className="mt-1 rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#161b22]">destination</span>}
    </button>
  );
  const locked = n.keys.some(api.stationLockedForMe);
  return (
    <button type="button" data-node={n.id} data-testid={`dest-node-${n.id}`} data-lock="false" data-legal={legal} data-current={current} data-limited={locked} disabled={locked || !legal} title={locked ? 'Locked station for you (Access control → Limits)' : n.sub ? `${n.label} · ${n.sub}` : n.label} aria-pressed={selected} onClick={() => onSelect(n)} style={style}
      className={`relative z-10 flex min-h-[72px] flex-col items-start rounded-md border p-2 text-left transition-colors disabled:cursor-default ${locked ? 'disabled:cursor-not-allowed disabled:opacity-40' : ''} ${state}${selected ? 'border-accent bg-accent/15 ring-2 ring-accent' : lit ? 'border-accent/70 bg-[#0b0e13] shadow-[0_0_12px_rgba(92,225,255,0.35)] hover:border-accent' : legal ? 'border-white/15 bg-[#0b0e13] hover:border-accent/60' : 'border-white/15 bg-[#0b0e13]'}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">{n.assign ? <UserPlus size={11} className="text-slate-400" /> : null}{n.label}</span>
      {n.sub && <span className="mt-0.5 text-[9px] leading-tight text-slate-500">{n.sub}</span>}
      <Marks n={n} marks={marks} />
      {selected && <span data-testid="dest-selected-tag" className="mt-1 rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#161b22]">destination</span>}
    </button>
  );
};

export interface DestinationMapProps<N extends DestNode> { config?: DestConfig<N>; selectedId?: string; onSelect: (n: N) => void; focus?: FloorDot[]; legal?: Set<string>; current?: Set<string>; dimRows?: Set<string>; testId?: string; softLegal?: boolean }
// softLegal: the legal set only LIGHTS nodes (destination-first flows keep every node armable); default disables the rest
export const DestinationMap = <N extends DestNode = MapNode>({ config, selectedId, onSelect, focus = [], legal, current, dimRows, testId = 'destination-map', softLegal }: DestinationMapProps<N>) => {
  const cfg = (config ?? SHOP_FLOOR_CONFIG) as DestConfig<N>;
  const rowIndex: Record<string, number> = Object.fromEntries(cfg.rows.map((r, i) => [r.key, i + 1]));
  const marksFor = (n: DestNode) => focus.filter((d) => n.keys.includes(d.station));
  const host = useRef<HTMLDivElement>(null); const [paths, setPaths] = useState<{ d: string; ramp: boolean }[]>([]); const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const draw = () => {
      const rect = (id: string): Box | undefined => { const n = el.querySelector<HTMLElement>(`[data-node="${id}"]`); if (!n) return undefined; let left = 0, top = 0; for (let o: HTMLElement | null = n; o && o !== el; o = o.offsetParent as HTMLElement | null) { left += o.offsetLeft; top += o.offsetTop; } return { left, top, width: n.offsetWidth, height: n.offsetHeight }; }; const out: typeof paths = [];
      cfg.tracks.forEach((line) => line.forEach((id, i) => { const a = rect(id); const b = rect(line[i + 1]); if (!a || !b) return; const p = pt(a, 'r'); const q = pt(b, 'l'); out.push({ ramp: false, d: `M${p.x},${p.y} L${q.x},${q.y}` }); }));
      cfg.ramps.forEach((r) => {
        const f = rect(r.from); const t = rect(r.to); if (!f || !t) return; const p = pt(f, 'b'); const q = pt(t, 'b');
        if (!r.leg.length) { const dip = cfg.rampDip ?? 34; out.push({ ramp: true, d: `M${p.x},${p.y} C${p.x},${p.y + dip} ${q.x},${q.y + dip} ${q.x},${q.y}` }); return; } // direct return loop under the row (redo off-ramp)
        const legs = r.leg.map(rect); if (legs.some((x) => !x)) return; const s0 = pt(legs[0]!, 'l'); out.push({ ramp: true, d: `M${p.x},${p.y} C${p.x},${s0.y} ${p.x + 10},${s0.y} ${s0.x},${s0.y}` }); legs.forEach((lg, i) => { const nx = legs[i + 1]; if (!lg || !nx) return; const a = pt(lg, 'r'); const b = pt(nx, 'l'); out.push({ ramp: true, d: `M${a.x},${a.y} L${b.x},${b.y}` }); }); const e = pt(legs[legs.length - 1]!, 'r'); out.push({ ramp: true, d: `M${e.x},${e.y} C${q.x - 10},${e.y} ${q.x},${e.y} ${q.x},${q.y}` });
      });
      if (cfg.merges) { const fa = rect(cfg.merges.to); cfg.merges.from.forEach((id) => { const a = rect(id); if (!a || !fa) return; const p = pt(a, 'r'); const q = pt(fa, 'l'); out.push({ ramp: false, d: `M${p.x},${p.y} C${p.x + 30},${p.y} ${q.x - 30},${q.y} ${q.x},${q.y}` }); }); }
      setPaths(out); setSize({ w: el.scrollWidth, h: el.scrollHeight });
    };
    draw(); const ro = new ResizeObserver(draw); ro.observe(el); return () => ro.disconnect();
  }, [focus.length, cfg]);
  const isLegal = (n: DestNode) => !!softLegal || !legal || legal.has(n.id); const isCur = (n: DestNode) => !!current?.has(n.id); const isDim = (n: DestNode) => (!!legal && !legal.has(n.id) && !isCur(n)) || !!dimRows?.has(n.row);
  const node = (n: N) => <Node key={n.id} n={n} rowIndex={rowIndex} selected={selectedId === n.id} current={isCur(n)} legal={isLegal(n)} lit={!!legal && legal.has(n.id)} dim={isDim(n)} caption={cfg.safeCaptions} onSelect={onSelect} marks={marksFor(n)} />;
  return <div data-testid={testId} ref={host} className="relative rounded-md border border-white/10 bg-[#141920] p-3">
    <svg className="pointer-events-none absolute inset-0 z-0" width={size.w} height={size.h}>{paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.ramp ? '#f59e0b' : '#64748b'} strokeWidth={p.ramp ? 2 : 1.5} strokeDasharray={p.ramp ? undefined : '5 5'} opacity={0.8} />)}</svg>
    <div className="relative grid gap-x-3 gap-y-4" style={{ gridTemplateColumns: cfg.columns, gridTemplateRows: cfg.rowHeights ?? `repeat(${cfg.rows.length}, auto)` }}>
      {cfg.rows.map((r, i) => <div key={r.key} style={{ gridColumn: 1, gridRow: i + 1 }} data-testid={`dest-row-${r.key}`} className={`self-center ${r.className} ${dimRows?.has(r.key) ? 'opacity-40' : ''}`}>{r.label}</div>)}
      {cfg.nodes.map(node)}
      {cfg.shared && <div style={{ gridColumn: cfg.sharedCol ?? cfg.rows.length + 1, gridRow: `1 / span ${cfg.rows.length}` }} className="grid grid-rows-3 gap-2">{cfg.shared.map(node)}</div>}
    </div>
    <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-slate-400" /> track</span><span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-6 border-t-2 border-amber-400" /> {cfg.legend.ramp}</span><span className="inline-flex items-center gap-1"><img src="/safe.png" alt="" className="h-4 w-4 object-contain" /> {cfg.legend.safe}</span></div>
  </div>;
};
