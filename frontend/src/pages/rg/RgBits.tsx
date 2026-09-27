import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Punch, PunchFlag } from '@/api/client';
import { fmtTime } from '@/lib/format';

export const FLAG_LABEL: Record<PunchFlag, string> = { offsite: 'offsite', no_gps: 'no GPS', synced_late: 'synced late', kiosk: 'kiosk', correction: 'correction' };
const FLAG_TONE: Record<PunchFlag, string> = { offsite: 'bg-amber-100 text-amber-800', no_gps: 'bg-canvas text-ink-500', synced_late: 'bg-sky-100 text-sky-800', kiosk: 'bg-canvas text-ink-500', correction: 'bg-violet-100 text-violet-800' };

export const FlagChips = ({ punch }: { punch: Punch }) => (
  <>{punch.queued && <span data-testid={`rg-flag-queued-${punch.id}`} className="rounded-sm bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-800">queued</span>}
    {punch.flags?.map((f) => <span key={f} data-testid={`rg-flag-${f}-${punch.id}`} className={`rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${FLAG_TONE[f]}`}>{FLAG_LABEL[f]}</span>)}</>
);

export const PunchList = ({ punches, testId }: { punches: Punch[]; testId: string }) => (
  <ul data-testid={testId} className="divide-y divide-line/70 text-xs">
    {punches.map((p) => <li key={p.id} data-testid={`rg-punch-${p.id}`} className="flex items-center gap-2 px-3 py-2"><span className={`w-9 font-semibold uppercase ${p.kind === 'in' ? 'text-moss-700' : 'text-ink-500'}`}>{p.kind}</span><span className="flex-1 text-ink-500">{p.location}{p.simulated && <span className="ml-1 text-[10px] text-amber-700">· simulated</span>}</span><FlagChips punch={p} /><span className="font-mono text-ink">{fmtTime(p.at)}</span></li>)}
    {!punches.length && <li className="px-3 py-4 text-center text-ink-400">No punches yet today</li>}
  </ul>
);

export const greeting = (d = new Date()) => { const h = d.getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

// Big-thumb PIN pad — auto-submits at 4 digits; also accepts a typed password via the hidden input for desktop testing
export const PinPad = ({ onSubmit, error, testId = 'rg-pin' }: { onSubmit: (secret: string) => void; error?: string | null; testId?: string }) => {
  const [v, setV] = useState('');
  useEffect(() => { if (v.length === 4) { onSubmit(v); setV(''); } }, [v, onSubmit]);
  return <div data-testid={`${testId}-pad`} className="space-y-3">
    <form className="flex justify-center gap-2" onSubmit={(e) => { e.preventDefault(); if (v) { onSubmit(v); setV(''); } }}>
      <input data-testid={testId} type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="PIN" className="h-12 w-40 rounded-md border border-line bg-surface text-center font-mono text-2xl tracking-[0.5em]" />
    </form>
    <div className="mx-auto grid w-56 grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i} /> : <button key={k} type="button" data-testid={`${testId}-key-${k === '⌫' ? 'del' : k}`} onClick={() => setV((x) => (k === '⌫' ? x.slice(0, -1) : x.length < 4 ? x + k : x))} className="h-14 rounded-lg border border-line bg-surface text-xl font-semibold text-ink active:bg-canvas">{k === '⌫' ? <Delete size={18} className="mx-auto" /> : k}</button>)}
    </div>
    {error && <p data-testid={`${testId}-error`} className="text-center text-xs text-rose-700">{error}</p>}
  </div>;
};

// Real browser geolocation, resolved once; null = denied / unavailable / timed out (punch is still accepted, flagged no-GPS)
export const useGeo = (enabled = true) => {
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) { setGeo(null); return; }
    if (!('geolocation' in navigator)) { setGeo(null); return; }
    let live = true; const t = setTimeout(() => { if (live) setGeo((g) => (g === undefined ? null : g)); }, 6000);
    navigator.geolocation.getCurrentPosition((pos) => { if (live) setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }, () => { if (live) setGeo(null); }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 });
    return () => { live = false; clearTimeout(t); };
  }, [enabled]);
  return geo;
};
