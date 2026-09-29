import { CalendarDays, Clock3, ShieldCheck, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { PinPad } from './RgBits';

export interface RgContext { user: User; signOut: () => Promise<void>; offline: boolean; queued: number; refresh: () => void }
export const useRg = () => useOutletContext<RgContext>();

// Connectivity + offline queue live in the shell so every /rg page sees the same banner and the sync fires once
export const useRgOffline = () => {
  const [offline, setOffline] = useState(api.rgIsOffline()); const [queued, setQueued] = useState(api.rgQueueCount()); const [synced, setSynced] = useState<number | null>(null);
  const refresh = useCallback(() => { setOffline(api.rgIsOffline()); setQueued(api.rgQueueCount()); }, []);
  const sync = useCallback(async () => { const s = await api.rgSyncQueue(); if (s.length) { setSynced(s.length); setTimeout(() => setSynced(null), 6000); } refresh(); }, [refresh]);
  useEffect(() => {
    void sync();
    const on = () => void sync(); const off = () => refresh(); const st = () => void sync();
    window.addEventListener('online', on); window.addEventListener('offline', off); window.addEventListener('rg-settings', st);
    const t = setInterval(() => void sync(), 15_000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('rg-settings', st); clearInterval(t); };
  }, [sync, refresh]);
  return { offline, queued, synced, refresh };
};

export const OfflineBanner = ({ offline, queued, synced }: { offline: boolean; queued: number; synced: number | null }) => {
  if (offline) return <div data-testid="rg-offline-banner" className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900"><WifiOff size={13} /> No signal — punches are saved on this device{queued > 0 && <> · <span data-testid="rg-queued-count">{queued} waiting to sync</span></>}</div>;
  if (synced) return <div data-testid="rg-synced-banner" className="rounded-md bg-sky-100 px-3 py-2 text-xs font-medium text-sky-900">Back online — {synced} punch{synced > 1 ? 'es' : ''} synced (marked synced-late)</div>;
  return null;
};

export default function RgShell() {
  const [user, setUser] = useState<User | null>(() => api.rgGetSession());
  const { offline, queued, synced, refresh } = useRgOffline();
  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = '/rg-manifest.webmanifest';
    const theme = document.createElement('meta'); theme.name = 'theme-color'; theme.content = '#1c2430';
    document.head.append(link, theme); document.title = 'RGTime';
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/rg-sw.js', { scope: '/rg' }).catch(() => undefined);
    return () => { link.remove(); theme.remove(); document.title = 'RolliSuite — Prototype'; };
  }, []);
  const signOut = async () => { await api.rgSignOut(); setUser(null); };
  const canManage = user && user.accessTier !== undefined;
  return (
    <div data-testid="rg-shell" className="flex h-full flex-col bg-canvas">
      <header className="flex items-center justify-between bg-ink px-4 py-2.5 text-white">
        <Link to="/rg" data-testid="rg-brand" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><Clock3 size={16} /> RGTime</Link>
        <div className="flex items-center gap-3 text-xs">{user && <>
          <NavLink to="/rg/week" data-testid="rg-nav-week" className={({ isActive }) => `inline-flex items-center gap-1 ${isActive ? 'text-white' : 'text-white/70 hover:text-white'}`}><CalendarDays size={13} /> My week</NavLink>
          {canManage && <NavLink to="/rg/manager" data-testid="rg-nav-manager" className={({ isActive }) => `inline-flex items-center gap-1 ${isActive ? 'text-white' : 'text-white/70 hover:text-white'}`}><ShieldCheck size={13} /> Manager</NavLink>}
          <span data-testid="rg-user" className="font-semibold">{user.shortName}</span><button data-testid="rg-sign-out" onClick={() => void signOut()} className="text-white/60 hover:text-white">Forget</button></>}</div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-sm space-y-4">
          <OfflineBanner offline={offline} queued={queued} synced={synced} />
          {user ? <Outlet context={{ user, signOut, offline, queued, refresh } satisfies RgContext} /> : <RgSignIn onSignedIn={setUser} />}
          <p className="px-1 text-[10px] leading-relaxed text-ink-400">Installable web app — add to your home screen. Your name is remembered on this phone; a tag tap opens straight to the button. <Link to="/rg/kiosk" data-testid="rg-kiosk-link" className="underline">Wall kiosk mode →</Link></p>
        </div>
      </main>
    </div>
  );
}

function RgSignIn({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const users = api.rgAllStaff();
  const [userId, setUserId] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = useCallback((secret: string) => api.rgSignIn(userId, secret.trim()).then(onSignedIn).catch((e) => setErr(e.message)), [userId, onSignedIn]);
  return <div data-testid="rg-sign-in" className="space-y-3 rounded-lg border border-line bg-surface p-4">
    <h1 className="text-lg font-semibold text-ink">{userId ? `Hi ${users.find((u) => u.id === userId)?.shortName} — your PIN` : 'Whose phone is this?'}</h1>
    <p className="text-xs text-ink-500">One time only. After this, a tag tap clocks you straight in or out.</p>
    {!userId ? <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rg-card-${u.id}`} onClick={() => { setUserId(u.id); setErr(null); }} className="rounded-md border border-line p-3 text-left text-sm hover:bg-canvas"><div className="font-semibold">{u.shortName}</div><div className="text-[11px] text-ink-500">{u.dutyLabel}</div></button>)}</div>
      : <><PinPad onSubmit={go} error={err} /><button data-testid="rg-sign-in-back" onClick={() => setUserId('')} className="block w-full text-center text-xs text-ink-500 underline">Not you? Pick another name</button></>}
  </div>;
}
