import { Check, Copy, Download, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import { RcButton, RcCard, RcError, RcInput, RcLabel } from '@/rc/RcBits';

// Deterministic pseudo-QR — a mock render so the screen reads right; real TOTP/QR is the production build's job
export const MockQr = ({ payload }: { payload: string }) => {
  let h = 2166136261; const cells: boolean[] = [];
  for (let i = 0; i < 21 * 21; i++) { h ^= payload.charCodeAt(i % Math.max(1, payload.length)); h = Math.imul(h, 16777619) >>> 0; cells.push((h & 3) === 0 || (h & 7) === 1); }
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
  return <div data-testid="rc-totp-qr" aria-label="Authenticator QR (mock)" className="grid w-[168px] gap-0 rounded-md bg-white p-2 shadow-sm" style={{ gridTemplateColumns: 'repeat(21, 1fr)' }}>{cells.map((on, i) => { const r = Math.floor(i / 21); const c = i % 21; const f = finder(r, c) ? ((r % 7 === 0 || r % 7 === 6 || c % 7 === 0 || c % 7 === 6 || (r % 7 >= 2 && r % 7 <= 4 && c % 7 >= 2 && c % 7 <= 4)) ) : on; return <span key={i} className={`aspect-square ${f ? 'bg-rc-ink' : 'bg-white'}`} />; })}</div>;
};

export const BackupCodes = ({ codes, used = [], testId = 'rc-backup-codes' }: { codes: string[]; used?: string[]; testId?: string }) => {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked in preview */ } setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const download = () => { const a = document.createElement('a'); a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(`RolliConnect backup codes\n\n${text}\n\nEach code works once.`)}`; a.download = 'rolliconnect-backup-codes.txt'; a.click(); };
  return <div data-testid={testId}>
    <ul className="grid grid-cols-2 gap-2 font-mono text-[15px] tracking-wider">{codes.map((c) => <li key={c} data-testid={`${testId}-${c}`} data-used={used.includes(c)} className={`rounded-md border px-3 py-2 ${used.includes(c) ? 'border-rc-line text-rc-muted line-through' : 'border-rc-line bg-rc-paper text-rc-ink'}`}>{c}</li>)}</ul>
    <div className="mt-3 flex gap-2"><RcButton type="button" tone="quiet" data-testid={`${testId}-copy`} onClick={() => void copy()}>{copied ? <><Check size={14} className="mr-1 inline" /> Copied</> : <><Copy size={14} className="mr-1 inline" /> Copy</>}</RcButton><RcButton type="button" tone="quiet" data-testid={`${testId}-download`} onClick={download}><Download size={14} className="mr-1 inline" /> Download .txt</RcButton></div>
  </div>;
};

// Authenticator setup → first code → backup codes → confirm saved. Shared by signup and by a sign-in that finds TOTP not yet enabled.
export const TotpSetup = ({ email, otpauth, onDone }: { email: string; otpauth: string; onDone: () => void }) => {
  const [code, setCode] = useState(''); const [codes, setCodes] = useState<string[] | null>(null); const [saved, setSaved] = useState(false); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const secret = new URL(otpauth.replace('otpauth://', 'https://')).searchParams.get('secret') ?? '';
  const confirm = async (e?: React.FormEvent) => { e?.preventDefault(); setErr(null); setBusy(true); try { const r = await api.rcConfirmTotp(email, code); setCodes(r.backupCodes); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); } };
  const finish = async () => { setBusy(true); try { await api.rcVerifyTotp(email, api.RC_DEMO_TOTP); onDone(); } finally { setBusy(false); } };
  if (codes) return <RcCard className="mt-8" eyebrow="Step 3 of 3" title="Save your backup codes" testId="rc-backup-card">
    <p className="text-[15px] leading-relaxed text-rc-muted">If you lose your phone, any one of these signs you in once. Keep them somewhere safe — we can’t show them again, only replace them.</p>
    <div className="mt-5"><BackupCodes codes={codes} /></div>
    <label className="mt-5 flex items-start gap-2 text-sm text-rc-ink"><input type="checkbox" data-testid="rc-backup-saved" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1 accent-rc-ink" /> I’ve saved these codes somewhere I can find them.</label>
    <RcButton type="button" data-testid="rc-backup-finish" className="mt-4 w-full" disabled={!saved || busy} onClick={() => void finish()}><ShieldCheck size={16} className="mr-1 inline" /> {busy ? 'Signing you in…' : 'Finish — open my account'}</RcButton>
  </RcCard>;
  return <RcCard className="mt-8" eyebrow="Step 2 of 3" title="Set up your authenticator" testId="rc-totp-setup-card">
    <p className="text-[15px] leading-relaxed text-rc-muted">Scan this with Google Authenticator, 1Password, Authy or any TOTP app, then enter the 6-digit code it shows.</p>
    <div className="mt-5 flex flex-wrap items-start gap-5">
      <MockQr payload={otpauth} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Can’t scan? Enter this key</div>
        <div data-testid="rc-totp-secret" className="mt-1 break-all rounded-md border border-rc-line bg-rc-paper px-3 py-2 font-mono tracking-widest text-rc-ink">{secret.replace(/(.{4})/g, '$1 ').trim()}</div>
        <div className="mt-2 text-xs text-rc-muted"><Smartphone size={12} className="mr-1 inline" /> Account: {email} · Issuer: RolliConnect</div>
        <div className="mt-3 rounded-md border border-dashed border-rc-accent/50 bg-rc-accentSoft px-3 py-2 text-xs text-rc-muted"><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-accent">Preview</span> · the demo authenticator always shows <span className="font-mono text-rc-ink">{api.RC_DEMO_TOTP}</span></div>
      </div>
    </div>
    <form onSubmit={confirm} className="mt-5 space-y-3">
      <div><RcLabel htmlFor="rc-setup-code">6-digit code</RcLabel><RcInput id="rc-setup-code" data-testid="rc-totp-setup-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000 000" autoFocus autoComplete="one-time-code" className="font-mono tracking-[0.3em]" /></div>
      <RcButton type="submit" data-testid="rc-totp-setup-confirm" className="w-full" disabled={busy || code.replace(/\s/g, '').length < 6}>{busy ? 'Checking…' : 'Turn on two-step verification'}</RcButton>
      <RcError text={err} />
    </form>
  </RcCard>;
};
