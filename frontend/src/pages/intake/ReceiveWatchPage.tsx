import { AlertTriangle, ArrowLeft, Check, MessageSquareQuote, Tags } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { DeptCode, ReceiveWatchInput, ReceiveWatchResult, WatchMatch } from '@/api/client';
import { PhotoStrip, Stamp } from '@/components/intake/IntakeBits';
import { ComponentChecklist, LineChecklist, SameWatchFork, WorkflowPicker } from '@/components/intake/InspectionBits';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { useAsync } from '@/hooks/useAsync';
import { fullName } from '@/lib/format';

export default function ReceiveWatchPage() {
  const { id = '' } = useParams();
  const { refreshCounts } = useIntakeCounts();
  const { data: ctx, loading, error: loadError } = useAsync(() => api.getInspectionContext(id), [id]);

  const [linesVerified, setLinesVerified] = useState<number[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  const [reference, setReference] = useState('');
  const [serial, setSerial] = useState('');
  const [match, setMatch] = useState<WatchMatch | null>(null);
  const [decision, setDecision] = useState<'n/a' | 'returning' | 'conflict'>('n/a');
  const [workflow, setWorkflow] = useState<DeptCode[]>([]);
  const [extraWatch, setExtraWatch] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveWatchResult | null>(null);

  // Trickle-down: pre-populate from the estimate; the operator verifies rather than re-enters
  useEffect(() => {
    if (!ctx) return;
    setComponents(ctx.expectedComponents.filter((c) => ctx.pkg.contents.includes(c)));
    setReference(ctx.estimate.watch.reference);
    setSerial(ctx.estimate.watch.serial);
    setWorkflow(ctx.suggestedWorkflow);
  }, [ctx]);

  // Mandatory same-watch check whenever ref + serial settle
  useEffect(() => {
    if (!ctx) return;
    let alive = true;
    const t = setTimeout(() => {
      api.findWatchBySerial(reference, serial).then((m) => {
        if (!alive) return;
        setMatch(m);
        setDecision('n/a');
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ctx, reference, serial]);

  const input: ReceiveWatchInput | null = ctx
    ? { reference, serial, linesVerified, componentsReceived: components, extraWatch, workflow, sameWatchDecision: match ? decision : 'n/a', notes: notes || undefined }
    : null;
  const discrepancies = useMemo(() => (ctx && input ? api.computeDiscrepancies(ctx, input) : []), [ctx, input]);
  const forkPending = !!match && decision === 'n/a';
  const canCommit = !!ctx && !forkPending && reference.trim() && serial.trim() && workflow.length > 0 && ctx.pkg.status === 'awaiting_inspection';

  if (loading) return null;
  if (loadError || !ctx || !input) {
    return (
      <div data-testid="inspection-error" className="text-ink-500">
        {loadError ?? 'Package not found.'} <Link to="/intake/inspection" className="underline">Back</Link>
      </div>
    );
  }

  const { pkg, estimate } = ctx;

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.receiveWatch(pkg.id, input);
      setResult(res);
      refreshCounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not commit');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const hold = result.pkg.status === 'discrepancy_hold';
    return (
      <div data-testid="inspection-result" className="mx-auto max-w-[640px] animate-rise">
        <Card accent={hold ? 'none' : 'moss'} className={hold ? 'border-l-[3px] border-rose-500' : ''}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${hold ? 'bg-rose-50 text-rose-700' : 'bg-moss-50 text-moss-700'}`}>
              {hold ? <AlertTriangle size={18} /> : <Check size={18} strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-tight text-ink">{hold ? 'Placed on discrepancy hold' : 'Watch received — awaiting approval'}</div>
              <div className="mt-0.5 text-xs text-ink-500">
                {result.pkg.subNumber} · {estimate.number} · {fullName(estimate.client)}
              </div>
              <div className="mt-2"><StatusPill status={result.pkg.status} testId="inspection-result-status" /></div>
              {hold ? (
                <ul className="mt-3 space-y-1 text-[13px] text-rose-800" data-testid="inspection-result-reasons">
                  {result.discrepancies.map((d) => <li key={d} className="flex gap-2"><span>•</span>{d}</li>)}
                </ul>
              ) : (
                <div className="mt-3 rounded-sm bg-canvas p-3 text-xs" data-testid="inspection-result-labels">
                  <div className="mb-1 inline-flex items-center gap-1 font-semibold text-ink-500"><Tags size={12} /> 2 labels queued (unprinted)</div>
                  {result.labels.map((l) => (
                    <div key={l.id} className="font-mono text-ink-700">{l.type === 'pdf417_data' ? 'PDF417' : 'REF/SER'} · {l.payload}</div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Link to="/intake/inspection" data-testid="inspection-result-back"><Button>Back to bins</Button></Link>
                {!hold && <Link to="/intake/labels" data-testid="inspection-result-labels-link"><Button variant="primary">Open Label Queue</Button></Link>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const readOnly = pkg.status !== 'awaiting_inspection';

  return (
    <div data-testid="receive-watch-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/intake/inspection" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Receive Watch</Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono font-semibold text-ink" data-testid="inspection-estimate-number">{estimate.number}</span>
          <span className="font-mono text-ink-500">{pkg.subNumber}</span>
          <StatusPill status={pkg.status} />
          <Stamp by={pkg.workOrderBy} station={pkg.arrivedStation} at={pkg.workOrderAt} />
        </div>
      </div>

      {readOnly && <div className="rounded-sm bg-amber-50 px-3 py-2 text-xs text-amber-900">This package has already been inspected — read only.</div>}

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="From the estimate" subtitle={`${fullName(estimate.client)} · ${estimate.watch.brand} ${estimate.watch.model} · verify each line is in scope`} testId="inspection-lines-card">
            <LineChecklist lines={estimate.lines} verified={linesVerified} onToggle={(i) => setLinesVerified((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]))} />
            <div className="mt-3 flex items-start gap-2 rounded-sm bg-canvas p-2.5 text-xs text-ink-700" data-testid="inspection-concerns">
              <MessageSquareQuote size={13} className="mt-0.5 shrink-0 text-ink-400" />
              <span><span className="font-semibold text-ink-500">Client’s stated concerns:</span> {estimate.concerns}</span>
            </div>
          </Card>

          <Card title="Expected components" subtitle="Derived from scope — confirm each was actually received" testId="inspection-components-card">
            <ComponentChecklist expected={ctx.expectedComponents} received={components} onToggle={(c) => setComponents((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} />
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-ink-400">Stage 2 logged: {pkg.contents.join(', ') || '—'}</span>
              <label className="inline-flex items-center gap-1.5 text-ink-700">
                <input type="checkbox" data-testid="extra-watch" checked={extraWatch} onChange={(e) => setExtraWatch(e.target.checked)} className="accent-rose-600" /> Extra / unexpected watch in package
              </label>
            </div>
            {pkg.photos.length > 0 && <div className="mt-3 border-t border-line pt-3"><PhotoStrip photos={pkg.photos} size="sm" /></div>}
          </Card>

          <Card title="Watch identity" subtitle="Verify reference and serial on the watch itself — NS if the serial is unreadable" testId="inspection-identity-card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Reference</label>
                <input data-testid="identity-reference" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} disabled={readOnly} className="h-11 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] tracking-wide focus:border-ink focus:bg-surface focus:outline-none" />
                <p className="mt-1 text-[11px] text-ink-400">Estimate says <span className="font-mono">{estimate.watch.reference}</span></p>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Serial</label>
                <div className="flex gap-2">
                  <input data-testid="identity-serial" value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} disabled={readOnly} className="h-11 flex-1 rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] tracking-wide focus:border-ink focus:bg-surface focus:outline-none" />
                  <Button type="button" data-testid="identity-ns" onClick={() => setSerial('NS')} disabled={readOnly} title="Serial unreadable — placeholder">NS</Button>
                </div>
                <p className="mt-1 text-[11px] text-ink-400">Estimate says <span className="font-mono">{estimate.watch.serial}</span>{serial === 'NS' && <span className="ml-1 text-amber-800">· NS placeholder — skips the same-watch check</span>}</p>
              </div>
            </div>
            {match && (
              <div className="mt-4">
                <SameWatchFork match={match} expectedClientId={estimate.clientId} decision={decision} onDecide={setDecision} />
              </div>
            )}
            {!match && serial && serial !== 'NS' && <p data-testid="same-watch-clear" className="mt-3 inline-flex items-center gap-1 text-xs text-moss-700"><Check size={12} /> No prior history for this reference + serial.</p>}
          </Card>

          <Card title="Workflow" subtitle="Pre-selected from the estimate’s departments" testId="inspection-workflow-card">
            <WorkflowPicker value={workflow} onChange={setWorkflow} />
            <textarea data-testid="inspection-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Inspector notes (optional)" className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none" />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Commit" testId="inspection-commit-card" accent={discrepancies.length ? 'none' : 'moss'} className={discrepancies.length ? 'border-l-[3px] border-rose-500' : ''}>
            <div className="mb-3 flex flex-wrap gap-1">{workflow.map((d) => <DeptBadge key={d} code={d} />)}{workflow.length === 0 && <span className="text-xs text-rose-700">Pick a workflow</span>}</div>
            <ul className="space-y-1 text-xs text-ink-700">
              <li className="flex items-center gap-1.5"><Check size={12} className={linesVerified.length === estimate.lines.length ? 'text-moss' : 'text-ink-300'} /> {linesVerified.length}/{estimate.lines.length} estimate lines verified</li>
              <li className="flex items-center gap-1.5"><Check size={12} className={components.length === ctx.expectedComponents.length ? 'text-moss' : 'text-rose-600'} /> {components.length}/{ctx.expectedComponents.length} expected components received</li>
              <li className="flex items-center gap-1.5"><Check size={12} className={match ? (decision !== 'n/a' ? 'text-moss' : 'text-amber-600') : 'text-moss'} /> Same-watch check {match ? (decision === 'n/a' ? 'needs a decision' : decision === 'returning' ? 'same watch returning' : 'conflict flagged') : 'clear'}</li>
            </ul>

            {discrepancies.length > 0 && (
              <div data-testid="discrepancy-list" className="mt-3 rounded-sm bg-rose-50 p-2.5 text-xs text-rose-800">
                <div className="mb-1 inline-flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> Discrepancy — commit places a hold</div>
                <ul className="space-y-0.5">{discrepancies.map((d) => <li key={d}>• {d}</li>)}</ul>
              </div>
            )}
            {error && <p data-testid="inspection-commit-error" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

            <Button
              variant="primary"
              className={`mt-3 w-full justify-center ${discrepancies.length ? '!bg-rose-700 hover:!bg-rose-800' : ''}`}
              data-testid="inspection-commit"
              disabled={!canCommit || busy}
              onClick={commit}
            >
              {busy ? 'Committing…' : discrepancies.length ? 'Commit → discrepancy hold' : 'Commit → received, queue 2 labels'}
            </Button>
            <p className="mt-2 text-[11px] leading-4 text-ink-400">{forkPending ? 'Resolve the same-watch check first.' : discrepancies.length ? 'Reason is recorded on the package; nothing is queued for print.' : 'Queues a PDF417 data label and a ref/serial watch label (unprinted). Status → received — awaiting approval.'}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
