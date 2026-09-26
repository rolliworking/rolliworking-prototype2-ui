import { Delete, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { User } from '@/api/client';

// Kiosk lock screen: pick your card, PIN in. Device = station ("Bench 3"), PIN = person. Auto-submits on the 4th digit.
export const BenchLock = ({ onUnlock, lastUser }: { onUnlock: (u: User) => void; lastUser?: User | null }) => {
  const staff = api.getDivisionStaff(api.getSessionDivision()).sort((a, b) => Number(api.isManagerTier(a)) - Number(api.isManagerTier(b)));
  const [sel, setSel] = useState<User | null>(lastUser ?? null); const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (pin.length === 4 && sel && !busy) { setBusy(true); api.benchPinIn(sel.id, pin).then(onUnlock).catch((e) => { setErr(e.message); setPin(''); }).finally(() => setBusy(false)); } }, [pin, sel, busy, onUnlock]);
  const key = (k: string) => { setErr(null); if (k === 'del') setPin((p) => p.slice(0, -1)); else if (pin.length < 4) setPin((p) => p + k); };
  return <div data-testid="bench-lock" className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-slate-100">Who’s at this bench?</h2>
      <p className="mt-1 text-sm text-slate-400">Tap your card, then your PIN. The board comes straight back.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">{staff.map((u) => <button key={u.id} data-testid={`bench-card-${u.id}`} onClick={() => { setSel(u); setPin(''); setErr(null); }} className={`min-h-[64px] rounded-2xl border p-3 text-left transition-colors ${sel?.id === u.id ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><div className="text-lg font-semibold text-slate-100">{u.shortName}</div><div className="text-xs text-slate-400">{u.dutyLabel}</div></button>)}</div>
    </div>
    <div className="w-full max-w-xs">
      <div className="mb-3 flex items-center justify-center gap-3" data-testid="bench-pin-dots">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-2 ${pin.length > i ? 'border-amber-400 bg-amber-400' : 'border-white/30'}`} />)}</div>
      <div className="grid grid-cols-3 gap-2">{['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => k === '' ? <span key={`gap-${i}`} /> : <button key={k} data-testid={`bench-key-${k}`} disabled={!sel} onClick={() => key(k)} className="flex min-h-[64px] items-center justify-center rounded-2xl bg-white/[0.06] text-2xl font-semibold text-slate-100 transition-transform active:scale-95 disabled:opacity-30">{k === 'del' ? <Delete size={24} /> : k}</button>)}</div>
      <p data-testid="bench-lock-hint" className={`mt-3 text-center text-sm ${err ? 'text-rose-400' : 'text-slate-500'}`}>{err ?? (sel ? <span className="inline-flex items-center gap-1"><KeyRound size={13} /> PIN for {sel.shortName}</span> : 'Pick a card first')}</p>
    </div>
  </div>;
};
