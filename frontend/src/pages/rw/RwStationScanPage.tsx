import { ClipboardCheck, MapPin, MoveRight } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import * as off from '@/api/offline';
import type { ClientRequestAlert, FloorDot, RwStationKey } from '@/api/client';
import { ClientRequestModal } from '@/components/jobs/ClientRequests';
import { AuditPanel, CompleteToast } from '@/components/rw/AuditPanel';
import { PartDot, ScanInput } from '@/components/rw/RwBits';
import { fmtTime } from '@/lib/format';

type Mode = 'move' | 'audit';
type Done = { label: string; by: string; token: string; transitioned: boolean } | null;

// Station-bound scanner: Move mode = every label scanned moves that part here (custody + history row); Audit mode = reconcile a location against belief
export default function RwStationScanPage() {
  const [mode, setMode] = useState<Mode>(api.getAuditLive() ? 'audit' : 'move');
  const [station, setStation] = useState<RwStationKey | ''>(api.getStationMemory() ?? ''); const [log, setLog] = useState<(FloorDot & { at: string })[]>([]); const [alert, setAlert] = useState<ClientRequestAlert | null>(null); const [done, setDone] = useState<Done>(null); const [queuedMsg, setQueuedMsg] = useState<string | null>(null);
  const s = api.RW_STATIONS.find((x) => x.key === station);
  return <div data-testid="rw-station-page" className="mx-auto max-w-2xl space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-white">{mode === 'move' ? 'Station Scanner' : 'Stage / Bin Audit'}</h1><p className="text-xs text-slate-400">{mode === 'move' ? 'Pick this terminal’s station (remembered), then scan labels. Each scan moves the part here and writes its history row. Scanning into an await-safe also completes the component.' : 'Pick a location, see what the system believes is there, scan everything physically present. Live reconciliation; Finish writes an append-only session.'}</p></div>
      <div data-testid="station-mode" className="inline-flex rounded-full border border-white/15 p-0.5 text-xs">
        <button data-testid="station-mode-move" onClick={() => setMode('move')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium ${mode === 'move' ? 'bg-accent text-[#161b22]' : 'text-slate-300 hover:bg-white/10'}`}><MoveRight size={13} /> Move</button>
        <button data-testid="station-mode-audit" onClick={() => setMode('audit')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium ${mode === 'audit' ? 'bg-accent text-[#161b22]' : 'text-slate-300 hover:bg-white/10'}`}><ClipboardCheck size={13} /> Audit</button>
      </div>
    </div>
    {mode === 'audit' ? <AuditPanel /> : <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{api.RW_STATIONS.filter((x) => x.key !== 'pre_approval').map((x) => <button key={x.key} data-testid={`station-pick-${x.key}`} onClick={() => setStation(x.key)} className={`min-h-[52px] rounded-xl border px-2 text-sm ${station === x.key ? 'border-accent bg-accent/15 text-white' : 'border-white/15 text-slate-300 hover:bg-white/5'}`}><div className="text-[10px] uppercase text-slate-500">{x.lane}</div>{x.label}</button>)}</div>
      {s ? <div data-testid="station-active" className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4"><div className="flex items-center gap-2 text-white"><MapPin size={18} className="text-amber-300" /><span className="text-2xl font-semibold">{s.label}</span><span className="text-xs text-slate-400">· {s.lane} lane{s.key.startsWith('safe_await') && ' · scan = complete'}</span></div>
        <ScanInput big testId="station-scan" placeholder={`Scan label → ${s.label}`} onScan={async (code) => { if (off.isOffline()) { off.enqueueScan({ kind: 'station', station: s.key, code }); setQueuedMsg(`Offline — ${code} queued for ${s.label}; it applies on replay, not now`); return; } const d = await api.stationScan(s.key, code); setLog((l) => [{ ...d, at: new Date().toISOString() }, ...l]); setAlert(api.clientRequestAlert(d.jobId)); setDone(d.completed ? { label: d.label, by: d.completed.by, token: d.completed.undoToken, transitioned: d.completed.transitioned } : null); }} /></div> : <p className="text-sm text-slate-500">Choose a station to start scanning.</p>}
      {queuedMsg && <div data-testid="station-queued" className="rounded-2xl border border-amber-400/40 bg-amber-950/50 px-4 py-2 text-sm text-amber-100">{queuedMsg}</div>}
      <ul data-testid="station-log" className="divide-y divide-white/5 rounded-md border border-white/10 bg-[#1f2630] text-sm">{log.map((d, i) => <li key={i} className="flex items-center gap-3 px-4 py-2"><PartDot k={d.key} /><span className="font-mono font-semibold text-white">{d.jobNumber}</span><span className="text-slate-300">{d.label} · {d.watchLabel}</span>{d.completed && <span data-testid={`station-log-complete-${i}`} className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">COMPLETE · {d.completed.by}</span>}<span className="ml-auto font-mono text-xs text-slate-500">{fmtTime(d.at)}</span></li>)}{!log.length && <li className="px-4 py-6 text-center text-slate-500">No scans yet at this terminal.</li>}</ul>
      <CompleteToast done={done} onUndone={() => { setDone(null); setLog((l) => l.map((r, i) => (i === 0 ? { ...r, completed: undefined, label: `${r.label} (undone)` } : r))); }} />
    </>}
    {alert && <ClientRequestModal alert={alert} via="station_scan" onClose={() => setAlert(null)} />}
  </div>;
}
