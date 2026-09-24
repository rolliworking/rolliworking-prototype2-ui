import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import * as api from '@/api/client';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Seeded demo accounts — the three canonical states
const DEMO = [
  { email: 'eleanor.vance@example.com', name: 'Eleanor Vance', state: 'an estimate waiting for approval' },
  { email: 'harrison.whitfield@example.com', name: 'Harrison Whitfield', state: 'a watch on the bench' },
  { email: 'grace.nakamura@example.com', name: 'Grace Nakamura', state: 'a watch ready for pickup' },
];

export default function RcLoginPage() {
  const { client } = useRcSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ path: string; email: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (client) return <Navigate to="/rc/home" replace />;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr(null);
    try {
      const r = await api.portalRequestMagicLink(email);
      setSent({ path: r.path, email: r.link.email });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Something went wrong');
    }
  };

  return (
    <div className="mx-auto max-w-[520px] pt-8" data-testid="rc-login-page">
      <h1 className="font-serif text-4xl font-light leading-tight tracking-tight sm:text-5xl">Your watches,<br />wherever you are.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-rc-muted">Sign in with the email we have on file. We’ll send a one-time link — no password to remember.</p>

      {!sent ? (
        <RcCard className="mt-8" testId="rc-login-card">
          <form onSubmit={send} className="space-y-4">
            <div>
              <RcLabel htmlFor="rc-email">Email</RcLabel>
              <RcInput id="rc-email" data-testid="rc-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus autoComplete="email" />
            </div>
            <RcButton type="submit" data-testid="rc-send-link" className="w-full">Send me a sign-in link</RcButton>
            <RcError text={err} />
          </form>
          <div className="mt-6 border-t border-rc-line pt-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Preview accounts</div>
            <ul className="mt-2 space-y-1.5">
              {DEMO.map((d) => (
                <li key={d.email}>
                  <button type="button" data-testid={`rc-demo-${d.email.split('@')[0].split('.')[0]}`} onClick={() => setEmail(d.email)} className="text-left text-sm text-rc-ink hover:text-rc-accent">
                    <span className="font-medium">{d.name}</span> <span className="text-rc-muted">— {d.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </RcCard>
      ) : (
        <RcCard className="mt-8" eyebrow="Check your inbox" title="We sent you a link" testId="rc-link-sent">
          <p className="text-[15px] leading-relaxed text-rc-muted">A one-time sign-in link went to <span className="font-medium text-rc-ink">{sent.email}</span>. It expires in 15 minutes.</p>
          <div className="mt-5 rounded-md border border-dashed border-rc-accent/50 bg-rc-accentSoft px-4 py-3 text-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-accent">Preview shortcut — nothing was actually emailed</div>
            <Link to={sent.path} data-testid="rc-magic-link" className="mt-1 block break-all font-mono text-[13px] text-rc-ink underline decoration-rc-accent underline-offset-4">{sent.path}</Link>
          </div>
          <button type="button" data-testid="rc-use-different-email" onClick={() => setSent(null)} className="mt-5 text-sm text-rc-muted hover:text-rc-ink">Use a different email</button>
        </RcCard>
      )}
    </div>
  );
}
