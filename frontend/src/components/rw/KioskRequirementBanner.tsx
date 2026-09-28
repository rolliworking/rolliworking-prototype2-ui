import { Camera, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { KioskStatus } from '@/api/client';

// Bench-iPad per-job view: the required kiosk step, outstanding or cleared — attributed to the job's watchmaker, not whoever is holding the iPad
export const KioskRequirementBanner = ({ jobId, tick }: { jobId: string; tick?: unknown }) => {
  const [s, setS] = useState<KioskStatus | null>(null);
  useEffect(() => { api.getKioskStatus(jobId).then(setS); }, [jobId, tick]);
  if (!s || !s.required) return null;
  return <div data-testid="rw-kiosk-requirement" data-done={s.done} className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${s.done ? 'border-emerald-700/50 bg-emerald-950/40 text-emerald-200' : 'border-amber-600/60 bg-amber-950/40 text-amber-100'}`}>
    {s.done ? <Check size={14} /> : <Camera size={14} />}
    <span className="font-semibold">{s.done ? 'WM room photo set complete' : 'WM room photo set required'}</span>
    <span className="opacity-80">· dial front · dial back · movement back · case back · at the shared kiosk · attributed to {s.watchmaker}</span>
    {s.done && s.session?.completedAt && <span className="ml-auto font-mono text-[10px] opacity-70">finished {new Date(s.session.completedAt).toLocaleString()}</span>}
    {!s.done && <span className="ml-auto font-mono text-[10px] opacity-70">{s.session ? `${s.session.shots.length} of ${api.KIOSK_STEPS.length} captured` : 'not started'}</span>}
  </div>;
};
