import { MousePointerClick } from 'lucide-react';
import { useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import * as api from '@/api/client';
import { DestinationMap } from '@/components/rw/DestinationMap';
import { BulkPanel } from '@/components/rw/FloorPanels';
import { targetKey, type MapNode } from '@/components/rw/StationMap';

// Click a destination → scan many → Commit. No job badges on the map on purpose (50–200 live jobs would bury it); single-job location lives in Component lookup.
export default function AssignMovePage() {
  const [dest, setDest] = useState<MapNode | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const { data: floor, reload } = useAsync(() => api.getShopFloor({}));
  return <div data-testid="assign-move-page" className="-mx-6 -my-5 min-h-[calc(100%+2.5rem)] space-y-3 bg-[#161b22] px-6 py-5 text-slate-100">
    <div><h1 className="text-lg font-semibold text-white">Assign / Move</h1><p className="text-xs text-slate-400">Pick a destination on the map, scan the labels, press Commit. Nothing moves until you commit. Manager-gate and bundling rules apply to the polish leg exactly as on the Shop Floor board.</p></div>
    {msg && <div data-testid="assign-message" className="rounded-md bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{msg}</div>}
    <DestinationMap selectedId={dest?.id} onSelect={(n) => setDest((d) => (d?.id === n.id ? null : n))} />
    {!dest && <div data-testid="assign-hint" className="flex items-center gap-1.5 text-xs text-amber-200"><MousePointerClick size={12} /> Click a station or safe above to choose the destination.</div>}
    <section className="rounded-md border border-white/10 bg-[#1f2630] p-3">
      <BulkPanel node={dest} target={dest ? targetKey(dest, floor?.dots ?? []) : undefined} onClear={() => setDest(null)} onCommitted={(t) => { setMsg(t); void reload(); window.setTimeout(() => setMsg(null), 5000); }} showHandout={false} />
    </section>
  </div>;
}
