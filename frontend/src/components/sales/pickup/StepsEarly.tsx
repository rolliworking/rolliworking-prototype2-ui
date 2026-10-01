import clsx from 'clsx';
import { Check, Send } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { PackagePhoto, PickupContext } from '@/api/client';
import { MoneyStrip, PaymentModal, SOLinesTable } from '@/components/sales/SalesBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtMoneyCents } from '@/lib/format';
import { CameraPane, GateBanner, ManagerApprovalModal, StopPickup } from './PickupBits';

type StepProps = { ctx: PickupContext; refresh: (c: PickupContext) => void; onNext: () => void; onBack: () => void; onStopped: () => void; fail: (e: unknown) => void };

// Step 1 — the item on the counter vs the intake photos. Staff tick "Same item" (logged) or stop with a reason (logged + pinned to MH).
export const StepItem = ({ ctx, refresh, onNext, onBack, onStopped, fail }: StepProps) => {
  const [sel, setSel] = useState<PackagePhoto | undefined>(ctx.intakePhotos[0]);
  const [live, setLive] = useState<PackagePhoto | null>(null);
  const o = ctx.order; const w = o.watch;
  const same = () => api.pickupConfirmItem(o.id, sel?.id).then((c) => { refresh(c); onNext(); }).catch(fail);
  return (
    <Card title="Step 1 · Customer / item" subtitle={`${w ? `${w.brand} ${w.model} · ref ${w.reference} · serial ${w.serial}` : 'no watch on record'} · compare the piece on the counter with what we photographed at intake`} testId="pickup-item-card">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Intake photos · {o.job?.number ?? '—'}</div>
          {sel ? <img data-testid="pickup-item-intake" src={sel.dataUrl} alt="intake" className="mt-1 aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" /> : <div data-testid="pickup-item-intake-none" className="mt-1 grid aspect-[4/3] place-items-center rounded-sm bg-canvas text-xs text-ink-400">No intake photos on this job</div>}
          <div className="mt-1.5 flex gap-1.5">{ctx.intakePhotos.map((p) => <button key={p.id} type="button" data-testid={`pickup-item-thumb-${p.id}`} onClick={() => setSel(p)} className={clsx('h-12 w-16 overflow-hidden rounded-sm ring-1', sel?.id === p.id ? 'ring-ink' : 'ring-line')}><img src={p.dataUrl} alt={p.slot ?? 'intake'} className="h-full w-full object-cover" /></button>)}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">On the counter now</div>
          {live ? <div className="mt-1"><img data-testid="pickup-item-live" src={live.dataUrl} alt="counter" className="aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-line" /><Button size="sm" className="mt-1.5" data-testid="pickup-item-retake" onClick={() => setLive(null)}>Retake</Button></div> : <CameraPane role="counter" label="Live" testId="pickup-item-cam" placeholderLabel={`Counter · ${w ? `${w.brand} ${w.model}` : 'item'}`} onShot={setLive} className="mt-1" />}
        </div>
      </div>
      {o.pickupDemo === 'item_mismatch' && <GateBanner tone="warn" testId="pickup-item-demo">Demo fixture: the piece on the counter will not match the intake photo — stop with “Not the same item”.</GateBanner>}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2"><Button onClick={onBack}>Back</Button><StopPickup step="step 1 · item" testId="pickup-item-stop" label="Not the same item" onStop={(r) => api.pickupAbort(o.id, 'step 1 · item mismatch', r).then(onStopped)} /></div>
        <Button variant="primary" data-testid="pickup-item-same" onClick={same}><Check size={13} /> Same item — continue</Button>
      </div>
    </Card>
  );
};

// Step 2 — money. Balance shown live; one-tap Send invoice; the gate refuses while a balance remains. Sole exception: a DIFFERENT manager approves a logged bypass.
export const StepInvoice = ({ ctx, refresh, onNext, onBack, fail }: StepProps) => {
  const o = ctx.order; const [pay, setPay] = useState(false); const [bypass, setBypass] = useState(false); const [sent, setSent] = useState<string | null>(null);
  const reload = () => api.getPickupContext(o.id).then(refresh).catch(fail);
  const cleared = o.balanceDue <= 0 || !!ctx.draft?.paymentBypass;
  return (
    <>
      <Card title={`Step 2 · Invoice · ${o.number}`} subtitle={`${o.job ? `job ${o.job.number} · ` : ''}${o.invoiceSentAt ? `invoice sent ${o.invoiceSends.length}× · last ${new Date(o.invoiceSentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'invoice not sent yet'}`} testId="pickup-invoice-card" bodyClassName="p-0">
        <SOLinesTable order={o} showFulfil />
        <div className="space-y-3 p-4">
          <MoneyStrip order={o} />
          {o.balanceDue > 0 && !ctx.draft?.paymentBypass && <GateBanner tone="block" testId="pickup-balance-gate">Balance due {fmtMoneyCents(o.balanceDue)} — the pickup cannot continue. Take payment, or have a different manager approve a bypass (logged on the SO + Hitlist).</GateBanner>}
          {ctx.draft?.paymentBypass && <GateBanner tone="warn" testId="pickup-bypass-approved">Payment bypass approved by {ctx.draft.paymentBypass.by} · {fmtMoneyCents(ctx.draft.paymentBypass.amount)} outstanding · “{ctx.draft.paymentBypass.reason}”</GateBanner>}
          {o.balanceDue <= 0 && <GateBanner tone="ok" testId="pickup-balance-clear">Paid in full{o.zeroBalance ? ' · zero balance — no QBO sync' : ''}.</GateBanner>}
          {sent && <div data-testid="pickup-invoice-sent" className="text-xs text-moss-800">{sent}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="pickup-send-invoice" onClick={() => api.sendInvoice(o.id).then((r) => { setSent(`Invoice sent to ${r.client.email} · pay link included`); return reload(); }).catch(fail)}><Send size={12} /> Send invoice</Button>
            {o.balanceDue > 0 && <Button data-testid="pickup-take-payment" onClick={() => setPay(true)}>Record payment ({fmtMoneyCents(o.balanceDue)})</Button>}
            {o.balanceDue > 0 && !ctx.draft?.paymentBypass && <Button data-testid="pickup-bypass-open" className="text-rose-700" onClick={() => setBypass(true)}>Manager bypass…</Button>}
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-between"><Button onClick={onBack}>Back</Button><Button variant="primary" data-testid="pickup-next-verify" disabled={!cleared} onClick={onNext}>Continue to verify →</Button></div>
      {pay && <PaymentModal order={o} onClose={() => setPay(false)} onDone={() => { setPay(false); void reload(); }} />}
      {bypass && <ManagerApprovalModal testId="pickup-bypass-modal" title={`Payment bypass · ${fmtMoneyCents(o.balanceDue)} outstanding`} hint="Release without payment is the ONLY exception to the balance gate." confirmLabel="Approve bypass" onClose={() => setBypass(false)} onApprove={async (input) => { refresh(await api.pickupApproveBypass(o.id, input)); setBypass(false); }} />}
    </>
  );
};
