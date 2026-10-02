import { Fingerprint, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { assertTouchId, enrolledCredential } from '@/api/webauthn';
import { CodeInput, DevFillCode, RcNote } from '@/rc/RcAuthBits';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Seeded demo states — Eleanor already has an account; the others are on file and get one on their first verified code
const DEMO = [
  { email: 'eleanor.vance@example.com', name: 'Eleanor Vance', state: 'has an account · code arrives in Intake ▸ Sent' },
  { email: 'harrison.whitfield@example.com', name: 'Harrison Whitfield', state: 'on file, no account yet — first code creates it' },
  { email: 'grace.nakamura@example.com', name: 'Grace Nakamura', state: 'on file, no account yet — first code creates it' },
];
const safeNext = (n: string | null) => (n && n.startsWith('/rc/') ? n : '/rc/home');

// PASSWORDLESS sign-in (MH ruling 2026-10-01): email → 6-digit code or the emailed link → signed in. Touch ID once enrolled. Password + TOTP retired (D-357).
// "Create your account" is the same door: the first verified code creates the account and attaches it to the client on file (same email = same person).
export default function RcLoginPage({ mode: forcedMode }: { mode?: 'signin' | 'create' } = {}) {
  const { client, refresh } = useRcSession(); const [sp] = useSearchParams(); const next = safeNext(sp.get('next'));
  const mode = forcedMode ?? (sp.get('mode') === 'create' ? 'create' : 'signin');
  const [email, setEmail] = useState(sp.get('email') ?? ''); const [code, setCode] = useState('');
  const [ch, setCh] = useState<{ challengeId: string; maskedEmail: string; expiresAt: string } | null>(null);
  const [look, setLook] = useState<Awaited<ReturnType<typeof api.rcLookup>> | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { const e = sp.get('email'); if (e) { setEmail(e); setCh(null); } }, [sp]);
  useEffect(() => { if (!email.includes('@')) { setLook(null); return; } const t = setTimeout(() => api.rcLookup(email).then(setLook), 200); return () => clearTimeout(t); }, [email]);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  if (client) return <Navigate to={next} replace />;
  const touchReady = !!look?.touchIdEnrolled && !!look?.hasAccount && (() => { const c = api.clientIdByEmailSync(email); return !!c && !!enrolledCredential(`rc:${c}`); })();

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr(null); setBusy(true);
    try { const r = await api.rcRequestCode(email, { next }); setCh(r); setCode(''); setCooldown(Math.round(api.RC_RESEND_COOLDOWN_MS / 1000)); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  const verify = async (c = code) => { if (!ch) return; setErr(null); setBusy(true); try { await api.rcVerifyCode(ch.challengeId, c); await refresh(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); } };
  const viaTouch = async () => { setErr(null); setBusy(true); try { const id = api.clientIdByEmailSync(email)!; const ok = await assertTouchId(`rc:${id}`); if (!ok) throw new Error('Touch ID did not verify'); await api.rcSignInWithTouchId(email); await refresh(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Touch ID failed — use a code instead'); } finally { setBusy(false); } };
  const step = ch ? 'code' : 'email';

  return (
    <div className="mx-auto max-w-[520px] pt-4 sm:pt-8" data-testid="rc-login-page" data-step={step} data-mode={mode}>
      <h1 className="font-serif text-4xl font-light leading-tight tracking-tight sm:text-5xl">{mode === 'create' ? <>Create your account.</> : <>Your watches,<br />wherever you are.</>}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-rc-muted">{mode === 'create' ? 'Use the email the workshop has for you. We email a one-time code; entering it proves it’s you and opens your account — every watch, estimate and message we already have on file. No password to invent.' : 'Enter your email and we’ll send a one-time code (and a link). No passwords — the code is the key. Once you’re in, you can turn on Touch ID for next time.'}</p>
      {sp.get('next') && <p data-testid="rc-login-next" className="mt-2 text-xs text-rc-muted">You’ll continue to <span className="font-mono">{next}</span> after signing in.</p>}

      {step === 'email' && <RcCard className="mt-6 sm:mt-8" testId="rc-login-card">
        <form onSubmit={send} className="space-y-4">
          <div><RcLabel htmlFor="rc-email">Email</RcLabel><RcInput id="rc-email" data-testid="rc-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus={!email} autoComplete="email" /></div>
          {look && email.includes('@') && <p data-testid="rc-lookup" data-state={look.clientOnFile ? (look.hasAccount ? 'account' : 'on-file') : 'unknown'} className="text-xs text-rc-muted">{look.clientOnFile ? look.hasAccount ? `Welcome back${look.firstName ? `, ${look.firstName}` : ''}.` : `We have you on file${look.firstName ? `, ${look.firstName}` : ''} — your first code creates your account.` : 'Not on file — use the address the workshop contacts you at, or message us.'}</p>}
          <RcButton type="submit" data-testid="rc-send-code" className="w-full" disabled={busy || !email.includes('@')}><Mail size={16} /> {busy ? 'Sending…' : 'Email me a code'}</RcButton>
          {touchReady && <RcButton type="button" tone="quiet" data-testid="rc-touch-signin" className="w-full" disabled={busy} onClick={viaTouch}><Fingerprint size={16} /> Sign in with Touch ID</RcButton>}
          <RcError text={err} />
        </form>
        <div className="mt-6 border-t border-rc-line pt-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Preview accounts</div>
          <ul className="mt-2 space-y-1.5">{DEMO.map((d) => <li key={d.email}><button type="button" data-testid={`rc-demo-${d.email.split('@')[0].split('.')[0]}`} onClick={() => setEmail(d.email)} className="text-left text-sm text-rc-ink hover:text-rc-accent"><span className="font-medium">{d.name}</span> <span className="text-rc-muted">— {d.state}</span></button></li>)}</ul>
        </div>
      </RcCard>}

      {step === 'code' && ch && <RcCard className="mt-6 sm:mt-8" eyebrow="Check your email" title="Enter your 6-digit code" testId="rc-code-card">
        <p className="text-[15px] leading-relaxed text-rc-muted" data-testid="rc-code-sent">We sent a code and a sign-in link to <span className="font-medium text-rc-ink">{ch.maskedEmail}</span>. Either works once and expires in 10 minutes.</p>
        <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="mt-5 space-y-4">
          <div><RcLabel htmlFor="rc-code">Code</RcLabel><CodeInput testId="rc-code-input" value={code} onChange={setCode} autoFocus /></div>
          <RcButton type="submit" data-testid="rc-code-verify" className="w-full" disabled={busy || code.length !== 6}><ShieldCheck size={16} /> {busy ? 'Checking…' : mode === 'create' ? 'Create my account' : 'Sign in'}</RcButton>
          <RcError text={err} />
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-rc-muted">
          <button type="button" data-testid="rc-code-resend" disabled={cooldown > 0 || busy} onClick={() => void send()} className="underline underline-offset-2 disabled:no-underline disabled:opacity-60">{cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}</button>
          <button type="button" data-testid="rc-code-back" onClick={() => { setCh(null); setCode(''); setErr(null); }} className="underline underline-offset-2">Use a different email</button>
        </div>
        <DevFillCode challengeId={ch.challengeId} onFill={(otp) => { setCode(otp); void verify(otp); }} />
        <div className="mt-4"><RcNote testId="rc-code-note">Nothing here continues without the code from your email — knowing an address alone can’t open an account.</RcNote></div>
      </RcCard>}
      {mode === 'signin' && step === 'email' && <p className="mt-4 text-sm text-rc-muted">New here? <Link to={`/rc?mode=create${email ? `&email=${encodeURIComponent(email)}` : ''}${sp.get('next') ? `&next=${encodeURIComponent(next)}` : ''}`} data-testid="rc-go-signup" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Create your account</Link> — same door, your first code opens it.</p>}
    </div>
  );
}
