import { ArrowLeft, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { SalesOrderWithRefs } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcButton, RcCard, RcError, RcInput, RcLabel, rcDate, rcMoney } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

type Run = (fn: () => Promise<unknown>) => Promise<void>;

const PickupPanel = ({ o, run, busy }: { o: SalesOrderWithRefs; run: Run; busy: boolean }) => {
  const { client } = useRcSession();
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState<'morning' | 'afternoon'>('morning');
  const [note, setNote] = useState('');
  const minDate = new Date().toISOString().slice(0, 10);
  if (o.pickupWindow) {
    return (
      <RcCard eyebrow="Pickup" title="You’re booked in" testId="rc-pickup-confirmed">
        <p className="text-[15px] text-rc-muted">We’ll have everything ready on <span className="font-medium text-rc-ink">{new Date(o.pickupWindow.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>, {o.pickupWindow.slot === 'morning' ? 'in the morning (9–12)' : 'in the afternoon (1–5)'}.{o.pickupWindow.note && <> Note: “{o.pickupWindow.note}”</>}</p>
        {o.pickupCode && <p className="mt-3 text-sm text-rc-muted">Bring your pickup code <span className="font-mono text-rc-ink">{o.pickupCode}</span> or show this screen. Someone collecting for you needs your name and a government ID.</p>}
      </RcCard>
    );
  }
  return (
    <RcCard eyebrow="Pickup" title="Choose a pickup window" testId="rc-pickup-form">
      <div id="pickup" className="grid gap-4 sm:grid-cols-2">
        <div><RcLabel htmlFor="rc-pickup-date">Day</RcLabel><RcInput id="rc-pickup-date" data-testid="rc-pickup-date" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <RcLabel>Time</RcLabel>
          <div className="flex gap-2">
            {(['morning', 'afternoon'] as const).map((s) => (
              <button key={s} type="button" data-testid={`rc-pickup-slot-${s}`} onClick={() => setSlot(s)} className={`h-11 flex-1 rounded-md border text-sm capitalize transition-colors ${slot === s ? 'border-rc-ink bg-rc-ink text-rc-cream' : 'border-rc-line bg-white text-rc-ink hover:bg-rc-accentSoft'}`}>{s} <span className="opacity-60">{s === 'morning' ? '9–12' : '1–5'}</span></button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2"><RcLabel htmlFor="rc-pickup-note">Anything we should know? (optional)</RcLabel><RcInput id="rc-pickup-note" data-testid="rc-pickup-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. my husband Ken may collect it" /></div>
      </div>
      <RcButton className="mt-4" data-testid="rc-pickup-confirm" disabled={busy || !date} onClick={() => run(() => api.portalConfirmPickupWindow(client!.id, o.id, date, slot, note))}>Confirm pickup window</RcButton>
      {o.pickupCode && <p className="mt-3 text-sm text-rc-muted">Your pickup code is <span className="font-mono text-rc-ink">{o.pickupCode}</span>.</p>}
    </RcCard>
  );
};

const ShippingPanel = ({ o, run, busy }: { o: SalesOrderWithRefs; run: Run; busy: boolean }) => {
  const { client } = useRcSession();
  const [f, setF] = useState({ name: `${client!.firstName} ${client!.lastName}`, street: client!.street, city: client!.city, state: client!.state, phone: client!.phone });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  if (o.shippingAddress) {
    return (
      <RcCard eyebrow="Shipping" title={o.tracking ? 'On its way' : 'We have your address'} testId="rc-shipping-confirmed">
        <p className="text-[15px] text-rc-muted">{o.shippingAddress.name}, {o.shippingAddress.street}, {o.shippingAddress.city}, {o.shippingAddress.state}. Fully insured, signature on delivery.</p>
        {o.tracking && <p className="mt-2 text-sm">Tracking <span className="font-mono">{o.tracking}</span>{o.shipment && <span className="text-rc-muted"> · {o.shipment.service}</span>}</p>}
      </RcCard>
    );
  }
  return (
    <RcCard eyebrow="Shipping" title="Where should we send it?" testId="rc-shipping-form">
      <div id="shipping" className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><RcLabel htmlFor="rc-ship-name">Name</RcLabel><RcInput id="rc-ship-name" data-testid="rc-ship-name" value={f.name} onChange={set('name')} /></div>
        <div className="sm:col-span-2"><RcLabel htmlFor="rc-ship-street">Street</RcLabel><RcInput id="rc-ship-street" data-testid="rc-ship-street" value={f.street} onChange={set('street')} /></div>
        <div><RcLabel htmlFor="rc-ship-city">City</RcLabel><RcInput id="rc-ship-city" data-testid="rc-ship-city" value={f.city} onChange={set('city')} /></div>
        <div><RcLabel htmlFor="rc-ship-state">State</RcLabel><RcInput id="rc-ship-state" data-testid="rc-ship-state" value={f.state} onChange={set('state')} /></div>
        <div className="sm:col-span-2"><RcLabel htmlFor="rc-ship-phone">Phone for the carrier</RcLabel><RcInput id="rc-ship-phone" data-testid="rc-ship-phone" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <RcButton className="mt-4" data-testid="rc-ship-submit" disabled={busy} onClick={() => run(() => api.portalSubmitShippingInfo(client!.id, o.id, { name: f.name, street: f.street, city: f.city, state: f.state }, f.phone))}>Send shipping details</RcButton>
    </RcCard>
  );
};

export default function RcInvoicePage() {
  const { id = '' } = useParams();
  const { client } = useRcSession();
  const { data: o, loading, reload } = useAsync(() => api.portalGetInvoice(client!.id, id), [id]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run: Run = async (fn) => {
    setErr(null); setBusy(true);
    try { await fn(); reload(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  if (loading) return null;
  if (!o) return <p className="text-rc-muted">We couldn’t find that invoice on your account.</p>;
  const done = o.status === 'shipped' || o.status === 'picked_up';

  return (
    <div className="space-y-6" data-testid="rc-invoice-page">
      <Link to="/rc/home" className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink" data-testid="rc-back-home"><ArrowLeft size={14} /> My watches</Link>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Invoice {o.number} · {rcDate(o.orderDate)}</div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight">{o.watch ? `${o.watch.brand} ${o.watch.model}` : 'Your invoice'}</h1>
        <p className="mt-2 font-serif text-lg italic" data-testid="rc-invoice-status">{o.isPaid ? 'Paid in full — thank you' : `${rcMoney(o.balanceDue)} outstanding`}</p>
      </div>

      <RcCard eyebrow="Work completed" testId="rc-invoice-lines">
        <ul className="divide-y divide-rc-line">
          {o.lines.map((l) => <li key={l.id} className="flex items-baseline justify-between gap-6 py-3"><span className="text-[15px]">{l.description}{l.qty > 1 && <span className="text-rc-muted"> × {l.qty}</span>}</span><span className="tabular text-[15px]">{rcMoney(l.qty * l.rate)}</span></li>)}
          {o.shippingAmount > 0 && <li className="flex items-baseline justify-between py-3 text-rc-muted"><span>Insured shipping</span><span className="tabular">{rcMoney(o.shippingAmount)}</span></li>}
        </ul>
        <div className="mt-4 space-y-1 border-t border-rc-ink/20 pt-4 text-[15px]">
          <div className="flex justify-between"><span className="text-rc-muted">Total</span><span className="tabular">{rcMoney(o.total)}</span></div>
          {o.payments.map((p) => <div key={p.id} className="flex justify-between text-rc-muted"><span>Paid {rcDate(p.at)}{p.note ? ` · ${p.note}` : ''}</span><span className="tabular">−{rcMoney(p.amount)}</span></div>)}
          <div className="flex items-baseline justify-between pt-2"><span className="text-sm uppercase tracking-[0.12em] text-rc-muted">Balance</span><span className="font-serif text-3xl" data-testid="rc-invoice-balance">{rcMoney(o.balanceDue)}</span></div>
        </div>
        {o.balanceDue > 0 && !done && (
          <div className="mt-5">
            <RcButton data-testid="rc-pay-now" disabled={busy} onClick={() => run(() => api.portalPayBalance(client!.id, o.id))}><CreditCard size={16} /> Pay {rcMoney(o.balanceDue)} now</RcButton>
            <p className="mt-2 text-xs text-rc-muted">Preview: this records a card payment in our system. No card is charged.</p>
          </div>
        )}
        <RcError text={err} />
      </RcCard>

      {!done && o.channel === 'pickup' && (o.status === 'fulfilled' || o.status === 'partial_fulfilled' || o.status === 'open') && <PickupPanel o={o} run={run} busy={busy} />}
      {!done && o.channel === 'ship' && <ShippingPanel o={o} run={run} busy={busy} />}
      {done && <RcCard eyebrow={o.status === 'shipped' ? 'Shipped' : 'Picked up'} testId="rc-invoice-done"><p className="text-[15px] text-rc-muted">{o.status === 'shipped' ? <>Shipped {o.shipDate ? rcDate(o.shipDate) : ''}{o.tracking && <> · tracking <span className="font-mono text-rc-ink">{o.tracking}</span></>}</> : <>Collected {o.pickedUpAt ? rcDate(o.pickedUpAt) : ''}. Thank you.</>}</p></RcCard>}
    </div>
  );
}
