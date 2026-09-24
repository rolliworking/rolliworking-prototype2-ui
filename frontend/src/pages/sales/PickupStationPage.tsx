import clsx from 'clsx';
import { Camera, Check, KeyRound, Search, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { PackagePhoto, SalesOrderWithRefs } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { MoneyStrip, PaymentModal, SOBadge, SOLinesTable, SalesSubNav } from '@/components/sales/SalesBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtMoneyCents, fullName } from '@/lib/format';

const STEPS = ['customer', 'invoice', 'verify', 'photos', 'complete'] as const;
const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export const Stepper = ({ steps, current, testId }: { steps: readonly string[]; current: number; testId: string }) => (
  <ol data-testid={testId} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
    {steps.map((s, i) => <li key={s} data-testid={`${testId}-${s}`} data-active={i === current} className={clsx('inline-flex items-center gap-1 rounded-sm px-2 py-1', i === current ? 'bg-ink text-white' : i < current ? 'text-moss-700' : 'text-ink-400')}>{i < current && <Check size={10} />}{i + 1}. {s}</li>)}
  </ol>
);

export default function PickupStationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<SalesOrderWithRefs[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SalesOrderWithRefs[]>([]);
  const [order, setOrder] = useState<SalesOrderWithRefs | null>(null);
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [proxyName, setProxy] = useState('');
  const [proxyId, setProxyId] = useState<PackagePhoto | undefined>();
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [bypass, setBypass] = useState('');
  const [pay, setPay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SalesOrderWithRefs | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const reload = () => api.getPickupQueue().then(setQueue);
  useEffect(() => { void reload(); searchRef.current?.focus(); }, []);
  useEffect(() => { const so = params.get('so'); if (so) api.getSalesOrder(so).then((o) => { if (o) { setOrder(o); setStep(1); } }); }, [params]);
  useEffect(() => { if (!q.trim()) return setHits([]); const t = setTimeout(() => api.findSalesOrders(q).then((r) => setHits(r.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)))), 120); return () => clearTimeout(t); }, [q]);

  const pick = (o: SalesOrderWithRefs) => { setOrder(o); setStep(1); setError(null); if (o.channel === 'ship' && o.shippingAddress) setError('Order has outbound ship products — send staff to Ship Station'); };
  const refreshOrder = async () => { if (order) setOrder(await api.getSalesOrder(order.id)); };
  const verified = !!code.trim() || (!!proxyName.trim() && !!proxyId);

  const complete = async () => {
    if (!order) return;
    try {
      const r = await api.confirmPickup(order.id, { code: code || undefined, proxyName: proxyName || undefined, proxyIdPhoto: proxyId, photos, bypassReason: bypass || undefined });
      setDone(r); setStep(4); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const reset = () => { setOrder(null); setStep(0); setCode(''); setProxy(''); setProxyId(undefined); setPhotos([]); setBypass(''); setDone(null); setError(null); navigate('/sales/pickup'); searchRef.current?.focus(); };

  return (
    <div data-testid="pickup-station-page" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Pickup Station</h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">customer → invoice → verify → photos → complete · signature-free (locked decision) · custody closes on complete</p>
        </div>
        <SalesSubNav />
      </div>
      <Stepper steps={STEPS} current={step} testId="pickup-steps" />
      {error && <div data-testid="pickup-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}

      {step === 0 && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <Card title="Customer" subtitle="Scan or type: name, SO #, estimate #, job #, pickup code" testId="pickup-customer-card">
            <label className="relative block"><Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input ref={searchRef} data-testid="pickup-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hits[0] && pick(hits[0])} placeholder="Start typing…" className="h-9 w-full rounded-sm border border-line bg-surface pl-7 pr-2 text-[14px] focus:border-ink focus:outline-none" /></label>
            <ul className="mt-2 divide-y divide-line/70">{hits.map((o) => <li key={o.id}><button type="button" data-testid={`pickup-hit-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-3 px-1 py-2 text-left text-[13px] hover:bg-canvas"><span className="font-mono text-xs font-medium">{o.number}</span><span className="font-medium text-ink">{fullName(o.client)}</span>{o.job && <span className="font-mono text-xs text-ink-400">{o.job.number}</span>}<StatusPill status={o.status} /><SOBadge order={o} /><span className="ml-auto tabular text-xs text-ink-500">{fmtMoneyCents(o.balanceDue)} due</span></button></li>)}</ul>
          </Card>
          <Card title="Ready queue" subtitle={`${queue.length} orders open / fulfilled, not routed to ship`} testId="pickup-queue" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{queue.map((o) => <li key={o.id}><button type="button" data-testid={`pickup-queue-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-canvas"><span className="font-mono font-medium">{o.number}</span><span className="truncate text-ink-700">{fullName(o.client)}</span>{o.pickupCode && <span className="font-mono text-ink-400"><KeyRound size={10} className="mr-0.5 inline" />{o.pickupCode}</span>}<span className="ml-auto"><SOBadge order={o} /></span></button></li>)}</ul>
          </Card>
        </div>
      )}

      {order && step >= 1 && step <= 3 && (
        <div className="grid grid-cols-[1fr_380px] gap-4">
          <div className="space-y-4">
            <Card title={`Invoice · ${order.number}`} subtitle={`${fullName(order.client)}${order.job ? ` · job ${order.job.number}` : ''}${order.watch ? ` · ${order.watch.brand} ${order.watch.model}` : ''}`} testId="pickup-invoice-card" bodyClassName="p-0">
              <SOLinesTable order={order} showFulfil />
              <div className="p-4"><MoneyStrip order={order} />
                {!order.qboInvoiceId && <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-800">Not fulfilled yet — no QBO invoice id <Provisional note="Pack: without an invoice id pickup may assume paid — UNKNOWN; we keep payment gated" /></p>}
              </div>
            </Card>
            {step === 1 && <div className="flex items-center justify-between"><Button onClick={reset}>Back</Button><div className="flex gap-2">{order.balanceDue > 0 && <Button data-testid="pickup-take-payment" onClick={() => setPay(true)}>Record payment ({fmtMoneyCents(order.balanceDue)})</Button>}<Button variant="primary" data-testid="pickup-next-verify" onClick={() => setStep(2)}>Continue to verify →</Button></div></div>}
            {step === 2 && (
              <Card title="Verify identity" subtitle="Pickup code on the record, or a proxy: name + government ID photo" testId="pickup-verify-card">
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-xs text-ink-500">Pickup verification code<input data-testid="pickup-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XX" className={`${field} mt-1 block w-full font-mono text-[15px] tracking-wider`} /><span className="mt-1 block text-[11px] text-ink-400">{order.pickupCode ? 'A code was issued to the client by email.' : 'No code on record — use proxy verification or push to pickup first.'}</span></label>
                  <div className="text-xs text-ink-500">Proxy (someone else collecting)<input data-testid="pickup-proxy-name" value={proxyName} onChange={(e) => setProxy(e.target.value)} placeholder="Proxy full name" className={`${field} mt-1 block w-full`} /><div className="mt-1.5">{proxyId ? <img src={proxyId.dataUrl} alt="ID" data-testid="pickup-proxy-id" className="h-16 rounded-sm ring-1 ring-line" /> : <PhotoCapture onAdd={(p) => setProxyId(p[0])} />}</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between"><Button onClick={() => setStep(1)}>Back</Button><Button variant="primary" data-testid="pickup-next-photos" disabled={!verified} onClick={() => setStep(3)}><UserRound size={13} /> Identity captured →</Button></div>
              </Card>
            )}
            {step === 3 && (
              <Card title="Hand-back photos" subtitle="Required to complete — watch + accessories as handed over" testId="pickup-photos-card">
                <PhotoCapture onAdd={(p) => setPhotos((x) => [...x, ...p])} />
                {photos.length > 0 && <div className="mt-2 flex gap-1.5" data-testid="pickup-photo-grid">{photos.map((p) => <img key={p.id} src={p.dataUrl} alt="hand-back" className="h-14 w-20 rounded-sm object-cover ring-1 ring-line" />)}</div>}
                {order.balanceDue > 0 && <label className="mt-3 block text-xs text-rose-700">Balance due {fmtMoneyCents(order.balanceDue)} — payment bypass reason (logged)<input data-testid="pickup-bypass" value={bypass} onChange={(e) => setBypass(e.target.value)} placeholder="Why release unpaid" className={`${field} mt-1 block w-full`} /></label>}
                <div className="mt-3 flex items-center justify-between"><Button onClick={() => setStep(2)}>Back</Button><Button variant="primary" data-testid="pickup-complete" disabled={photos.length === 0} onClick={complete}><Camera size={13} /> Complete pickup</Button></div>
              </Card>
            )}
          </div>
          <Card title="Order" testId="pickup-side"><dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-ink-500">Status</dt><dd><StatusPill status={order.status} /></dd><dt className="text-ink-500">Channel</dt><dd className="capitalize">{order.channel ?? '—'}</dd><dt className="text-ink-500">Code issued</dt><dd className="font-mono">{order.pickupCode ? '••••-••' : '—'}</dd><dt className="text-ink-500">Detail</dt><dd><Link to={`/sales/${order.id}`} className="text-brand hover:underline">Open sales order</Link></dd></dl></Card>
        </div>
      )}

      {step === 4 && done && (
        <Card accent="moss" title="Pickup complete" testId="pickup-done">
          <p className="text-[13px] text-ink">{done.number} · {fullName(done.client)} · <StatusPill status={done.status} testId="pickup-done-status" />{done.job && <> · job <Link to={`/jobs/${done.job.id}`} className="font-mono text-brand hover:underline">{done.job.number}</Link> closed, custody released</>}</p>
          <p className="mt-1 text-xs text-ink-500">Code consumed · thank-you email queued to Outbox · audit stamped.</p>
          <Button variant="primary" className="mt-3" data-testid="pickup-reset" onClick={reset}>Next customer</Button>
        </Card>
      )}
      {pay && order && <PaymentModal order={order} onClose={() => setPay(false)} onDone={async () => { setPay(false); await refreshOrder(); await reload(); }} />}
    </div>
  );
}
