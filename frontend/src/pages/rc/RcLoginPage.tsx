import { KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';
import { TotpSetup } from '@/rc/RcTotpBits';

// Seeded demo states — Eleanor already has an account (password + authenticator); the others show the signup path
const DEMO = [
  { email: 'eleanor.vance@example.com', name: 'Eleanor Vance', state: 'has an account · password Rolli2026! · code 000000' },
  { email: 'harrison.whitfield@example.com', name: 'Harrison Whitfield', state: 'on file, no account yet — create one' },
  { email: 'grace.nakamura@example.com', name: 'Grace Nakamura', state: 'on file, no account yet — create one' },
];
const safeNext = (n: string | null) => (n && n.startsWith('/rc/') ? n : '/rc/home');

// Password + TOTP login — the magic link is retired: a link is not a credential
export default function RcLoginPage() {
  const { client, refresh } = useRcSession(); const [sp] = useSearchParams(); const next = safeNext(sp.get('next'));
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [step, setStep] = useState<'creds' | 'totp' | 'totp_setup'>('creds'); const [otpauth, setOtpauth] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (client) return <Navigate to={next} replace />;

  const signIn = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null); setBusy(true);
    try { const look = await api.rcLookup(email); if (look.clientOnFile && !look.hasAccount) { setErr('We have your email on file but no account yet — create one below.'); return; } const r = await api.rcSignIn(email, password); setOtpauth(r.otpauth ?? ''); setStep(r.step); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null); setBusy(true);
    try { await api.rcVerifyTotp(email, code); await refresh(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-login-page" data-step={step}>
      <h1 className="font-serif text-4xl font-light leading-tight tracking-tight sm:text-5xl">Your watches,<br />wherever you are.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-rc-muted">Sign in with your email, password and the 6-digit code from your authenticator. Photos, estimates and messages stay behind this door.</p>
      {sp.get('next') && <p data-testid="rc-login-next" className="mt-2 text-xs text-rc-muted">You’ll continue to <span className="font-mono">{next}</span> after signing in.</p>}

      {step === 'creds' && <RcCard className="mt-8" testId="rc-login-card">
        <form onSubmit={signIn} className="space-y-4">
          <div><RcLabel htmlFor="rc-email">Email</RcLabel><RcInput id="rc-email" data-testid="rc-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus autoComplete="email" /></div>
          <div><RcLabel htmlFor="rc-password">Password</RcLabel><RcInput id="rc-password" data-testid="rc-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          <RcButton type="submit" data-testid="rc-sign-in" className="w-full" disabled={busy || !email || !password}>{busy ? 'Checking…' : 'Continue'}</RcButton>
          <RcError text={err} />
        </form>
        <p className="mt-4 text-sm text-rc-muted">New here? <Link to={`/rc/signup${sp.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} data-testid="rc-go-signup" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Create your account</Link> — takes a minute.</p>
        <div className="mt-6 border-t border-rc-line pt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Preview accounts</div>
          <ul className="mt-2 space-y-1.5">{DEMO.map((d) => <li key={d.email}><button type="button" data-testid={`rc-demo-${d.email.split('@')[0].split('.')[0]}`} onClick={() => { setEmail(d.email); if (d.email.startsWith('eleanor')) setPassword('Rolli2026!'); }} className="text-left text-sm text-rc-ink hover:text-rc-accent"><span className="font-medium">{d.name}</span> <span className="text-rc-muted">— {d.state}</span></button></li>)}</ul>
        </div>
      </RcCard>}

      {step === 'totp' && <RcCard className="mt-8" eyebrow="Two-step verification" title="Enter your 6-digit code" testId="rc-totp-card">
        <p className="text-[15px] leading-relaxed text-rc-muted">Open your authenticator app and type the code for RolliConnect. Lost your phone? Use one of your backup codes instead.</p>
        <form onSubmit={verify} className="mt-5 space-y-4">
          <div><RcLabel htmlFor="rc-code">Authenticator or backup code</RcLabel><RcInput id="rc-code" data-testid="rc-totp-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000 000" autoFocus autoComplete="one-time-code" className="font-mono tracking-[0.3em]" /></div>
          <RcButton type="submit" data-testid="rc-totp-verify" className="w-full" disabled={busy || code.replace(/\s/g, '').length < 6}><ShieldCheck size={16} className="mr-1 inline" /> {busy ? 'Verifying…' : 'Sign in'}</RcButton>
          <RcError text={err} />
        </form>
        <div className="mt-5 rounded-md border border-dashed border-rc-accent/50 bg-rc-accentSoft px-4 py-3 text-xs text-rc-muted"><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-accent">Preview</span> · the demo authenticator always shows <span className="font-mono text-rc-ink">{api.RC_DEMO_TOTP}</span> · Eleanor’s unused backup codes include <span className="font-mono text-rc-ink">P3RT-8NW2</span></div>
        <button type="button" data-testid="rc-totp-back" onClick={() => { setStep('creds'); setCode(''); setErr(null); }} className="mt-4 inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink"><KeyRound size={13} /> Use a different account</button>
      </RcCard>}

      {step === 'totp_setup' && <TotpSetup email={email} otpauth={otpauth} onDone={() => void refresh()} />}
    </div>
  );
}
