import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import * as cz from '@/api/concierge';
import type { ConciergeLane, SwoStage } from '@/api/client';
import { ActionMap } from '@/components/concierge/ActionMap';
import { LaneBoard } from '@/components/concierge/LaneBoard';
import { LayoutList, MousePointerClick } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { VIEWS, readView } from '@/pages/rs/ConciergePage';
import { CameraLookup } from '@/components/concierge/CameraLookup';
import { SlidePanel, type PanelState } from '@/components/concierge/SlidePanel';
import type { Run } from '@/components/concierge/SwoCard';
import { Toast } from '@/components/rw/pad/PadBits';

// MM's / JV's pads: the same Concierge split under the Vendors tab — TRACK (progress) | ASSIGN (Assign / Move) — horizontal scroll per track, camera lookup, slide-out as a full-width sheet. Same custody, same logs as /concierge.
export default function RwConciergePage() {
  const { user } = useAuth(); const viewKey = `rollisuite.concierge.view.${user?.id ?? 'anon'}`;
  const [view, setViewState] = useState(() => readView(user?.id)); const setView = (v: typeof view) => { setViewState(v); localStorage.setItem(viewKey, v); };
  const [lanes, setLanes] = useState<ConciergeLane[]>([]); const [panel, setPanel] = useState<PanelState>(null); const [picked, setPicked] = useState<string | null>(null); const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const load = useCallback(async () => { cz.syncConciergeAlerts(); setLanes(await api.getConciergeBoard()); }, []);
  useEffect(() => { void load(); }, [load]);
  const say = (text: string, tone: 'ok' | 'err' = 'ok') => { setToast({ text, tone }); window.setTimeout(() => setToast(null), 3500); };
  const run: Run = async (fn, m) => { try { await fn(); await load(); say(m); } catch (e) { say(e instanceof Error ? e.message : 'Failed', 'err'); } };
  const openStage = (vendorId: string, stage: SwoStage) => setPanel((p) => (p?.kind === 'stage' && p.vendorId === vendorId && p.stage === stage ? null : { kind: 'stage', vendorId, stage }));
  const total = lanes.reduce((t, l) => t + l.rows.length, 0);
  return <div data-testid="rw-concierge-page" className="space-y-3 pb-28">
    <header className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h1 className="text-2xl font-semibold text-white">Vendors</h1><p className="text-sm text-slate-400">{lanes.length} lanes · {total} shop work orders · {VIEWS.find((v) => v.key === view)!.hint}</p></div>
      <div data-testid="concierge-view-toggle" className="inline-flex rounded-md border border-white/15 text-sm">{VIEWS.map((v) => <button key={v.key} type="button" data-testid={`concierge-view-${v.key}`} data-selected={view === v.key} onClick={() => setView(v.key)} className={`inline-flex min-h-[44px] items-center gap-1.5 px-4 font-semibold uppercase tracking-wide ${view === v.key ? 'bg-accent text-[#161b22]' : 'text-slate-300 hover:bg-white/10'}`}>{v.key === 'track' ? <LayoutList size={14} /> : <MousePointerClick size={14} />}{v.label}</button>)}</div></header>
    <div className={view === 'track' ? '' : 'hidden'}><LaneBoard pad lanes={lanes} onOpenStage={openStage} onOutstanding={(vendorId) => setPanel((p) => (p?.kind === 'outstanding' && p.vendorId === vendorId ? null : { kind: 'outstanding', vendorId }))} selected={panel?.kind === 'stage' ? { vendorId: panel.vendorId, stage: panel.stage } : null} /></div>
    <div className={view === 'assign' ? '' : 'hidden'}><ActionMap lanes={lanes} run={run} pad active={view === 'assign'} onLookup={(ids, title) => setPanel({ kind: 'lookup', swoIds: ids, title })} pickedId={picked} onPickedConsumed={() => setPicked(null)} camera={(onCode) => <CameraLookup onCode={onCode} />} /></div>
    <SlidePanel pad state={panel} lanes={lanes} run={run} onClose={() => setPanel(null)} onPick={view === 'track' ? (w) => { setPicked(w.id); setPanel(null); setView('assign'); } : undefined} />
    {toast && <Toast text={toast.text} tone={toast.tone} />}
  </div>;
}
