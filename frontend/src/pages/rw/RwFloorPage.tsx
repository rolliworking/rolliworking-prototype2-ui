import { ArrowDownToLine, ArrowUpFromLine, Lock, MousePointerClick, ScanLine, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ComponentKey, FloorDot, GateDirection, GateScan, GateTrack, JobKind, PartHistoryView, RwStationKey, ShopFloor } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CompleteToast } from '@/components/rw/AuditPanel';
import { PART_NAME, PartDot, ScanInput } from '@/components/rw/RwBits';
import { StationMap, targetKey, type MapNode } from '@/components/rw/StationMap';
import { BulkPanel, LookupPanel } from '@/components/rw/FloorPanels';
import { fmtDate, fmtTime } from '@/lib/format';

type Tab = 'gate' | 'bulk' | 'lookup';
const stationLabel = (k?: RwStationKey) => (k ? api.RW_STATIONS.find((s) => s.key === k)?.label ?? k : '—');

// Manager gate: the custody checkpoint on both ends of the polish off-ramp. Scan IN = safe → refinisher, scan OUT = safe → back onto the track.
const GatePanel = ({ onDone }: { onDone: (m: string) => void }) => {
  const { user } = useAuth(); const [dir, setDir] = useState<GateDirection>('in'); const [track, setTrack] = useState<GateTrack | 'auto'>('auto'); const [to, setTo] = useState(api.POLISHERS[0]); const [last, setLast] = useState<GateScan | null>(null); const [err, setErr] = useState<string | null>(null);
  const manager = user?.accessTier === 'manager';
  const scan = async (label: string) => { setErr(null); const t: GateTrack = track === 'auto' ? (/^BAND-/i.test(label) ? 'band' : 'watch') : track; try { const r = await api.polishGateScan(label, dir, t, dir === 'in' ? to : undefined); setLast(r.scan); onDone(`${r.scan.jobNumber} · ${r.scan.parts.map((k) => PART_NAME[k]).join(' + ')}${r.scan.bundled ? ' (bundled)' : ''} · ${stationLabel(r.scan.from)} → ${stationLabel(r.scan.to)} · handed to ${r.scan.assignedTo}`); } catch (x) { setErr(x instanceof Error ? x.message : 'Scan failed'); throw x; } };
  return <div data-testid="gate-panel" className="grid gap-3 md:grid-cols-[1fr_320px]">
    <div className="space-y-2">
      {!manager && <div data-testid="gate-manager-only" className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"><Lock size={11} className="mr-1 inline" /> Manager gate — only a manager (currently Vienna; MM later) scans parts in or out of the safe. Signed in as {user?.shortName}.</div>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Direction</span>
        {(['in', 'out'] as GateDirection[]).map((d) => <button key={d} data-testid={`gate-dir-${d}`} aria-pressed={dir === d} onClick={() => setDir(d)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${dir === d ? 'border-amber-400 bg-amber-400 text-[#161b22]' : 'border-white/15 text-slate-200'}`}>{d === 'in' ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}{d === 'in' ? 'Scan IN → to refinisher' : 'Scan OUT → back on track'}</button>)}
        <span className="ml-2 text-slate-400">Track</span>
        <select data-testid="gate-track" value={track} onChange={(e) => setTrack(e.target.value as GateTrack | 'auto')} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1 text-slate-100"><option value="auto">auto (BAND- label = bracelet)</option><option value="watch">WATCH · case (+ bracelet when not split)</option><option value="band">BRACELET · split jobs</option></select>
        {dir === 'in' && <><span className="ml-2 text-slate-400">Hand to</span><select data-testid="gate-polisher" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1 text-slate-100">{api.POLISHERS.map((p) => <option key={p}>{p}</option>)}</select></>}
      </div>
      <ScanInput testId="gate-scan" placeholder={dir === 'in' ? 'Scan the case / band barcode in the safe · E02016 or BAND-E02031' : 'Scan the refinished part back · E02016'} onScan={scan} big />
      {err && <div data-testid="gate-error" className="rounded-md bg-rose-950/60 px-3 py-2 text-xs text-rose-200">{err}</div>}
      <p className="text-[11px] text-slate-500">Bundling rule: a job without a separate band track (no B) sends case + bracelet through this gate together. WB / WBP jobs: the bracelet has its own gated leg on the BRACELET track — scan its BAND- label.</p>
    </div>
    <div data-testid="gate-last" className="rounded-md border border-white/10 bg-[#0f131a] p-3 text-xs">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last gate scan</div>
      {last ? <><div className="font-mono text-base font-semibold text-white">{last.jobNumber}</div><div className="text-slate-300">{last.parts.map((k) => PART_NAME[k]).join(' + ')}{last.bundled && <span className="ml-1 rounded bg-amber-400/20 px-1 text-[10px] text-amber-200">bundled</span>}</div><div className="mt-1 text-slate-400">{stationLabel(last.from)} → <b className="text-slate-200">{stationLabel(last.to)}</b></div><div className="text-slate-400">handed to <b className="text-slate-200">{last.assignedTo}</b> · by {last.by} · {last.station} · {fmtTime(last.at)}</div></> : <div className="text-slate-500">Nothing scanned yet.</div>}
    </div>
  </div>;
};

export default function RwFloorPage() {
  const [m, setM] = useState<ShopFloor | null>(null); const [tech, setTech] = useState(''); const [kind, setKind] = useState<'' | JobKind>(''); const [hist, setHist] = useState<PartHistoryView | null>(null); const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null); const [done, setDone] = useState<{ label: string; by: string; token: string; transitioned: boolean } | null>(null); const [tab, setTab] = useState<Tab>('gate'); const [log, setLog] = useState<GateScan[]>([]); const [dest, setDest] = useState<MapNode | null>(null); const [focus, setFocus] = useState<Set<string> | undefined>(undefined);
  const load = useCallback(() => Promise.all([api.getShopFloor({ tech: tech || undefined, kind: kind || undefined }).then(setM), api.getGateScans().then(setLog)]).then(() => undefined), [tech, kind]);
  useEffect(() => { void load(); }, [load]);
  const say = (tone: 'ok' | 'err', text: string) => { setMsg({ tone, text }); window.setTimeout(() => setMsg(null), tone === 'ok' ? 4000 : 6000); };
  const drop = async (to: RwStationKey, e: React.DragEvent) => { const [jobId, key] = e.dataTransfer.getData('text/plain').split('|'); if (!jobId) return; try { const d = await api.movePart(jobId, key as ComponentKey, to, 'drag'); say('ok', `${d.jobNumber} · ${d.label} → ${stationLabel(to)}`); if (d.completed) setDone({ label: d.label, by: d.completed.by, token: d.completed.undoToken, transitioned: d.completed.transitioned }); await load(); if (hist && hist.job.id === jobId && hist.part.key === key) setHist(await api.getPartHistory(jobId, key as ComponentKey)); } catch (x) { say('err', x instanceof Error ? x.message : 'Move failed'); } };
  const open = async (d: FloorDot) => setHist(await api.getPartHistory(d.jobId, d.key));
  if (!m) return null;
  return <div data-testid="rw-floor-page" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-white">Shop Floor · station map</h1><p className="text-xs text-slate-400">WATCH and BRACELET tracks · the Polish Room is a manager-gated off-ramp (scan IN → refinisher · scan OUT → back on track) · every <Lock size={10} className="inline text-amber-300" /> is a manager's safe, a real custody-holding point · drag a part to move it · click a part for its history</p></div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-3 text-slate-400">{(['head', 'case', 'band'] as ComponentKey[]).map((k) => <span key={k} className="inline-flex items-center gap-1"><PartDot k={k} size={10} /> {PART_NAME[k]}</span>)}</span>
        <select data-testid="floor-filter-tech" value={tech} onChange={(e) => setTech(e.target.value)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All techs</option>{m.techs.map((t) => <option key={t}>{t}</option>)}</select>
        <select data-testid="floor-filter-kind" value={kind} onChange={(e) => setKind(e.target.value as '' | JobKind)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All job types</option><option value="service">Service</option><option value="small_job">Small job</option><option value="warranty">Warranty</option></select>
      </div>
    </div>
    <CompleteToast done={done} onUndone={() => { setDone(null); void load(); }} />
    {msg && <div data-testid="floor-message" className={`rounded-md px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-rose-950/60 text-rose-200'}`}>{msg.text}</div>}
    <StationMap dots={m.dots} onDrop={(to, e) => void drop(to, e)} onOpen={open} onSelect={tab === 'bulk' ? (n) => setDest(n) : undefined} selectedId={tab === 'bulk' ? dest?.id : undefined} focus={tab === 'lookup' ? focus : undefined} />
    {tab === 'bulk' && !dest && <div data-testid="bulk-map-hint" className="-mt-1 flex items-center gap-1.5 text-xs text-amber-200"><MousePointerClick size={12} /> Bulk assign: click a card on the map above to choose the destination.</div>}
    <section data-testid="floor-tabs" className="rounded-md border border-white/10 bg-[#1f2630] p-3">
      <nav className="mb-3 flex gap-1 border-b border-white/10">{([['gate', 'Manager gate scan', ScanLine], ['bulk', 'Bulk assign', MousePointerClick], ['lookup', 'Component lookup', Search]] as [Tab, string, typeof ScanLine][]).map(([k, l, I]) => <button key={k} data-testid={`floor-tab-${k}`} aria-current={tab === k} onClick={() => setTab(k)} className={`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium ${tab === k ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><I size={13} /> {l}</button>)}</nav>
      {tab === 'gate' && <GatePanel onDone={(t) => { say('ok', t); void load(); }} />}
      {tab === 'bulk' && <BulkPanel node={dest} target={dest ? targetKey(dest, m.dots) : undefined} onClear={() => setDest(null)} onCommitted={(t) => { say('ok', t); void load(); }} />}
      {tab === 'lookup' && <LookupPanel dots={m.dots} onOpen={open} onFocus={setFocus} />}
    </section>
    <section data-testid="gate-log" className="rounded-md border border-white/10 bg-[#1f2630] p-3">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Chain of custody · manager gate scans</h2><span className="text-[11px] text-slate-500">who scanned · what · handed to whom · when — same ledger pattern as the two-scan receive</span></div>
      <ul className="divide-y divide-white/5 text-xs">{log.map((g) => <li key={g.id} data-testid={`gate-log-${g.id}`} className="flex flex-wrap items-center gap-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${g.direction === 'in' ? 'bg-amber-400/20 text-amber-200' : 'bg-emerald-900/60 text-emerald-200'}`}>gate {g.direction}</span><span className="rounded bg-white/10 px-1.5 text-[10px] uppercase text-slate-300">{g.track}</span><Link to={`/rw/jobs/${g.jobId}`} className="font-mono font-semibold text-amber-300 hover:underline">{g.jobNumber}</Link><span className="text-slate-200">{g.parts.map((k) => PART_NAME[k]).join(' + ')}{g.bundled && ' (bundled)'}</span><span className="text-slate-400">{stationLabel(g.from)} → {stationLabel(g.to)}</span><span className="text-slate-300">→ {g.assignedTo}</span><span className="ml-auto text-slate-500">{g.by} · {g.station} · {fmtDate(g.at)} {fmtTime(g.at)}</span></li>)}{!log.length && <li className="py-3 text-center text-slate-500">No gate scans yet this session.</li>}</ul>
    </section>
    {hist && <aside data-testid="floor-history" className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-white/10 bg-[#1f2630] text-slate-100 shadow-2xl">
      <div className="flex items-start justify-between border-b border-white/10 p-4"><div><div className="flex items-center gap-2 text-base font-semibold"><PartDot k={hist.part.key} /> {PART_NAME[hist.part.key]} · <Link to={`/rw/jobs/${hist.job.id}`} className="font-mono text-amber-300 hover:underline">{hist.job.number}</Link></div><div className="text-xs text-slate-400">{hist.job.watch.brand} {hist.job.watch.model} · {hist.job.client.lastName} · custody {hist.part.custodyTech ?? '—'} · {hist.part.partStatus ?? 'derived'}</div></div><button data-testid="floor-history-close" onClick={() => setHist(null)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button></div>
      <div className="border-b border-white/10 p-3"><div className="mb-1 text-[10px] uppercase text-slate-500">Move to</div><div className="flex flex-wrap gap-1">{m.stations.filter((s) => s.lane === 'shared' || s.lane === (hist.part.key === 'band' ? 'band' : 'head')).map((s) => <button key={s.key} data-testid={`floor-history-move-${s.key}`} onClick={async () => { try { await api.movePart(hist.job.id, hist.part.key, s.key, 'drag'); say('ok', `→ ${s.label}`); await load(); setHist(await api.getPartHistory(hist.job.id, hist.part.key)); } catch (x) { say('err', x instanceof Error ? x.message : 'Move failed'); } }} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10">{api.isSafeStation(s.key) && <Lock size={9} className="text-amber-300" />}{s.label}</button>)}</div>
        {hist.job.status !== 'ready_to_ship' && <button data-testid="floor-finish-job" onClick={async () => { try { await api.finishJob(hist.job.id); say('ok', `${hist.job.number} finished`); await load(); setHist(null); } catch (x) { say('err', x instanceof Error ? x.message : 'Blocked'); } }} className="mt-2 w-full rounded-md bg-amber-400 py-1.5 text-xs font-semibold text-[#161b22]">Mark job Finished (gate-checked)</button>}</div>
      <ul className="flex-1 divide-y divide-white/5 overflow-y-auto text-xs">{hist.moves.map((mv, i) => <li key={i} data-testid={`floor-history-row-${i}`} className="px-4 py-2"><div className="flex justify-between"><span className="font-medium">{mv.to ? stationLabel(mv.to) : mv.status}</span><span className="text-slate-500">{fmtDate(mv.at)} {fmtTime(mv.at)}</span></div><div className="text-slate-400">{mv.from && `from ${stationLabel(mv.from)} · `}{mv.status} · {mv.by} · {mv.via}{mv.note && ` · ${mv.note}`}</div></li>)}{!hist.moves.length && <li className="px-4 py-6 text-center text-slate-500">No moves yet — position is derived from job status.</li>}</ul>
    </aside>}
  </div>;
}
