import { Fingerprint, Hammer, ShieldOff, WifiOff } from 'lucide-react';
import * as off from '@/api/offline';
import * as wa from '@/api/webauthn';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { AccessTier, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { MoneyContext } from '@/components/MoneyContext';
import { padAllowed, roleKind } from '@/config/roles';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';
import { IntercomButton, PageBanner } from '@/components/layout/IntercomPanel';
import { RoleTabBar } from '@/components/rw/RoleTabBar';
import { MessagesButton } from '@/components/layout/MessagesPopover';
import { MessageBubble } from '@/components/layout/MessageBubble';
import { ViewAsPicker } from '@/components/layout/ViewAs';

export const RW_NAV: { key: string; label: string; path: string; tiers: AccessTier[]; end?: boolean }[] = [
  { key: 'hitlist', label: 'Hitlist', path: '/rw/hitlist', tiers: ['manager', 'concierge'] },
  { key: 'bench', label: 'Bench', path: '/rw', tiers: ['manager', 'concierge'], end: true },
  { key: 'floor', label: 'Shop Floor', path: '/rw/floor', tiers: ['manager', 'concierge'] },
  { key: 'assign', label: 'Assign / Move', path: '/rw/assign', tiers: ['manager'] },
  { key: 'queue', label: 'Work Queue', path: '/rw/queue', tiers: ['manager'] },
  { key: 'bulk', label: 'Bulk Assign', path: '/rw/bulk', tiers: ['manager'] },
  { key: 'jobs', label: 'Jobs', path: '/rw/jobs', tiers: ['manager', 'concierge'] },
  { key: 'parts', label: 'Parts', path: '/rw/parts', tiers: ['manager', 'concierge'] },
  { key: 'wm', label: 'WM Room', path: '/rw/wm', tiers: ['manager', 'concierge'] },
  { key: 'station', label: 'Station Scan', path: '/rw/station', tiers: ['manager'] },
  { key: 'testing', label: 'Testing', path: '/rw/testing', tiers: ['manager', 'concierge'] },
  { key: 'qc', label: 'QC', path: '/rw/qc', tiers: ['manager'] },
  { key: 'supervisor', label: 'Supervisor', path: '/rw/supervisor', tiers: ['manager'] },
  { key: 'pad', label: 'Pad', path: '/rw/pad', tiers: ['manager', 'concierge'] },
  { key: 'band', label: 'Band Pad', path: '/rw/band', tiers: ['manager'] },
  { key: 'history', label: 'History', path: '/rw/history', tiers: ['manager', 'concierge'] },
  { key: 'reports', label: 'Reports', path: '/rw/reports', tiers: ['manager'] },
  { key: 'bench-pad', label: 'Bench Pad', path: '/rw/bench', tiers: ['manager', 'concierge'] },
  { key: 'picking', label: 'Picking', path: '/rw/picking', tiers: ['manager', 'concierge'] },
  { key: 'evidence', label: 'Evidence', path: '/rw/evidence', tiers: ['manager', 'concierge'] },
];

const JOB_LINK = /^\/jobs\/([^/?#]+)$/;
const SWO_LINK = /^\/swo\/([^/?#]+)$/;
// Supervisor tab bar (MM: Pad · Team hitlist · Queue · Assign · Messages) — visible to any pad-tier role even below manager tier
const SUPERVISOR_NAV = ['pad', 'band', 'hitlist', 'queue', 'assign', 'jobs'];

export default function RwShell() {
  const { user, station, signOut } = useAuth(); const nav = useNavigate(); const { pathname } = useLocation();
  const [blocked, setBlocked] = useState<string | null>(null);
  const bench = pathname.startsWith('/rw/bench'); const fullscreen = bench || (user && /^\/rw\/(wm|pad|band|picking)/.test(pathname));
  useEffect(() => { document.title = 'RolliWorking'; return () => { document.title = 'RolliSuite — Prototype'; }; }, []);
  // PWA: /rw carries its own manifest (start_url /rw, standalone, landscape) + iOS meta so Add to Home Screen installs the workshop pad, not the desktop app
  useEffect(() => { const link = document.createElement('link'); link.rel = 'manifest'; link.href = '/rw-manifest.webmanifest'; link.dataset.rw = '1'; document.head.appendChild(link); const metas = [['apple-mobile-web-app-capable', 'yes'], ['apple-mobile-web-app-status-bar-style', 'black-translucent'], ['apple-mobile-web-app-title', 'RolliWorking']].map(([n, c]) => { const m = document.createElement('meta'); m.name = n; m.content = c; document.head.appendChild(m); return m; }); return () => { link.remove(); metas.forEach((m) => m.remove()); }; }, []);
  const { online, queued } = off.useOnline();
  // Guided Access owner path (NOT-KEEPER heuristic): long-press the brand 1.2 s → MH PIN → /choose-view without leaving the kiosk
  const press = useRef<number | null>(null); const [ownerPin, setOwnerPin] = useState<string | null>(null);
  const pressStart = () => { press.current = window.setTimeout(() => setOwnerPin(''), 1200); }; const pressEnd = () => { if (press.current) window.clearTimeout(press.current); press.current = null; };
  useEffect(() => { setBlocked(null); }, [pathname]);
  // Access boundary: RS links inside re-homed components are rewritten (jobs) or blocked (everything else)
  const guard = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null; if (!a) return;
    const url = new URL(a.href, window.location.origin); if (url.origin !== window.location.origin) return;
    const p = url.pathname; if (p.startsWith('/rw')) return;
    e.preventDefault(); e.stopPropagation();
    const m = JOB_LINK.exec(p); if (m) { nav(`/rw/jobs/${m[1]}${url.hash}`); return; }
    const sw = SWO_LINK.exec(p); if (sw) { nav(`/rw/swo/${sw[1]}`); return; }
    setBlocked(p);
  };
  return (
    <MoneyContext.Provider value={user?.accessTier === 'manager' && api.limitsOf(user).pricing !== 'none'}>
      <div data-testid="rw-shell" onClickCapture={guard} className="flex h-full flex-col bg-[#161b22] text-slate-100">
        {!fullscreen && <header className="flex items-center gap-4 border-b border-white/10 bg-[#0f131a] px-4 py-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
          <NavLink to="/rw" data-testid="rw-brand" onPointerDown={pressStart} onPointerUp={pressEnd} onPointerLeave={pressEnd} onContextMenu={(e) => e.preventDefault()} className="flex min-h-[44px] items-center gap-2 text-sm font-semibold tracking-tight text-white"><Hammer size={16} className="text-amber-400" /> RolliWorking <span className="text-[10px] font-normal text-white/50">workshop · {station?.name ?? 'unregistered'} · {station ? api.RG_DIVISION_LABEL[station.division] : ''}</span></NavLink>
          {user && <nav data-testid="rw-nav" className="flex items-center gap-1 text-xs">{RW_NAV.filter((n) => (roleKind(user) === 'supervisor' && user.accessTier !== 'manager' ? SUPERVISOR_NAV.includes(n.key) : n.tiers.includes(user.accessTier) || (padAllowed(roleKind(user)) && SUPERVISOR_NAV.includes(n.key)))).map((n) => <NavLink key={n.key} to={n.path} end={n.end} data-testid={`rw-nav-${n.key}`} className={({ isActive }) => `rounded-sm px-2.5 py-1.5 font-medium ${isActive ? 'bg-accent text-[#161b22]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>{n.label}</NavLink>)}</nav>}
          <div className="ml-auto flex items-center gap-3 text-xs"><ViewAsPicker dark /><MessagesButton dark /><IntercomButton dark /><NavLink to="/rw/device" data-testid="rw-nav-device" className="text-white/60 hover:text-white">Device</NavLink><Provisional note="RolliWorking standalone is an ACCESS BOUNDARY in Keeper: bench tiers authenticate into RW only and cannot reach RS. The prototype shares one origin and one station session." />{user && <><span data-testid="rw-user" className="text-white/80">{user.shortName} · {user.dutyLabel}</span><button data-testid="rw-sign-out" onClick={() => void signOut()} className="text-white/60 hover:text-white">Sign out</button></>}</div>
        </header>}
        {fullscreen && <PageBanner />}
        {!online && <div data-testid="rw-offline-banner" className="flex min-h-[44px] items-center gap-2 border-b border-amber-900/50 bg-amber-950/70 px-4 text-xs text-amber-100"><WifiOff size={13} /> Offline — board is read-only · scans queue and replay when back online ({queued} queued) · custody only changes on a confirmed scan</div>}
        {online && queued > 0 && <div data-testid="rw-replay-banner" className="flex min-h-[44px] items-center gap-2 border-b border-white/10 bg-[#1f2630] px-4 text-xs text-slate-200">{queued} queued scan{queued === 1 ? '' : 's'} from the offline period<button data-testid="rw-replay-now" onClick={() => void off.replayQueue(async (q) => { if (q.kind === 'station' && q.station) await api.stationScan(q.station as api.RwStationKey, q.code); })} className="ml-auto min-h-[36px] rounded-md bg-accent px-3 font-semibold text-[#161b22]">Replay now</button><NavLink to="/rw/device" className="underline">Device check</NavLink></div>}
        {ownerPin !== null && <OwnerPinGate pin={ownerPin} onChange={setOwnerPin} onClose={() => setOwnerPin(null)} onOk={() => { setOwnerPin(null); nav('/choose-view'); }} />}
        {blocked && <div data-testid="rw-blocked" className="flex items-center gap-2 border-b border-rose-900/50 bg-rose-950/60 px-4 py-1.5 text-xs text-rose-200"><ShieldOff size={12} /> <span className="font-mono">{blocked}</span> is a RolliSuite screen — not reachable from RolliWorking (access boundary). Use a front-desk station.<button onClick={() => setBlocked(null)} className="ml-auto text-rose-300 hover:text-white">dismiss</button></div>}
        <main className={`rw-dark min-h-0 flex-1 overflow-y-auto ${fullscreen ? '' : 'p-4'} ${user ? 'pb-16' : ''}`}>
          {user || bench ? <Outlet /> : <RwSignIn />}
        </main>
        {user && <RoleTabBar />}
        {user && <MessageBubble variant="rw" />}
      </div>
    </MoneyContext.Provider>
  );
}

const OwnerPinGate = ({ pin, onChange, onClose, onOk }: { pin: string; onChange: (v: string) => void; onClose: () => void; onOk: () => void }) => {
  const owner = api.getDivisionStaff('rolliworks').find((u) => u.id === api.OWNER_USER_ID); const [err, setErr] = useState<string | null>(null);
  return <div data-testid="owner-pin-gate" className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6" onClick={onClose}>
    <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (owner && pin === owner.pin) onOk(); else setErr('Owner PIN not recognised'); }} className="w-full max-w-sm space-y-3 rounded-3xl border border-white/10 bg-[#1f2630] p-5">
      <h2 className="text-lg font-semibold text-white">Owner path · Guided Access</h2><p className="text-xs text-slate-400">MH PIN opens /choose-view without leaving the kiosk. NOT-KEEPER heuristic — long-press on the brand.</p>
      <input data-testid="owner-pin-input" autoFocus type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin} onChange={(e) => onChange(e.target.value)} className="min-h-[52px] w-full rounded-2xl border border-white/15 bg-[#0f131a] px-4 text-center text-2xl tracking-[0.5em] text-white" />
      {err && <p data-testid="owner-pin-error" className="text-sm text-rose-400">{err}</p>}
      <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-[48px] flex-1 rounded-2xl border border-white/20 text-slate-100">Cancel</button><button type="submit" data-testid="owner-pin-go" className="min-h-[48px] flex-1 rounded-2xl bg-accent font-semibold text-[#161b22]">Open choose-view</button></div>
    </form>
  </div>;
};

export const RwRestricted = ({ label }: { label: string }) => <div data-testid="rw-restricted" className="mx-auto mt-10 max-w-md rounded-md border border-white/10 bg-[#1f2630] p-5 text-sm text-slate-300"><p className="font-semibold text-white">{label} is for supervisors and managers.</p><p className="mt-1 text-xs text-slate-400">Your card is bench-tier. Ask a supervisor to assign or review from their board.</p></div>;

function RwSignIn() {
  const { signInWithPassword, switchWithPin, signInWithTouchId } = useAuth();
  const users = api.getDivisionStaff(api.getSessionDivision());
  const [sel, setSel] = useState<User | null>(null); const [today, setToday] = useState(false); const [secret, setSecret] = useState(''); const [err, setErr] = useState<string | null>(null); const [touch, setTouch] = useState(false);
  useEffect(() => { void wa.platformAuthenticatorAvailable().then(setTouch); }, []);
  const touchId = async () => { if (!sel) return; try { if (!wa.enrolledCredential(sel.id)) await wa.enrolTouchId(sel); const ok = await wa.assertTouchId(sel.id); if (!ok) throw new Error('Credential did not match'); await signInWithTouchId(sel.id); } catch (e) { setErr(e instanceof Error ? `${e.name === 'NotAllowedError' ? 'Touch ID cancelled' : e.message}` : 'Touch ID failed'); } };
  const pick = (u: User) => { setSel(u); setSecret(''); setErr(null); api.hasSignedInToday(u.id).then(setToday); };
  const go = () => { if (!sel) return; const p = today ? switchWithPin(sel.id, secret.trim()) : signInWithPassword(sel.id, secret.trim(), { dataUrl: null, cameraStatus: 'no_camera' }); p.catch((e) => setErr(e.message)); };
  return <div data-testid="rw-sign-in" className="mx-auto mt-8 max-w-lg space-y-3 rounded-md border border-white/10 bg-[#1f2630] p-5">
    <h1 className="text-lg font-semibold text-white">Who’s on the bench?</h1>
    <p className="text-xs text-slate-400">Same card model as RolliSuite — password on your first sign-in of the day, PIN after. Station division decides who appears here.</p>
    <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rw-card-${u.id}`} onClick={() => pick(u)} className={`rounded-md border p-2.5 text-left text-xs ${sel?.id === u.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:bg-white/5'}`}><div className="font-semibold text-white">{u.shortName}</div><div className="text-slate-400">{u.dutyLabel}</div></button>)}</div>
    {sel && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}><input data-testid="rw-secret" type="password" autoFocus value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={today ? 'PIN (fast switch)' : 'password (first sign-in today)'} inputMode={today ? 'numeric' : undefined} pattern={today ? '[0-9]*' : undefined} className="min-h-[44px] flex-1 rounded-md border border-white/10 px-3 py-2 text-sm" /><Button variant="primary" data-testid="rw-sign-in-btn">{today ? 'PIN in' : 'Sign in'}</Button></form>}
    {sel && touch && <button type="button" data-testid="rw-touch-id" onClick={() => void touchId()} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-accent/50 bg-accent/10 px-3 text-sm font-semibold text-accent"><Fingerprint size={16} /> {wa.enrolledCredential(sel.id) ? `Touch ID · ${sel.shortName}` : `Set up Touch ID for ${sel.shortName} on this pad`}</button>}
    {sel && !touch && <p data-testid="rw-touch-id-unavailable" className="text-[11px] text-slate-500">Touch ID sign-in appears here on a pad with a platform authenticator (HTTPS + iPadOS). Web Push / badges need the PWA installed to the Home Screen.</p>}
    {err && <p data-testid="rw-error" className="text-xs text-rose-400">{err}</p>}
    <p className="text-[11px] text-slate-500">No camera on the bench — photo step skipped, audited as no_camera.</p>
  </div>;
}
