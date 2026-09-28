import { AlertTriangle, ArrowLeft, Camera, Check, Flag, MessageSquareQuote, Printer, ScanLine, Tags } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ComponentCodeChips } from '@/components/estimates/ComponentChain';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import { FlagToPicker, flagAssignee } from '@/components/today/FlagTo';
import type { DeptCode, PackagePhoto, ReceiveWatchInput, ReceiveWatchResult, WatchMatch } from '@/api/client';
import { InspectionCameraFlow } from '@/components/inspection/InspectionCameraFlow';
import { PhotoStrip, Stamp } from '@/components/intake/IntakeBits';
import { LabelPrintDialog } from '@/components/intake/LabelBits';
import { ComponentChecklist, LineChecklist, SameWatchFork } from '@/components/intake/InspectionBits';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoney, fmtTime, fullName } from '@/lib/format';

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
  const [notes, setNotes] = useState(''); const [itemLabel, setItemLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveWatchResult | null>(null); const [printDialog, setPrintDialog] = useState(false); const [printedIds, setPrintedIds] = useState<string[]>([]);
  const [scanQ, setScanQ] = useState(''); const [scanErr, setScanErr] = useState<string | null>(null); const nav = useNavigate();
  const [photos, setPhotos] = useState<PackagePhoto[]>([]); const [cam, setCam] = useState(false); const [photoScan, setPhotoScan] = useState(''); const [photoErr, setPhotoErr] = useState<string | null>(null); const [lastAttach, setLastAttach] = useState<string | null>(null);
  const [flag, setFlag] = useState(''); const [flagNote, setFlagNote] = useState(''); const [flagBusy, setFlagBusy] = useState(false); const [flagMsg, setFlagMsg] = useState<string | null>(null);

  // Trickle-down: pre-populate from the estimate; the operator verifies rather than re-enters
  useEffect(() => {
    if (!ctx) return;
    setComponents(ctx.expectedComponents.filter((c) => ctx.pkg.contents.includes(c)));
    setReference(ctx.estimate.watch!.reference);
    setSerial(ctx.estimate.watch!.serial);
    setWorkflow(ctx.suggestedWorkflow);
    setPhotos(ctx.pkg.photos.filter(api.isInspectionPhoto));
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
    ? { reference, serial, linesVerified, componentsReceived: components, extraWatch, workflow, sameWatchDecision: match ? decision : 'n/a', notes: notes || undefined, itemLabel: itemLabel || undefined }
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
  const expWatch = estimate.watch!;

  // Photo flow is armed by the job's own ref·serial barcode (or typing it) — must resolve to THIS job
  const armCamera = (raw: string) => {
    const hit = api.parseRefSerial(raw);
    if (!hit) { setPhotoErr(`Could not read a ref · serial from “${raw}”`); return; }
    const same = hit.reference === reference.trim().toUpperCase() && (hit.serial === serial.trim().toUpperCase() || serial.trim().toUpperCase() === 'NS');
    if (!same) { setPhotoErr(`${hit.reference} / ${hit.serial} is not this job (${reference} / ${serial})`); return; }
    setPhotoErr(null); setPhotoScan(''); setCam(true);
  };
  const onShot = async (p: { source: 'ipevo' | 'microscope'; dataUrl: string }) => {
    const res = await api.addPackageInspectionPhoto(pkg.id, p);
    setPhotos((v) => [...v, res.photo]); setLastAttach(res.attachedToJob ?? null);
  };
  const cameraEl = cam && <InspectionCameraFlow title={`${estimate.number} · ${reference} / ${serial}`} onShot={onShot} onDone={() => setCam(false)} onClose={() => setCam(false)} />;
  const photoSummary = photos.length ? `${photos.length} captured · ${photos.filter((p) => p.slot?.includes('ipevo')).length} IPEVO · ${photos.filter((p) => p.slot?.includes('microscope')).length} micro` : 'none yet';

  const commit = async (print: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.receiveWatch(pkg.id, input);
      setResult(res);
      // Save & Print → flows straight into the label dialog (printer / copies / preview) — labels are marked printed there, not silently
      if (print && res.labels.length && res.pkg.status !== 'discrepancy_hold') setPrintDialog(true);
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
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-500" data-testid="inspection-result-photos"><Camera size={12} /> Inspection photos: <span data-testid="inspection-result-photo-count" className="font-semibold text-ink">{photoSummary}</span><Button size="sm" className="ml-auto" data-testid="inspection-result-camera" onClick={() => setCam(true)}>{photos.length ? 'Add more' : 'Capture now'}</Button></div>
              {photos.length > 0 && <div className="mt-2"><PhotoStrip photos={photos} size="sm" /></div>}
              {hold ? (
                <ul className="mt-3 space-y-1 text-[13px] text-rose-800" data-testid="inspection-result-reasons">
                  {result.discrepancies.map((d) => <li key={d} className="flex gap-2"><span>•</span>{d}</li>)}
                </ul>
              ) : (
                <div className="mt-3 rounded-sm bg-canvas p-3 text-xs" data-testid="inspection-result-labels">
                  <div className="mb-1 flex items-center gap-1 font-semibold text-ink-500"><Tags size={12} /> <span data-testid="inspection-result-labels-state">{printedIds.length ? `${printedIds.length} component label${printedIds.length === 1 ? '' : 's'} printed` : `${result.labels.length} labels queued (unprinted)`}</span><Button size="sm" className="ml-auto" data-testid="inspection-result-print" onClick={() => setPrintDialog(true)}><Printer size={12} /> {printedIds.length ? 'Reprint' : 'Print now'}</Button></div>
                  {result.labels.map((l) => (
                    <div key={l.id} className="font-mono text-ink-700">{l.type === 'pdf417_data' ? 'PDF417' : 'REF/SER'} · {l.payload}</div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Link to="/intake/inspection" data-testid="inspection-result-back"><Button>Back to bins</Button></Link>
                {!hold && <Link to="/intake/labels" data-testid="inspection-result-labels-link"><Button>Open Label Queue</Button></Link>}
                {!hold && <Link to="/intake/history" data-testid="inspection-result-history-link"><Button>Intake History</Button></Link>}
                {!hold && <Link to={`/inspection/new?est=${encodeURIComponent(estimate.number)}`} data-testid="inspection-result-start-inspection"><Button variant="primary">Start inspection form →</Button></Link>}
              </div>
            </div>
          </div>
        </Card>
        {cameraEl}
        {printDialog && <LabelPrintDialog labels={result.labels} title={`Print Intake Labels · ${estimate.number} · ${estimate.client.lastName}`} onClose={() => setPrintDialog(false)} onPrinted={(ids) => setPrintedIds(ids)} />}
      </div>
    );
  }

  const readOnly = pkg.status !== 'awaiting_inspection';
  const decoded = api.decodeSerial(serial, reference);

  // Top-to-bottom: scan est# → customer → what was received (read-only) → inspector's confirmation → component chips → serial decode → date → estimate copy → actions
  return (
    <div data-testid="receive-watch-page" className="mx-auto max-w-[880px] space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/intake/inspection" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Receive Watch · Stage 4 · VERIFIED</Link>
        <div className="flex items-center gap-3 text-xs"><span className="font-mono font-semibold text-ink" data-testid="inspection-estimate-number">{estimate.number}</span><span className="font-mono text-ink-500">{pkg.subNumber}</span><StatusPill status={pkg.status} /><Stamp by={pkg.workOrderBy} station={pkg.arrivedStation} at={pkg.workOrderAt} /></div>
      </div>
      {readOnly && <div className="rounded-sm bg-amber-50 px-3 py-2 text-xs text-amber-900">This package has already been inspected — read only.</div>}

      <Card title="1 · Scan estimate barcode or enter est#" subtitle="Resolves the job the moment either one is used" testId="rw-scan-card">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void api.findInspectionPackage(scanQ).then((hit) => { if (!hit) { setScanErr(`No package for “${scanQ}”`); return; } setScanErr(null); if (hit.packageId !== pkg.id) nav(`/intake/inspection/${hit.packageId}`); }); }}>
          <div className="relative flex-1"><ScanLine size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="rw-scan-input" value={scanQ} onChange={(e) => setScanQ(e.target.value)} placeholder="Scan the estimate barcode · or type E02041 / SUB-26-0310" className="h-11 w-full rounded-sm border border-line bg-canvas pl-9 pr-3 font-mono text-[15px] focus:border-ink focus:bg-surface focus:outline-none" /></div>
          <Button type="submit" data-testid="rw-scan-go">Resolve</Button>
        </form>
        {scanErr && <p data-testid="rw-scan-error" className="mt-1 text-xs text-rose-700">{scanErr}</p>}
      </Card>

      <Card title="2 · Customer" testId="rw-customer-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="font-semibold text-ink" data-testid="rw-customer-name">{fullName(estimate.client)}</span><span className="text-ink-500">{estimate.client.email}</span><span className="text-ink-500">{estimate.client.phone}</span>{estimate.client.company && <span className="rounded bg-canvas px-1.5 text-xs text-ink-600">{estimate.client.company}</span>}<span className="ml-auto text-xs text-ink-400">Expected: {expWatch.brand} {expWatch.model} · <span className="font-mono">{expWatch.reference}</span></span></div>
        {estimate.clientNotes && <div className="mt-2 flex items-start gap-2 rounded-sm bg-canvas p-2.5 text-xs text-ink-700" data-testid="inspection-concerns"><MessageSquareQuote size={13} className="mt-0.5 shrink-0 text-ink-400" /><span><span className="font-semibold text-ink-500">Client’s stated concerns:</span> {estimate.clientNotes}</span></div>}
      </Card>

      <Card title="3 · What was received" subtitle="Read-only recap from Receive Package (Scan 1 / pill tap) — not editable here" testId="rw-received-card">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="rw-received-pills">{pkg.contents.map((c) => <span key={c} className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-ink">{c}</span>)}{!pkg.contents.length && <span className="text-xs text-ink-400">Nothing logged at Scan 1</span>}<span className="ml-auto text-[11px] text-ink-400">logged by {pkg.processedBy ?? pkg.arrivedBy} · {fmtDate(pkg.processedAt ?? pkg.arrivedAt)} {fmtTime(pkg.processedAt ?? pkg.arrivedAt)}</span></div>
        {pkg.notes && <p data-testid="rw-received-other" className="mt-2 text-xs text-ink-700"><span className="font-semibold text-ink-500">Other items noted at intake:</span> {pkg.notes}</p>}
        {pkg.photos.length > 0 && <div className="mt-3 border-t border-line pt-3"><PhotoStrip photos={pkg.photos} size="sm" /></div>}
      </Card>

      <Card title="4 · Inspector’s confirmation — what is physically in hand" subtitle="Tap each item you are holding right now; this is compared against what was recorded as received above" testId="inspection-components-card" accent="moss">
        <div data-testid="box-pills" className="mb-3 flex flex-wrap gap-1.5">{Array.from(new Set([...ctx.expectedComponents, ...pkg.contents])).map((c) => { const exp = ctx.expectedComponents.includes(c); const rec = pkg.contents.includes(c); const ver = components.includes(c); return <button key={c} type="button" data-testid={`box-pill-${c.replace(/\s+/g, '-')}`} data-verified={ver} disabled={readOnly} onClick={() => setComponents((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${ver ? 'border-moss bg-moss text-white' : exp && rec ? 'border-line bg-surface text-ink' : exp ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{c}<span className={`font-mono text-[9px] uppercase ${ver ? 'text-white/70' : 'text-ink-400'}`}>{exp ? 'exp' : 'not exp'} · {rec ? 'rec' : 'not rec'}</span></button>; })}</div>
        <ComponentChecklist expected={ctx.expectedComponents} received={components} onToggle={(c) => setComponents((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} />
        <label className="mt-3 block text-xs text-ink-500">Item description · shown on the shop-floor badge (multiple items on one estimate → 1/3, 2/3, 3/3)<input data-testid="rw-item-label" value={itemLabel} onChange={(e) => setItemLabel(e.target.value)} disabled={readOnly} placeholder="e.g. 1/3 · Submariner head" className="mt-1 block h-9 w-72 rounded-sm border border-line bg-canvas px-2.5 font-mono text-[13px] focus:border-ink focus:bg-surface focus:outline-none" /></label>
        <textarea data-testid="rw-inhand-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={2} placeholder="Anything else in hand not covered above — new dial, hands, box, papers…" className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none" />
        <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-700"><input type="checkbox" data-testid="extra-watch" checked={extraWatch} disabled={readOnly} onChange={(e) => setExtraWatch(e.target.checked)} className="accent-rose-600" /> Extra / unexpected watch in package</label>
      </Card>

      <Card title="5 · Component codes" subtitle="Pre-selected from the estimate’s chips — override here if the watch in hand says otherwise (override is logged, never lost)" testId="inspection-workflow-card">
        <ComponentCodeChips value={workflow} inferred={workflow.join() === ctx.suggestedWorkflow.join()} readOnly={readOnly} onToggle={(c) => setWorkflow((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))} testId="rw-chips" />
      </Card>

      <Card title="6 · Serial # and reference" subtitle="Verify on the watch itself — NS if the serial is unreadable · serial auto-decodes brand / model / caliber" testId="inspection-identity-card">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Serial #</label><div className="flex gap-2"><input data-testid="identity-serial" value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())} disabled={readOnly} placeholder="1601-1545646546" className="h-11 flex-1 rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] tracking-wide focus:border-ink focus:bg-surface focus:outline-none" /><Button type="button" data-testid="identity-ns" onClick={() => setSerial('NS')} disabled={readOnly} title="Serial unreadable — placeholder">NS</Button></div><p className="mt-1 text-[11px] text-ink-400">Estimate says <span className="font-mono">{expWatch.serial}</span>{serial === 'NS' && <span className="ml-1 text-amber-800">· NS placeholder — skips the same-watch check</span>}</p></div>
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Reference</label><input data-testid="identity-reference" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} disabled={readOnly} className="h-11 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] tracking-wide focus:border-ink focus:bg-surface focus:outline-none" /><p className="mt-1 text-[11px] text-ink-400">Estimate says <span className="font-mono">{expWatch.reference}</span></p></div>
        </div>
        {decoded.confidence !== 'none' && <div data-testid="serial-decode" data-confidence={decoded.confidence} className="mt-3 flex flex-wrap items-center gap-2 rounded-sm bg-canvas px-3 py-2 text-xs"><span className="font-semibold text-ink-500">Decoded:</span><span data-testid="serial-decode-brand" className="font-semibold text-ink">{decoded.brand}</span><span data-testid="serial-decode-model" className="text-ink-700">{decoded.model}</span><span data-testid="serial-decode-caliber" className="font-mono text-ink-700">{decoded.caliber}</span>{decoded.era && <span className="text-ink-400">{decoded.era}</span>}{decoded.model && expWatch.model && !decoded.model.toLowerCase().includes(expWatch.model.split(' ')[0].toLowerCase()) && <span data-testid="serial-decode-mismatch" className="rounded-sm bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">≠ estimate watch ({expWatch.model})</span>}<span className="ml-auto text-[10px] uppercase text-ink-400">{decoded.confidence === 'reference' ? 'from our records' : 'prefix lookup · provisional'}</span></div>}
        {match && <div className="mt-4"><SameWatchFork match={match} expectedClientId={estimate.clientId} decision={decision} onDecide={setDecision} /></div>}
        {!match && serial && serial !== 'NS' && <p data-testid="same-watch-clear" className="mt-3 inline-flex items-center gap-1 text-xs text-moss-700"><Check size={12} /> No prior history for this reference + serial.</p>}
      </Card>

      <Card title="7 · Inspection photos" subtitle="Scan or enter the job’s ref · serial barcode → IPEVO fires first for 2 overview shots, then hands off to the microscope (no cap) · every shot attaches to the job file as it’s taken" testId="rw-photos-card" action={<span data-testid="rw-photo-count" className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${photos.length ? 'bg-moss-50 text-moss-700' : 'bg-canvas text-ink-500'}`}>{photos.length} captured</span>}>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (photoScan.trim()) armCamera(photoScan); }}>
          <div className="relative flex-1"><ScanLine size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="rw-photo-scan" value={photoScan} onChange={(e) => setPhotoScan(e.target.value)} disabled={readOnly} placeholder={`Scan the ref · serial barcode · or type ${reference} / ${serial} · ${reference}-${serial} · pasted label payload`} className="h-11 w-full rounded-sm border border-line bg-canvas pl-9 pr-3 font-mono text-[15px] focus:border-ink focus:bg-surface focus:outline-none" /></div>
          <Button type="submit" data-testid="rw-photo-scan-go" disabled={readOnly || !photoScan.trim()}>Resolve</Button>
          <Button type="button" variant="primary" data-testid="rw-photo-use-fields" disabled={readOnly || !reference.trim() || !serial.trim()} onClick={() => armCamera(`${reference} / ${serial}`)}><Camera size={13} /> Use ref + serial above</Button>
        </form>
        {photoErr && <p data-testid="rw-photo-error" className="mt-1 text-xs text-rose-700">{photoErr}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500"><span data-testid="rw-photo-summary">{photoSummary}</span>{lastAttach && <span data-testid="rw-photo-attached" className="rounded-sm bg-moss-50 px-1.5 py-0.5 font-medium text-moss-700">attached to {lastAttach}</span>}{!lastAttach && photos.length > 0 && <span className="text-ink-400">saved on {pkg.subNumber} · cascades to the job when it’s opened</span>}</div>
        {photos.length > 0 && <div className="mt-2"><PhotoStrip photos={photos} /></div>}
        {photos.length > 0 && !readOnly && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <FlagToPicker value={flag} onChange={setFlag} note={flagNote} onNote={setFlagNote} testId="rw-flag-to" />
          {flag && <Button size="sm" variant="primary" data-testid="rw-flag-send" disabled={flagBusy} onClick={async () => { const to = flagAssignee(flag); if (!to) return; setFlagBusy(true); try { const last = photos[photos.length - 1]; await hl.flagToHitlist({ to, text: flagNote || `Inspection photo · ${estimate.number} ${reference} / ${serial}`, photo: last, jobId: estimate.jobId }); setFlagMsg(`Latest shot flagged to ${api.assigneeLabel(to).split(' →')[0]} — on their Hitlist inbox`); setFlag(''); setFlagNote(''); } finally { setFlagBusy(false); } }}><Flag size={12} /> Send latest shot</Button>}
          {flagMsg && <span data-testid="rw-flag-msg" className="rounded-sm bg-moss-50 px-1.5 py-0.5 text-xs font-medium text-moss-700">{flagMsg}</span>}
        </div>}
      </Card>

      <Card title="8 · Date received" testId="rw-date-card"><div className="text-sm text-ink" data-testid="rw-date-received">{fmtDate(pkg.processedAt ?? pkg.arrivedAt)} {fmtTime(pkg.processedAt ?? pkg.arrivedAt)} <span className="text-xs text-ink-400">· auto-filled from the receive timestamp · {pkg.carrier} {pkg.trackingNumber ?? ''}</span></div></Card>

      <Card title="9 · Copy of the estimate" subtitle={`${estimate.number} · ${fullName(estimate.client)} · verify each line is in scope`} testId="inspection-lines-card">
        <LineChecklist lines={estimate.lines} verified={linesVerified} onToggle={(i) => setLinesVerified((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]))} />
        <div className="mt-2 flex justify-end text-xs text-ink-500">Estimate total <span className="ml-2 font-mono font-semibold text-ink">{fmtMoney(estimate.total)}</span></div>
      </Card>

      <Card title="10 · Save" testId="inspection-commit-card" accent={discrepancies.length ? 'none' : 'moss'} className={discrepancies.length ? 'border-l-[3px] border-rose-500' : ''}>
        <ul className="space-y-1 text-xs text-ink-700">
          <li className="flex items-center gap-1.5"><Check size={12} className={linesVerified.length === estimate.lines.length ? 'text-moss' : 'text-ink-300'} /> {linesVerified.length}/{estimate.lines.length} estimate lines verified</li>
          <li className="flex items-center gap-1.5"><Check size={12} className={components.length === ctx.expectedComponents.length ? 'text-moss' : 'text-rose-600'} /> {components.length}/{ctx.expectedComponents.length} expected components verified in hand</li>
          <li className="flex items-center gap-1.5"><Check size={12} className={photos.length >= 2 ? 'text-moss' : 'text-ink-300'} /> Inspection photos: {photoSummary}</li>
          <li className="flex items-center gap-1.5"><Check size={12} className={match ? (decision !== 'n/a' ? 'text-moss' : 'text-amber-600') : 'text-moss'} /> Same-watch check {match ? (decision === 'n/a' ? 'needs a decision' : decision === 'returning' ? 'same watch returning' : 'conflict flagged') : 'clear'}</li>
        </ul>
        {discrepancies.length > 0 && <div data-testid="discrepancy-list" className="mt-3 rounded-sm bg-rose-50 p-2.5 text-xs text-rose-800"><div className="mb-1 inline-flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> Discrepancy — save places a hold</div><ul className="space-y-0.5">{discrepancies.map((d) => <li key={d}>• {d}</li>)}</ul></div>}
        {error && <p data-testid="inspection-commit-error" className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Link to="/intake/inspection" data-testid="inspection-cancel"><Button>Cancel</Button></Link>
          <Button data-testid="inspection-commit" disabled={!canCommit || busy} onClick={() => commit(false)}>{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="primary" data-testid="inspection-save-print" className={discrepancies.length ? '!bg-rose-700 hover:!bg-rose-800' : ''} disabled={!canCommit || busy} onClick={() => commit(true)}><Printer size={13} /> {busy ? 'Saving…' : discrepancies.length ? 'Save → discrepancy hold' : 'Save & Print labels'}</Button>
        </div>
        <p className="mt-2 text-right text-[11px] leading-4 text-ink-400">{forkPending ? 'Resolve the same-watch check first.' : discrepancies.length ? 'Reason is recorded on the package; nothing is queued for print.' : 'Save queues the intake labels unprinted · Save & Print opens Print Intake Labels pre-filled with ref#, serial#, model, client and est#.'}</p>
      </Card>
      {cameraEl}
    </div>
  );
}
