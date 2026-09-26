import { MapPin } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { ClientRequestAlert, FloorDot, RwStationKey } from '@/api/client';
import { ClientRequestModal } from '@/components/jobs/ClientRequests';
import { PartDot, ScanInput } from '@/components/rw/RwBits';
import { fmtTime } from '@/lib/format';

// Station-bound scanner: every label scanned moves that part here (custody + history row) — parts travel like registered mail
export default function RwStationScanPage() {
  const [station, setStation] = useState<RwStationKey | ''>(api.getStationMemory() ?? ''); const [log, setLog] = useState<(FloorDot & { at: string })[]>([]); const [alert, setAlert] = useState<ClientRequestAlert | null>(null);
  const s = api.RW_STATIONS.find((x) => x.key === station);
  return <div data-testid="rw-station-page" className="mx-auto max-w-2xl space-y-4">
    <div><h1 className="text-lg font-semibold text-white">Station Scanner</h1><p className="text-xs text-slate-400">Pick this terminal’s station (remembered), then scan labels. Each scan moves the part to this station and writes its history row.</p></div>
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{api.RW_STATIONS.filter((x) => x.key !== 'pre_approval').map((x) => <button key={x.key} data-testid={`station-pick-${x.key}`} onClick={() => setStation(x.key)} className={`min-h-[52px] rounded-xl border px-2 text-sm ${station === x.key ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-white/15 text-slate-300 hover:bg-white/5'}`}><div className="text-[10px] uppercase text-slate-500">{x.lane}</div>{x.label}</button>)}</div>
    {s ? <div data-testid="station-active" className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4"><div className="flex items-center gap-2 text-white"><MapPin size={18} className="text-amber-300" /><span className="text-2xl font-semibold">{s.label}</span><span className="text-xs text-slate-400">· {s.lane} lane</span></div>
      <ScanInput big testId="station-scan" placeholder={`Scan label → ${s.label}`} onScan={async (code) => { const d = await api.stationScan(s.key, code); setLog((l) => [{ ...d, at: new Date().toISOString() }, ...l]); setAlert(api.clientRequestAlert(d.jobId)); }} /></div> : <p className="text-sm text-slate-500">Choose a station to start scanning.</p>}
    <ul data-testid="station-log" className="divide-y divide-white/5 rounded-md border border-white/10 bg-[#1f2630] text-sm">{log.map((d, i) => <li key={i} className="flex items-center gap-3 px-4 py-2"><PartDot k={d.key} /><span className="font-mono font-semibold text-white">{d.jobNumber}</span><span className="text-slate-300">{d.label} · {d.watchLabel}</span><span className="ml-auto font-mono text-xs text-slate-500">{fmtTime(d.at)}</span></li>)}{!log.length && <li className="px-4 py-6 text-center text-slate-500">No scans yet at this terminal.</li>}</ul>
    {alert && <ClientRequestModal alert={alert} via="station_scan" onClose={() => setAlert(null)} />}
  </div>;
}
