import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';
import { TotpSetup } from '@/rc/RcTotpBits';

// Account creation for a client already on file: email → one-time verification link (emailed, mock Outbox) → password → authenticator → backup codes → signed in.
// Only the emailed link opens the password step — knowing an email is not enough to claim the account (D-357).
export default function RcSignupPage() {
  const { client, refresh } = useRcSession(); const [sp] = useSearchParams(); const next = sp.get('next') && sp.get('next')!.startsWith('/rc/') ? sp.get('next')! : '/rc/home'; const token = sp.get('verify');
  const [email, setEmail] = useState(''); const [sent, setSent] = useState<string | null>(null); const [verified, setVerified] = useState<{ email: string; firstName: string } | null>(null);
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [otpauth, setOtpauth] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!token) return; api.rcVerifyInvite(token).then((v) => { setVerified(v); setEmail(v.email); }).catch((ex) => setErr(ex instanceof Error ? ex.message : 'Invalid link')); }, [token]);
  if (client) return <Navigate to={next} replace />;
  const request = async (e?: React.FormEvent) => { e?.preventDefault(); setErr(null); setBusy(true); try { const r = await api.rcRequestSignup(email); setSent(r.maskedEmail); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); } };
  const create = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null);
    if (password !== confirm) { setErr('Passwords don’t match'); return; }
    setBusy(true); try { const r = await api.rcSignup(email, password, token!); setOtpauth(r.otpauth); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  const step = otpauth ? 'totp' : verified ? 'password' : sent ? 'check-email' : token ? 'verifying' : 'email';
  return <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-signup-page" data-step={step}>
    <h1 className="font-serif text-4xl font-light leading-tight tracking-tight sm:text-5xl">Create your account.</h1>
    <p className="mt-4 text-[15px] leading-relaxed text-rc-muted">Use the email the workshop has for you. We’ll send a one-time link to prove it’s yours; then you’ll set a password and an authenticator — the same two-step sign-in your bank uses.</p>
    {step === 'email' && <RcCard className="mt-8" eyebrow="Step 1 of 4" title="Your email" testId="rc-signup-card">
      <form onSubmit={request} className="space-y-4">
        <div><RcLabel htmlFor="su-email">Email on file</RcLabel><RcInput id="su-email" data-testid="rc-signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus autoComplete="email" /></div>
        <RcButton type="submit" data-testid="rc-signup-request" className="w-full" disabled={busy || !email}>{busy ? 'Sending…' : 'Email me a verification link'}</RcButton>
        <RcError text={err} />
      </form>
      <p className="mt-4 text-sm text-rc-muted">Already have an account? <Link to="/rc" data-testid="rc-go-login" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Sign in</Link>. Not a client yet? Message the workshop — accounts are created for clients on file.</p>
      <p className="mt-3 text-xs text-rc-muted">Preview: try <button type="button" data-testid="rc-signup-demo-harrison" onClick={() => setEmail('harrison.whitfield@example.com')} className="underline decoration-rc-accent underline-offset-2">harrison.whitfield@example.com</button></p>
    </RcCard>}
    {step === 'check-email' && <RcCard className="mt-8" eyebrow="Step 2 of 4" title="Check your email to continue" testId="rc-signup-sent">
      <p className="text-[15px] leading-relaxed text-rc-ink" data-testid="rc-signup-sent-text">We sent a one-time link to <span className="font-medium">{sent}</span>. Open it to choose your password and set up your authenticator. The link works once.</p>
      <p className="mt-3 text-xs text-rc-muted">Nothing here continues without that link — typing an email alone can’t claim an account.</p>
      <p className="mt-4 text-xs text-rc-muted">Prototype: emails aren’t really sent — staff can see the link in Intake ▸ Outbox.</p>
    </RcCard>}
    {step === 'verifying' && <RcCard className="mt-8" eyebrow="Verifying" title="Checking your link…" testId="rc-signup-verifying"><RcError text={err} />{err && <p className="mt-3 text-sm"><Link to="/rc/signup" className="underline decoration-rc-accent underline-offset-4">Request a new link</Link></p>}</RcCard>}
    {step === 'password' && verified && <RcCard className="mt-8" eyebrow="Step 3 of 4" title={`Email verified — welcome, ${verified.firstName}`} testId="rc-signup-card">
      <form onSubmit={create} className="space-y-4">
        <div><RcLabel htmlFor="su-email">Email</RcLabel><RcInput id="su-email" data-testid="rc-signup-email" type="email" value={email} readOnly className="opacity-70" /></div>
        <div><RcLabel htmlFor="su-pass">Password · at least 8 characters</RcLabel><RcInput id="su-pass" data-testid="rc-signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" /></div>
        <div><RcLabel htmlFor="su-pass2">Confirm password</RcLabel><RcInput id="su-pass2" data-testid="rc-signup-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></div>
        <RcButton type="submit" data-testid="rc-signup-create" className="w-full" disabled={busy || password.length < 8 || !confirm}>{busy ? 'Creating…' : 'Continue to authenticator'}</RcButton>
        <RcError text={err} />
      </form>
    </RcCard>}
    {step === 'totp' && otpauth && <TotpSetup email={email} otpauth={otpauth} onDone={() => void refresh()} />}
  </div>;
}
