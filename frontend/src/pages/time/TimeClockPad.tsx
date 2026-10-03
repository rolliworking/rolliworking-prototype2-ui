import clsx from 'clsx';
import { ArrowLeft, Clock3, Fingerprint, MapPin, MapPinOff, Nfc, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClockPoint, ClockState, Punch, User } from '@/api/client';
import * as wa from '@/api/webauthn';
import { FlagChips, PinPad, greeting, useGeo } from '@/components/time/TimeBits';
import { fmtTime } from '@/lib/format';

// Offline queue + banner (ported from the RGTime shell): punches are saved on the device with the true time and sync when the signal is back
const useOffline = () => {
  const [offline, setOffline] = useState(api.rgIsOffline()); const [queued, setQueued] = useState(api.rgQueueCount()); const [synced, setSynced] = useState<number | null>(null);
  const refresh = useCallback(() => { setOffline(api.rgIsOffline()); setQueued(api.rgQueueCount()); }, []);
  const sync = useCallback(async () => { const s = await api.rgSyncQueue(); if (s.length) { setSynced(s.length); setTimeout(() => setSynced(null), 6000); } refresh(); }, [refresh]);
  useEffect(() => { void sync(); const on = () => void sync(); const off = () => refresh(); window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('rg-settings', on); const t = setInterval(() => void sync(), 15_000); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('rg-settings', on); clearInterval(t); }; }, [sync, refresh]);
  return { offline, queued, synced, refresh };
};

const Done = ({ punch, user, onReset }: { punch: Punch; user: User; onReset: () => void }) => (
  <div data-testid="rg-kiosk-done" data-kind={punch.kind} className={clsx('rounded-3xl p-10 text-center shadow-pop', punch.kind === 'in' ? 'bg-moss' : 'bg-ink-700 ring-1 ring-white/20')}>
    <div className="text-lg text-white/80">{greeting()} {user.shortName}</div>
    <div data-testid="rg-kiosk-done-label" className="text-6xl font-semibold">Clocked {punch.kind}</div>
    <div data-testid="rg-clock-done-detail" className="mt-2 text-2xl text-white/90">{fmtTime(punch.at)} · {punch.location}</div>
    <div className="mt-2 flex justify-center gap-1"><FlagChips punch={punch} /></div>
    {punch.queued && <div data-testid="rg-clock-done-queued" className="mx-auto mt-3 max-w-sm rounded-md bg-white/15 px-3 py-2 text-xs"><WifiOff size={12} className="mr-1 inline" /> No signal — saved on this device with the real time; it syncs by itself.</div>}
    {punch.flags?.includes('offsite') && <div data-testid="rg-clock-done-offsite" className="mx-auto mt-3 max-w-sm rounded-md bg-amber-300/90 px-3 py-2 text-xs font-medium text-amber-950">Recorded — but this device was {punch.geo ? `${(punch.geo.distanceM / 1000).toFixed(1)} km` : 'far'} from the shop. Flagged for a manager, not rejected.</div>}
    <button data-testid="rg-clock-back" onClick={onReset} className="mt-4 text-xs text-white/80 underline">Done</button>
  </div>
);

// Station lock for a wall iPad (manager PIN) — the same list Setup → Stations marks as clock points
const StationLock = ({ onLocked }: { onLocked: (t: ClockPoint) => void }) => {
  const points = api.getClockPointsSync(); const [id, setId] = useState(points[0]?.id ?? ''); const [err, setErr] = useState<string | null>(null);
  const go = useCallback((pin: string) => { const ok = api.rgAllStaff().some((m) => m.accessTier === 'manager' && m.pin === pin); if (!ok) { setErr('Manager PIN required'); return; } api.rgSetKioskStation(id); onLocked(points.find((p) => p.id === id)!); }, [id, points, onLocked]);
  return <div data-testid="rg-kiosk-lock" className="rounded-2xl bg-white p-5 text-ink">
    <div className="text-lg font-semibold">Lock this pad to a clock point</div>
    <p className="mb-3 text-xs text-ink-500">Pick where this pad hangs, then a manager PIN. Every punch from here records that station. Add clock points in Setup → Organisation → Stations.</p>
    <select data-testid="rg-kiosk-station-select" value={id} onChange={(e) => setId(e.target.value)} className="mb-3 w-full rounded-md border border-line bg-surface px-2 py-2 text-sm">{points.map((t) => <option key={t.id} value={t.id}>{t.label} · {api.entityName(t.division)} · {t.kind}</option>)}</select>
    <PinPad testId="rg-kiosk-lock-pin" onSubmit={go} error={err} />
  </div>;
};

// Time Clock pad `/time/pad` — one screen for the wall iPad (lock → cards → Touch ID / PIN) AND for an NFC tap (`?station=` from the tag; a remembered device gets the one-button confirm)
export default function TimeClockPad() {
  const [params] = useSearchParams(); const tapStation = params.get('station') ?? params.get('tag') ?? ''; const simulated = params.get('sim') === '1'; const tapMode = !!tapStation;
  const [point, setPoint] = useState<ClockPoint | undefined>(() => { const id = tapStation || api.rgKioskStation()?.id; return id ? api.getClockPointsSync().find((p) => p.id === id) : undefined; });
  const [pick, setPick] = useState<User | null>(() => (tapMode ? api.rgGetSession() : null)); const remembered = tapMode && !!pick && api.rgGetSession()?.id === pick.id;
  const [state, setState] = useState<ClockState | null>(null); const [done, setDone] = useState<Punch | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [clock, setClock] = useState(new Date());
  const [touchAvail, setTouchAvail] = useState(false); const [offerEnrol, setOfferEnrol] = useState<User | null>(null);
  const { offline, queued, synced, refresh } = useOffline(); const settings = api.rgGetSettings(); const geo = useGeo(tapMode && !settings.simulateOffsite);
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 10_000); return () => clearInterval(t); }, []);
  useEffect(() => { void wa.platformAuthenticatorAvailable().then(setTouchAvail); }, []);
  useEffect(() => { if (pick) void api.getClockState(pick.id).then(setState); else setState(null); }, [pick]);
  useEffect(() => { if (!done || tapMode) return; const t = setTimeout(() => { setDone(null); setPick(null); setOfferEnrol(null); }, 6000); return () => clearTimeout(t); }, [done, tapMode]);
  const staff = point ? api.rgAllStaff().filter((u) => !u.disabled && !(u.invite && !u.invite.usedAt) && (u.division === 'both' || u.division === point.division)) : [];
  const finish = (p: Punch, u: User) => { setDone(p); setErr(null); refresh(); if (touchAvail && !wa.enrolledCredential(u.id) && p.method !== 'touch_id') setOfferEnrol(u); };
  const run = async (fn: () => Promise<Punch>, u: User) => { setBusy(true); setErr(null); try { finish(await fn(), u); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  const withPin = (pin: string) => { if (!pick || !point) return; void run(async () => { const p = await api.rgPadPunch(pick.id, point.id, { pin }); if (tapMode && !remembered) await api.rgSignIn(pick.id, pin); return p; }, pick); };
  const withTouch = () => { if (!pick || !point) return; void run(async () => { const ok = await wa.assertTouchId(pick.id); if (!ok) throw new Error('Touch ID did not match this card'); return api.rgPadPunch(pick.id, point.id, { touchId: true }); }, pick); };
  const tapConfirm = () => { if (!pick || !point) return; void run(() => api.punchClock(point.id, { simulated, geo: geo ?? null, source: 'nfc', userId: pick.id }), pick); };
  const enrol = () => { if (!offerEnrol) return; wa.enrolTouchId(offerEnrol).then(() => setOfferEnrol(null)).catch((e) => setErr(e instanceof Error ? e.message : 'Touch ID enrolment failed')); };
  const reset = () => { setDone(null); setOfferEnrol(null); if (!remembered) setPick(null); };
  const nextKind = state?.onClock ? 'out' : 'in';
  return <div data-testid="rg-kiosk" data-mode={tapMode ? 'tap' : 'kiosk'} className="flex h-full min-h-screen flex-col bg-ink text-white">
    <header className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="inline-flex items-center gap-2 font-semibold"><Clock3 size={16} /> Time Clock{tapMode && <span className="ml-1 inline-flex items-center gap-1 rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70"><Nfc size={11} /> tag tap{simulated ? ' · simulated' : ''}</span>}</span>
      {point && <span data-testid="rg-kiosk-station" className="inline-flex items-center gap-1 text-white/70"><MapPin size={13} /> {point.label} <span className="text-white/40">· {api.entityName(point.division)}</span></span>}
      <span data-testid="rg-kiosk-clock" className="font-mono text-lg">{fmtTime(clock.toISOString())}</span>
    </header>
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-5">
      {offline && <div data-testid="rg-offline-banner" className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900"><WifiOff size={13} /> No signal — punches are saved on this device{queued > 0 && <> · <span data-testid="rg-queued-count">{queued} waiting to sync</span></>}</div>}
      {!offline && synced && <div data-testid="rg-synced-banner" className="rounded-md bg-sky-100 px-3 py-2 text-xs font-medium text-sky-900">Back online — {synced} punch{synced > 1 ? 'es' : ''} synced (marked synced-late)</div>}
      {tapMode && !point && <div data-testid="rg-clock-unknown" className="space-y-2 rounded-2xl bg-rose-50 p-5 text-rose-800"><p className="font-semibold">Unknown clock point</p><p className="text-xs">“{tapStation}” is not a registered tag or clock-point station. A manager can add it in Setup → Organisation → Stations.</p></div>}
      {!tapMode && !point && <StationLock onLocked={setPoint} />}
      {point && done && pick && <><Done punch={done} user={pick} onReset={reset} />{offerEnrol && <div data-testid="rg-touch-enrol" className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-xs"><span><Fingerprint size={14} className="mr-1 inline" /> Set up Touch ID on this pad for {offerEnrol.shortName}? Next time: tap your card, touch the sensor, done.</span><div className="flex gap-2"><button data-testid="rg-touch-enrol-skip" onClick={() => setOfferEnrol(null)} className="text-white/60 underline">Not now</button><button data-testid="rg-touch-enrol-go" onClick={enrol} className="rounded-md bg-white px-3 py-1.5 font-semibold text-ink">Enrol</button></div></div>}</>}
      {point && !done && !pick && <div>
        <h1 className="mb-3 text-2xl font-semibold">Who are you?</h1>
        <div data-testid="rg-kiosk-staff" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{staff.map((u) => <button key={u.id} data-testid={`rg-kiosk-card-${u.id}`} onClick={() => { setPick(u); setErr(null); }} className="rounded-2xl bg-white/10 p-5 text-left hover:bg-white/15 active:bg-white/20"><div className="text-xl font-semibold">{u.shortName}</div><div className="text-xs text-white/60">{u.dutyLabel}</div>{wa.enrolledCredential(u.id) && <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-300"><Fingerprint size={10} /> Touch ID</div>}</button>)}</div>
      </div>}
      {point && !done && pick && remembered && <div data-testid="rg-clock-page" className="space-y-4">
        <div className="rounded-2xl bg-white p-4 text-ink">
          <div className="flex items-center justify-between"><div className="text-lg font-semibold">{greeting()} {pick.shortName}</div><button data-testid="rg-sign-in-back" onClick={() => { void api.rgSignOut(); setPick(null); }} className="text-xs text-ink-500 underline">Not you?</button></div>
          {state && <div data-testid="rg-clock-current" className="mt-1 text-xs text-ink-500">{state.onClock ? `On the clock since ${fmtTime(state.since!)} (${state.sinceLocation})` : 'Currently off the clock'} · {state.todayHours.toFixed(2)} h today</div>}
          <div data-testid="rg-clock-geo" data-geo={geo === undefined ? 'pending' : geo ? 'ok' : 'none'} className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">{geo === undefined ? <><MapPin size={11} className="animate-pulse" /> locating…</> : geo ? <><MapPin size={11} /> {settings.simulateOffsite ? 'location: simulated offsite' : `${api.rgDistanceM(geo.lat, geo.lng)} m from the shop`}</> : <><MapPinOff size={11} /> {settings.simulateOffsite ? 'simulated offsite' : 'no location — punch still counts'}</>}</div>
        </div>
        <button data-testid="rg-clock-confirm" data-kind={nextKind} disabled={!state || busy} onClick={tapConfirm} className={clsx('w-full rounded-3xl py-10 text-4xl font-semibold text-white shadow-pop active:translate-y-px disabled:opacity-50', nextKind === 'in' ? 'bg-moss hover:bg-moss-700' : 'bg-ink-700 ring-1 ring-white/20 hover:bg-ink-600')}>{state ? `CLOCK ${nextKind.toUpperCase()}` : '…'}<div className="mt-1 text-sm font-normal text-white/80">{pick.shortName} · {point.label}</div></button>
      </div>}
      {point && !done && pick && !remembered && <div data-testid="rg-pad-auth" className="rounded-2xl bg-white p-5 text-ink">
        <div className="mb-3 flex items-center justify-between"><div><div className="text-lg font-semibold">{pick.shortName} — {state ? `clock ${nextKind}` : '…'}</div>{state && <div className="text-xs text-ink-500">{state.onClock ? `on the clock since ${fmtTime(state.since!)}` : 'off the clock'} · {point.label}</div>}</div><button data-testid="rg-kiosk-back" onClick={() => { setPick(null); setErr(null); }} className="text-xs text-ink-500 underline">Not you</button></div>
        {touchAvail && wa.enrolledCredential(pick.id) && <button data-testid="rg-touch-id" disabled={busy} onClick={withTouch} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-5 text-xl font-semibold text-white active:translate-y-px disabled:opacity-50"><Fingerprint size={24} /> Touch ID</button>}
        <PinPad testId="rg-kiosk-pin" onSubmit={withPin} error={err} />
        {tapMode && <p className="mt-2 text-center text-[10px] text-ink-400">Once — after this, a tag tap on this device clocks you straight in or out.</p>}
      </div>}
      {err && (done || remembered) && <p data-testid="rg-clock-error" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</p>}
      <div className="mt-auto flex items-center justify-between text-[10px] text-white/40">
        <Link to="/time" data-testid="time-pad-back" className="inline-flex items-center gap-1 underline"><ArrowLeft size={10} /> Time clock board</Link>
        {point && !tapMode && <button data-testid="rg-kiosk-change-station" onClick={() => { localStorage.removeItem('rollisuite.rg.kioskStation'); setPoint(undefined); setPick(null); }} className="underline">change clock point</button>}
        <DevToggles />
      </div>
    </main>
  </div>;
}

const DevToggles = () => {
  const [s, setS] = useState(api.rgGetSettings());
  const set = (patch: Partial<typeof s>) => { setS((x) => ({ ...x, ...patch })); void api.rgSaveSettings(patch).then((n) => { setS(n); window.dispatchEvent(new Event('rg-settings')); }); };
  return <span data-testid="rg-dev-toggles" className="inline-flex gap-3"><label className="inline-flex items-center gap-1"><input data-testid="rg-sim-offsite" type="checkbox" checked={s.simulateOffsite} onChange={(e) => set({ simulateOffsite: e.target.checked })} /> sim offsite</label><label className="inline-flex items-center gap-1"><input data-testid="rg-sim-offline" type="checkbox" checked={s.simulateOffline} onChange={(e) => set({ simulateOffline: e.target.checked })} /> sim no signal</label></span>;
};
