import { Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useOutletContext } from 'react-router-dom';
import * as api from '@/api/client';
import type { User } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';

export interface RgContext { user: User; signOut: () => Promise<void> }
export const useRg = () => useOutletContext<RgContext>();

export default function RgShell() {
  const [user, setUser] = useState<User | null>(() => api.rgGetSession());
  useEffect(() => {
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = '/rg-manifest.webmanifest';
    const theme = document.createElement('meta'); theme.name = 'theme-color'; theme.content = '#1c2430';
    document.head.append(link, theme); document.title = 'RGTime';
    return () => { link.remove(); theme.remove(); document.title = 'RolliSuite — Prototype'; };
  }, []);
  const signOut = async () => { await api.rgSignOut(); setUser(null); };
  return (
    <div data-testid="rg-shell" className="flex h-full flex-col bg-canvas">
      <header className="flex items-center justify-between bg-ink px-4 py-2.5 text-white">
        <Link to="/rg" data-testid="rg-brand" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><Clock3 size={16} /> RGTime <span className="text-[10px] font-normal text-white/60">time-clock · phone app</span></Link>
        <div className="flex items-center gap-3 text-xs">{user && <><span data-testid="rg-user">{user.shortName}</span><button data-testid="rg-sign-out" onClick={() => void signOut()} className="text-white/70 hover:text-white">Forget phone</button></>}</div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-sm space-y-4">
          {user ? <Outlet context={{ user, signOut } satisfies RgContext} /> : <RgSignIn onSignedIn={setUser} />}
          <p className="px-1 text-[10px] leading-relaxed text-ink-400"><Provisional note="RGTime owns staff identity in Keeper (D-026). Prototype reads the shared users fixture. Plain NFC tags are cloneable — hardening (NTAG 424 rotating codes / geolocation sanity check) is a Keeper decision, not built here." /> Installable web app — add to your home screen; your sign-in is remembered on this phone.</p>
        </div>
      </main>
    </div>
  );
}

function RgSignIn({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const users = api.rgAllStaff();
  const [userId, setUserId] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = () => api.rgSignIn(userId, pw.trim()).then(onSignedIn).catch((e) => setErr(e.message));
  return <div data-testid="rg-sign-in" className="space-y-3 rounded-lg border border-line bg-surface p-4">
    <h1 className="text-lg font-semibold text-ink">Who’s phone is this?</h1>
    <p className="text-xs text-ink-500">Sign in once — RGTime remembers you on this device so an NFC tap clocks you straight in.</p>
    <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rg-card-${u.id}`} onClick={() => { setUserId(u.id); setErr(null); }} className={`rounded-md border p-2 text-left text-xs ${userId === u.id ? 'border-ink bg-canvas' : 'border-line hover:bg-canvas'}`}><div className="font-semibold">{u.shortName}</div><div className="text-ink-500">{u.dutyLabel}</div></button>)}</div>
    {userId && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}><input data-testid="rg-password" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" className="flex-1 rounded-md border border-line px-2 py-2 text-sm" /><Button variant="primary" data-testid="rg-sign-in-btn">Remember me</Button></form>}
    {err && <p data-testid="rg-error" className="text-xs text-rose-700">{err}</p>}
  </div>;
}
