import { Fingerprint, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { RcAccount } from '@/api/client';
import { clearTouchId, enrolTouchId, enrolledCredential, platformAuthenticatorAvailable } from '@/api/webauthn';
import { RcButton, RcCard, RcError, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Account — passwordless by design: the emailed code is the key; Touch ID is the shortcut once enrolled on this device. Sensitive changes re-verify.
export default function RcAccountPage() {
  const { client } = useRcSession(); const [acct, setAcct] = useState<RcAccount | null>(null); const [avail, setAvail] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const load = () => api.rcGetAccount(client!.id).then(setAcct);
  useEffect(() => { void load(); platformAuthenticatorAvailable().then(setAvail); }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!acct || !client) return null;
  const here = !!enrolledCredential(`rc:${client.id}`);
  const enrol = async () => { setBusy(true); setErr(null); try { await enrolTouchId({ id: `rc:${client.id}`, firstName: client.firstName, displayName: `${client.firstName} ${client.lastName}` }); await api.rcMarkTouchIdEnrolled(client.id, true); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Touch ID enrolment failed'); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { clearTouchId(`rc:${client.id}`); await api.rcMarkTouchIdEnrolled(client.id, false); await load(); } finally { setBusy(false); } };
  return <div className="space-y-6" data-testid="rc-account-page">
    <h1 className="font-serif text-4xl font-light tracking-tight">Account &amp; security</h1>
    <RcCard eyebrow="Sign-in" title={<span className="inline-flex items-center gap-2"><Mail size={20} className="text-rc-accent" /> One-time code by email</span>} testId="rc-account-security">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Email</dt><dd className="mt-0.5 text-rc-ink" data-testid="rc-account-email">{acct.email}</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Password</dt><dd className="mt-0.5 text-rc-ink" data-testid="rc-account-password">None — we never use one</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Account since</dt><dd className="mt-0.5 text-rc-ink">{rcDate(acct.createdAt)}</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Sign-ins</dt><dd className="mt-0.5 text-rc-ink" data-testid="rc-account-signins">{acct.signIns}{acct.lastLoginAt && <span className="text-rc-muted"> · last {rcDate(acct.lastLoginAt)}</span>}</dd></div></dl>
      <p className="mt-4 text-sm text-rc-muted">Approving money, changing contact details or adding a pickup person always asks for a fresh code (or Touch ID) — even while you’re signed in.</p>
    </RcCard>
    <RcCard eyebrow="Touch ID / Face ID" title={<span className="inline-flex items-center gap-2"><Fingerprint size={20} className="text-rc-accent" /> <span data-testid="rc-account-touch">{acct.touchIdEnrolledAt && here ? 'On for this device' : acct.touchIdEnrolledAt ? 'On — another device' : 'Off'}</span></span>} testId="rc-account-touchid" action={acct.touchIdEnrolledAt && here ? <RcButton tone="quiet" data-testid="rc-touch-remove" disabled={busy} onClick={remove}>Turn off</RcButton> : <RcButton data-testid="rc-touch-enrol" disabled={busy || !avail} onClick={enrol}><ShieldCheck size={15} /> Turn on</RcButton>}>
      <p className="text-sm text-rc-muted">{avail ? 'Sign in and confirm sensitive actions with the fingerprint or face this device already knows. Your biometrics never leave the device — we only store a public key.' : 'This device has no platform authenticator (or the page is not on a secure origin). Codes by email keep working everywhere.'}</p>
      {acct.touchIdEnrolledAt && <p className="mt-2 text-xs text-rc-muted">Enrolled {rcDate(acct.touchIdEnrolledAt)}.</p>}
      <RcError text={err} />
    </RcCard>
    <RcCard eyebrow="Coming next" title="Contact details · authorized pickup persons · notifications" testId="rc-account-placeholders">
      <p className="text-sm text-rc-muted">These sections re-verify before saving. They are on the roadmap (PLACEHOLDER) — for now message the workshop to change any of them.</p>
    </RcCard>
  </div>;
}
