import { MousePointerClick, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import * as api from '@/api/client';
import { DestinationMap, SHOP_FLOOR_CONFIG } from '@/components/rw/DestinationMap';
import { BulkPanel } from '@/components/rw/FloorPanels';
import { targetKey, type MapNode } from '@/components/rw/StationMap';
import type { FloorDot, JobWithRefs } from '@/api/client';

// Click a destination → scan many → Commit. No job badges on the map on purpose (50–200 live jobs would bury it); single-job location lives in Component lookup.
// `?dest=<nodeId>` (Safes vs insurance "Move…") arms that destination on arrival; `?item=<job#>` is only a hint of what to scan — custody still changes on the scan.
export default function AssignMovePage() {
  const [params] = useSearchParams(); const presetDest = params.get('dest'); const itemHint = params.get('item');
  const [dest, setDest] = useState<MapNode | null>(() => (presetDest ? SHOP_FLOOR_CONFIG.nodes.find((n) => n.id === presetDest) ?? null : null)); const [msg, setMsg] = useState<string | null>(null); const [q, setQ] = useState(''); const [job, setJob] = useState<JobWithRefs | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (presetDest) setDest(SHOP_FLOOR_CONFIG.nodes.find((n) => n.id === presetDest) ?? null); }, [presetDest]);
  const { data: floor, reload } = useAsync(() => api.getShopFloor({}));
  const focus: FloorDot[] = job ? (floor?.dots ?? []).filter((d) => d.jobId === job.id) : [];
  const lookup = async (e: React.FormEvent) => { e.preventDefault(); const s = q.trim(); if (!s) return; const j = await api.findJobByLabel(s.replace(/^BAND-/i, '')) ?? (await api.searchJobs(s)).find((x) => x.watch.reference.toUpperCase() === s.toUpperCase() || x.estimate?.number.toUpperCase() === s.toUpperCase()) ?? null; setJob(j); setErr(j ? null : `No job matches “${s}”`); };
  const clearJob = () => { setJob(null); setQ(''); setErr(null); };
  return <div data-testid="assign-move-page" className="-mx-6 -my-5 min-h-[calc(100%+2.5rem)] space-y-3 bg-[#161b22] px-6 py-5 text-slate-100">
    <div><h1 className="text-lg font-semibold text-white">Assign / Move</h1><p className="text-xs text-slate-400">Pick a destination on the map, scan the labels, press Commit. Nothing moves until you commit. Manager-gate and bundling rules apply to the polish leg exactly as on the Shop Floor board.</p></div>
    <form onSubmit={lookup} className="flex max-w-xl items-center gap-2"><div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="assign-lookup-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up ONE job · est # / ref # / barcode — shows only that job's parts on the map" className="w-full rounded-md border border-white/10 bg-[#0f131a] py-2 pl-8 pr-3 text-sm text-slate-100" /></div><button data-testid="assign-lookup-go" className="rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-[#161b22]">Find</button>{job && <button type="button" data-testid="assign-lookup-clear" onClick={clearJob} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200"><X size={13} /> Clear</button>}</form>
    {err && <div data-testid="assign-lookup-error" className="text-xs text-rose-300">{err}</div>}
    {itemHint && dest && <div data-testid="assign-move-hint" className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">From Safes vs insurance: destination <b>{dest.label}</b> is armed — scan the ticket for <b className="font-mono">{itemHint}</b> below, then Commit. Nothing moves until the scan.</div>}
    {job && <div data-testid="assign-lookup-job" className="flex flex-wrap items-center gap-2 text-xs text-slate-300"><span className="font-mono text-base font-semibold text-amber-300">{job.number}</span><span>{job.client.firstName} {job.client.lastName} · {job.watch.brand} {job.watch.model}</span><span className="rounded bg-white/10 px-1.5 text-[10px] uppercase">{job.workflow.join('')}</span><span className="text-slate-500">showing only this job's {focus.length} part{focus.length === 1 ? '' : 's'} on the map</span></div>}
    {msg && <div data-testid="assign-message" className="rounded-md bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{msg}</div>}
    <DestinationMap selectedId={dest?.id} onSelect={(n) => setDest((d) => (d?.id === n.id ? null : n))} focus={focus} />
    {!dest && <div data-testid="assign-hint" className="flex items-center gap-1.5 text-xs text-amber-200"><MousePointerClick size={12} /> Click a station or safe above to choose the destination.</div>}
    <section className="rounded-md border border-white/10 bg-[#1f2630] p-3">
      <BulkPanel node={dest} target={dest ? targetKey(dest, floor?.dots ?? []) : undefined} onClear={() => setDest(null)} onCommitted={(t) => { setMsg(t); void reload(); window.setTimeout(() => setMsg(null), 5000); }} showHandout={false} />
    </section>
  </div>;
}
