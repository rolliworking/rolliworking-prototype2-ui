import clsx from 'clsx';
import { Check, RefreshCw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import { CustodyChip } from '@/components/custody/CustodyChip';
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
  const o = ctx.order; const w = o.watch; const minus = o.job ? api.minusOneItemsSync(o.job.id) : [];
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
      {o.job && minus.length > 0 && <div className="mt-3"><GateBanner tone="block" testId="pickup-custody-gate"><div className="flex flex-wrap items-center gap-2">Gate 1 · custody: {minus.length} client asset{minus.length === 1 ? '' : 's'} on {o.job.number} {minus.length === 1 ? 'has' : 'have'} no real custody scan — add to custody at the node it is at before the hand-over.{minus.map((m) => <CustodyChip key={m.part} jobId={o.job!.id} part={m.part} onFixed={() => api.getPickupContext(o.id).then(refresh).catch(fail)} />)}</div></GateBanner></div>}
      {o.pickupDemo === 'item_mismatch' && <GateBanner tone="warn" testId="pickup-item-demo">Demo fixture: the piece on the counter will not match the intake photo — stop with “Not the same item”.</GateBanner>}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2"><Button onClick={onBack}>Back</Button><StopPickup step="step 1 · item" testId="pickup-item-stop" label="Not the same item" onStop={(r) => api.pickupAbort(o.id, 'step 1 · item mismatch', r).then(onStopped)} /></div>
        <Button variant="primary" data-testid="pickup-item-same" disabled={minus.length > 0} title={minus.length ? 'Custody gate: −1 client asset — add to custody first' : undefined} onClick={same}><Check size={13} /> Same item — continue</Button>
      </div>
    </Card>
  );
};

// Step 2 — money. Gate = invoice SENT + QBO balance read as $0 (local ledger alone is not enough). Sole exception: a DIFFERENT manager approves a logged bypass.
export const StepInvoice = ({ ctx, refresh, onNext, onBack, fail }: StepProps) => {
  const o = ctx.order; const [pay, setPay] = useState(false); const [bypass, setBypass] = useState(false); const [sent, setSent] = useState<string | null>(null); const [reading, setReading] = useState(false);
  const reload = () => api.getPickupContext(o.id).then(refresh).catch(fail);
  const check = ctx.draft?.invoiceCheck; const invoiceSent = !!o.invoiceSentAt || !!o.zeroBalance;
  const readQbo = () => { setReading(true); api.pickupCheckInvoice(o.id).then(refresh).catch(fail).finally(() => setReading(false)); };
  useEffect(() => { if (!check && !ctx.draft?.paymentBypass) readQbo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const qboOk = !!o.zeroBalance || check?.qboStatus === 'ok';
  const cleared = !!ctx.draft?.paymentBypass || (o.balanceDue <= 0 && invoiceSent && qboOk);
  return (
    <>
      <Card title={`Step 2 · Invoice · ${o.number}`} subtitle={`${o.job ? `job ${o.job.number} · ` : ''}${o.invoiceSentAt ? `invoice sent${o.invoiceSends.length ? ` ${o.invoiceSends.length}×` : ''} · last ${new Date(o.invoiceSentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'invoice NOT sent yet'}`} testId="pickup-invoice-card" bodyClassName="p-0">
        <SOLinesTable order={o} showFulfil />
        <div className="space-y-3 p-4">
          <MoneyStrip order={o} />
          <div data-testid="pickup-gate2" className="grid grid-cols-2 gap-2 text-xs">
            <div data-testid="pickup-gate2-sent" data-ok={invoiceSent} className={`rounded-sm border px-3 py-2 ${invoiceSent ? 'border-moss-200 bg-moss-50 text-moss-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}><div className="text-[10px] font-semibold uppercase tracking-wide">Invoice sent</div><div className="font-medium">{o.zeroBalance ? 'zero balance — no invoice needed' : o.invoiceSentAt ? `yes · ${new Date(o.invoiceSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'NO — send it before the hand-over'}</div></div>
            <div data-testid="pickup-gate2-qbo" data-status={o.zeroBalance ? 'excluded' : check?.qboStatus ?? 'unread'} className={`rounded-sm border px-3 py-2 ${qboOk ? 'border-moss-200 bg-moss-50 text-moss-800' : check ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-line bg-canvas text-ink-600'}`}><div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide"><span>QBO balance at the gate</span><button type="button" data-testid="pickup-gate2-reread" onClick={readQbo} disabled={reading} className="inline-flex items-center gap-1 normal-case text-brand hover:underline disabled:opacity-50"><RefreshCw size={10} className={reading ? 'animate-spin' : ''} /> {reading ? 'reading…' : 're-read'}</button></div><div className="font-medium">{o.zeroBalance ? 'excluded — no QBO sync' : !check ? (reading ? 'Reading QuickBooks…' : 'not read yet') : check.qboStatus === 'unavailable' ? 'QBO unreachable — try again' : check.qboStatus === 'mismatch' ? `QBO shows ${fmtMoneyCents(check.qboBalance ?? 0)} · local ${fmtMoneyCents(check.localBalance)}` : `${fmtMoneyCents(check.qboBalance ?? 0)} · matches local · ${new Date(check.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}</div></div>
          </div>
          {!cleared && <GateBanner tone="block" testId="pickup-balance-gate">{o.balanceDue > 0 ? `Balance due ${fmtMoneyCents(o.balanceDue)} — ` : !invoiceSent ? 'The invoice was never sent — ' : !qboOk ? 'QuickBooks does not agree the balance is $0 — ' : ''}the pickup cannot continue. {o.balanceDue > 0 ? 'Take payment, ' : !invoiceSent ? 'Send the invoice, ' : 'Re-read QBO or take payment, '}or have a different manager approve a bypass (logged on the SO + Hitlist).</GateBanner>}
          {ctx.draft?.paymentBypass && <GateBanner tone="warn" testId="pickup-bypass-approved">Payment bypass approved by {ctx.draft.paymentBypass.by} · {fmtMoneyCents(ctx.draft.paymentBypass.amount)} outstanding · “{ctx.draft.paymentBypass.reason}”</GateBanner>}
          {cleared && !ctx.draft?.paymentBypass && <GateBanner tone="ok" testId="pickup-balance-clear">Paid in full{o.zeroBalance ? ' · zero balance — no QBO sync' : ' · invoice sent · QBO agrees'}.</GateBanner>}
          {sent && <div data-testid="pickup-invoice-sent" className="text-xs text-moss-800">{sent}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="pickup-send-invoice" onClick={() => api.sendInvoice(o.id).then((r) => { setSent(`Invoice sent to ${r.client.email} · pay link included`); return reload(); }).catch(fail)}><Send size={12} /> {o.invoiceSentAt ? 'Send invoice again' : 'Send invoice'}</Button>
            {o.balanceDue > 0 && <Button data-testid="pickup-take-payment" onClick={() => setPay(true)}>Record payment ({fmtMoneyCents(o.balanceDue)})</Button>}
            {!cleared && !ctx.draft?.paymentBypass && <Button data-testid="pickup-bypass-open" className="text-rose-700" onClick={() => setBypass(true)}>Manager bypass…</Button>}
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-between"><Button onClick={onBack}>Back</Button><Button variant="primary" data-testid="pickup-next-verify" disabled={!cleared} onClick={onNext}>Continue to verify →</Button></div>
      {pay && <PaymentModal order={o} onClose={() => setPay(false)} onDone={() => { setPay(false); api.pickupCheckInvoice(o.id).then(refresh).catch(fail); }} />}
      {bypass && <ManagerApprovalModal testId="pickup-bypass-modal" title={`Payment bypass · ${fmtMoneyCents(o.balanceDue)} outstanding${o.invoiceSentAt ? '' : ' · invoice never sent'}`} hint="Release without payment / without a sent invoice is the ONLY exception to the gate." confirmLabel="Approve bypass" onClose={() => setBypass(false)} onApprove={async (input) => { refresh(await api.pickupApproveBypass(o.id, input)); setBypass(false); }} />}
    </>
  );
};
