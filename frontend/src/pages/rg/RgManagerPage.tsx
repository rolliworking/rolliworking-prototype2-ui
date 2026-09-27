import { ChevronLeft, ChevronRight, Copy, Download, LocateFixed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { Division, Punch, PunchKind, RgFlagRow, RgSettings, User, WeekView } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';
import { FlagChips, PinPad } from './RgBits';
import { useRg } from './RgShell';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Div = Division | 'all';
const DIVS: { key: Div; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'rolliworks', label: 'Rolliworks' }, { key: 'rollishop', label: 'RolliShop' }];
const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const field = 'rounded-md border border-line bg-surface px-2 py-1.5 text-xs';

// Manager view (concierge+, Q56): everyone's grid · flags · append-only corrections · payroll CSV · geofence + stations
export default function RgManagerPage() {
  const { user } = useRg();
  const [mgr, setMgr] = useState<User | null>(null);
  return <div data-testid="rg-manager-page" className="space-y-3">{mgr ? <ManagerView mgr={mgr} /> : <ManagerGate preselect={user} onVerified={setMgr} />}</div>;
}

function ManagerGate({ preselect, onVerified }: { preselect: User; onVerified: (u: User) => void }) {
  const staff = api.rgAllStaff().filter((u) => u.accessTier === 'manager' || u.accessTier === 'concierge');
  const [userId, setUserId] = useState(staff.some((u) => u.id === preselect.id) ? preselect.id : ''); const [err, setErr] = useState<string | null>(null);
  const go = useCallback((secret: string) => api.rgVerifyManager(userId, secret.trim()).then(onVerified).catch((x) => setErr(x.message)), [userId, onVerified]);
  return <div data-testid="rg-manager-gate" className="space-y-3 rounded-lg border border-line bg-surface p-4">
    <h1 className="text-base font-semibold text-ink">Manager view</h1>
    <p className="text-xs text-ink-500">Card + PIN, concierge tier and up — even on a remembered phone.</p>
    <div className="grid grid-cols-2 gap-2">{staff.map((u) => <button key={u.id} data-testid={`rg-mgr-card-${u.id}`} onClick={() => setUserId(u.id)} className={`rounded-md border p-2 text-left text-xs ${userId === u.id ? 'border-ink bg-canvas' : 'border-line hover:bg-canvas'}`}><div className="font-semibold">{u.shortName}</div><div className="text-ink-500">{u.dutyLabel}</div></button>)}</div>
    {userId && <PinPad testId="rg-mgr-password" onSubmit={go} error={err} />}
  </div>;
}

function ManagerView({ mgr }: { mgr: User }) {
  const [tab, setTab] = useState<'week' | 'flags' | 'export' | 'settings'>('week'); const [division, setDivision] = useState<Div>('all'); const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5 text-xs">{(['week', 'flags', 'export', 'settings'] as const).map((t) => <button key={t} data-testid={`rg-mgr-tab-${t}`} onClick={() => setTab(t)} className={`rounded px-2 py-1 capitalize ${tab === t ? 'bg-ink text-white' : 'text-ink-600 hover:bg-canvas'}`}>{t}</button>)}</div>
      <select data-testid="rg-week-division" value={division} onChange={(e) => setDivision(e.target.value as Div)} className={field}>{DIVS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>
    </div>
    {tab === 'week' && <WeekGrid mgr={mgr} division={division} tick={tick} onChange={bump} />}
    {tab === 'flags' && <Flags mgr={mgr} division={division} tick={tick} onChange={bump} />}
    {tab === 'export' && <Export division={division} />}
    {tab === 'settings' && <Settings mgr={mgr} />}
  </div>;
}

function WeekGrid({ mgr, division, tick, onChange }: { mgr: User; division: Div; tick: number; onChange: () => void }) {
  const [offset, setOffset] = useState(0); const [view, setView] = useState<WeekView | null>(null); const [openDay, setOpenDay] = useState<string | null>(null);
  useEffect(() => { api.getWeekHours(division, offset).then(setView); }, [division, offset, tick]);
  const detail = view && openDay ? view.rows.flatMap((r) => r.days.filter((d) => `${r.user.id}:${d.date}` === openDay).map((d) => ({ r, d })))[0] : undefined;
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1"><button data-testid="rg-week-prev" onClick={() => setOffset((o) => o - 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas"><ChevronLeft size={14} /></button><button data-testid="rg-week-next" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="rounded-md border border-line p-1.5 hover:bg-canvas disabled:opacity-40"><ChevronRight size={14} /></button></div>
      <div data-testid="rg-week-range" className="text-xs font-semibold text-ink">{view ? `${fmtDate(view.start)} – ${fmtDate(view.end)}${offset === 0 ? ' · this week' : offset === -1 ? ' · last week' : ''}` : '…'}</div>
    </div>
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table data-testid="rg-week-grid" className="w-full text-[11px]">
        <thead><tr className="border-b border-line text-left text-ink-500"><th className="px-2 py-1.5 font-medium">Staff</th>{DOW.map((d) => <th key={d} className="px-1 py-1.5 text-center font-medium">{d}</th>)}<th className="px-2 py-1.5 text-right font-medium">Week</th></tr></thead>
        <tbody className="divide-y divide-line/70">{view?.rows.map((r) => <tr key={r.user.id} data-testid={`rg-week-row-${r.user.id}`}>
          <td className="px-2 py-1.5 font-semibold text-ink">{r.user.shortName}{r.openNow && <span data-testid={`rg-week-open-${r.user.id}`} className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-moss align-middle" title="on the clock now" />}</td>
          {r.days.map((d) => <td key={d.date} className="px-1 py-1.5 text-center"><button data-testid={`rg-week-cell-${r.user.id}-${d.date}`} onClick={() => setOpenDay(openDay === `${r.user.id}:${d.date}` ? null : `${r.user.id}:${d.date}`)} className={`relative min-w-[30px] rounded px-1 py-0.5 font-mono ${d.hours ? 'text-ink hover:bg-canvas' : 'text-ink-300'} ${d.open ? 'bg-amber-50 text-amber-800' : ''}`} title={d.open ? 'open punch — no clock-out yet' : undefined}>{d.hours ? d.hours.toFixed(1) : d.open ? 'open' : '·'}{d.flagged && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-500" />}</button></td>)}
          <td data-testid={`rg-week-total-${r.user.id}`} className="px-2 py-1.5 text-right font-mono font-semibold text-ink">{r.total.toFixed(1)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-[10px] text-ink-400">Amber = open punch (still clocked in, or forgot to clock out). Purple dot = flagged or corrected punch. Tap a day to see or correct punches.</p>
    {detail && <DayDetail mgr={mgr} user={detail.r.user} date={detail.d.date} punches={detail.d.punches} hours={detail.d.hours} open={detail.d.open} onChange={onChange} />}
  </div>;
}

function DayDetail({ mgr, user, date, punches, hours, open, onChange }: { mgr: User; user: User; date: string; punches: Punch[]; hours: number; open: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState<Punch | null>(null); const [adding, setAdding] = useState(false); const [err, setErr] = useState<string | null>(null);
  const stations = api.getNfcTags().filter((t) => user.division === 'both' || t.division === user.division);
  return <div data-testid="rg-day-detail" className="rounded-lg border border-line bg-surface">
    <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs"><span className="font-semibold text-ink">{user.shortName} · {fmtDate(`${date}T12:00:00`)}</span><span className="text-ink-500">{hours.toFixed(2)} h{open ? ' · open' : ''}</span></div>
    <ul className="divide-y divide-line/70 text-xs">{punches.map((p) => <li key={p.id} data-testid={`rg-detail-punch-${p.id}`} className="space-y-1 px-3 py-1.5">
      <div className="flex items-center gap-2"><span className={`w-8 font-semibold uppercase ${p.kind === 'in' ? 'text-moss-700' : 'text-ink-500'}`}>{p.kind}</span><span className="flex-1 text-ink-500">{p.location}</span><FlagChips punch={p} /><span className="font-mono">{fmtTime(p.at)}</span>{!p.queued && <button data-testid={`rg-correct-${p.id}`} onClick={() => { setEditing(editing?.id === p.id ? null : p); setAdding(false); setErr(null); }} className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] hover:bg-canvas">Correct</button>}</div>
      {p.correctionOf && <div data-testid={`rg-correction-note-${p.id}`} className="text-[10px] text-violet-800">Correction by {p.by} · {p.reason} · original {fmtTime(api.rgAllPunches().find((x) => x.id === p.correctionOf)?.at ?? p.at)} kept (superseded)</div>}
      {p.flags?.includes('correction') && !p.correctionOf && <div className="text-[10px] text-violet-800">Added by {p.by} · {p.reason}</div>}
      {p.flags?.includes('offsite') && p.geo && <div className="text-[10px] text-amber-800">{(p.geo.distanceM / 1000).toFixed(1)} km from the shop</div>}
      {p.flags?.includes('synced_late') && p.recordedAt && <div className="text-[10px] text-sky-800">Reached the server {fmtTime(p.recordedAt)} (punched {fmtTime(p.at)})</div>}
    </li>)}{!punches.length && <li className="px-3 py-3 text-center text-ink-400">No punches</li>}</ul>
    <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
      <Button size="sm" data-testid="rg-add-punch" onClick={() => { setAdding(!adding); setEditing(null); setErr(null); }}>{open ? 'Add missing clock-out' : '+ Add punch'}</Button>
      <span className="text-[10px] text-ink-400">Originals are never edited — corrections are new rows.</span>
    </div>
    {editing && <CorrectionForm key={editing.id} title={`Correct ${editing.kind.toUpperCase()} ${fmtTime(editing.at)}`} at={toLocalInput(editing.at)} kind={editing.kind} error={err} onSubmit={(at, kind, reason) => api.rgCorrectPunch(editing.id, { at: new Date(at).toISOString(), kind }, reason, mgr.shortName).then(() => { setEditing(null); onChange(); }).catch((e) => setErr(e.message))} onCancel={() => setEditing(null)} />}
    {adding && <CorrectionForm title={open ? 'Add the missing clock-out' : 'Add a punch'} at={`${date}T${open ? '17:30' : '09:00'}`} kind={open ? 'out' : 'in'} stations={stations} error={err} onSubmit={(at, kind, reason, stationId) => api.rgAddPunch(user.id, kind, new Date(at).toISOString(), stationId ?? stations[0].id, reason, mgr.shortName).then(() => { setAdding(false); onChange(); }).catch((e) => setErr(e.message))} onCancel={() => setAdding(false)} />}
  </div>;
}

function CorrectionForm({ title, at, kind, stations, error, onSubmit, onCancel }: { title: string; at: string; kind: PunchKind; stations?: { id: string; label: string }[]; error: string | null; onSubmit: (at: string, kind: PunchKind, reason: string, stationId?: string) => void; onCancel: () => void }) {
  const [a, setA] = useState(at); const [k, setK] = useState<PunchKind>(kind); const [reason, setReason] = useState(''); const [st, setSt] = useState(stations?.[0]?.id);
  return <form data-testid="rg-correction-form" className="space-y-2 border-t border-line bg-canvas/60 px-3 py-2 text-xs" onSubmit={(e) => { e.preventDefault(); onSubmit(a, k, reason, st); }}>
    <div className="font-semibold text-ink">{title}</div>
    <div className="flex flex-wrap gap-2">
      <input data-testid="rg-corr-at" type="datetime-local" value={a} onChange={(e) => setA(e.target.value)} className={field} />
      <select data-testid="rg-corr-kind" value={k} onChange={(e) => setK(e.target.value as PunchKind)} className={field}><option value="in">IN</option><option value="out">OUT</option></select>
      {stations && <select data-testid="rg-corr-station" value={st} onChange={(e) => setSt(e.target.value)} className={field}>{stations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>}
    </div>
    <input data-testid="rg-corr-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required) — e.g. forgot to clock out, stayed for pickup" className={`${field} w-full`} />
    {error && <p data-testid="rg-corr-error" className="text-rose-700">{error}</p>}
    <div className="flex justify-end gap-2"><Button size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" variant="primary" data-testid="rg-corr-save" type="submit">Save correction</Button></div>
  </form>;
}

const FLAG_TITLE: Record<RgFlagRow['kind'], string> = { offsite: 'Offsite punch', synced_late: 'Synced late', missed_out: 'Missed clock-out', correction: 'Correction', no_gps: 'No GPS' };
function Flags({ mgr, division, tick, onChange }: { mgr: User; division: Div; tick: number; onChange: () => void }) {
  const [rows, setRows] = useState<RgFlagRow[]>([]); const [resolving, setResolving] = useState<RgFlagRow | null>(null); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.rgGetFlags(division).then(setRows); }, [division, tick]);
  return <div data-testid="rg-flags" className="rounded-lg border border-line bg-surface">
    <div className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">Needs a look · {rows.length}</div>
    <ul className="divide-y divide-line/70 text-xs">{rows.map((r) => <li key={`${r.kind}-${r.punch.id}`} data-testid={`rg-flag-row-${r.kind}-${r.punch.id}`} className="space-y-1 px-3 py-2">
      <div className="flex items-center gap-2"><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${r.kind === 'offsite' || r.kind === 'missed_out' ? 'bg-amber-100 text-amber-800' : r.kind === 'correction' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>{FLAG_TITLE[r.kind]}</span><span className="font-semibold text-ink">{r.user.shortName}</span><span className="flex-1 text-ink-500">{r.punch.kind.toUpperCase()} · {r.punch.location}</span><span className="font-mono">{fmtDate(r.punch.at)} {fmtTime(r.punch.at)}</span></div>
      {r.kind === 'offsite' && r.punch.geo && <div className="text-[10px] text-amber-800">{(r.punch.geo.distanceM / 1000).toFixed(1)} km from the shop — accepted, flagged</div>}
      {r.kind === 'synced_late' && r.punch.recordedAt && <div className="text-[10px] text-sky-800">Queued on the phone, reached the server {fmtTime(r.punch.recordedAt)}</div>}
      {r.kind === 'correction' && <div className="text-[10px] text-violet-800">by {r.punch.by} · {r.punch.reason}{r.original && <> · was {r.original.kind.toUpperCase()} {fmtTime(r.original.at)}</>}</div>}
      {r.kind === 'missed_out' && <div className="flex items-center justify-between"><span className="text-[10px] text-amber-800">Clocked in, never out</span><Button size="sm" data-testid={`rg-resolve-${r.punch.id}`} onClick={() => { setResolving(resolving?.punch.id === r.punch.id ? null : r); setErr(null); }}>Add clock-out</Button></div>}
      {resolving?.punch.id === r.punch.id && <CorrectionForm title={`Clock-out for ${r.user.shortName}`} at={toLocalInput(r.punch.at).slice(0, 11) + '17:30'} kind="out" error={err} onSubmit={(at, kind, reason) => api.rgAddPunch(r.user.id, kind, new Date(at).toISOString(), r.punch.tagId, reason, mgr.shortName).then(() => { setResolving(null); onChange(); }).catch((e) => setErr(e.message))} onCancel={() => setResolving(null)} />}
    </li>)}{!rows.length && <li className="px-3 py-4 text-center text-ink-400">Nothing flagged.</li>}</ul>
  </div>;
}

function Export({ division }: { division: Div }) {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  const [from, setFrom] = useState(d(14)); const [to, setTo] = useState(d(0)); const [preview, setPreview] = useState<string | null>(null);
  const build = () => api.rgPayrollCsv(from, to, division);
  const download = () => { const csv = build(); setPreview(csv); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `rgtime-payroll-${from}-${to}.csv`; a.click(); };
  const totals = preview?.split('\n').filter((l) => l.startsWith('"TOTAL')) ?? [];
  return <div data-testid="rg-export" className="space-y-3 rounded-lg border border-line bg-surface p-3 text-xs">
    <div className="font-semibold text-ink">Payroll export · CSV</div>
    <div className="flex flex-wrap items-center gap-2"><label>From <input data-testid="rg-export-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} /></label><label>To <input data-testid="rg-export-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} /></label><Button variant="primary" data-testid="rg-export-download" onClick={download}><Download size={12} /> Download</Button></div>
    <p className="text-[10px] text-ink-400">One row per paired shift · station · flags (offsite, synced_late, correction, missing_out) · correction reason + who · per-person totals at the bottom. {DIVS.find((x) => x.key === division)?.label}.</p>
    {totals.length > 0 && <ul data-testid="rg-export-totals" className="divide-y divide-line/70 rounded-md border border-line">{totals.map((l) => { const c = l.split('","'); return <li key={l} className="flex justify-between px-2 py-1"><span>{c[0].replace(/^"/, '')}</span><span className="font-mono">{c[4]} h{c[6] && ` · ${c[6]}`}</span></li>; })}</ul>}
  </div>;
}

function Settings({ mgr }: { mgr: User }) {
  const [s, setS] = useState<RgSettings>(api.rgGetSettings()); const [msg, setMsg] = useState<string | null>(null);
  const save = (patch: Partial<RgSettings>) => { setS((x) => ({ ...x, ...patch })); return api.rgSaveSettings(patch, mgr.shortName).then((n) => { setS(n); setMsg('Saved'); window.dispatchEvent(new Event('rg-settings')); setTimeout(() => setMsg(null), 2000); }); };
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => void save({ shopLat: p.coords.latitude, shopLng: p.coords.longitude }), () => setMsg('Location unavailable'));
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => { setMsg('Copied'); setTimeout(() => setMsg(null), 1500); });
  return <div data-testid="rg-settings" className="space-y-3 text-xs">
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="font-semibold text-ink">Geofence (Q51)</div>
      <p className="text-[10px] text-ink-400">Punches outside the radius are accepted and flagged offsite — never silently rejected (GPS lies sometimes). This is what makes a cloned tag useless.</p>
      <div className="grid grid-cols-3 gap-2">
        <label>Lat<input data-testid="rg-set-lat" type="number" step="0.00001" value={s.shopLat} onChange={(e) => setS({ ...s, shopLat: Number(e.target.value) })} className={`${field} mt-0.5 block w-full`} /></label>
        <label>Lng<input data-testid="rg-set-lng" type="number" step="0.00001" value={s.shopLng} onChange={(e) => setS({ ...s, shopLng: Number(e.target.value) })} className={`${field} mt-0.5 block w-full`} /></label>
        <label>Radius m<input data-testid="rg-set-radius" type="number" min={25} step={25} value={s.radiusM} onChange={(e) => setS({ ...s, radiusM: Number(e.target.value) })} className={`${field} mt-0.5 block w-full`} /></label>
      </div>
      <div className="flex items-center gap-2"><Button size="sm" variant="primary" data-testid="rg-set-save" onClick={() => void save({ shopLat: s.shopLat, shopLng: s.shopLng, radiusM: s.radiusM })}>Save</Button><Button size="sm" data-testid="rg-set-locate" onClick={locate}><LocateFixed size={12} /> Use my current location</Button>{msg && <span data-testid="rg-set-msg" className="text-moss-700">{msg}</span>}</div>
      <div className="flex flex-wrap gap-3 border-t border-line pt-2 text-[11px]"><label className="inline-flex items-center gap-1"><input data-testid="rg-set-sim-offsite" type="checkbox" checked={s.simulateOffsite} onChange={(e) => void save({ simulateOffsite: e.target.checked })} /> simulate offsite (dev)</label><label className="inline-flex items-center gap-1"><input data-testid="rg-set-sim-offline" type="checkbox" checked={s.simulateOffline} onChange={(e) => void save({ simulateOffline: e.target.checked })} /> simulate no signal (dev)</label></div>
    </div>
    <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <div className="font-semibold text-ink">Stations · write these URLs to the NFC tags</div>
      <ul className="divide-y divide-line/70">{api.getNfcTags().map((t) => { const url = `${window.location.origin}/rg/clock?station=${t.id}`; return <li key={t.id} data-testid={`rg-station-${t.id}`} className="flex items-center gap-2 py-1.5"><span className="font-semibold text-ink">{t.label}</span><span className="text-ink-500">{api.RG_DIVISION_LABEL[t.division]}</span><span className="ml-auto truncate font-mono text-[10px] text-ink-500">{url}</span><button data-testid={`rg-station-copy-${t.id}`} onClick={() => void copy(url)} className="rounded-sm border border-line p-1 hover:bg-canvas"><Copy size={11} /></button></li>; })}</ul>
      <p className="text-[10px] text-ink-400">Kiosk fallback for staff without a phone: <span className="font-mono">/rg/kiosk</span> on the wall iPad, station-locked.</p>
    </div>
  </div>;
}
