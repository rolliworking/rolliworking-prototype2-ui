import { Settings, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import * as api from '@/api/client';
import type { BenchSettings } from '@/api/client';
import { Big, Sheet } from '@/components/rw/pad/PadBits';

// Behind the long-press gear: supervisor PIN, then bench name + idle timeout (+ offline simulation for walking the banner). Stored per device.
export const BenchSettingsSheet = ({ current, onClose, onSaved }: { current: BenchSettings; onClose: () => void; onSaved: (s: BenchSettings) => void }) => {
  const [pin, setPin] = useState(''); const [ok, setOk] = useState(false); const [form, setForm] = useState<BenchSettings>(current); const [err, setErr] = useState<string | null>(null);
  const gate = (e: FormEvent) => { e.preventDefault(); if (api.verifySupervisorPin(pin.trim())) { setOk(true); setErr(null); } else setErr('Supervisor PIN not recognised'); };
  const save = () => { try { onSaved(api.saveBenchSettings(form, pin.trim())); } catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); } };
  return <Sheet testId="bench-settings" title={<span className="inline-flex items-center gap-2"><Settings size={22} className="text-amber-400" /> Bench settings</span>} sub="Per device · supervisor PIN required · in Keeper the bench identity is a station record so a replaced iPad re-adopts it" onClose={onClose}>
    {!ok ? <form onSubmit={gate} className="space-y-3"><label className="block text-sm text-slate-300">Supervisor PIN</label><input data-testid="bench-settings-pin" autoFocus inputMode="numeric" type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#0f131a] px-4 text-2xl tracking-[0.5em] text-slate-100" /><Big testId="bench-settings-unlock" tone="primary" type="submit" full><ShieldCheck size={18} /> Unlock settings</Big>{err && <p data-testid="bench-settings-error" className="text-sm text-rose-400">{err}</p>}</form>
    : <div className="space-y-4">
      <label className="block"><span className="text-sm text-slate-300">Bench name (station identity)</span><input data-testid="bench-settings-name" value={form.benchName} onChange={(e) => setForm({ ...form, benchName: e.target.value })} className="mt-1 min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#0f131a] px-4 text-lg text-slate-100" /></label>
      <label className="block"><span className="text-sm text-slate-300">Idle re-lock after (minutes without touch)</span><div className="mt-1 flex items-center gap-2">{[1, 5, 10, 20, 30].map((n) => <button key={n} type="button" data-testid={`bench-settings-idle-${n}`} onClick={() => setForm({ ...form, idleMinutes: n })} className={`min-h-[48px] flex-1 rounded-2xl border text-base font-semibold ${form.idleMinutes === n ? 'border-amber-400 bg-amber-400/15 text-slate-100' : 'border-white/10 text-slate-300'}`}>{n}</button>)}<input data-testid="bench-settings-idle" type="number" min={1} max={120} value={form.idleMinutes} onChange={(e) => setForm({ ...form, idleMinutes: Number(e.target.value) })} className="min-h-[48px] w-20 rounded-2xl border border-white/10 bg-[#0f131a] px-3 text-center font-mono text-slate-100" /></div></label>
      <label className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/10 px-4"><input data-testid="bench-settings-offline" type="checkbox" checked={form.simulateOffline} onChange={(e) => setForm({ ...form, simulateOffline: e.target.checked })} className="h-5 w-5" /><span className="text-sm text-slate-300">Simulate API unreachable <span className="text-slate-500">(prototype only — walks the “reconnecting…” banner; the board keeps its last data)</span></span></label>
      <Big testId="bench-settings-save" tone="primary" full onClick={save}>Save to this device</Big>
      {err && <p data-testid="bench-settings-error" className="text-sm text-rose-400">{err}</p>}
    </div>}
  </Sheet>;
};
