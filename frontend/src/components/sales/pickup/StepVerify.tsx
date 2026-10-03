import clsx from 'clsx';
import jsQR from 'jsqr';
import { Check, KeyRound, Lock, Mail, MessageSquare, QrCode, ScanLine, Smartphone, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as api from '@/api/client';
import type { PackagePhoto, PickupContext } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCamera } from '@/hooks/useCamera';
import { RcPickupConfirm } from '@/pages/rc/RcPickupConfirmPage';
import { CameraPane, DEV, GateBanner, ManagerApprovalModal, PhoneFrame, cameraPrefs, field } from './PickupBits';
import { SecondFactorPanel } from './SecondFactor';

type Method = 'qr_scan' | 'code' | 'proxy' | 'reverse_qr';
const METHODS: { key: Method; label: string; icon: typeof QrCode }[] = [{ key: 'qr_scan', label: 'Scan client’s QR', icon: ScanLine }, { key: 'code', label: 'Type code', icon: KeyRound }, { key: 'proxy', label: 'Proxy + ID', icon: UserRound }, { key: 'reverse_qr', label: 'Reverse QR', icon: Smartphone }];
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

// Counter camera → jsQR every 300 ms; a decode feeds the SAME verify path as typed / wedge input
const QrScanner = ({ onCode }: { onCode: (payload: string) => void }) => {
  const { videoRef, status } = useCamera(true, cameraPrefs().counter);
  const last = useRef<string>('');
  useEffect(() => {
    if (status !== 'ready') return;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const t = setInterval(() => {
      const v = videoRef.current; if (!v || !ctx || v.videoWidth === 0) return;
      canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (hit?.data && hit.data !== last.current) { last.current = hit.data; onCode(hit.data); setTimeout(() => { last.current = ''; }, 4000); }
    }, 300);
    return () => clearInterval(t);
  }, [status, videoRef, onCode]);
  return (
    <div data-testid="pickup-qr-scanner" data-status={status} className="relative aspect-[4/3] overflow-hidden rounded-sm bg-black">
      <video ref={videoRef} autoPlay muted playsInline className={clsx('h-full w-full object-cover', status !== 'ready' && 'opacity-0')} />
      <div className="pointer-events-none absolute inset-[18%] rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      {status !== 'ready' && <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-white/70">{status === 'denied' ? 'Camera permission denied — use the scanner field or type the code' : status === 'starting' ? 'Starting camera…' : 'No camera — a handheld scanner types into the field below'}</div>}
    </div>
  );
};

type Props = { ctx: PickupContext; refresh: (c: PickupContext) => void; onNext: () => void; onBack: () => void; onStopped: () => void; fail: (e: unknown) => void };
export const StepVerify = ({ ctx, refresh, onNext, onBack, onStopped, fail }: Props) => {
  const o = ctx.order; const c = o.client; const verified = ctx.draft?.verify;
  const [method, setMethod] = useState<Method>('qr_scan');
  const [wedge, setWedge] = useState(''); const [code, setCode] = useState('');
  const [proxyName, setProxyName] = useState(''); const [proxyId, setProxyId] = useState<PackagePhoto | undefined>(); const [proxyModal, setProxyModal] = useState(false); const [authorizedId, setAuthorizedId] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [, tick] = useState(0);
  const say = (m: string) => { setMsg(m); setErr(null); };
  const oops = (e: unknown) => { setErr(e instanceof Error ? e.message : 'Failed'); setMsg(null); api.getPickupContext(o.id).then(refresh).catch(() => undefined); };
  const verifyPayload = (payload: string, via: 'qr_scan' | 'code') => api.pickupVerifyCode(o.id, payload, via).then((r) => { refresh(r); say(`Identity verified · ${api.PICKUP_VERIFY_LABEL[via]}`); }).catch(oops);
  const resend = (ch: 'email' | 'sms') => api.pickupResendCode(o.id, ch).then((r) => { refresh(r); const last = r.resends[r.resends.length - 1]; say(`New 6-digit code sent by ${ch.toUpperCase()} to ${last.to} · generation ${last.generation} · earlier codes are void`); }).catch(oops);
  useEffect(() => api.onPickupEvent((e) => { if (e.soId !== o.id) return; api.getPickupContext(o.id).then((r) => { refresh(r); if (e.kind === 'reverse_confirmed') say(r.draft?.secondFactor?.method === 'reverse_qr' ? 'Client confirmed on their phone — second factor done' : 'Client confirmed on their phone — identity verified'); if (e.kind === 'reverse_declined') setErr('CLIENT DECLINED — the account holder says this is not them. Stop the hand-over.'); }).catch(fail); }), [o.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const rq = ctx.reverseQr; const rqOpen = rq && !rq.usedAt && new Date(rq.expiresAt).getTime() > Date.now();
  const rqUrl = rq ? `${window.location.origin}/rc/pickup/${rq.token}` : '';
  const declined = !!rq?.declinedAt;
  const lockLeft = ctx.lock ? Math.max(0, Math.round((new Date(ctx.lock.until).getTime() - Date.now()) / 1000)) : 0; const locked = lockLeft > 0;
  const needsSecond = ctx.valueTier.high && !!verified && verified.method !== 'reverse_qr' && !ctx.draft?.secondFactor;
  const canContinue = !!verified && !needsSecond;
  const authorized = ctx.authorizedPickups.find((p) => p.id === authorizedId);
  const confirmAuthorized = () => api.pickupVerifyProxy(o.id, authorized?.name ?? '', proxyId, undefined, authorizedId).then((r) => { refresh(r); say(`Authorized pickup person · ${authorized?.name} · ID photographed · no manager approval needed`); }).catch(oops);
  const showReverseFallback = () => { setMethod('reverse_qr'); api.pickupIssueReverseQr(o.id).then(refresh).catch(oops); };

  return (
    <>
      <Card title="Step 3 · Verify identity" subtitle={`${c.firstName} ${c.lastName} · 6-digit code · generation ${ctx.codeGeneration}${ctx.codeIssuedAt ? ` · issued ${ago(ctx.codeIssuedAt)}` : ''}${ctx.resends.length ? ` · last resend ${ctx.resends[ctx.resends.length - 1].channel.toUpperCase()} to ${ctx.resends[ctx.resends.length - 1].to} ${ago(ctx.resends[ctx.resends.length - 1].at)}` : ''}${ctx.authorizedPickups.length ? ` · ${ctx.authorizedPickups.length} authorized pickup person${ctx.authorizedPickups.length === 1 ? '' : 's'} on file` : ''}`} testId="pickup-verify-card">
        {locked && <GateBanner tone="block" testId="pickup-lockout"><span className="inline-flex items-center gap-1.5"><Lock size={12} /> Code entry locked — {api.PICKUP_CODE_MAX_FAILS} wrong codes · <span className="font-mono" data-testid="pickup-lockout-left">{Math.floor(lockLeft / 60)}:{String(lockLeft % 60).padStart(2, '0')}</span> left · proxy + ID and reverse QR still work · logged on the SO + audit</span></GateBanner>}
        {verified ? (
          <div className="space-y-3">
            <div className={clsx(verified.method === 'reverse_qr' && rq && 'grid grid-cols-[1fr_320px] gap-4')}>
              <GateBanner tone="ok" testId="pickup-verified">Identity verified · {api.PICKUP_VERIFY_LABEL[verified.method]}{verified.proxyName ? ` · ${verified.proxyName}${verified.proxyAuthorizedId ? ' · authorized pickup person (client pre-approved)' : ` · approved by ${verified.proxyApproval?.by}`}` : ''} · {new Date(verified.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</GateBanner>
              {verified.method === 'reverse_qr' && rq && <PhoneFrame caption="Mock phone · prototype only (NOT-KEEPER)"><RcPickupConfirm key={rq.token} token={rq.token} embedded /></PhoneFrame>}
            </div>
            {ctx.valueTier.high && verified.method !== 'reverse_qr' && <SecondFactorPanel ctx={ctx} refresh={refresh} onReverseQr={showReverseFallback} />}
            {needsSecond && rq && <div className="grid grid-cols-[1fr_320px] gap-3 text-xs"><div>{rqOpen ? <div className="flex items-start gap-3"><div data-testid="pickup-reverse-qr" className="rounded-sm bg-white p-2 ring-1 ring-line"><QRCodeSVG value={rqUrl} size={148} level="M" /></div><div><div className="font-mono text-[11px] text-ink-500" data-testid="pickup-reverse-url">{rqUrl.replace(window.location.origin, '')}</div><div className="mt-1 text-ink-500">expires in <span className="font-mono">{Math.max(0, Math.round((new Date(rq.expiresAt).getTime() - Date.now()) / 1000))}s</span></div></div></div> : <Button size="sm" data-testid="pickup-reverse-new" onClick={showReverseFallback}>New QR</Button>}{declined && <GateBanner tone="block" testId="pickup-reverse-declined">Client declined on their phone — stop the hand-over.</GateBanner>}</div><PhoneFrame caption="Mock phone · prototype only (NOT-KEEPER) · renders the real /rc/pickup page">{rqOpen || rq.usedAt ? <RcPickupConfirm key={rq.token} token={rq.token} embedded /> : <div className="p-4 text-sm text-rc-muted">Expired — show a new QR.</div>}</PhoneFrame></div>}
          </div>
        ) : (
          <>
            <div className="flex gap-1" role="tablist">{METHODS.map((m) => <button key={m.key} type="button" role="tab" data-testid={`pickup-method-${m.key}`} aria-selected={method === m.key} disabled={locked && (m.key === 'qr_scan' || m.key === 'code')} onClick={() => { setMethod(m.key); setErr(null); }} className={clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-xs font-medium disabled:opacity-40', method === m.key ? 'bg-ink text-white' : 'border border-line text-ink-700 hover:bg-canvas')}><m.icon size={13} /> {m.label}</button>)}</div>
            <div className="mt-3 grid grid-cols-[1fr_280px] gap-4">
              <div>
                {method === 'qr_scan' && !locked && (
                  <div className="grid grid-cols-[280px_1fr] gap-3">
                    <QrScanner onCode={(p) => void verifyPayload(p, 'qr_scan')} />
                    <div className="space-y-2 text-xs">
                      <p className="text-ink-500">Hold the client’s phone (or printed email) in the frame. A handheld scanner types into the field — press Enter.</p>
                      <input data-testid="pickup-qr-wedge" autoFocus value={wedge} onChange={(e) => setWedge(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && wedge.trim()) { void verifyPayload(wedge, 'qr_scan'); setWedge(''); } }} placeholder="RSPU:SO-26-0115:482913" className={`${field} block w-full font-mono`} />
                      {DEV && <Button size="sm" data-testid="pickup-qr-simulate" onClick={() => api.pickupDevQrPayload(o.id).then((p) => (p ? verifyPayload(p, 'qr_scan') : setErr('No code on record to simulate'))).catch(oops)} title="Dev build only — feeds the live code through the real decode path"><ScanLine size={12} /> Simulate scan (dev)</Button>}
                    </div>
                  </div>
                )}
                {method === 'code' && !locked && (
                  <div className="max-w-[320px] text-xs">
                    <label className="text-ink-500">Pickup verification code · 6 digits<input data-testid="pickup-code" autoFocus value={code} inputMode="numeric" maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && code.trim() && void verifyPayload(code, 'code')} placeholder="482913" className={`${field} mt-1 block w-full font-mono text-[18px] tracking-[0.3em]`} /></label>
                    <Button variant="primary" className="mt-2" data-testid="pickup-code-check" disabled={!code.trim()} onClick={() => void verifyPayload(code, 'code')}><Check size={12} /> Check code</Button>
                    <p className="mt-2 text-ink-400">{o.pickupCode ? `A code is on record (generation ${ctx.codeGeneration}). ${api.PICKUP_CODE_MAX_FAILS} wrong codes lock code entry for ${api.PICKUP_LOCKOUT_MS / 60_000} minutes${ctx.draft?.codeAttempts ? ` · ${ctx.draft.codeAttempts} wrong so far` : ''}. Older generations are refused with the date they were replaced.` : 'No code on record — resend one, or use proxy / reverse QR.'}</p>
                  </div>
                )}
                {locked && (method === 'qr_scan' || method === 'code') && <p className="text-xs text-ink-500">Code entry is locked. Switch to <b>Proxy + ID</b> or <b>Reverse QR</b>, or wait for the timer.</p>}
                {method === 'proxy' && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-ink-500">Authorized pickup person on file<select data-testid="pickup-proxy-authorized" value={authorizedId} onChange={(e) => { setAuthorizedId(e.target.value); setErr(null); }} className={`${field} mt-1 block w-full`}><option value="">— not on the list (manager approval needed)</option>{ctx.authorizedPickups.map((p) => <option key={p.id} value={p.id}>{p.name}{p.relation ? ` · ${p.relation}` : ''}</option>)}</select></label>
                      {authorized ? <>
                        <p className="mt-2 text-moss-800" data-testid="pickup-proxy-authorized-note">On {c.firstName}’s authorized list since {new Date(authorized.addedAt).toLocaleDateString()} (added by {authorized.addedBy}, {authorized.via}). Photograph their government ID — no manager approval needed.</p>
                        <Button variant="primary" className="mt-2" data-testid="pickup-proxy-authorized-confirm" disabled={!proxyId} onClick={confirmAuthorized}><UserRound size={12} /> Confirm authorized person</Button>
                      </> : <>
                        <label className="mt-2 block text-ink-500">Proxy full name<input data-testid="pickup-proxy-name" value={proxyName} onChange={(e) => setProxyName(e.target.value)} placeholder="Who is collecting" className={`${field} mt-1 block w-full`} /></label>
                        <p className="mt-2 text-ink-400">Weakest path — not on the client’s list. Needs the proxy’s government ID photographed AND a different manager’s approval. ID photo is manager-only and purged when the warranty window closes.</p>
                        <Button variant="primary" className="mt-2" data-testid="pickup-proxy-approve" disabled={!proxyName.trim() || !proxyId} onClick={() => setProxyModal(true)}><UserRound size={12} /> Manager approval…</Button>
                      </>}
                    </div>
                    <div>{proxyId ? <div><img data-testid="pickup-proxy-id" src={proxyId.dataUrl} alt="ID" className="aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" /><Button size="sm" className="mt-1.5" onClick={() => setProxyId(undefined)}>Retake</Button></div> : <CameraPane role="counter" label="Government ID" testId="pickup-proxy-cam" placeholderLabel="Proxy ID" onShot={setProxyId} />}</div>
                  </div>
                )}
                {method === 'reverse_qr' && (
                  <div className="grid grid-cols-[1fr_320px] gap-3 text-xs">
                    <div>
                      <p className="text-ink-500">The station shows a QR; the client scans it with their own phone and taps <b>Yes</b>. Single-use, bound to this order and this station, expires in 2 minutes.</p>
                      {rqOpen ? (
                        <div className="mt-2 flex items-start gap-3">
                          <div data-testid="pickup-reverse-qr" className="rounded-sm bg-white p-2 ring-1 ring-line"><QRCodeSVG value={rqUrl} size={148} level="M" /></div>
                          <div><div className="font-mono text-[11px] text-ink-500" data-testid="pickup-reverse-url">{rqUrl.replace(window.location.origin, '')}</div><div className="mt-1 text-ink-500">expires in <span className="font-mono">{Math.max(0, Math.round((new Date(rq!.expiresAt).getTime() - Date.now()) / 1000))}s</span></div><Button size="sm" className="mt-2" data-testid="pickup-reverse-new" onClick={() => api.pickupIssueReverseQr(o.id).then(refresh).catch(oops)}>New QR</Button></div>
                        </div>
                      ) : <Button variant="primary" className="mt-2" data-testid="pickup-reverse-show" onClick={() => api.pickupIssueReverseQr(o.id).then(refresh).catch(oops)}><QrCode size={12} /> Show QR to client</Button>}
                      {declined && <GateBanner tone="block" testId="pickup-reverse-declined">Client declined on their phone — stop the hand-over.</GateBanner>}
                    </div>
                    {rq && <PhoneFrame caption="Mock phone · prototype only (NOT-KEEPER) · renders the real /rc/pickup page">{rqOpen || rq.usedAt ? <RcPickupConfirm key={rq.token} token={rq.token} embedded /> : <div className="p-4 text-sm text-rc-muted">Expired — show a new QR.</div>}</PhoneFrame>}
                  </div>
                )}
              </div>
              <div className="rounded-sm border border-line bg-canvas p-3 text-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Resend code</div>
                <p className="mt-1 text-ink-500">Rotates the code: the previous one dies immediately and the SO logs who, when, which generation.</p>
                <div className="mt-2 flex flex-col gap-1.5"><Button size="sm" data-testid="pickup-resend-email" onClick={() => void resend('email')}><Mail size={12} /> Email · {c.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2')}</Button><Button size="sm" data-testid="pickup-resend-sms" onClick={() => void resend('sms')}><MessageSquare size={12} /> SMS · {c.phone ? `•••-${c.phone.replace(/\D/g, '').slice(-4)}` : 'no phone'} <span className="text-[10px] text-ink-400">vonage-mock</span></Button></div>
                {ctx.resends.length > 0 && <ul data-testid="pickup-resend-log" className="mt-2 space-y-0.5 text-[11px] text-ink-500">{[...ctx.resends].reverse().slice(0, 4).map((r, i) => <li key={i}>gen {r.generation} · {r.channel.toUpperCase()} → {r.to} · {ago(r.at)} · {r.by}</li>)}</ul>}
              </div>
            </div>
          </>
        )}
        {msg && <div data-testid="pickup-verify-msg" className="mt-3 rounded-sm bg-moss-50 px-3 py-1.5 text-xs text-moss-800">{msg}</div>}
        {err && <div data-testid="pickup-verify-error" className="mt-3 rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{err}</div>}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2"><Button onClick={onBack}>Back</Button>{declined && <Button className="text-rose-700" data-testid="pickup-verify-stop" onClick={() => api.pickupAbort(o.id, 'step 3 · verify', 'Client declined the reverse-QR confirmation').then(onStopped).catch(fail)}>Stop pickup</Button>}</div>
          <Button variant="primary" data-testid="pickup-next-photos" disabled={!canContinue} title={needsSecond ? 'Second factor pending (≥ $10k)' : undefined} onClick={onNext}><UserRound size={13} /> {needsSecond ? 'Second factor pending' : 'Identity captured →'}</Button>
        </div>
      </Card>
      {proxyModal && <ManagerApprovalModal testId="pickup-proxy-modal" title={`Proxy release · ${proxyName}`} hint="A proxy collects on the client's behalf and is NOT on the authorized list. Confirm the ID matches the name and that the client asked for it." confirmLabel="Approve proxy" onClose={() => setProxyModal(false)} onApprove={async (input) => { refresh(await api.pickupVerifyProxy(o.id, proxyName, proxyId, input)); setProxyModal(false); say(`Proxy release approved · ${proxyName}`); }} />}
    </>
  );
};
