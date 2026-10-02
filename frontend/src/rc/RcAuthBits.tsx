import { Fingerprint, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClientLink } from '@/api/client';
import { assertTouchId, enrolledCredential } from '@/api/webauthn';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';

export const DEV = import.meta.env.DEV;

// Six boxes, one code — numeric keyboard on phones, paste-friendly
export const CodeInput = ({ value, onChange, testId, autoFocus }: { value: string; onChange: (v: string) => void; testId: string; autoFocus?: boolean }) => (
  <RcInput data-testid={testId} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000 000" autoFocus={autoFocus} className="font-mono text-2xl tracking-[0.4em]" />
);

// Prototype-only shortcut: fills the code that the staff Sent page shows (dev builds)
export const DevFillCode = ({ challengeId, onFill }: { challengeId: string; onFill: (otp: string, magicPath: string) => void }) => {
  if (!DEV) return null;
  return <button type="button" data-testid="rc-dev-fill-code" onClick={() => api.rcDevPeekCode(challengeId).then((r) => onFill(r.otp, r.magicPath))} className="mt-3 text-xs text-rc-muted underline decoration-rc-accent underline-offset-2">Prototype: fill the code from the email (staff see it in Intake ▸ Sent)</button>;
};

// Fresh proof for a sensitive action — emailed code (to the email the link / account is bound to) or Touch ID once enrolled. Grant lives 5 min, bound to this action, consumed on success.
export const StepUpModal = ({ clientId, action, title, what, onVerified, onClose }: { clientId: string; action: string; title: string; what: string; onVerified: () => void; onClose: () => void }) => {
  const [stage, setStage] = useState<'choose' | 'code'>('choose'); const [ch, setCh] = useState<{ challengeId: string; maskedEmail: string } | null>(null);
  const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [touch, setTouch] = useState(false);
  useEffect(() => { api.rcGetAccount(clientId).then((a) => setTouch(!!a?.touchIdEnrolledAt && !!enrolledCredential(`rc:${clientId}`))); }, [clientId]);
  const send = async () => { setBusy(true); setErr(null); try { const r = await api.rcRequestStepUp(clientId, action); setCh(r); setStage('code'); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  const verify = async (c = code) => { if (!ch) return; setBusy(true); setErr(null); try { await api.rcVerifyCode(ch.challengeId, c); onVerified(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); } };
  const viaTouch = async () => { setBusy(true); setErr(null); try { const ok = await assertTouchId(`rc:${clientId}`); if (!ok) throw new Error('Touch ID did not verify'); await api.rcStepUpWithTouchId(clientId, action); onVerified(); } catch (e) { setErr(e instanceof Error ? e.message : 'Touch ID failed'); } finally { setBusy(false); } };
  return (
    <div data-testid="rc-stepup" data-stage={stage} className="fixed inset-0 z-50 flex items-end justify-center bg-rc-ink/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-t-2xl bg-rc-cream p-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Confirm it’s you</div>
        <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight">{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-rc-muted">{what} This is a money decision, so we check once more — even if you’re already signed in.</p>
        {stage === 'choose' && <div className="mt-5 flex flex-col gap-2">
          <RcButton data-testid="rc-stepup-email" disabled={busy} onClick={send}><Mail size={16} /> {busy ? 'Sending…' : 'Email me a code'}</RcButton>
          {touch && <RcButton tone="quiet" data-testid="rc-stepup-touch" disabled={busy} onClick={viaTouch}><Fingerprint size={16} /> Use Touch ID</RcButton>}
          <RcButton tone="quiet" data-testid="rc-stepup-cancel" onClick={onClose}>Not now</RcButton>
        </div>}
        {stage === 'code' && ch && <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
          <p className="text-sm text-rc-muted" data-testid="rc-stepup-sent">We emailed a 6-digit code to <span className="font-medium text-rc-ink">{ch.maskedEmail}</span>. It works once and expires in 10 minutes.</p>
          <div><RcLabel htmlFor="rc-stepup-code">Code</RcLabel><CodeInput testId="rc-stepup-code" value={code} onChange={setCode} autoFocus /></div>
          <RcButton type="submit" data-testid="rc-stepup-verify" className="w-full" disabled={busy || code.length !== 6}><ShieldCheck size={16} /> {busy ? 'Checking…' : 'Confirm'}</RcButton>
          <div className="flex items-center justify-between"><button type="button" data-testid="rc-stepup-resend" onClick={send} className="text-xs text-rc-muted underline underline-offset-2">Send a new code</button><DevFillCode challengeId={ch.challengeId} onFill={(otp) => { setCode(otp); void verify(otp); }} /></div>
        </form>}
        <RcError text={err} />
      </div>
    </div>
  );
};

// Every LINK page ends here: one link = one object; the account is the house. Email comes from the token so "Create your account" is pre-filled.
export const LinkFooter = ({ link, what }: { link: ClientLink; what: string }) => (
  <RcCard testId="rc-link-footer" className="border-dashed">
    <p className="text-[15px] leading-relaxed text-rc-muted"><Lock size={14} className="mr-1 inline text-rc-accent" /> This link opens <span className="font-medium text-rc-ink">{what}</span> only{link.expiresAt ? ` and expires ${new Date(link.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}. Want all your watches, photos and messages in one place?</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Link to={`/rc?email=${encodeURIComponent(link.email)}&mode=create`} data-testid="rc-link-create-account"><RcButton type="button">Create your account</RcButton></Link>
      <Link to={`/rc?email=${encodeURIComponent(link.email)}`} data-testid="rc-link-sign-in"><RcButton type="button" tone="quiet">Sign in</RcButton></Link>
    </div>
    <p className="mt-2 text-xs text-rc-muted">We’ll pre-fill <span className="font-mono">{link.email}</span> — the code we email proves it’s you. No password, ever.</p>
  </RcCard>
);

// Dead link — same words every time, never a dead page
export const LinkExpired = ({ message, email }: { message?: string; email?: string }) => (
  <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-link-expired">
    <RcCard eyebrow="This link" title={<span className="inline-flex items-center gap-2"><Lock size={20} className="text-rc-accent" /> {message ?? api.LINK_EXPIRED_COPY}</span>}>
      <p className="text-[15px] leading-relaxed text-rc-muted">Links we email do one thing and then retire. Your account shows everything — sign in with a code we email you.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Link to={`/rc${email ? `?email=${encodeURIComponent(email)}` : ''}`} data-testid="rc-link-expired-signin"><RcButton type="button"><ShieldCheck size={15} /> Sign in</RcButton></Link></div>
    </RcCard>
  </div>
);

export const RcNote = ({ children, testId }: { children: ReactNode; testId: string }) => <div data-testid={testId} className="rounded-md border border-dashed border-rc-accent/50 bg-rc-accentSoft px-4 py-3 text-sm text-rc-ink">{children}</div>;
