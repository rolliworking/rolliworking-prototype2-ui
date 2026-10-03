import clsx from 'clsx';
import { Camera, Check, RefreshCw, ScanSearch, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { PackagePhoto, PickupContext, SerialRead } from '@/api/client';
import { SpecimenBanner } from '@/components/inspection/OpinionCard';
import * as il from '@/api/inspectionLabels';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCamera } from '@/hooks/useCamera';
import { CameraPane, DEV, GateBanner, ManagerApprovalModal, placeholderShot, shotId, cameraPrefs } from './PickupBits';

type Props = { ctx: PickupContext; refresh: (c: PickupContext) => void; onNext: () => void; onBack: () => void; onStopped: () => void; fail: (e: unknown) => void };
const pct = (r: SerialRead) => (r.confidence == null ? '—' : `${Math.round(r.confidence * 100)}%`);
const PAIR_LABEL = { intake_vs_record: 'intake photo ≠ record', handback_vs_record: 'hand-back photo ≠ record', intake_vs_handback: 'intake ≠ hand-back' } as const;

// Three values, three comparisons — a mismatch against the record means something different from the two photos disagreeing
export const SerialCompare = ({ check, testId }: { check: NonNullable<PickupContext['draft']>['serialCheck'] & object; testId: string }) => {
  const tone = check.result === 'match' ? 'ok' : check.result === 'unreadable' ? 'warn' : 'block';
  const cell = (label: string, r: SerialRead, bad: boolean) => <div data-testid={`${testId}-${label.toLowerCase().replace(/\W+/g, '-')}`} data-bad={bad} className={clsx('rounded-sm border px-2 py-1.5', bad ? 'border-rose-300 bg-rose-50' : 'border-line bg-surface')}><div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div><div className="font-mono text-[15px] tracking-wider">{r.value ?? <span className="text-ink-400">unreadable</span>}</div><div className="text-[10px] text-ink-400">confidence {pct(r)}</div></div>;
  const badIntake = check.failedPair === 'intake_vs_record' || check.failedPair === 'intake_vs_handback' || (check.result === 'unreadable' && (!check.intake.value || (check.intake.confidence ?? 0) < 0.6));
  const badHand = check.failedPair === 'handback_vs_record' || check.failedPair === 'intake_vs_handback' || (check.result === 'unreadable' && (!check.handback.value || (check.handback.confidence ?? 0) < 0.6));
  return (
    <div data-testid={testId} data-result={check.result} data-source={check.source}>
      <div className="grid grid-cols-3 gap-2 text-xs">{cell('Record', { value: check.record || null, confidence: null }, false)}{cell('Intake OCR', check.intake, badIntake)}{cell('Hand-back OCR', check.handback, badHand)}</div>
      <div className="mt-2 flex items-center gap-2">
        <GateBanner tone={tone} testId={`${testId}-result`}>{check.result === 'match' ? 'Serial MATCH — all three agree.' : check.result === 'unreadable' ? 'Can’t read it — retake the hand-back photo (closer, less glare). This is not a mismatch.' : `Serial MISMATCH — ${PAIR_LABEL[check.failedPair!]}. Hard stop unless a different manager overrides with a reason.`}</GateBanner>
        <span data-testid={`${testId}-source`} className={clsx('shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1', check.source === 'mock' ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-sky-50 text-sky-800 ring-sky-200')}>{check.source === 'mock' ? 'MOCK result' : 'Claude vision'}</span>
      </div>
      {check.override && <div data-testid={`${testId}-override`} className="mt-1.5 text-xs text-rose-700">Overridden by {check.override.by} · “{check.override.reason}”</div>}
    </div>
  );
};

// Step 4 — intake photo vs hand-back photo side by side; one tap reads both serials and compares with the record
export const StepPhotos = ({ ctx, refresh, onNext, onBack, fail }: Props) => {
  const o = ctx.order; const d = ctx.draft;
  const intake = d?.intakePhoto ?? ctx.intakePhotos.find((p) => p.id === d?.itemConfirmed?.intakePhotoId) ?? ctx.intakePhotos[0];
  const [hand, setHand] = useState<PackagePhoto | undefined>(d?.handbackPhoto);
  const [busy, setBusy] = useState(false); const [override, setOverride] = useState(false);
  const check = d?.serialCheck;
  const run = (photo: PackagePhoto) => { if (!intake) { fail(new Error('No intake photo on this job — the serial check needs one')); return; } setBusy(true); api.pickupCheckSerial(o.id, intake, photo).then(refresh).catch(fail).finally(() => setBusy(false)); };
  const passed = !!check && (check.result === 'match' || !!check.override) && !(check.source === 'mock' && !api.MOCK_OCR_MAY_PASS && !check.override);
  const gate = o.job ? il.pickupGate(o.job.id) : null;
  return (
    <>
      <Card title="Step 4 · Photos + serial" subtitle={`record serial ${ctx.recordSerial || '—'} · the hand-back photo becomes part of the pickup record`} testId="pickup-photos-card">
        <div className="grid grid-cols-2 gap-4">
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Intake photo</div>{intake ? <img data-testid="pickup-photos-intake" src={intake.dataUrl} alt="intake" className="mt-1 aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" /> : <div className="mt-1 grid aspect-[4/3] place-items-center rounded-sm bg-canvas text-xs text-ink-400">No intake photo</div>}</div>
          <div><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Hand-back photo · now</div>
            {hand ? <div className="mt-1"><img data-testid="pickup-photos-handback" src={hand.dataUrl} alt="hand-back" className="aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" /><div className="mt-1.5 flex gap-1.5"><Button size="sm" data-testid="pickup-photos-retake" onClick={() => setHand(undefined)}><RefreshCw size={12} /> Retake</Button>{!check && <Button size="sm" variant="primary" data-testid="pickup-read-serials" disabled={busy} onClick={() => run(hand)}><ScanSearch size={12} /> {busy ? 'Reading…' : 'Read serials'}</Button>}</div></div>
              : <CameraPane role="counter" label="Hand-back" testId="pickup-handback-cam" placeholderLabel={`Hand-back · serial ${ctx.recordSerial}`} onShot={(p) => { setHand({ ...p, id: shotId(), slot: 'Hand-back' }); run(p); }} className="mt-1" />}
          </div>
        </div>
        {busy && <div data-testid="pickup-ocr-busy" className="mt-3 text-xs text-ink-500">Reading both engravings…</div>}
        {check && <div className="mt-3"><SerialCompare check={check} testId="pickup-serial" /></div>}
        {check && check.result !== 'match' && !check.override && <div className="mt-2 flex gap-2"><Button size="sm" className="text-rose-700" data-testid="pickup-serial-override" onClick={() => setOverride(true)}><ShieldAlert size={12} /> Manager override…</Button></div>}
        {o.job && <div className="mt-3"><SpecimenBanner jobId={o.job.id} onChange={() => api.getPickupContext(o.id).then(refresh)} /></div>}
        <div className="mt-3 flex items-center justify-between"><Button onClick={onBack}>Back</Button><Button variant="primary" data-testid="pickup-next-complete" disabled={!passed || !!gate} title={gate ? 'Specimen capture pending — complete the controlled shot list or have a manager waive' : undefined} onClick={onNext}><Camera size={13} /> {gate ? 'Specimen capture pending' : 'Photos verified →'}</Button></div>
      </Card>
      {override && check && <ManagerApprovalModal testId="pickup-serial-modal" title={`Override serial ${check.result}`} hint="The OCR result stays on the record; the override sits next to it with the approver's name." confirmLabel="Override" onClose={() => setOverride(false)} onApprove={async (input) => { refresh(await api.pickupOverrideSerial(o.id, input)); setOverride(false); }} />}
    </>
  );
};

// Step 5 — custody transfer. Done requires the FIRST client-camera frame (proves the camera works at the moment of release); frames 2–6 follow over 60 s.
export const StepComplete = ({ ctx, onBack, fail, onDone }: { ctx: PickupContext; onBack: () => void; fail: (e: unknown) => void; onDone: (order: api.SalesOrderWithRefs, capturing: boolean) => void }) => {
  const o = ctx.order; const d = ctx.draft!;
  const { videoRef, status, capture } = useCamera(true, cameraPrefs().client);
  const [bypass, setBypass] = useState(false); const [busy, setBusy] = useState(false);
  const done = async () => {
    setBusy(true);
    try {
      let shot = capture().dataUrl;
      if (!shot && DEV) shot = placeholderShot('CLIENT CAM · frame 1/6 · +0s').dataUrl;
      if (!shot) throw new Error('Client camera not ready — the first frame is required. Check the camera or use the camera bypass.');
      const r = await api.confirmPickup(o.id, { firstFrame: { id: shotId(), source: 'webcam', dataUrl: shot } });
      onDone(r, true);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const rows: [string, string][] = [['Item', d.itemConfirmed ? `confirmed by ${d.itemConfirmed.by}` : '—'], ['Invoice', d.paymentBypass ? `BYPASS · ${d.paymentBypass.by}` : `${o.invoiceSentAt ? 'sent' : o.zeroBalance ? 'zero balance' : 'NOT sent'} · QBO ${o.zeroBalance ? 'excluded' : d.invoiceCheck ? `${d.invoiceCheck.qboStatus} (${new Date(d.invoiceCheck.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})` : 'unread'}`], ['Balance', o.balanceDue <= 0 ? 'paid in full' : `BYPASS · ${d.paymentBypass?.by}`], ['Identity', d.verify ? api.PICKUP_VERIFY_LABEL[d.verify.method] + (d.verify.proxyName ? ` · ${d.verify.proxyName}${d.verify.proxyAuthorizedId ? ' (authorized)' : ''}` : '') : '—'], ['Value tier', `$${Math.round(ctx.valueTier.total).toLocaleString()}${ctx.valueTier.high ? ` ≥ $10k · 2nd factor ${d.secondFactor ? api.PICKUP_SECOND_FACTOR_LABEL[d.secondFactor.method] : d.verify?.method === 'reverse_qr' ? 'reverse QR' : '—'}` : ' · standard'}`], ['Serial', d.serialCheck ? `${d.serialCheck.result}${d.serialCheck.override ? ` · overridden by ${d.serialCheck.override.by}` : ''} (${d.serialCheck.source === 'mock' ? 'MOCK' : 'Claude'})` : '—'], ['Cameras', `client cam 1 frame / 10 s × ${api.PICKUP_FRAMES} · Reolink NVR clip stamped (MOCK) · 90 days`]];
  return (
    <>
      <Card accent="moss" title="Step 5 · Complete hand-over" subtitle={`custody closes on Done · client camera records ${api.PICKUP_FRAMES} frames over ${api.PICKUP_FRAME_WINDOW_MS / 1000} s · ${api.PICKUP_RETENTION.policy}`} testId="pickup-complete-card">
        <div className="grid grid-cols-[1fr_300px] gap-4">
          <dl data-testid="pickup-complete-summary" className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-xs">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-500">{k}</dt><dd className="inline-flex items-center gap-1 text-ink"><Check size={11} className="text-moss-700" /> {v}</dd></div>)}<dt className="text-ink-500">Retention</dt><dd className="text-ink-500">{api.PICKUP_RETENTION.policy}</dd></dl>
          <div data-testid="pickup-client-cam" data-status={status} className="rounded-sm border border-line bg-ink/95 p-2 text-white">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/70"><span>Client camera · station role: client</span><span>{status === 'ready' ? 'live' : status}</span></div>
            <div className="relative mt-1 aspect-[4/3] overflow-hidden rounded-sm bg-black"><video ref={videoRef} autoPlay muted playsInline className={clsx('h-full w-full object-cover', status !== 'ready' && 'opacity-0')} />{status !== 'ready' && <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-white/60">{status === 'denied' ? 'Permission denied' : status === 'starting' ? 'Starting…' : DEV ? 'No camera — dev build will record placeholder frames' : 'No client camera — Done is blocked without a manager camera bypass'}</div>}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2"><Button onClick={onBack}>Back</Button><Button className="text-rose-700" data-testid="pickup-camera-bypass" onClick={() => setBypass(true)}><ShieldAlert size={12} /> Camera not working…</Button></div>
          <Button variant="primary" data-testid="pickup-complete" disabled={busy} onClick={done}><Camera size={13} /> Capture frame 1 · Done</Button>
        </div>
      </Card>
      {bypass && <ManagerApprovalModal testId="pickup-camera-modal" title="Release without camera evidence" hint="USB cams fail. The release is logged as 'released without camera evidence' on the SO, the job, Client 360 and the Hitlist." confirmLabel="Release without evidence" onClose={() => setBypass(false)} onApprove={async (input) => { const r = await api.confirmPickup(o.id, { cameraBypass: input }); setBypass(false); onDone(r, false); }} />}
    </>
  );
};
