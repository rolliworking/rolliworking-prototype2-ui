import { Timer } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';

export default function RtShell() {
  const { user, station, signInWithPassword, signOut } = useAuth();
  return (
    <div data-testid="rt-shell" className="flex h-full flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-ink px-5 py-2 text-white">
        <Link to="/rt" data-testid="rt-brand" className="flex items-center gap-2 text-sm font-semibold tracking-tight"><Timer size={16} /> RolliTime <span className="text-[10px] font-normal text-white/60">timing bench · {station?.name ?? 'unregistered'}</span></Link>
        <div className="flex items-center gap-3 text-xs"><Provisional note="RolliTime is a NEW automation — no legacy precedent; tolerances and Witschi field mapping are provisional" />{user && <><span data-testid="rt-user">{user.shortName}</span><button data-testid="rt-sign-out" onClick={() => void signOut()} className="text-white/70 hover:text-white">Sign out</button></>}<Link to="/today" className="text-white/60 hover:text-white">← RolliSuite</Link></div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-5">{user ? <Outlet /> : <RtSignIn onSignIn={signInWithPassword} />}</main>
    </div>
  );
}

function RtSignIn({ onSignIn }: { onSignIn: (userId: string, password: string, photo: { dataUrl: null; cameraStatus: 'no_camera' }) => Promise<unknown> }) {
  const users = api.getDivisionStaff(api.getSessionDivision());
  const [userId, setUserId] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = () => onSignIn(userId, pw.trim(), { dataUrl: null, cameraStatus: 'no_camera' }).catch((e) => setErr(e.message));
  return <div data-testid="rt-sign-in" className="mx-auto mt-10 max-w-md space-y-3 rounded-lg border border-line bg-surface p-5">
    <h1 className="text-lg font-semibold text-ink">Who’s at the bench?</h1>
    <div className="grid grid-cols-2 gap-2">{users.map((u) => <button key={u.id} data-testid={`rt-card-${u.id}`} onClick={() => setUserId(u.id)} className={`rounded-md border p-2 text-left text-xs ${userId === u.id ? 'border-ink bg-canvas' : 'border-line hover:bg-canvas'}`}><div className="font-semibold">{u.shortName}</div><div className="text-ink-500">{u.dutyLabel}</div></button>)}</div>
    {userId && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}><input data-testid="rt-password" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" className="flex-1 rounded-md border border-line px-2 py-1 text-sm" /><Button variant="primary" data-testid="rt-sign-in-btn">Sign in</Button></form>}
    {err && <p data-testid="rt-error" className="text-xs text-rose-700">{err}</p>}
    <p className="text-[11px] text-ink-400">Standard card + password model · no camera at the bench (photo skipped, audited as no_camera).</p>
  </div>;
}
