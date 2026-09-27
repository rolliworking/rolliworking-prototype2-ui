import { Clock3, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { NfcTag, Punch, User } from '@/api/client';
import { fmtTime } from '@/lib/format';
import { FlagChips, greeting, PinPad } from './RgBits';
import { OfflineBanner, useRgOffline } from './RgShell';

// Wall-mounted iPad, station-locked: tap your name → PIN → punch → huge confirmation → resets. No personal phone needed.
export default function RgKioskPage() {
  const [station, setStation] = useState<NfcTag | undefined>(() => api.rgKioskStation()); const [pick, setPick] = useState<User | null>(null); const [done, setDone] = useState<Punch | null>(null); const [err, setErr] = useState<string | null>(null); const [clock, setClock] = useState(new Date());
  const { offline, queued, synced, refresh } = useRgOffline();
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 10_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!done) return; const t = setTimeout(() => { setDone(null); setPick(null); }, 5000); return () => clearTimeout(t); }, [done]);
  const punch = useCallback((pin: string) => { if (!pick || !station) return; api.rgKioskPunch(pick.id, pin, station.id).then((p) => { setDone(p); setErr(null); refresh(); }).catch((e) => setErr(e.message)); }, [pick, station, refresh]);
  const staff = station ? api.rgAllStaff().filter((u) => u.division === 'both' || u.division === station.division) : [];
  return <div data-testid="rg-kiosk" className="flex h-full flex-col bg-ink text-white">
    <header className="flex items-center justify-between px-5 py-3 text-sm"><span className="inline-flex items-center gap-2 font-semibold"><Clock3 size={16} /> RGTime kiosk</span>{station && <span data-testid="rg-kiosk-station" className="inline-flex items-center gap-1 text-white/70"><MapPin size={13} /> {station.label}</span>}<span data-testid="rg-kiosk-clock" className="font-mono text-lg">{fmtTime(clock.toISOString())}</span></header>
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-5">
      <OfflineBanner offline={offline} queued={queued} synced={synced} />
      {!station && <StationLock onLocked={(t) => setStation(t)} />}
      {station && done && <div data-testid="rg-kiosk-done" data-kind={done.kind} className={`rounded-3xl p-10 text-center shadow-pop ${done.kind === 'in' ? 'bg-moss' : 'bg-ink-700 ring-1 ring-white/20'}`}>
        <div className="text-lg text-white/80">{greeting()} {api.rgAllStaff().find((u) => u.id === done.userId)?.shortName}</div>
        <div data-testid="rg-kiosk-done-label" className="text-6xl font-semibold">Clocked {done.kind}</div>
        <div className="mt-2 text-2xl text-white/90">{fmtTime(done.at)} · {done.location}</div>
        <div className="mt-2 flex justify-center gap-1"><FlagChips punch={done} /></div>
      </div>}
      {station && !done && !pick && <div>
        <h1 className="mb-3 text-2xl font-semibold">Who are you?</h1>
        <div data-testid="rg-kiosk-staff" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{staff.map((u) => <button key={u.id} data-testid={`rg-kiosk-card-${u.id}`} onClick={() => { setPick(u); setErr(null); }} className="rounded-2xl bg-white/10 p-5 text-left hover:bg-white/15 active:bg-white/20"><div className="text-xl font-semibold">{u.shortName}</div><div className="text-xs text-white/60">{u.dutyLabel}</div></button>)}</div>
      </div>}
      {station && !done && pick && <div className="rounded-2xl bg-white p-5 text-ink">
        <div className="mb-3 flex items-center justify-between"><div className="text-lg font-semibold">{pick.shortName} — your PIN</div><button data-testid="rg-kiosk-back" onClick={() => setPick(null)} className="text-xs text-ink-500 underline">Not you</button></div>
        <PinPad testId="rg-kiosk-pin" onSubmit={punch} error={err} />
      </div>}
      {station && <button data-testid="rg-kiosk-change-station" onClick={() => { localStorage.removeItem('rollisuite.rg.kioskStation'); setStation(undefined); setPick(null); }} className="mt-auto self-center text-[10px] text-white/40 underline">change station</button>}
    </main>
  </div>;
}

function StationLock({ onLocked }: { onLocked: (t: NfcTag) => void }) {
  const [id, setId] = useState(api.getNfcTags()[0]?.id ?? ''); const [err, setErr] = useState<string | null>(null);
  const managers = api.rgAllStaff().filter((u) => u.accessTier === 'manager');
  const go = useCallback((pin: string) => { const ok = managers.some((m) => m.pin === pin); if (!ok) { setErr('Manager PIN required'); return; } api.rgSetKioskStation(id); onLocked(api.getNfcTag(id)!); }, [id, managers, onLocked]);
  return <div data-testid="rg-kiosk-lock" className="rounded-2xl bg-white p-5 text-ink">
    <div className="text-lg font-semibold">Lock this iPad to a station</div>
    <p className="mb-3 text-xs text-ink-500">Pick where this kiosk hangs, then a manager PIN. Every punch from here records that station.</p>
    <select data-testid="rg-kiosk-station-select" value={id} onChange={(e) => setId(e.target.value)} className="mb-3 w-full rounded-md border border-line bg-surface px-2 py-2 text-sm">{api.getNfcTags().map((t) => <option key={t.id} value={t.id}>{t.label} · {api.RG_DIVISION_LABEL[t.division]}</option>)}</select>
    <PinPad testId="rg-kiosk-lock-pin" onSubmit={go} error={err} />
  </div>;
}
