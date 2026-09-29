import { Camera, ClipboardCheck, Eye, Hammer, UserRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useViewAs } from '@/components/layout/ViewAs';
import { roleKind, ROLE_HOME } from '@/config/roles';

// D-385 (pad amendment): MH signing in on an iPad lands here — a grid of the iPad accounts + the two kiosks + "My own view".
// Device type: station record (D-384) → ?device= override → touch heuristic (prototype only, see config/device.ts).
export default function ChooseViewPage() {
  const { realUser, loading } = useAuth(); const { isOwner, start, own } = useViewAs();
  if (loading) return null;
  if (!realUser) return <Navigate to="/sign-in" replace />;
  if (!isOwner) return <Navigate to="/" replace />;
  const padPeople = api.getDivisionStaff('rolliworks').filter((u) => u.id !== realUser.id && ['watchmaker', 'supervisor'].includes(roleKind(u)));
  const tile = 'flex min-h-[132px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition-[transform,border-color] hover:-translate-y-0.5 hover:border-amber-400';
  return (
    <div data-testid="choose-view-page" className="min-h-full bg-[#161b22] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Choose a view</h1>
            <p className="mt-1 text-sm text-slate-400">Signed in as {realUser.displayName} · owner. Tap a person to open their exact view — every action is recorded as {realUser.shortName} (as them), never credited to them.</p>
          </div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400">pad sign-in · WM 1–8 are bench iPads, not accounts</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <button type="button" data-testid="choose-view-own" onClick={() => void own()} className={`${tile} border-amber-400/60 bg-amber-400/10`}>
            <Eye size={22} className="text-amber-400" />
            <div><div className="text-lg font-semibold text-white">My own view</div><div className="text-xs text-slate-400">{realUser.shortName} · desktop, everything</div></div>
          </button>
          {padPeople.map((u) => (
            <button key={u.id} type="button" data-testid={`choose-view-${u.shortName}`} onClick={() => void start(u.id)} className={`${tile} border-white/10 bg-[#1f2630]`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><UserRound size={18} /></span>
              <div><div className="text-lg font-semibold text-white">{u.shortName}</div><div className="text-xs text-slate-400">{u.dutyLabel}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{ROLE_HOME[roleKind(u)]}</div></div>
            </button>
          ))}
          <Link to="/kiosk" data-testid="choose-view-kiosk-frontdesk" className={`${tile} border-white/10 bg-[#1f2630]`}>
            <ClipboardCheck size={22} className="text-sky-300" />
            <div><div className="text-lg font-semibold text-white">Front-desk check-in kiosk</div><div className="text-xs text-slate-400">station view · no personal session</div></div>
          </Link>
          <Link to="/wm-kiosk" data-testid="choose-view-kiosk-photo" className={`${tile} border-white/10 bg-[#1f2630]`}>
            <Camera size={22} className="text-emerald-300" />
            <div><div className="text-lg font-semibold text-white">Photo kiosk</div><div className="text-xs text-slate-400">watchmaker room · common area</div></div>
          </Link>
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Hammer size={12} /> Route guards evaluate the viewed role — viewing as a watchmaker bounces from desktop routes exactly as they would.</p>
      </div>
    </div>
  );
}
