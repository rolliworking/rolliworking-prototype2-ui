import { Camera, Check } from 'lucide-react';
import { useRef, useState } from 'react';
import * as api from '@/api/client';
import { Big, Sheet } from './PadBits';

// iPad camera → slot label → attach to the OPEN job (scan-first: job ↔ watch identity). Multiple shots without leaving the flow.
export const CameraCapture = ({ jobId, jobNumber, onDone, compact }: { jobId: string; jobNumber: string; onDone: (m: string) => void; compact?: boolean }) => {
  const input = useRef<HTMLInputElement>(null); const [shot, setShot] = useState<string | null>(null); const [slot, setSlot] = useState<string>('workbench'); const [count, setCount] = useState(0); const [busy, setBusy] = useState(false);
  const onFile = (f?: File | null) => { if (!f) return; setShot(URL.createObjectURL(f)); };
  const attach = async (again: boolean) => { if (!shot) return; setBusy(true); try { await api.capturePadPhoto(jobId, shot, slot); setCount((c) => c + 1); onDone(`${jobNumber} · photo attached · ${api.PHOTO_SLOTS.find((s) => s.key === slot)!.label}`); setShot(null); if (again) window.setTimeout(() => input.current?.click(), 50); } finally { setBusy(false); } };
  return <>
    <input ref={input} data-testid={`pad-camera-input-${jobId}`} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    <Big testId={`pad-camera-${jobId}`} tone={compact ? 'quiet' : 'ghost'} onClick={() => input.current?.click()}><Camera size={18} /> {compact ? '' : 'Camera'}{count > 0 && <span className="font-mono text-sm text-slate-400">+{count}</span>}</Big>
    {shot && <Sheet testId="pad-photo-sheet" title="Label this shot" sub={<>Binds to <span className="font-mono text-white">{jobNumber}</span> · stamped who / when / slot · client sees only client-visible slots</>} onClose={() => setShot(null)}>
      <img src={shot} alt="capture" className="max-h-[38vh] w-full rounded-2xl object-contain bg-black" />
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{api.PHOTO_SLOTS.map((s) => <button key={s.key} data-testid={`pad-slot-${s.key}`} onClick={() => setSlot(s.key)} className={`min-h-[56px] rounded-2xl border text-base font-medium ${slot === s.key ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-white/15 text-slate-200'}`}>{s.label}<span className="block text-[10px] uppercase text-slate-500">{s.clientVisible ? 'client-visible' : 'internal'}</span></button>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Big testId="pad-photo-confirm" tone="primary" disabled={busy} onClick={() => attach(false)}><Check size={18} /> Attach</Big><Big testId="pad-photo-another" disabled={busy} onClick={() => attach(true)}><Camera size={18} /> Attach &amp; shoot another</Big></div>
    </Sheet>}
  </>;
};
