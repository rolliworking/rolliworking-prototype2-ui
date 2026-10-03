import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import * as org from '@/api/org';
import type { User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';

const field = 'h-10 w-full rounded-sm border border-line bg-canvas px-3 text-[14px] focus:border-ink focus:bg-surface focus:outline-none';

// First sign-in for an invited staffer: 6-digit invite code → choose password + PIN → signed in (counts as the day's first sign-in)
export const StaffInviteActivate = ({ user, onBack, onDone }: { user: User; onBack: () => void; onDone: () => void }) => {
  const { signInWithPassword } = useAuth();
  const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const expired = org.staffStatusSync(user) === 'expired';
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(null);
    try { await org.activateStaffInvite(user.id, code, password, pin); await signInWithPassword(user.id, password, { dataUrl: null, cameraStatus: 'no_camera' }); onDone(); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Activation failed'); setBusy(false); }
  };
  return <form onSubmit={submit} data-testid="invite-activate" className="animate-rise rounded-md border-l-[3px] border-moss bg-surface p-6 shadow-card">
    <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-moss-700"><ShieldCheck size={14} /> First sign-in · invite</div>
    <h2 className="text-lg font-semibold tracking-tight text-ink">Welcome, {user.shortName}</h2>
    <p className="mt-1 text-xs text-ink-500">Enter the 6-digit code from your invite ({user.invite?.channel === 'sms' ? 'text message' : 'email'}), then choose the password and PIN you will use at every station.</p>
    {expired && <p data-testid="invite-expired" className="mt-3 rounded-sm bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">This invite expired — ask a manager to resend it from Setup → Organisation → Staff.</p>}
    <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-500">Invite code<input data-testid="invite-code" inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" className={`${field} mt-1.5 font-mono tracking-[0.3em]`} /></label>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">New password<input data-testid="invite-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 6 characters" className={`${field} mt-1.5`} /></label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-ink-500">4-digit PIN<input data-testid="invite-pin" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className={`${field} mt-1.5 font-mono`} /></label>
    </div>
    {err && <p data-testid="invite-error" className="mt-3 text-xs font-medium text-rose-700">{err}</p>}
    <div className="mt-5 flex items-center justify-between">
      <button type="button" data-testid="invite-back" onClick={onBack} className="text-xs text-ink-500 hover:text-ink">← Not you? Back</button>
      <Button type="submit" variant="primary" data-testid="invite-submit" disabled={busy || expired || code.length !== 6 || password.length < 6 || pin.length !== 4}><KeyRound size={13} /> {busy ? 'Activating…' : 'Activate & sign in'}</Button>
    </div>
  </form>;
};
