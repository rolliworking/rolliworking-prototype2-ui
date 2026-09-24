import { ArrowLeft, Ban, CheckCircle2, CreditCard, Mail, MapPin, PackageCheck, RefreshCw, Save, Truck, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Address, Client, SOLineInput, SalesOrderWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { ClientPicker } from '@/components/estimates/EstimateForm';
import { ReasonModal } from '@/components/jobs/JobBits';
import { LinesEditor, MoneyStrip, PaymentModal, PaymentsList, SOBadge, SOLinesTable, SalesSubNav } from '@/components/sales/SalesBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents, fmtTime, fullName } from '@/lib/format';

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';
type ModalState = 'payment' | 'cancel' | 'admin-pickup' | 'admin-ship' | null;

export default function SalesOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;
  const [o, setO] = useState<SalesOrderWithRefs | null | undefined>(isNew ? null : undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [lines, setLines] = useState<SOLineInput[]>([{ description: '', qty: 1, rate: 0 }]);
  const [shippingAmount, setShipping] = useState(0);
  const [memo, setMemo] = useState('');
  const [editing, setEditing] = useState(isNew);
  const [addr, setAddr] = useState<Address>({ name: '', street: '', city: '', state: '' });
  const [modal, setModal] = useState<ModalState>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const row = await api.getSalesOrder(id);
    setO(row);
    if (row) { setLines(row.lines.map((l) => ({ description: l.description, partNumber: l.partNumber, qty: l.qty, rate: l.rate, dept: l.dept }))); setShipping(row.shippingAmount); setMemo(row.memo ?? ''); setAddr(row.shippingAddress ?? { name: fullName(row.client), street: row.client.street, city: row.client.city, state: row.client.state }); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const say = (m: string) => { setFlash(m); setError(null); window.setTimeout(() => setFlash(null), 3000); };
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); await load(); if (msg) say(msg); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };

  const save = async () => {
    try {
      if (isNew) { const created = await api.createSalesOrder({ clientId: client?.id ?? '', lines, shippingAmount, memo }); navigate(`/sales/${created.id}`); return; }
      await api.updateSalesOrder(id!, { lines, shippingAmount, memo }); setEditing(false); await load(); say('Saved');
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
  };

  if (o === undefined) return null;
  if (!isNew && !o) return <div className="text-ink-500">Sales order not found. <Link to="/sales" className="underline">Back</Link></div>;
  const editable = isNew || (o && ['draft', 'open'].includes(o.status));
  const linesTotal = lines.reduce((t, l) => t + l.qty * l.rate, 0) + shippingAmount;

  return (
    <div data-testid="so-detail-page" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link to="/sales" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Sales orders</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-ink" data-testid="so-number">{o ? o.number : 'New sales order'}</h1>
            {o && <><StatusPill status={o.status} testId="so-status" /><SOBadge order={o} testId="so-badge" />{o.channel && <span data-testid="so-channel" className="inline-flex items-center gap-1 rounded-sm bg-canvas px-1.5 py-0.5 text-[11px] font-medium capitalize text-ink-700">{o.channel === 'ship' ? <Truck size={11} /> : <PackageCheck size={11} />} {o.channel}</span>}</>}
          </div>
          {o && <div className="mt-0.5 text-xs text-ink-500"><Link to={`/clients/${o.clientId}`} className="font-medium text-ink hover:underline">{fullName(o.client)}</Link> · {o.client.email}{o.job && <> · <Link to={`/jobs/${o.job.id}`} data-testid="so-job-link" className="inline-flex items-center gap-1 text-brand hover:underline"><Wrench size={11} /> Job {o.job.number}</Link>{o.watch && ` · ${o.watch.brand} ${o.watch.model}`}</>} · ordered {fmtDate(o.orderDate)}</div>}
        </div>
        <SalesSubNav />
      </div>

      {o && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="so-actions">
          {o.status === 'draft' && <Button variant="primary" data-testid="act-open-so" onClick={() => run(() => api.openSalesOrder(o.id), 'Opened · email queued')}>Open order</Button>}
          {['open', 'partial_fulfilled', 'fulfilled'].includes(o.status) && o.balanceDue > 0 && <Button variant="primary" data-testid="act-payment" onClick={() => setModal('payment')}><CreditCard size={13} /> Record payment</Button>}
          {['open', 'partial_fulfilled'].includes(o.status) && <span className="inline-flex items-center gap-1"><Button data-testid="act-fulfill" onClick={() => run(() => api.fulfillSalesOrder(o.id), 'Fulfilled · QBO queued (stub)')}><CheckCircle2 size={13} /> Fulfil → QBO</Button><Provisional note="Pack: without an invoice id, pickup may assume paid — simplest version: payment still gated" /></span>}
          {['open', 'partial_fulfilled', 'fulfilled'].includes(o.status) && <>
            <Button data-testid="act-push-pickup" disabled={o.channel === 'pickup'} onClick={() => run(() => api.setFulfillmentChannel(o.id, 'pickup'), 'Pushed to Pickup Station · code emailed')}><PackageCheck size={13} /> Push to Pickup</Button>
            <Button data-testid="act-push-ship" disabled={o.channel === 'ship'} onClick={() => run(() => api.setFulfillmentChannel(o.id, 'ship'), 'Pushed to Ship Station')}><Truck size={13} /> Push to Ship</Button>
            {o.channel === 'ship' && <Button data-testid="act-request-shipping-info" onClick={() => run(() => api.requestShippingInfo(o.id), 'Shipping info request queued to Outbox')}><Mail size={13} /> Request shipping info</Button>}
            {o.channel === 'pickup' && <Link to={`/sales/pickup?so=${o.id}`} data-testid="act-go-pickup" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300">Open in Pickup Station →</Link>}
            {o.channel === 'ship' && <Link to={`/sales/ship?so=${o.id}`} data-testid="act-go-ship" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300">Open in Ship Station →</Link>}
            {user?.accessTier === 'manager' && <><Button data-testid="act-admin-pickup" onClick={() => setModal('admin-pickup')}>Admin: mark picked up…</Button><Button data-testid="act-admin-ship" onClick={() => setModal('admin-ship')}>Admin: mark shipped…</Button></>}
          </>}
          {!['shipped', 'picked_up', 'cancelled'].includes(o.status) && <Button data-testid="act-cancel-so" className="!text-rose-700" onClick={() => setModal('cancel')}><Ban size={13} /> Cancel…</Button>}
          {editable && !editing && <Button data-testid="act-edit-so" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      )}

      {flash && <div data-testid="so-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="so-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          {isNew && <Card title="Customer" subtitle="Required before save" testId="so-client-card"><ClientPicker value={client} onChange={setClient} /></Card>}
          <Card title="Lines" subtitle="amount = qty × rate · total = Σ lines + shipping" testId="so-lines-card" bodyClassName={editing ? 'p-4' : 'p-0'}>
            {editing ? (
              <div className="space-y-3">
                <LinesEditor lines={lines} onChange={setLines} />
                <div className="grid grid-cols-[1fr_160px] gap-3">
                  <label className="text-xs text-ink-500">Notes / memo<input data-testid="so-memo" value={memo} onChange={(e) => setMemo(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
                  <label className="text-xs text-ink-500">Shipping amount<input data-testid="so-shipping" type="number" min={0} step="0.01" value={shippingAmount} onChange={(e) => setShipping(Number(e.target.value))} className={`${field} mt-1 block w-full tabular text-right`} /></label>
                </div>
                <div className="flex items-center justify-between"><span className="text-xs text-ink-500">Order total <span className="tabular font-semibold text-ink" data-testid="so-editor-total">{fmtMoneyCents(linesTotal)}</span></span><div className="flex gap-2">{!isNew && <Button onClick={() => { setEditing(false); void load(); }}>Cancel</Button>}<Button variant="primary" data-testid="so-save" onClick={save}><Save size={13} /> {isNew ? 'Create draft' : 'Save'}</Button></div></div>
              </div>
            ) : o && <SOLinesTable order={o} showFulfil />}
            {!editing && o?.memo && <p className="border-t border-line px-4 py-2 text-xs text-ink-500">Memo: {o.memo}</p>}
          </Card>
          {o && <Card title="Payments" subtitle="Stub ledger — no processor; partial allowed" testId="so-payments-card"><MoneyStrip order={o} /><div className="mt-3"><PaymentsList order={o} /></div></Card>}
        </div>
        {o && (
          <div className="space-y-4">
            <Card title="Hand-back" subtitle="Custody closes at pickup or ship — signature-free" testId="so-handback-card">
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-ink-500">Channel</dt><dd className="capitalize text-ink">{o.channel ?? '—'}</dd>
                {o.channel === 'pickup' && <><dt className="text-ink-500">Pickup code</dt><dd className="inline-flex items-center gap-2"><span data-testid="so-pickup-code" className="font-mono text-[15px] font-semibold tracking-wider text-ink">{o.pickupCode ?? (o.pickedUpAt ? 'consumed' : '—')}</span>{o.pickupCode && <button type="button" data-testid="act-regen-code" onClick={() => run(() => api.regeneratePickupCode(o.id), 'New code emailed')} className="text-ink-400 hover:text-ink" title="Re-issue"><RefreshCw size={11} /></button>}</dd></>}
                {o.pickupWindow && <><dt className="text-ink-500">Pickup window</dt><dd data-testid="so-pickup-window" className="text-ink">{new Date(o.pickupWindow.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {o.pickupWindow.slot} <span className="text-ink-400">· confirmed by client in RolliConnect</span>{o.pickupWindow.note && <span className="block text-xs text-ink-500">“{o.pickupWindow.note}”</span>}</dd></>}
                {o.channel === 'ship' && <>
                  <dt className="text-ink-500">Ship-to</dt>
                  <dd>{o.status === 'shipped' && o.shippingAddress ? <span data-testid="so-address">{o.shippingAddress.name}, {o.shippingAddress.street}, {o.shippingAddress.city} {o.shippingAddress.state}</span> : (
                    <div className="space-y-1" data-testid="address-form">
                      {o.shippingAddress && <div data-testid="so-address" className="text-ink">{o.shippingAddress.name}, {o.shippingAddress.street}, {o.shippingAddress.city} {o.shippingAddress.state}</div>}
                      {(['name', 'street', 'city', 'state'] as (keyof Address)[]).map((k) => <input key={k} data-testid={`addr-${k}`} value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} placeholder={k} className={`${field} block w-full`} />)}
                      <Button size="sm" data-testid="addr-save" onClick={() => run(() => api.setShippingAddress(o.id, addr), 'Ship-to saved')}><MapPin size={12} /> {o.shippingAddress ? 'Update address' : 'Save address'}</Button>
                    </div>
                  )}</dd>
                  {o.shippingInfoRequestedAt && <><dt className="text-ink-500">Info requested</dt><dd className="text-ink">{fmtDate(o.shippingInfoRequestedAt)} {fmtTime(o.shippingInfoRequestedAt)}</dd></>}
                  {o.tracking && <><dt className="text-ink-500">Tracking</dt><dd data-testid="so-tracking" className="font-mono text-ink">{o.tracking}</dd></>}
                  {o.shipDate && <><dt className="text-ink-500">Ship date</dt><dd className="text-ink">{fmtDate(o.shipDate)}</dd></>}
                </>}
                {o.pickedUpAt && <><dt className="text-ink-500">Picked up</dt><dd data-testid="so-picked-up" className="text-ink">{fmtDate(o.pickedUpAt)} {fmtTime(o.pickedUpAt)} · {o.pickupSession?.by}{o.pickupSession?.proxyName && ` · proxy ${o.pickupSession.proxyName}`}{o.pickupSession?.adminOverride && ' · ADMIN'}</dd></>}
                {o.fulfilledAt && <><dt className="text-ink-500">Fulfilled</dt><dd className="text-ink">{fmtDate(o.fulfilledAt)}</dd></>}
                {o.cancelledAt && <><dt className="text-ink-500">Cancelled</dt><dd className="text-rose-700">{fmtDate(o.cancelledAt)}</dd></>}
              </dl>
              {o.shipment && <div className="mt-3 border-t border-line pt-2 text-xs" data-testid="so-shipment"><div className="text-ink">{o.shipment.service} · insured {fmtMoneyCents(o.shipment.coverage)}{o.shipment.bypassReason && <span className="ml-1 text-rose-700">· payment bypass</span>}</div><img src={o.shipment.labelDataUrl} alt="Mock label" className="mt-1 w-full rounded-sm ring-1 ring-line" /></div>}
              {o.pickupSession && o.pickupSession.photos.length > 0 && <div className="mt-2 flex gap-1.5">{o.pickupSession.photos.map((p) => <img key={p.id} src={p.dataUrl} alt="hand-back" className="h-14 w-20 rounded-sm object-cover ring-1 ring-line" />)}</div>}
            </Card>
          </div>
        )}
      </div>

      {modal === 'payment' && o && <PaymentModal order={o} onClose={() => setModal(null)} onDone={() => { setModal(null); void load(); say('Payment recorded · email queued'); }} />}
      {modal === 'cancel' && o && <ReasonModal testId="cancel-so-modal" title={`Cancel ${o.number}`} confirmLabel="Cancel order" danger onClose={() => setModal(null)} onConfirm={async (r) => { await api.cancelSalesOrder(o.id, r); setModal(null); await load(); say('Cancelled'); }} />}
      {(modal === 'admin-pickup' || modal === 'admin-ship') && o && <ReasonModal testId="admin-mark-modal" title={modal === 'admin-pickup' ? 'Admin: mark picked up' : 'Admin: mark shipped'} hint="Privileged override — logged to the audit trail." confirmLabel="Mark" onClose={() => setModal(null)} onConfirm={async (r) => { await api.adminMarkComplete(o.id, modal === 'admin-pickup' ? 'pickup' : 'ship', r); setModal(null); await load(); say('Marked (admin)'); }} />}
    </div>
  );
}
