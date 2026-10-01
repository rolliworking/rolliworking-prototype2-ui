import clsx from 'clsx';
import { Check, KeyRound, Search, Settings2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { PickupContext, SalesOrderWithRefs } from '@/api/client';
import { SOBadge, SalesSubNav } from '@/components/sales/SalesBits';
import { EvidenceStrip, useEvidenceCapture } from '@/components/sales/pickup/EvidenceStrip';
import { CameraSettings } from '@/components/sales/pickup/PickupBits';
import { StepInvoice, StepItem } from '@/components/sales/pickup/StepsEarly';
import { StepComplete, StepPhotos } from '@/components/sales/pickup/StepsLate';
import { StepVerify } from '@/components/sales/pickup/StepVerify';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtMoneyCents, fullName } from '@/lib/format';

const STEPS = ['customer', 'invoice', 'verify', 'photos', 'complete'] as const;
const GATES = ['Item confirmed', 'Balance cleared', 'Identity verified', 'Serial verified', 'First frame'] as const;

export const Stepper = ({ steps, current, testId }: { steps: readonly string[]; current: number; testId: string }) => (
  <ol data-testid={testId} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
    {steps.map((s, i) => <li key={s} data-testid={`${testId}-${s}`} data-active={i === current} className={clsx('inline-flex items-center gap-1 rounded-sm px-2 py-1', i === current ? 'bg-ink text-white' : i < current ? 'text-moss-700' : 'text-ink-400')}>{i < current && <Check size={10} />}{i + 1}. {s}</li>)}
  </ol>
);

// Right rail: what this order is + which gates are open — derived from the same draft confirmPickup() validates
const GateRail = ({ ctx }: { ctx: PickupContext }) => {
  const o = ctx.order; const d = ctx.draft;
  const state = [!!d?.itemConfirmed, o.balanceDue <= 0 || !!d?.paymentBypass, !!d?.verify && (d.verify.method !== 'proxy' || !!d.verify.proxyApproval), !!d?.serialCheck && (d.serialCheck.result === 'match' || !!d.serialCheck.override), false];
  return (
    <Card title="Order" testId="pickup-side">
      <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-ink-500">Status</dt><dd><StatusPill status={o.status} /></dd><dt className="text-ink-500">Balance</dt><dd data-testid="pickup-side-balance" className={clsx('tabular', o.balanceDue > 0 ? 'font-semibold text-rose-700' : 'text-moss-800')}>{fmtMoneyCents(o.balanceDue)}</dd><dt className="text-ink-500">Code</dt><dd className="font-mono">{o.pickupCode ? `••••-•• · gen ${ctx.codeGeneration}` : '—'}</dd>{o.pickupWindow && <><dt className="text-ink-500">Window</dt><dd data-testid="pickup-window">{new Date(o.pickupWindow.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {o.pickupWindow.slot}</dd></>}<dt className="text-ink-500">Detail</dt><dd><Link to={`/sales/${o.id}`} className="text-brand hover:underline">Open sales order</Link>{o.job && <> · <Link to={`/jobs/${o.job.id}`} className="font-mono text-brand hover:underline">{o.job.number}</Link></>}</dd></dl>
      <ul data-testid="pickup-gates" className="mt-3 space-y-1 border-t border-line pt-2 text-xs">{GATES.map((g, i) => <li key={g} data-testid={`pickup-gate-${i + 1}`} data-ok={state[i]} className={clsx('inline-flex w-full items-center gap-1.5', state[i] ? 'text-moss-800' : 'text-ink-500')}>{state[i] ? <Check size={11} /> : <span className="inline-block h-[11px] w-[11px] rounded-full border border-ink-300" />} {i + 1}. {g}</li>)}</ul>
      {ctx.aborts.length > 0 && <div data-testid="pickup-side-aborts" className="mt-2 border-t border-line pt-2 text-[11px] text-rose-700">Stopped before: {ctx.aborts.map((a) => `${a.step} (${a.by})`).join(' · ')}</div>}
    </Card>
  );
};

export default function PickupStationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<SalesOrderWithRefs[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SalesOrderWithRefs[]>([]);
  const [ctx, setCtx] = useState<PickupContext | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SalesOrderWithRefs | null>(null);
  const [cams, setCams] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const evidence = useEvidenceCapture();

  const reload = useCallback(() => api.getPickupQueue().then(setQueue), []);
  useEffect(() => { void reload(); searchRef.current?.focus(); }, [reload]);
  useEffect(() => { if (!q.trim()) return setHits([]); const t = setTimeout(() => api.findSalesOrders(q).then((r) => setHits(r.filter((o) => ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status)))), 120); return () => clearTimeout(t); }, [q]);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Failed');
  const pick = useCallback((o: SalesOrderWithRefs) => { setError(null); api.pickupStart(o.id).then((c) => { setCtx(c); setStep(1); }).catch(fail); }, []);
  useEffect(() => { const so = params.get('so'); if (so && !ctx) api.getSalesOrder(so).then((o) => o && pick(o)).catch(fail); }, [params, ctx, pick]);
  const refresh = (c: PickupContext) => { setCtx(c); setError(null); };
  const reset = () => { setCtx(null); setStep(0); setDone(null); setError(null); setQ(''); navigate('/sales/pickup'); void reload(); setTimeout(() => searchRef.current?.focus(), 50); };
  const stopped = () => { setError(null); reset(); };
  const go = (n: number) => () => { setError(null); setStep(n); };
  const stepProps = ctx ? { ctx, refresh, onStopped: stopped, fail } : null;

  return (
    <div data-testid="pickup-station-page" className="space-y-4 pb-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Pickup Station</h1>
          <p className="mt-0.5 text-xs text-ink-500">item → invoice → verify → photos → complete · every gate is enforced where the release is committed · signature-free (locked) · custody closes on Done</p>
        </div>
        <div className="flex items-center gap-2">{ctx && !done && <Button size="sm" data-testid="pickup-leave" onClick={reset} title="Leave this pickup — the steps already done stay on the order; nothing is released"><X size={12} /> Leave · back to queue</Button>}<Button size="sm" data-testid="pickup-camera-settings-btn" onClick={() => setCams(true)}><Settings2 size={12} /> Cameras</Button><SalesSubNav /></div>
      </div>
      <Stepper steps={STEPS} current={done ? 5 : Math.max(0, step - 1)} testId="pickup-steps" />
      {error && <div data-testid="pickup-error" className="flex items-start justify-between gap-2 rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"><span>{error}</span><button type="button" aria-label="Dismiss" onClick={() => setError(null)}><X size={12} /></button></div>}

      {step === 0 && !done && (
        <div className="grid grid-cols-[1fr_400px] gap-4">
          <Card title="Customer" subtitle="Scan or type: name, SO #, estimate #, job #, pickup code" testId="pickup-customer-card">
            <label className="relative block"><Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input ref={searchRef} data-testid="pickup-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hits[0] && pick(hits[0])} placeholder="Start typing…" className="h-9 w-full rounded-sm border border-line bg-surface pl-7 pr-2 text-[14px] focus:border-ink focus:outline-none" /></label>
            <ul className="mt-2 divide-y divide-line/70">{hits.map((o) => <li key={o.id}><button type="button" data-testid={`pickup-hit-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-3 px-1 py-2 text-left text-[13px] hover:bg-canvas"><span className="font-mono text-xs font-medium">{o.number}</span><span className="font-medium text-ink">{fullName(o.client)}</span>{o.job && <span className="font-mono text-xs text-ink-400">{o.job.number}</span>}<StatusPill status={o.status} /><SOBadge order={o} /><span className="ml-auto tabular text-xs text-ink-500">{fmtMoneyCents(o.balanceDue)} due</span></button></li>)}</ul>
          </Card>
          <Card title="Ready queue" subtitle={`${queue.length} orders open / fulfilled, not routed to ship`} testId="pickup-queue" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{queue.map((o) => <li key={o.id}><button type="button" data-testid={`pickup-queue-${o.id}`} onClick={() => pick(o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-canvas"><span className="font-mono font-medium">{o.number}</span><span className="truncate text-ink-700">{fullName(o.client)}</span>{o.pickupCode && <span className="font-mono text-ink-400" title="code on record"><KeyRound size={10} className="mr-0.5 inline" />gen {o.pickupCodeGeneration ?? 1}</span>}{o.balanceDue > 0 && <span className="tabular text-rose-700">{fmtMoneyCents(o.balanceDue)} due</span>}<span className="ml-auto"><SOBadge order={o} /></span></button></li>)}</ul>
          </Card>
        </div>
      )}

      {stepProps && ctx && step >= 1 && step <= 5 && !done && (
        <div className="grid grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            {step === 1 && <StepItem {...stepProps} onNext={go(2)} onBack={reset} />}
            {step === 2 && <StepInvoice {...stepProps} onNext={go(3)} onBack={go(1)} />}
            {step === 3 && <StepVerify {...stepProps} onNext={go(4)} onBack={go(2)} />}
            {step === 4 && <StepPhotos {...stepProps} onNext={go(5)} onBack={go(3)} />}
            {step === 5 && <StepComplete ctx={ctx} fail={fail} onBack={go(4)} onDone={(o, capturing) => { setDone(o); if (capturing) evidence.start(o); else evidence.reload(); void reload(); }} />}
          </div>
          <GateRail ctx={ctx} />
        </div>
      )}

      {done && (
        <Card accent="moss" title="Pickup complete" testId="pickup-done">
          <p className="text-[13px] text-ink">{done.number} · {fullName(done.client)} · <StatusPill status={done.status} testId="pickup-done-status" />{done.job && <> · job <Link to={`/jobs/${done.job.id}`} className="font-mono text-brand hover:underline">{done.job.number}</Link> closed, custody released</>}</p>
          {done.pickupSession && <p data-testid="pickup-done-summary" className="mt-1 text-xs text-ink-700">{api.pickupSummaryLine(done.pickupSession, fullName(done.client))}</p>}
          <p className="mt-1 text-xs text-ink-500">{done.pickupSession?.evidenceStatus === 'bypassed' ? 'Released WITHOUT camera evidence (manager approved) · logged on the Hitlist.' : `Client camera is recording the hand-over strip in the background (${api.PICKUP_FRAMES} frames / ${api.PICKUP_FRAME_WINDOW_MS / 1000} s) — you can take the next customer.`} Code consumed · thank-you email recorded · <Link to={`/sales/${done.id}`} className="text-brand hover:underline">pickup session on the SO</Link>.</p>
          <Button variant="primary" className="mt-3" data-testid="pickup-reset" onClick={reset}>Next customer</Button>
        </Card>
      )}
      <EvidenceStrip captures={evidence.captures} reload={evidence.reload} />
      {cams && <CameraSettings onClose={() => setCams(false)} />}
    </div>
  );
}
