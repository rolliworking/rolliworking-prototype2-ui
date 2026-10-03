import clsx from 'clsx';
import { EyeOff, Film, ShieldAlert, Video } from 'lucide-react';
import * as api from '@/api/client';
import type { SalesOrderWithRefs } from '@/api/client';
import { SerialCompare } from '@/components/sales/pickup/StepsLate';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtMoneyCents, fmtTime, fullName } from '@/lib/format';

const EV_TONE: Record<string, string> = { pending: 'bg-amber-50 text-amber-800 ring-amber-200', complete: 'bg-moss-50 text-moss-800 ring-moss-200', incomplete: 'bg-rose-50 text-rose-700 ring-rose-200', bypassed: 'bg-rose-50 text-rose-700 ring-rose-200' };
const when = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`;

// THE pickup record — frames, OCR crops + three-way compare, verify method, resend log, every exception with its approver. Job timeline + Client 360 show one derived line that points here.
export const PickupSessionCard = ({ order: o, onChange }: { order: SalesOrderWithRefs; onChange?: () => void }) => {
  const s = o.pickupSession; const resends = o.pickupResends ?? []; const aborts = o.pickupAborts ?? [];
  if (!s && resends.length === 0 && aborts.length === 0) return null;
  const ev = s?.evidenceStatus; const frames = s?.frames ?? []; const expected = s?.framesExpected ?? api.PICKUP_FRAMES;
  const manager = api.canSeeIdPhotosSync(); const idPhoto = s?.proxyIdPhoto ?? s?.secondFactor?.idPhoto; const idTaken = !!idPhoto || !!s?.retention?.idPhotoPurgedAt || (!!s?.retention?.idPhotoUntil && (s.verifyMethod === 'proxy' || s.secondFactor?.method === 'kiosk_id_photo'));
  return (
    <Card title="Pickup session" subtitle={s ? api.pickupSummaryLine(s, fullName(o.client)) : 'no release yet — resend / stop history below'} testId="so-pickup-session" action={ev && <span data-testid="so-pickup-evidence" data-status={ev} className={clsx('rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1', EV_TONE[ev])}>{ev === 'bypassed' ? 'no camera evidence' : `evidence ${frames.length}/${expected} · ${ev}`}</span>}>
      {s && (
        <div className="space-y-3 text-xs">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-500">Released</dt><dd data-testid="so-pickup-released">{when(s.at)} · {s.by} · {s.station}{s.openedVia && <span className="text-ink-400"> · opened by {s.openedVia.replace(/_/g, ' ')}</span>}</dd>
            <dt className="text-ink-500">Identity</dt><dd data-testid="so-pickup-verify">{s.adminOverride ? 'ADMIN MARK (no verification)' : s.verifyMethod ? api.PICKUP_VERIFY_LABEL[s.verifyMethod] : s.codeUsed ? 'Code' : 'Proxy'}{s.codeUsed && ` · code generation ${s.codeGeneration ?? 1}`}{s.proxyName && ` · ${s.proxyName}${s.proxyAuthorizedId ? ' · authorized pickup person (client pre-approved)' : s.proxyApproval ? ` · approved by ${s.proxyApproval.by} (“${s.proxyApproval.reason}”)` : ''}`}</dd>
            {s.invoiceCheck && <><dt className="text-ink-500">Invoice gate</dt><dd data-testid="so-pickup-invoice-check">{s.invoiceCheck.invoiceSentAt ? `sent ${fmtDate(s.invoiceCheck.invoiceSentAt)}` : 'NOT sent'} · QBO {s.invoiceCheck.qboStatus}{s.invoiceCheck.qboBalance !== null ? ` · ${fmtMoneyCents(s.invoiceCheck.qboBalance)}` : ''} · read {fmtTime(s.invoiceCheck.at)}</dd></>}
            {s.valueTier && <><dt className="text-ink-500">Value tier</dt><dd data-testid="so-pickup-tier" data-high={s.valueTier.high}>{s.valueTier.itemValue === null ? 'item unvalued' : `item $${s.valueTier.itemValue.toLocaleString()}`} + invoice ${s.valueTier.invoiceTotal.toLocaleString()} = ${Math.round(s.valueTier.total).toLocaleString()}{s.valueTier.high ? <span className="ml-1 rounded-sm bg-amber-50 px-1 font-semibold text-amber-800 ring-1 ring-amber-200">≥ $10k</span> : ' · standard'}{s.secondFactor && <span data-testid="so-pickup-second-factor"> · 2nd factor {api.PICKUP_SECOND_FACTOR_LABEL[s.secondFactor.method]}{s.secondFactor.kioskName ? ` on ${s.secondFactor.kioskName}` : ''}{s.secondFactor.otpLast2 ? ` · ••••${s.secondFactor.otpLast2}` : ''}</span>}</dd></>}
            {s.itemConfirmed && <><dt className="text-ink-500">Item</dt><dd>confirmed against intake photos by {s.itemConfirmed.by} · {fmtTime(s.itemConfirmed.at)}</dd></>}
            {s.paymentBypass && <><dt className="text-ink-500">Payment</dt><dd data-testid="so-pickup-payment-bypass" className="inline-flex items-center gap-1 text-rose-700"><ShieldAlert size={11} /> BYPASS · released with {fmtMoneyCents(s.paymentBypass.amount)} outstanding · approved by {s.paymentBypass.by} · “{s.paymentBypass.reason}”</dd></>}
            {s.cameraBypass && <><dt className="text-ink-500">Camera</dt><dd data-testid="so-pickup-camera-bypass" className="inline-flex items-center gap-1 text-rose-700"><ShieldAlert size={11} /> released without camera evidence · approved by {s.cameraBypass.by} · “{s.cameraBypass.reason}”</dd></>}
            {s.reolink && <><dt className="text-ink-500">NVR clip</dt><dd data-testid="so-pickup-reolink" className="inline-flex items-center gap-1 text-ink-600"><Video size={11} /> {s.reolink.nvr} · {s.reolink.channel} · {fmtTime(s.reolink.clipFrom)}–{fmtTime(s.reolink.clipTo)} · ref <span className="font-mono">{s.reolink.clipRef}</span> · kept until {fmtDate(s.reolink.retainUntil)}</dd></>}
            {s.retention && <><dt className="text-ink-500">Retention</dt><dd className="text-ink-500">{s.retention.policy} · frames until {fmtDate(s.retention.framesUntil)}{s.retention.idPhotoUntil && ` · ID photo until ${fmtDate(s.retention.idPhotoUntil)}`}{s.retention.idPhotoPurgedAt && <span data-testid="so-pickup-id-purged" className="ml-1 text-rose-700">· ID photo purged {fmtDate(s.retention.idPhotoPurgedAt)}</span>}</dd></>}
          </dl>
          {(s.intakePhoto || s.handbackPhoto || idTaken) && <div className="flex gap-2">{s.intakePhoto && <figure><img src={s.intakePhoto.dataUrl} alt="intake" className="h-24 w-32 rounded-sm object-cover ring-1 ring-line" /><figcaption className="mt-0.5 text-[10px] text-ink-500">Intake</figcaption></figure>}{s.handbackPhoto && <figure><img data-testid="so-pickup-handback" src={s.handbackPhoto.dataUrl} alt="hand-back" className="h-24 w-32 rounded-sm object-cover ring-1 ring-line" /><figcaption className="mt-0.5 text-[10px] text-ink-500">Hand-back</figcaption></figure>}
            {idTaken && (s.retention?.idPhotoPurgedAt ? <figure data-testid="so-pickup-id-photo" data-state="purged"><div className="grid h-24 w-32 place-items-center rounded-sm bg-canvas text-[10px] text-ink-400 ring-1 ring-line"><span className="text-center">ID photo purged<br />warranty window closed</span></div><figcaption className="mt-0.5 text-[10px] text-ink-500">ID · purged</figcaption></figure>
              : manager && idPhoto ? <figure data-testid="so-pickup-id-photo" data-state="visible"><img src={idPhoto.dataUrl} alt="ID" className="h-24 w-32 rounded-sm object-cover ring-1 ring-line" /><figcaption className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-500"><EyeOff size={10} /> ID · manager-only · until {s.retention?.idPhotoUntil ? fmtDate(s.retention.idPhotoUntil) : '—'}</figcaption></figure>
              : <figure data-testid="so-pickup-id-photo" data-state="restricted"><div className="grid h-24 w-32 place-items-center rounded-sm bg-ink/90 text-[10px] text-white/70 ring-1 ring-line"><span className="inline-flex flex-col items-center gap-1 text-center"><EyeOff size={14} /> ID photo<br />manager-only</span></div><figcaption className="mt-0.5 text-[10px] text-ink-500">ID · restricted</figcaption></figure>)}
            {idTaken && manager && idPhoto && import.meta.env.DEV && <button type="button" data-testid="so-pickup-id-purge-dev" onClick={() => api.pickupDevPurgeIdPhotoNow(o.id).then(() => onChange?.())} className="self-start text-[10px] text-ink-400 underline hover:text-ink">Dev · purge now (warranty closed)</button>}
          </div>}
          {s.serialCheck && <SerialCompare check={s.serialCheck} testId="so-pickup-serial" />}
          {ev && ev !== 'bypassed' && (
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><Film size={11} /> Client camera strip · {frames.length}/{expected}{s.evidenceStartedAt && ` · started ${fmtTime(s.evidenceStartedAt)}`}{s.evidenceCompletedAt && ` · complete ${fmtTime(s.evidenceCompletedAt)}`}{s.evidenceFlaggedAt && ` · flagged ${fmtTime(s.evidenceFlaggedAt)}`}</div>
              <div data-testid="so-pickup-frames" className="mt-1 flex gap-1.5">{Array.from({ length: expected }, (_, i) => frames[i]).map((f, i) => f ? <figure key={f.id}><img src={f.dataUrl} alt={`frame ${f.seq}`} className="h-16 w-[86px] rounded-sm object-cover ring-1 ring-line" /><figcaption className="mt-0.5 font-mono text-[10px] text-ink-500">#{f.seq} · {fmtTime(f.at)}</figcaption></figure> : <div key={i} className={clsx('grid h-16 w-[86px] place-items-center rounded-sm text-[10px]', ev === 'incomplete' ? 'bg-rose-50 text-rose-700' : 'bg-canvas text-ink-400')}>{ev === 'incomplete' ? 'missing' : 'waiting'}</div>)}</div>
            </div>
          )}
        </div>
      )}
      {resends.length > 0 && <div className="mt-3 border-t border-line pt-2 text-xs"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Code resends</div><ul data-testid="so-pickup-resends" className="mt-1 space-y-0.5 text-ink-700">{[...resends].reverse().map((r, i) => <li key={i}>gen {r.generation} · {r.channel.toUpperCase()} → {r.to} · {when(r.at)} · {r.by}{r.smsId && <span className="text-ink-400"> · {r.smsId}</span>}</li>)}</ul></div>}
      {aborts.length > 0 && <div className="mt-3 border-t border-line pt-2 text-xs"><div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Stopped pickups</div><ul data-testid="so-pickup-aborts" className="mt-1 space-y-0.5 text-ink-700">{[...aborts].reverse().map((a, i) => <li key={i}>{a.step} · “{a.reason}” · {when(a.at)} · {a.by}</li>)}</ul></div>}
    </Card>
  );
};
