import clsx from 'clsx';
import { Camera, Check, Copy, MessageSquare, QrCode, RefreshCw, Smartphone, Upload } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as wm8 from '@/api/watchm8';
import type { HandoffSession, ShotKey } from '@/api/watchm8';
import { useCamera } from '@/hooks/useCamera';

export type Device = 'phone' | 'desktop';
export const DeviceCtx = createContext<Device>('desktop');
export const useDevice = () => useContext(DeviceCtx);
export const DEV = import.meta.env.DEV;
export const MOCK_BADGE = <span data-testid="wm8-mock-badge" className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">mock</span>;

// rolliworks.com look: warm paper, serif headlines, pill buttons — phone-first (single column), desktop = same layout with two columns where it helps
export const RwH = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => <div><h2 className="font-serif text-2xl font-medium tracking-tight text-rc-ink sm:text-3xl">{children}</h2>{sub && <p className="mt-1 text-[15px] leading-relaxed text-rc-muted">{sub}</p>}</div>;
export const RwBtn = ({ tone = 'primary', className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' | 'link' }) => (
  <button {...rest} className={clsx('inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-[background-color,opacity,transform] active:translate-y-px disabled:opacity-40', tone === 'primary' && 'bg-rc-ink text-rc-cream hover:bg-black', tone === 'quiet' && 'border border-rc-line bg-white text-rc-ink hover:bg-rc-accentSoft', tone === 'link' && 'px-0 text-rc-ink underline decoration-rc-accent underline-offset-4', className)}>{children}</button>
);
export const RwCard = ({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) => <section data-testid={testId} className={clsx('rounded-xl border border-rc-line bg-rc-paper p-4 sm:p-5', className)}>{children}</section>;
export const RwField = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-rc-muted">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-rc-muted">{hint}</span>}</label>;
export const rwInput = 'h-11 w-full rounded-md border border-rc-line bg-white px-3 text-[15px] text-rc-ink placeholder:text-rc-muted/60 focus:border-rc-accent focus:outline-none';
export const Choice = ({ on, onClick, children, testId, big }: { on: boolean; onClick: () => void; children: ReactNode; testId: string; big?: boolean }) => <button type="button" data-testid={testId} aria-pressed={on} onClick={onClick} className={clsx('rounded-lg border text-left transition-colors', big ? 'px-4 py-4 text-[15px]' : 'px-3 py-2 text-sm', on ? 'border-rc-ink bg-rc-ink text-rc-cream' : 'border-rc-line bg-white text-rc-ink hover:bg-rc-accentSoft')}>{children}</button>;

// Guided shot — overlay for the subject, capture, retake; placeholder shutter in dev builds (headless has no camera). Every photo: stage 0 · source web · controlled false.
export const GuidedShot = ({ shot, tab, onDone, compact }: { shot: ShotKey; tab: string; onDone: (dataUrl: string) => void; compact?: boolean }) => {
  const spec = wm8.SHOTS[shot]; const device = useDevice();
  const { videoRef, status, capture } = useCamera(true);
  const [taken, setTaken] = useState<string | null>(null); const t0 = useRef(performance.now()); const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { wm8.instrument({ tab, shot, kind: 'shown', device }); const started = t0.current; return () => { if (!taken) wm8.instrument({ tab, shot, kind: 'abandoned', seconds: Math.round((performance.now() - started) / 1000), device }); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const got = (d: string) => { setTaken(d); wm8.instrument({ tab, shot, kind: 'captured', seconds: Math.round((performance.now() - t0.current) / 1000), device }); };
  const retake = () => { setTaken(null); t0.current = performance.now(); wm8.instrument({ tab, shot, kind: 'retaken', device }); };
  const overlay = spec.overlay === 'circle' ? 'inset-[12%] rounded-full' : spec.overlay === 'ring' ? 'inset-[8%] rounded-full border-[14px]' : spec.overlay === 'rect' ? 'inset-x-[20%] inset-y-[35%] rounded-md' : 'inset-x-[8%] inset-y-[40%] rounded-md';
  return (
    <div data-testid={`shot-${shot}`} data-state={taken ? 'taken' : status} className="rounded-xl bg-rc-ink p-3 text-rc-cream">
      <div className="flex items-start justify-between gap-2"><div><div className="text-[15px] font-medium">{spec.title}</div><div className="text-xs text-rc-cream/70">{spec.hint}</div></div><Camera size={16} className="mt-1 shrink-0 text-rc-cream/70" /></div>
      <div className={clsx('relative mt-2 overflow-hidden rounded-lg bg-black', compact ? 'aspect-[4/3]' : 'aspect-[3/4] sm:aspect-[4/3]')}>
        {taken ? <img src={taken} alt={spec.title} className="h-full w-full object-cover" /> : <video ref={videoRef} autoPlay muted playsInline className={clsx('h-full w-full object-cover', status !== 'ready' && 'opacity-0')} />}
        {!taken && <div className={clsx('pointer-events-none absolute border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]', overlay)} />}
        {!taken && status !== 'ready' && <div className="absolute inset-x-0 bottom-3 text-center text-xs text-white/70">{status === 'denied' ? 'Camera blocked — upload a photo instead' : status === 'starting' ? 'Starting camera…' : 'No camera here — upload a photo'}</div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {taken ? <><RwBtn tone="quiet" data-testid={`shot-${shot}-retake`} className="bg-transparent text-rc-cream" onClick={retake}><RefreshCw size={14} /> Retake</RwBtn><RwBtn data-testid={`shot-${shot}-use`} className="bg-rc-cream text-rc-ink hover:bg-white" onClick={() => onDone(taken)}><Check size={14} /> Use this photo</RwBtn></>
          : <><RwBtn data-testid={`shot-${shot}-capture`} className="bg-rc-cream text-rc-ink hover:bg-white" disabled={status !== 'ready'} onClick={() => { const s = capture(); if (s.dataUrl) got(s.dataUrl); }}><Camera size={14} /> Take photo</RwBtn><RwBtn tone="quiet" data-testid={`shot-${shot}-upload`} className="bg-transparent text-rc-cream" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload</RwBtn>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => got(String(r.result)); r.readAsDataURL(f); e.target.value = ''; }} />
            {DEV && <RwBtn tone="quiet" data-testid={`shot-${shot}-placeholder`} className="bg-transparent text-rc-cream/80" title="Dev build only" onClick={() => got(wm8.ph(`${spec.title} · placeholder`))}>Placeholder (dev)</RwBtn>}</>}
      </div>
    </div>
  );
};

// Desktop → phone hand-off (MOCK). PRIMARY "Text me the link" (Vonage mock) · SECONDARY "Scan instead" (QR, anonymous). The paired phone renders inline and streams the shot back live.
export const HandoffBlock = ({ tab, shots, onShot, done }: { tab: string; shots: ShotKey[]; onShot: (key: ShotKey, dataUrl: string) => void; done: Partial<Record<ShotKey, string>> }) => {
  const device = useDevice(); const [mode, setMode] = useState<'idle' | 'sms' | 'qr'>('idle'); const [phone, setPhone] = useState(''); const [session, setSession] = useState<HandoffSession | null>(null); const [err, setErr] = useState<string | null>(null);
  const [paired, setPaired] = useState(false); const [idx, setIdx] = useState(0);
  const pending = shots.filter((k) => !done[k]); const current = pending[Math.min(idx, Math.max(0, pending.length - 1))];
  const start = (via: 'sms' | 'qr') => { setErr(null); try { const s = wm8.startHandoff(via, phone); setSession(s); setMode(via); wm8.instrument({ tab, kind: 'handoff', device, detail: via === 'sms' ? `SMS → ${phone} (${s.smsId})` : 'QR shown' }); setTimeout(() => setPaired(true), via === 'sms' ? 1400 : 900); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (device === 'phone') return <div className="space-y-3" data-testid="handoff-inline">{pending.length ? <GuidedShot key={current} shot={current} tab={tab} onDone={(d) => onShot(current, d)} /> : <p className="text-sm text-rc-muted">All photos taken.</p>}</div>;
  return (
    <div data-testid="handoff-block" data-mode={mode} data-paired={paired} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <RwCard>
        <div className="flex items-start gap-3"><Smartphone size={22} className="mt-0.5 shrink-0 text-rc-accent" /><div><div className="text-[15px] font-medium">Photos come out better from your phone</div><p className="mt-1 text-sm text-rc-muted">We’ll hand this page to your phone — the photo appears here the moment you take it. Nothing to install.</p></div></div>
        {mode === 'idle' && <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row"><input data-testid="handoff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(212) 555-0100" inputMode="tel" className={clsx(rwInput, 'sm:max-w-[220px]')} /><RwBtn data-testid="handoff-sms" onClick={() => start('sms')}><MessageSquare size={15} /> Text me the link</RwBtn></div>
          <RwBtn tone="link" data-testid="handoff-qr" onClick={() => start('qr')}><QrCode size={15} /> Scan instead</RwBtn>
          {err && <p className="text-sm text-rose-700" data-testid="handoff-error">{err}</p>}
          <p className="text-xs text-rc-muted">Or <RwBtn tone="link" className="min-h-0 text-xs" data-testid="handoff-here" onClick={() => { setMode('qr'); setPaired(true); setSession({ id: 'local', via: 'qr', createdAt: new Date().toISOString(), url: '' }); }}>use this device’s camera</RwBtn>.</p>
        </div>}
        {mode === 'sms' && session && <p data-testid="handoff-sms-sent" className="mt-4 text-sm text-rc-muted">Sent to <span className="font-medium text-rc-ink">{phone}</span> — open the text and tap the link. {MOCK_BADGE} <span className="font-mono text-[11px]">{session.smsId}</span></p>}
        {mode === 'qr' && session && session.id !== 'local' && <div className="mt-4 flex items-center gap-4"><div className="rounded-md bg-white p-2 ring-1 ring-rc-line"><QRCodeSVG value={session.url} size={112} /></div><p className="text-sm text-rc-muted">Point your phone camera at the code. Anonymous — no number needed. {MOCK_BADGE}</p></div>}
        {mode !== 'idle' && <div className="mt-4 flex flex-wrap gap-2 text-xs text-rc-muted">{shots.map((k) => <span key={k} data-testid={`handoff-status-${k}`} data-done={!!done[k]} className={clsx('rounded-full px-2 py-0.5 ring-1', done[k] ? 'bg-moss-50 text-moss-800 ring-moss-200' : 'ring-rc-line')}>{wm8.SHOTS[k].title}{done[k] ? ' ✓' : ''}</span>)}</div>}
      </RwCard>
      {paired && mode !== 'idle' && <div data-testid="paired-phone" className="mx-auto w-[300px]"><div className="rounded-[28px] border-[6px] border-ink bg-ink p-1 shadow-pop"><div className="mx-auto mb-1 h-4 w-24 rounded-full bg-black" /><div className="h-[520px] overflow-y-auto rounded-[20px] bg-rc-cream p-3 text-rc-ink"><div className="mb-2 text-[11px] uppercase tracking-wide text-rc-muted">rolliworks.com · your phone</div>{pending.length ? <GuidedShot key={current} shot={current} tab={tab} compact onDone={(d) => { onShot(current, d); setIdx(0); }} /> : <p className="text-sm text-rc-muted">All done — back to the big screen.</p>}</div></div><p className="mt-1.5 text-[10px] uppercase tracking-wide text-amber-800">Paired phone · prototype only (NOT-KEEPER) · the real one is the client’s phone</p></div>}
    </div>
  );
};

export const ShotStrip = ({ shots, onRetake }: { shots: Partial<Record<ShotKey, string>>; onRetake: (k: ShotKey) => void }) => <div className="flex flex-wrap gap-2" data-testid="shot-strip">{(Object.keys(shots) as ShotKey[]).filter((k) => shots[k]).map((k) => <figure key={k} className="relative"><img src={shots[k]} alt={k} className="h-16 w-20 rounded-md object-cover ring-1 ring-rc-line" /><figcaption className="mt-0.5 text-[10px] text-rc-muted">{wm8.SHOTS[k].title}</figcaption><button type="button" data-testid={`shot-strip-retake-${k}`} onClick={() => onRetake(k)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" title="Retake"><RefreshCw size={10} /></button></figure>)}</div>;

// Permalink + share card preview (what a text / social share would show)
export const ShareCard = ({ title, lines, permalink, testId }: { title: string; lines: string[]; permalink: string; testId: string }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (what: string, text: string) => { navigator.clipboard?.writeText(text).catch(() => undefined); setCopied(what); setTimeout(() => setCopied(null), 1500); };
  return (
    <div data-testid={testId} className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <div className="rounded-xl bg-rc-ink p-4 text-rc-cream"><div className="text-[10px] uppercase tracking-[0.2em] text-rc-cream/60">rolliworks.com</div><div className="mt-1 font-serif text-xl">{title}</div><ul className="mt-2 space-y-0.5 text-sm text-rc-cream/85">{lines.map((l) => <li key={l}>{l}</li>)}</ul></div>
      <div className="flex flex-col gap-2 text-xs"><div className="font-mono text-[11px] text-rc-muted" data-testid={`${testId}-permalink`}>{permalink}</div><RwBtn tone="quiet" className="min-h-9 text-xs" data-testid={`${testId}-copy-link`} onClick={() => copy('link', permalink)}><Copy size={12} /> {copied === 'link' ? 'Copied' : 'Copy link'}</RwBtn><RwBtn tone="quiet" className="min-h-9 text-xs" data-testid={`${testId}-copy-summary`} onClick={() => copy('summary', `${title} — ${lines.join(' · ')} — ${permalink}`)}><Copy size={12} /> {copied === 'summary' ? 'Copied' : 'Copy summary'}</RwBtn></div>
    </div>
  );
};

// "Save my results": phone/email → mock send; else a CLAIM CODE the visitor can bring back
export const SaveResults = ({ results, photos, claim, onSaved }: { results: Record<string, unknown>; photos: { key: string; dataUrl: string }[]; claim?: string; onSaved: (code: string) => void }) => {
  const [open, setOpen] = useState(false); const [contact, setContact] = useState(''); const [saved, setSaved] = useState<{ code: string; sent?: string } | null>(null);
  const save = () => { const c = contact.trim(); const isEmail = c.includes('@'); const digits = c.replace(/\D/g, ''); const ok = isEmail || digits.length >= 10; const cl = wm8.saveClaim(results, photos, ok ? (isEmail ? { email: c } : { phone: c }) : undefined, claim); if (ok && !isEmail) wm8.startHandoff('sms', c); setSaved({ code: cl.code, sent: ok ? c : undefined }); onSaved(cl.code); };
  if (saved) return <p data-testid="save-results-done" className="text-sm text-rc-muted">{saved.sent ? <>Saved — we sent your link to <span className="font-medium text-rc-ink">{saved.sent}</span>. {MOCK_BADGE}</> : <>Saved. Your claim code is <span data-testid="claim-code" className="font-mono text-[15px] font-semibold text-rc-ink">{saved.code}</span> — we’ll remember it on this device, and it attaches your photos to any request you send.</>}</p>;
  return open ? <div className="flex flex-col gap-2 sm:flex-row"><input data-testid="save-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email (optional)" className={rwInput} /><RwBtn data-testid="save-results-go" onClick={save}>Save</RwBtn></div> : <RwBtn tone="quiet" data-testid="save-results" onClick={() => setOpen(true)}>Save my results</RwBtn>;
};
