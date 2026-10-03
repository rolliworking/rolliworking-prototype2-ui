import clsx from 'clsx';
import { Check, IdCard, KeyRound, QrCode, ShieldCheck, Smartphone, TabletSmartphone } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { PackagePhoto, PickupContext } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { CameraPane, DEV, GateBanner, field } from './PickupBits';

// ≥ $10k value tier (pickup gap 4): after the primary identity check the CLIENT confirms on the paired kiosk — one-time code (MOCK SMS) typed on the kiosk, or a client-operated ID photo. Fallback = reverse QR on their phone.
// The kiosk renders inline here (one browser = every screen in the prototype, NOT-KEEPER); on a real counter it is the paired kiosk device from Setup → Stations.
export const SecondFactorPanel = ({ ctx, refresh, onReverseQr }: { ctx: PickupContext; refresh: (c: PickupContext) => void; onReverseQr: () => void }) => {
  const o = ctx.order; const t = ctx.valueTier; const sf = ctx.draft?.secondFactor; const k = ctx.pairedKiosk; const otp = ctx.kioskOtp;
  const [mode, setMode] = useState<'otp' | 'id' | null>(null); const [typed, setTyped] = useState(''); const [err, setErr] = useState<string | null>(null); const [peek, setPeek] = useState<string | null>(null);
  const oops = (e: unknown) => setErr(e instanceof Error ? e.message : 'Failed');
  const push = () => { setErr(null); api.pickupKioskPushOtp(o.id).then((c) => { refresh(c); setMode('otp'); if (DEV && c.kioskOtp) api.pickupDevKioskOtp(o.id).then(setPeek).catch(() => undefined); }).catch(oops); };
  const confirmOtp = () => { setErr(null); api.pickupKioskConfirmOtp(o.id, typed).then((c) => { refresh(c); setTyped(''); setMode(null); }).catch(oops); };
  const idShot = (p: PackagePhoto) => { setErr(null); api.pickupKioskIdPhoto(o.id, p).then((c) => { refresh(c); setMode(null); }).catch(oops); };
  const breakdown = `${t.itemValue === null ? 'item unvalued ($0 for the tier)' : `item $${t.itemValue.toLocaleString()} (${t.itemSource})`} + invoice $${t.invoiceTotal.toLocaleString()} = $${Math.round(t.total).toLocaleString()} ≥ $${t.threshold.toLocaleString()}`;
  if (sf) return <GateBanner tone="ok" testId="pickup-second-factor-ok"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Second factor · {api.PICKUP_SECOND_FACTOR_LABEL[sf.method]}{sf.kioskName ? ` · ${sf.kioskName}` : ''}{sf.otpLast2 ? ` · code ••••${sf.otpLast2}` : ''} · {new Date(sf.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span><span className="ml-2 text-[11px] font-normal text-moss-700">{breakdown}</span></GateBanner>;
  return (
    <div data-testid="pickup-second-factor" data-high className="rounded-sm border border-amber-300 bg-amber-50/60 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2"><ShieldCheck size={14} className="text-amber-800" /><span className="font-semibold text-amber-900">≥ $10k value tier — the client confirms the hand-over themselves</span><span data-testid="pickup-second-factor-breakdown" className="text-amber-800">{breakdown}</span></div>
      <p className="mt-1 text-ink-600">Second factor on the paired kiosk <b data-testid="pickup-second-factor-kiosk">{k ? k.name : 'none paired (Setup → Stations)'}</b>: a one-time code to the client’s phone typed on the kiosk, or a client-operated ID photo. No kiosk / no phone → reverse QR fallback.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="primary" data-testid="pickup-sf-otp" disabled={!k} onClick={push}><KeyRound size={12} /> {otp ? 'Push a new one-time code' : 'Push one-time code to kiosk'}</Button>
        <Button size="sm" data-testid="pickup-sf-id" disabled={!k} onClick={() => { setMode('id'); setErr(null); }}><IdCard size={12} /> Client-operated ID photo on kiosk</Button>
        <Button size="sm" data-testid="pickup-sf-reverse" onClick={onReverseQr}><QrCode size={12} /> Fallback · reverse QR</Button>
      </div>
      {(mode === 'otp' || mode === 'id') && k && (
        <div data-testid="pickup-kiosk-frame" data-mode={mode} className="mt-3 flex items-start gap-3">
          <div className="w-[340px] rounded-xl border-[6px] border-ink bg-ink p-1 shadow-pop"><div className="rounded-md bg-rc-cream p-4 text-rc-ink">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-rc-muted"><TabletSmartphone size={12} /> {k.name}</div>
            <div className="mt-2 font-serif text-xl">{o.client.firstName}, please confirm your pickup</div>
            <div className="text-xs text-rc-muted">{o.watch ? `${o.watch.brand} ${o.watch.model}` : 'Your watch'} · {o.number}</div>
            {mode === 'otp' && <div className="mt-3">
              <div className="text-xs text-rc-muted">{otp ? <>We texted a 6-digit code to <b>{otp.maskedTo}</b>. Enter it here.</> : 'Waiting for the counter to push a code…'}</div>
              <input data-testid="pickup-kiosk-otp" inputMode="numeric" maxLength={6} value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && typed.length === 6 && confirmOtp()} placeholder="••••••" className={`${field} mt-2 block w-full text-center font-mono text-[22px] tracking-[0.4em]`} disabled={!otp} />
              <Button variant="primary" className="mt-2 w-full" data-testid="pickup-kiosk-otp-confirm" disabled={!otp || typed.length !== 6} onClick={confirmOtp}><Check size={12} /> Confirm</Button>
              {DEV && peek && <div data-testid="pickup-kiosk-otp-peek" className="mt-2 rounded-sm bg-amber-100 px-2 py-1 text-[10px] text-amber-900">DEV · SMS (vonage-mock) says: <span className="font-mono">{peek}</span></div>}
            </div>}
            {mode === 'id' && <div className="mt-3"><div className="mb-1 text-xs text-rc-muted">Hold your ID to the camera and tap Capture — only a manager can view it; it is deleted when your warranty closes.</div><CameraPane role="client" label="Kiosk · your ID" testId="pickup-kiosk-id-cam" placeholderLabel={`Client ID · ${o.client.lastName}`} onShot={idShot} /></div>}
          </div></div>
          <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-800"><Smartphone size={11} /> Mock kiosk · prototype only (NOT-KEEPER) · pushed to {k.name}</p>
        </div>
      )}
      {err && <div data-testid="pickup-second-factor-error" className={clsx('mt-2 rounded-sm bg-rose-50 px-2 py-1 text-rose-700')}>{err}</div>}
    </div>
  );
};
