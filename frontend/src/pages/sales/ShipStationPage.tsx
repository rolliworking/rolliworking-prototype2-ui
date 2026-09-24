import { Mail, Search, Tag, Truck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Address, MockShipment, PackagePhoto, SalesOrderWithRefs, ShipCarrier } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { MoneyStrip, PaymentModal, SOBadge, SOLinesTable, SalesSubNav } from '@/components/sales/SalesBits';
import { Stepper } from '@/pages/sales/PickupStationPage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtMoneyCents, fullName } from '@/lib/format';

const STEPS = ['order', 'tracking', 'review', 'email'] as const;
const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export default function ShipStationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<SalesOrderWithRefs[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SalesOrderWithRefs[]>([]);
  const [order, setOrder] = useState<SalesOrderWithRefs | null>(null);
  const [step, setStep] = useState(0);
  const [addr, setAddr] = useState<Address>({ name: '', street: '', city: '', state: '' });
  const [carrier, setCarrier] = useState<ShipCarrier>('fedex');
  const [declared, setDeclared] = useState('');
  const [label, setLabel] = useState<MockShipment | null>(null);
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [bypass, setBypass] = useState('');
  const [pay, setPay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SalesOrderWithRefs | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const reload = () => api.getShipQueue().then(setQueue);
  useEffect(() => { void reload(); searchRef.current?.focus(); }, []);
  useEffect(() => { const so = params.get('so'); if (so) api.getSalesOrder(so).then((o) => o && pick(o)); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!q.trim()) return setHits([]); const t = setTimeout(() => api.findSalesOrders(q).then((r) => setHits(r.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)))), 120); return () => clearTimeout(t); }, [q]);

  const pick = (o: SalesOrderWithRefs) => { setOrder(o); setAddr(o.shippingAddress ?? { name: fullName(o.client), street: o.client.street, city: o.client.city, state: o.client.state }); setDeclared(String(o.total)); setStep(1); setError(null); };
  const refreshOrder = async () => { if (order) setOrder(await api.getSalesOrder(order.id)); };
  const declaredNormalized = api.normalizeDeclaredValue(Number(declared) || 0);

  const createLabel = async () => {
    if (!order) return;
    try {
      const saved = await api.setShippingAddress(order.id, addr);
      setOrder(saved);
      const l = await api.shippingProvider.createShipment({ carrier, declaredValue: Number(declared) || 0, address: addr, reference: saved.number });
      setLabel(l); setStep(2); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const confirm = async () => {
    if (!order || !label) return;
    try { const r = await api.confirmShipment(order.id, { carrier, declaredValue: Number(declared) || 0, photos, label, bypassReason: bypass || undefined }); setDone(r); setStep(3); await reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const reset = () => { setOrder(null); setStep(0); setLabel(null); setPhotos([]); setBypass(''); setDone(null); setError(null); navigate('/sales/ship'); searchRef.current?.focus(); };

  return (
    <div data-testid="ship-station-page" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Ship Station</h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">order → tracking → review → email · mock create-shipment seam (label + tracking + coverage) · IFS click path is dead <Provisional note="Carrier is open commercially — shippingProvider in client.ts is the seam a real provider replaces" /></p>
        </div>
        <SalesSubNav />
      </div>
      <Stepper steps={STEPS} current={step} testId="ship-steps" />
      {error && <div data-testid="ship-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}

      {step === 0 && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <Card title="Order" subtitle="Lookup by SO #, estimate #, job # or name" testId="ship-order-card">
            <label className="relative block"><Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input ref={searchRef} data-testid="ship-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hits[0] && pick(hits[0])} placeholder="SO-26-0104, E01044, Osei…" className="h-9 w-full rounded-sm border border-line bg-surface pl-7 pr-2 text-[14px] focus:border-ink focus:outline-none" /></label>
            <ul className="mt-2 divide-y divide-line/70">{hits.map((o) => <li key={o.id}><button type="button" data-testid={`ship-hit-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-3 px-1 py-2 text-left text-[13px] hover:bg-canvas"><span className="font-mono text-xs font-medium">{o.number}</span><span className="font-medium text-ink">{fullName(o.client)}</span><StatusPill status={o.status} /><SOBadge order={o} /><span className="ml-auto text-xs capitalize text-ink-500">{o.channel ?? 'no channel'}</span></button></li>)}</ul>
          </Card>
          <Card title="Paid / unshipped queue" subtitle={`${queue.length} routed to ship`} testId="ship-queue" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{queue.map((o) => <li key={o.id}><button type="button" data-testid={`ship-queue-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-canvas"><span className="font-mono font-medium">{o.number}</span><span className="truncate text-ink-700">{fullName(o.client)}</span>{!o.shippingAddress && <span className="text-amber-800">no address</span>}<span className="ml-auto"><SOBadge order={o} /></span></button></li>)}</ul>
          </Card>
        </div>
      )}

      {order && step === 1 && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <Card title={`Tracking · ${order.number}`} subtitle="Ship-to, carrier, declared value → mock label" testId="ship-tracking-card">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 text-xs text-ink-500">Ship-to address{(['name', 'street', 'city', 'state'] as (keyof Address)[]).map((k) => <input key={k} data-testid={`ship-addr-${k}`} value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} placeholder={k} className={`${field} block w-full`} />)}
                <Button size="sm" data-testid="ship-request-info" onClick={async () => { try { await api.requestShippingInfo(order.id); await refreshOrder(); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } }}><Mail size={12} /> Request shipping info (Outbox)</Button>{order.shippingInfoRequestedAt && <span className="ml-2 text-[11px] text-moss-700">requested</span>}
              </div>
              <div className="space-y-2 text-xs text-ink-500">
                <label className="block">Carrier<select data-testid="ship-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value as ShipCarrier)} className={`${field} mt-1 block w-full uppercase`}>{api.SHIP_CARRIERS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></label>
                <label className="block">Declared value<input data-testid="ship-declared" type="number" min={0} value={declared} onChange={(e) => setDeclared(e.target.value)} className={`${field} mt-1 block w-full tabular`} /><span className="mt-0.5 block text-[11px] text-ink-400">0 &lt; n &lt; 1000 is read as thousands → insured <span data-testid="ship-coverage-preview" className="tabular font-medium text-ink">{fmtMoneyCents(declaredNormalized)}</span></span></label>
                <div className="pt-1"><MoneyStrip order={order} /></div>
                {!order.isPaid && <label className="block text-rose-700">Unpaid — ship is blocked unless a bypass is logged<input data-testid="ship-bypass" value={bypass} onChange={(e) => setBypass(e.target.value)} placeholder="Bypass reason" className={`${field} mt-1 block w-full`} /><Button size="sm" className="mt-1" data-testid="ship-take-payment" onClick={() => setPay(true)}>Record payment instead</Button></label>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between"><Button onClick={reset}>Back</Button><Button variant="primary" data-testid="ship-create-label" onClick={createLabel}><Tag size={13} /> Create mock label →</Button></div>
          </Card>
          <Card title="Order" testId="ship-side" bodyClassName="p-0"><SOLinesTable order={order} /><p className="px-4 py-2 text-xs"><Link to={`/sales/${order.id}`} className="text-brand hover:underline">Open sales order</Link></p></Card>
        </div>
      )}

      {order && label && step === 2 && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <Card title="Review" subtitle="Package photos required before confirm" testId="ship-review-card">
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-ink-500">Service</dt><dd className="text-ink">{label.service}</dd><dt className="text-ink-500">Tracking</dt><dd data-testid="ship-tracking" className="font-mono text-ink">{label.tracking}</dd><dt className="text-ink-500">Label</dt><dd className="font-mono text-ink">{label.labelId}</dd><dt className="text-ink-500">Coverage</dt><dd data-testid="ship-coverage" className="tabular text-ink">{fmtMoneyCents(label.coverage)}</dd><dt className="text-ink-500">Ship-to</dt><dd className="text-ink">{addr.name}, {addr.street}, {addr.city} {addr.state}</dd></dl>
            <div className="mt-3"><PhotoCapture onAdd={(p) => setPhotos((x) => [...x, ...p])} />{photos.length > 0 && <div className="mt-2 flex gap-1.5" data-testid="ship-photo-grid">{photos.map((p) => <img key={p.id} src={p.dataUrl} alt="package" className="h-14 w-20 rounded-sm object-cover ring-1 ring-line" />)}</div>}</div>
            <div className="mt-3 flex items-center justify-between"><Button onClick={() => setStep(1)}>Back</Button><Button variant="primary" data-testid="ship-confirm" disabled={photos.length === 0} onClick={confirm}><Truck size={13} /> Confirm shipment</Button></div>
          </Card>
          <Card title="Mock label" testId="ship-label-card"><img src={label.labelDataUrl} alt="Mock shipping label" data-testid="ship-label-img" className="w-full rounded-sm ring-1 ring-line" /></Card>
        </div>
      )}

      {step === 3 && done && (
        <Card accent="moss" title="Shipped · notification queued" testId="ship-done">
          <p className="text-[13px] text-ink">{done.number} · {fullName(done.client)} · <StatusPill status={done.status} testId="ship-done-status" /> · tracking <span className="font-mono">{done.tracking}</span>{done.job && <> · job <Link to={`/jobs/${done.job.id}`} className="font-mono text-brand hover:underline">{done.job.number}</Link> closed, custody released</>}</p>
          <p className="mt-1 text-xs text-ink-500">Shipping notification queued to Outbox · shipment record + line shipped_qty saved · audit stamped.</p>
          <Button variant="primary" className="mt-3" data-testid="ship-reset" onClick={reset}>Next order (reset)</Button>
        </Card>
      )}
      {pay && order && <PaymentModal order={order} onClose={() => setPay(false)} onDone={async () => { setPay(false); await refreshOrder(); }} />}
    </div>
  );
}
