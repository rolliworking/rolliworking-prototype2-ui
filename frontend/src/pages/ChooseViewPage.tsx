import { Camera, ClipboardCheck, Eye, UserRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import * as api from '@/api/client';
import { staffInitials } from '@/api/hitlist';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useViewAs } from '@/components/layout/ViewAs';
import { roleKind, ROLE_HOME, ROLE_LABEL } from '@/config/roles';

// D-385 (amended 2026-09-29): MANDATORY entry screen after ANY owner sign-in, every device (keyed on the account being owner — not on device detection).
// One tap = View-as under MH's own session. No password, no PIN, no station token — the viewed user's credentials are never involved. Exit from any View-as returns here.
// Tile groups walk the org tree (User.reportsTo), not a role list: supervisors = anyone with reports; the rest group under the person they report to
const hasReports = (u: User) => api.directReports(u.id).length > 0;
const GROUPS: { key: string; label: string; pick: (u: User) => boolean }[] = [
  { key: 'watchmakers', label: 'Watchmakers · report to MM', pick: (u) => !hasReports(u) && u.reportsTo === 'u-mm' },
  { key: 'supervisors', label: 'Supervisors · have reports', pick: (u) => hasReports(u) && u.id !== api.OWNER_USER_ID },
  { key: 'band', label: 'Band / Polish · report to JV', pick: (u) => !hasReports(u) && u.reportsTo === 'u-jv' },
  { key: 'frontdesk', label: 'Front desk · report to VC / MH', pick: (u) => !hasReports(u) && (u.reportsTo === 'u-vienna' || u.reportsTo === api.OWNER_USER_ID) },
];
const initials = staffInitials;
export default function ChooseViewPage() {
  const { realUser, loading } = useAuth(); const { isOwner, start, own } = useViewAs();
  if (loading) return null;
  if (!realUser) return <Navigate to="/sign-in" replace />;
  if (!isOwner) return <Navigate to="/" replace />;
  const staff = api.getDivisionStaff('rolliworks').concat(api.getDivisionStaff('rollishop').filter((u) => u.division === 'rollishop')).filter((u) => u.id !== realUser.id);
  const tile = 'flex min-h-[120px] min-w-0 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-[transform,border-color] hover:-translate-y-0.5 hover:border-accent active:scale-[0.99]';
  return (
    <div data-testid="choose-view-page" className="min-h-full bg-[#161b22] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <button type="button" data-testid="choose-view-own" onClick={() => void own()} className="flex w-full items-center gap-4 rounded-3xl border border-accent/60 bg-accent/10 px-6 py-5 text-left hover:border-accent">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-lg font-bold text-black">{initials(realUser)}</span>
          <span><span className="block text-2xl font-semibold text-white">Continue as {realUser.shortName}</span><span className="block text-sm text-slate-300">{realUser.dutyLabel} · own view · lands on {ROLE_HOME[roleKind(realUser)]}</span></span>
          <Eye size={22} className="ml-auto text-accent" />
        </button>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-white">View as…</h1>
        <p className="mt-1 text-sm text-slate-400">One tap opens that person’s exact view under your own session — no password, no PIN. Every action is recorded as {realUser.shortName} (as them). Exit from any view returns here.</p>
        {GROUPS.map((g) => { const people = staff.filter(g.pick); if (!people.length) return null; return <section key={g.key} data-testid={`choose-view-group-${g.key}`} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {people.map((u) => <button key={u.id} type="button" data-testid={`choose-view-${u.shortName}`} onClick={() => void start(u.id)} className={`${tile} border-white/10 bg-[#1f2630]`}>
              <span className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 font-mono text-sm font-semibold">{initials(u)}</span><span className="text-lg font-semibold text-white">{u.shortName}</span></span>
              <span><span className="block truncate text-xs text-slate-400">{u.dutyLabel} · {ROLE_LABEL[roleKind(u)]}</span><span className="mt-1 block font-mono text-[10px] text-slate-500">lands on {ROLE_HOME[roleKind(u)]}</span></span>
            </button>)}
          </div>
        </section>; })}
        <section data-testid="choose-view-group-kiosks" className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kiosks</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Link to="/kiosk" data-testid="choose-view-kiosk-frontdesk" className={`${tile} border-white/10 bg-[#1f2630]`}><ClipboardCheck size={22} className="text-sky-300" /><span><span className="block text-lg font-semibold text-white">Front-desk check-in kiosk</span><span className="block text-xs text-slate-400">kiosk screen under your session · no station token</span></span></Link>
            <Link to="/wm-kiosk" data-testid="choose-view-kiosk-photo" className={`${tile} border-white/10 bg-[#1f2630]`}><Camera size={22} className="text-emerald-300" /><span><span className="block text-lg font-semibold text-white">Photo kiosk</span><span className="block text-xs text-slate-400">watchmaker room · common area</span></span></Link>
          </div>
        </section>
        <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><UserRound size={12} /> Route guards evaluate the viewed role — viewing as a watchmaker bounces from desktop routes exactly as they would. The top-bar picker switches later without signing out.</p>
      </div>
    </div>
  );
}
