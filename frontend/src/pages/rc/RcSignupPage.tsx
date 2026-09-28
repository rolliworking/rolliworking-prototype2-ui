import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';
import { TotpSetup } from '@/rc/RcTotpBits';

// Account creation for a client already on file: email → password → authenticator → backup codes → signed in
export default function RcSignupPage() {
  const { client, refresh } = useRcSession(); const [sp] = useSearchParams(); const next = sp.get('next') && sp.get('next')!.startsWith('/rc/') ? sp.get('next')! : '/rc/home';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [otpauth, setOtpauth] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (client) return <Navigate to={next} replace />;
  const create = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null);
    if (password !== confirm) { setErr('Passwords don’t match'); return; }
    setBusy(true); try { const r = await api.rcSignup(email, password); setOtpauth(r.otpauth); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-signup-page" data-step={otpauth ? 'totp' : 'account'}>
    <h1 className="font-serif text-4xl font-light leading-tight tracking-tight sm:text-5xl">Create your account.</h1>
    <p className="mt-4 text-[15px] leading-relaxed text-rc-muted">Use the email the workshop has for you. You’ll set a password and an authenticator — the same two-step sign-in your bank uses — so only you can see your photos, estimates and messages.</p>
    {!otpauth ? <RcCard className="mt-8" eyebrow="Step 1 of 3" title="Email and password" testId="rc-signup-card">
      <form onSubmit={create} className="space-y-4">
        <div><RcLabel htmlFor="su-email">Email on file</RcLabel><RcInput id="su-email" data-testid="rc-signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus autoComplete="email" /></div>
        <div><RcLabel htmlFor="su-pass">Password · at least 8 characters</RcLabel><RcInput id="su-pass" data-testid="rc-signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <div><RcLabel htmlFor="su-pass2">Confirm password</RcLabel><RcInput id="su-pass2" data-testid="rc-signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
        <RcButton type="submit" data-testid="rc-signup-create" className="w-full" disabled={busy || !email || password.length < 8 || !confirm}>{busy ? 'Creating…' : 'Continue to authenticator'}</RcButton>
        <RcError text={err} />
      </form>
      <p className="mt-4 text-sm text-rc-muted">Already have an account? <Link to="/rc" data-testid="rc-go-login" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Sign in</Link>. Not a client yet? Message the workshop — accounts are created for clients on file.</p>
      <p className="mt-3 text-xs text-rc-muted">Preview: try <button type="button" data-testid="rc-signup-demo-harrison" onClick={() => setEmail('harrison.whitfield@example.com')} className="underline decoration-rc-accent underline-offset-2">harrison.whitfield@example.com</button> or <button type="button" data-testid="rc-signup-demo-grace" onClick={() => setEmail('grace.nakamura@example.com')} className="underline decoration-rc-accent underline-offset-2">grace.nakamura@example.com</button>.</p>
    </RcCard>
    : <TotpSetup email={email} otpauth={otpauth} onDone={() => void refresh()} />}
  </div>;
}
