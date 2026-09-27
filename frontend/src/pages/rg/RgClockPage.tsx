import { MapPin, MapPinOff, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClockState, Punch } from '@/api/client';
import { fmtTime } from '@/lib/format';
import { FlagChips, greeting, useGeo } from './RgBits';
import { useRg } from './RgShell';

// Tag-tap → this page already knows you → ONE button → huge confirmation. Target under 5 s.
export default function RgClockPage() {
  const { user, refresh } = useRg(); const nav = useNavigate(); const [params] = useSearchParams();
  const stationId = params.get('station') ?? params.get('tag') ?? ''; const simulated = params.get('sim') === '1'; const station = api.getNfcTag(stationId);
  const settings = api.rgGetSettings(); const geo = useGeo(!settings.simulateOffsite);
  const [state, setState] = useState<ClockState | null>(null); const [done, setDone] = useState<Punch | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { api.getClockState(user.id).then(setState); }, [user.id]);
  useEffect(() => { if (!done) return; const t = setTimeout(() => nav('/rg'), 6000); return () => clearTimeout(t); }, [done, nav]);
  const confirm = async () => {
    setBusy(true); setErr(null);
    try { const p = await api.punchClock(stationId, { simulated, geo: geo ?? null, source: 'nfc' }); setDone(p); refresh(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  if (!station) return <div data-testid="rg-clock-unknown" className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Unknown station</p><p className="text-xs">“{stationId || '—'}” is not a registered NFC tag. Ask a manager to register it in Manager → Stations.</p><Link to="/rg" className="text-xs underline">← Back</Link></div>;
  if (done) {
    const offsite = done.flags?.includes('offsite');
    return <div data-testid="rg-clock-done" data-kind={done.kind} className={`space-y-3 rounded-2xl p-6 text-center text-white shadow-pop ${done.kind === 'in' ? 'bg-moss' : 'bg-ink-700'}`}>
      <div className="text-sm text-white/80">{greeting()} {user.shortName}</div>
      <div data-testid="rg-clock-done-label" className="text-4xl font-semibold leading-tight">Clocked {done.kind}</div>
      <div data-testid="rg-clock-done-detail" className="text-lg text-white/90">{fmtTime(done.at)} · {done.location}</div>
      <div className="flex flex-wrap justify-center gap-1"><FlagChips punch={done} /></div>
      {done.queued && <div data-testid="rg-clock-done-queued" className="rounded-md bg-white/15 px-3 py-2 text-xs"><WifiOff size={12} className="mr-1 inline" /> No signal — saved on this phone with the real time; it syncs by itself.</div>}
      {offsite && <div data-testid="rg-clock-done-offsite" className="rounded-md bg-amber-300/90 px-3 py-2 text-xs font-medium text-amber-950">Recorded — but your phone was {done.geo ? `${(done.geo.distanceM / 1000).toFixed(1)} km` : 'far'} from the shop. Flagged for a manager, not rejected.</div>}
      <Link to="/rg" data-testid="rg-clock-back" className="inline-block pt-1 text-xs text-white/80 underline">Done</Link>
    </div>;
  }
  const nextKind = state?.onClock ? 'out' : 'in';
  return <div data-testid="rg-clock-page" className="space-y-4">
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500"><MapPin size={12} /> Station</div>
      <div data-testid="rg-clock-location" className="mt-1 text-lg font-semibold text-ink">{station.label}</div>
      <div className="text-xs text-ink-500">{api.RG_DIVISION_LABEL[station.division]} · <span className="font-mono">{station.id}</span>{simulated && <span className="ml-1 text-amber-700">· simulated tap</span>}</div>
      {state && <div data-testid="rg-clock-current" className="mt-3 text-xs text-ink-500">{state.onClock ? `On the clock since ${fmtTime(state.since!)} (${state.sinceLocation})` : 'Currently off the clock'}</div>}
      <div data-testid="rg-clock-geo" data-geo={geo === undefined ? 'pending' : geo ? 'ok' : 'none'} className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">{geo === undefined ? <><MapPin size={11} className="animate-pulse" /> locating…</> : geo ? <><MapPin size={11} /> {settings.simulateOffsite ? 'location: simulated offsite' : `${api.rgDistanceM(geo.lat, geo.lng)} m from the shop`}</> : <><MapPinOff size={11} /> {settings.simulateOffsite ? 'simulated offsite' : 'no location — punch still counts'}</>}</div>
    </div>
    <button data-testid="rg-clock-confirm" data-kind={nextKind} disabled={!state || busy} onClick={() => void confirm()} className={`w-full rounded-2xl py-8 text-3xl font-semibold text-white shadow-pop active:translate-y-px disabled:opacity-50 ${nextKind === 'in' ? 'bg-moss hover:bg-moss-700' : 'bg-ink hover:bg-ink-700'}`}>{state ? `CLOCK ${nextKind.toUpperCase()}` : '…'}<div className="mt-1 text-sm font-normal text-white/80">{user.shortName} · {station.label}</div></button>
    {err && <p data-testid="rg-clock-error" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
    <Link to="/rg" data-testid="rg-clock-cancel" className="block text-center text-xs text-ink-500 underline">Not now</Link>
    <DevToggles />
  </div>;
}

export const DevToggles = () => {
  const [s, setS] = useState(api.rgGetSettings());
  const set = (patch: Partial<typeof s>) => { setS((x) => ({ ...x, ...patch })); void api.rgSaveSettings(patch).then((n) => { setS(n); window.dispatchEvent(new Event('rg-settings')); }); };
  return <div data-testid="rg-dev-toggles" className="flex flex-wrap gap-3 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
    <span className="font-semibold">Prototype:</span>
    <label className="inline-flex items-center gap-1"><input data-testid="rg-sim-offsite" type="checkbox" checked={s.simulateOffsite} onChange={(e) => set({ simulateOffsite: e.target.checked })} /> simulate offsite</label>
    <label className="inline-flex items-center gap-1"><input data-testid="rg-sim-offline" type="checkbox" checked={s.simulateOffline} onChange={(e) => set({ simulateOffline: e.target.checked })} /> simulate no signal</label>
  </div>;
};
