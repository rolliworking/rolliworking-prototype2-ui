import { KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { RcAccount } from '@/api/client';
import { RcButton, RcCard, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';
import { BackupCodes } from '@/rc/RcTotpBits';

// Client account page — two-step status, backup codes remaining, regenerate
export default function RcAccountPage() {
  const { client } = useRcSession(); const [acct, setAcct] = useState<RcAccount | null>(null); const [fresh, setFresh] = useState<string[] | null>(null);
  const load = () => api.rcGetAccount(client!.id).then(setAcct);
  useEffect(() => { void load(); }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!acct) return null;
  const left = acct.backupCodes.length - acct.usedBackupCodes.length;
  return <div className="space-y-6" data-testid="rc-account-page">
    <h1 className="font-serif text-4xl font-light tracking-tight">Account &amp; security</h1>
    <RcCard eyebrow="Sign-in" title={<span className="inline-flex items-center gap-2"><ShieldCheck size={20} className="text-rc-accent" /> Two-step verification is on</span>} testId="rc-account-security">
      <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Email</dt><dd className="mt-0.5 text-rc-ink">{acct.email}</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Password</dt><dd className="mt-0.5 text-rc-ink">••••••••</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Authenticator</dt><dd className="mt-0.5 text-rc-ink" data-testid="rc-account-totp">{acct.totpEnabled ? 'Enabled' : 'Not set up'}</dd></div><div><dt className="text-xs uppercase tracking-[0.14em] text-rc-muted">Account since</dt><dd className="mt-0.5 text-rc-ink">{rcDate(acct.createdAt)}{acct.lastLoginAt && <span className="text-rc-muted"> · last sign-in {rcDate(acct.lastLoginAt)}</span>}</dd></div></dl>
    </RcCard>
    <RcCard eyebrow="Backup codes" title={<span className="inline-flex items-center gap-2"><KeyRound size={18} /> <span data-testid="rc-account-backup-left">{left} of {acct.backupCodes.length} unused</span></span>} testId="rc-account-backup" action={<RcButton tone="quiet" data-testid="rc-account-regenerate" onClick={() => void api.rcRegenerateBackupCodes(client!.id).then((c) => { setFresh(c); void load(); })}>Replace codes</RcButton>}>
      {fresh ? <><p className="mb-4 text-sm text-rc-muted">New codes — the old ones no longer work. Save these now; we won’t show them again.</p><BackupCodes codes={fresh} testId="rc-account-fresh-codes" /></>
        : <p className="text-sm text-rc-muted">Codes are shown only when issued. Used codes are struck through below so you know how many remain.<span className="mt-3 block"><BackupCodes codes={acct.backupCodes.map((c, i) => (acct.usedBackupCodes.includes(c) ? c : `••••-•••${i + 1}`))} used={acct.usedBackupCodes} testId="rc-account-codes" /></span></p>}
    </RcCard>
  </div>;
}
