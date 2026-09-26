import { Hammer, ShieldOff } from 'lucide-react';
import { useEffect, useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { AccessTier, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { MoneyContext } from '@/components/MoneyContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';

export const RW_NAV: { key: string; label: string; path: string; tiers: AccessTier[]; end?: boolean }[] = [
  { key: 'bench', label: 'Bench', path: '/rw', tiers: ['manager', 'concierge'], end: true },
  { key: 'jobs', label: 'Jobs', path: '/rw/jobs', tiers: ['manager', 'concierge'] },
  { key: 'parts', label: 'Parts', path: '/rw/parts', tiers: ['manager', 'concierge'] },
  { key: 'qc', label: 'QC', path: '/rw/qc', tiers: ['manager'] },
  { key: 'supervisor', label: 'Supervisor', path: '/rw/supervisor', tiers: ['manager'] },
  { key: 'floor', label: 'Floor', path: '/rw/floor', tiers: ['manager', 'concierge'] },
  { key: 'evidence', label: 'Evidence', path: '/rw/evidence', tiers: ['manager', 'concierge'] },
  { key: 'today', label: 'My today', path: '/rw/today', tiers: ['manager', 'concierge'] },
];

const JOB_LINK = /^\/jobs\/([^/?#]+)$/;

export default function RwShell() {
  const { user, station, signOut } = useAuth(); const nav = useNavigate(); const { pathname } = useLocation();
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => { document.title = 'RolliWorking'; return () => { document.title = 'RolliSuite — Prototype'; }; }, []);
  useEffect(() => { setBlocked(null); }, [pathname]);
  // Access boundary: RS links inside re-homed components are rewritten (jobs) or blocked (everything else)
  const guard = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null; if (!a) return;
    const url = new URL(a.href, window.location.origin); if (url.origin !== window.location.origin) return;
    const p = url.pathname; if (p.startsWith('/rw')) return;
    e.preventDefault(); e.stopPropagation();
    const m = JOB_LINK.exec(p); if (m) { nav(`/rw/jobs/${m[1]}`); return; }
    setBlocked(p);
  };
  return (
    <MoneyContext.Provider value={false}>
      <div data-testid="rw-shell" onClickCapture={guard} className="flex h-full flex-col bg-[#161b22] text-slate-100">
        <header className="flex items-center gap-4 border-b border-white/10 bg-[#0f131a] px-4 py-2">
          <NavLink to="/rw" data-testid="rw-brand" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white"><Hammer size={16} className="text-amber-400" /> RolliWorking <span className="text-[10px] font-normal text-white/50">workshop · {station?.name ?? 'unregistered'} · {station ? api.RG_DIVISION_LABEL[station.division] : ''}</span></NavLink>
          {user && <nav data-testid="rw-nav" className="flex items-center gap-1 text-xs">{RW_NAV.filter((n) => n.tiers.includes(user.accessTier)).map((n) => <NavLink key={n.key} to={n.path} end={n.end} data-testid={`rw-nav-${n.key}`} className={({ isActive }) => `rounded-sm px-2.5 py-1.5 font-medium ${isActive ? 'bg-amber-400 text-[#161b22]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>{n.label}</NavLink>)}</nav>}
          <div className="ml-auto flex items-center gap-3 text-xs"><Provisional note="RolliWorking standalone is an ACCESS BOUNDARY in Keeper: bench tiers authenticate into RW only and cannot reach RS. The prototype shares one origin and one station session." />{user && <><span data-testid="rw-user" className="text-white/80">{user.shortName} · {user.dutyLabel}</span><button data-testid="rw-sign-out" onClick={() => void signOut()} className="text-white/60 hover:text-white">Sign out</button></>}</div>
        </header>
        {blocked && <div data-testid="rw-blocked" className="flex items-center gap-2 border-b border-rose-900/50 bg-rose-950/60 px-4 py-1.5 text-xs text-rose-200"><ShieldOff size={12} /> <span className="font-mono">{blocked}</span> is a RolliSuite screen — not reachable from RolliWorking (access boundary). Use a front-desk station.<button onClick={() => setBlocked(null)} className="ml-auto text-rose-300 hover:text-white">dismiss</button></div>}
        <main className="rw-dark min-h-0 flex-1 overflow-y-auto p-4">
          {user ? <Outlet /> : <RwSignIn />}
        </main>
      </div>
    </MoneyContext.Provider>
  );
}

export const RwRestricted = ({ label }: { label: string }) => <div data-testid="rw-restricted" className="mx-auto mt-10 max-w-md rounded-md border border-white/10 bg-[#1f2630] p-5 text-sm text-slate-300"><p className="font-semibold text-white">{label} is for supervisors and managers.</p><p className="mt-1 text-xs text-slate-400">Your card is bench-tier. Ask a supervisor to assign or review from their board.</p></div>;

function RwSignIn() {
  const { signInWithPassword, switchWithPin } = useAuth();
  const users = api.getDivisionStaff(api.getSessionDivision());
  const [sel, setSel] = useState<User | null>(null); const [today, setToday] = useState(false); const [secret, setSecret] = useState(''); const [err, setErr] = useState<string | null>(null);
  const pick = (u: User) => { setSel(u); setSecret(''); setErr(null); api.hasSignedInToday(u.id).then(setToday); };
  const go = () => { if (!sel) return; const p = today ? switchWithPin(sel.id, secret.trim()) : signInWithPassword(sel.id, secret.trim(), { dataUrl: null, cameraStatus: 'no_camera' }); p.catch((e) => setErr(e.message)); };
  return <div data-testid="rw-sign-in" className="mx-auto mt-8 max-w-lg space-y-3 rounded-md border border-white/10 bg-[#1f2630] p-5">
    <h1 className="text-lg font-semibold text-white">Who’s on the bench?</h1>
    <p className="text-xs text-slate-400">Same card model as RolliSuite — password on your first sign-in of the day, PIN after. Station division decides who appears here.</p>
    <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rw-card-${u.id}`} onClick={() => pick(u)} className={`rounded-md border p-2.5 text-left text-xs ${sel?.id === u.id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 hover:bg-white/5'}`}><div className="font-semibold text-white">{u.shortName}</div><div className="text-slate-400">{u.dutyLabel}</div></button>)}</div>
    {sel && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}><input data-testid="rw-secret" type="password" autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={today ? 'PIN (fast switch)' : 'password (first sign-in today)'} inputMode={today ? 'numeric' : undefined} className="flex-1 rounded-md border border-white/10 px-3 py-2 text-sm" /><Button variant="primary" data-testid="rw-sign-in-btn">{today ? 'PIN in' : 'Sign in'}</Button></form>}
    {err && <p data-testid="rw-error" className="text-xs text-rose-400">{err}</p>}
    <p className="text-[11px] text-slate-500">No camera on the bench — photo step skipped, audited as no_camera.</p>
  </div>;
}
