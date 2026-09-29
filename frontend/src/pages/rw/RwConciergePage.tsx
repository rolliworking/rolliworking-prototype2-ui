import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage } from '@/api/client';
import { ActionMap } from '@/components/concierge/ActionMap';
import { CameraLookup } from '@/components/concierge/CameraLookup';
import { SlidePanel, type PanelState } from '@/components/concierge/SlidePanel';
import type { Run } from '@/components/concierge/SwoCard';
import { Toast } from '@/components/rw/pad/PadBits';

// MM's / JV's pads: the same Concierge ACTION map — horizontal scroll per track, lookup via the pad camera, slide-out as a full-width sheet. Same custody, same logs as /concierge.
export default function RwConciergePage() {
  const [lanes, setLanes] = useState<ConciergeLane[]>([]); const [panel, setPanel] = useState<PanelState>(null); const [picked, setPicked] = useState<string | null>(null); const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const load = useCallback(async () => { cz.syncConciergeAlerts(); setLanes(await api.getConciergeBoard()); }, []);
  useEffect(() => { void load(); }, [load]);
  const say = (text: string, tone: 'ok' | 'err' = 'ok') => { setToast({ text, tone }); window.setTimeout(() => setToast(null), 3500); };
  const run: Run = async (fn, m) => { try { await fn(); await load(); say(m); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const openStage = (vendorId: string, stage: SwoStage) => setPanel((p) => (p?.kind === 'stage' && p.vendorId === vendorId && p.stage === stage ? null : { kind: 'stage', vendorId, stage }));
  const total = lanes.reduce((t, l) => t + l.rows.length, 0);
  return <div data-testid="rw-concierge-page" className="space-y-3 pb-28">
    <header className="flex flex-wrap items-end gap-3"><div><h1 className="text-2xl font-semibold text-white">Vendors · action map</h1><p className="text-sm text-slate-400">{lanes.length} lanes · {total} shop work orders · look up a job (camera or scanner), tap a node, scan at commit. Nothing moves until COMMIT.</p></div></header>
    <ActionMap lanes={lanes} run={run} pad onLookup={(ids, title) => setPanel({ kind: 'lookup', swoIds: ids, title })} onOpenStage={openStage} pickedId={picked} onPickedConsumed={() => setPicked(null)} camera={(onCode) => <CameraLookup onCode={onCode} />} />
    <SlidePanel pad state={panel} lanes={lanes} run={run} onClose={() => setPanel(null)} onPick={(w) => { setPicked(w.id); setPanel(null); }} />
    {toast && <Toast text={toast.text} tone={toast.tone} />}
  </div>;
}
