import { ArrowLeft, Check, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { EstimateWithRefs, PackagePhoto } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PhotoStrip, ScanInput, Stamp } from '@/components/intake/IntakeBits';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { ContentPills, PhotoCapture, ReceiptPreview } from '@/components/intake/ReceiveBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

export default function ReceivePackagePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, station } = useAuth();
  const { refreshCounts } = useIntakeCounts();
  const { data: pkg, loading } = useAsync(() => api.getPackage(id), [id]);
  const [receiptPrinted, setReceiptPrinted] = useState(false);
  const seededFor = useRef<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [estimate, setEstimate] = useState<EstimateWithRefs | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [contents, setContents] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed local form state from the package exactly once per package
  useEffect(() => {
    if (!pkg || seededFor.current === pkg.id) return;
    seededFor.current = pkg.id;
    setTracking(pkg.trackingNumber ?? '');
    setContents(pkg.contents);
    setPhotos(pkg.photos);
    setReceiptPrinted(pkg.receiptPrinted);
    if (pkg.estimate) setEstimate(pkg.estimate);
  }, [pkg]);

  if (loading) return null;
  if (!pkg) return <div className="text-ink-500">Package not found. <Link to="/intake" className="underline">Back to Arrival</Link></div>;

  const readOnly = pkg.status !== 'arrived';

  const scanEstimate = async (value: string) => {
    const est = await api.lookupEstimate(value);
    if (!est) {
      setEstError(`No estimate matches “${value}”`);
      return;
    }
    setEstError(null);
    setEstimate(est);
    if (contents.length === 0) {
      const depts = Array.from(new Set(est.lines.map((l) => l.dept)));
      setContents(Array.from(new Set(depts.flatMap((d) => api.DEPT_COMPONENTS[d]))));
    }
  };

  const process = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.receivePackage(pkg.id, { trackingNumber: tracking, estimateId: estimate?.id, contents, photos, notes: notes || undefined });
      refreshCounts();
      navigate('/intake/receive', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process package');
      setBusy(false);
    }
  };

  const printReceipt = async () => {
    await api.printDropOffReceipt(pkg.id);
    setReceiptPrinted(true);
  };

  const client = estimate?.client ?? pkg.client;
  const receiptLines = [
    `Sub#  ${pkg.subNumber}`,
    `Date  ${fmtDate(new Date().toISOString())}   Station ${station?.name ?? ''}`,
    `Client ${client ? fullName(client) : 'Unknown'}`,
    estimate ? `Estimate ${estimate.number} · ${estimate.watch.brand} ${estimate.watch.model}` : 'Estimate —',
    `Received ${contents.length ? contents.join(', ') : '—'}`,
    `Logged by ${user?.shortName}`,
  ];

  return (
    <div data-testid="receive-package-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/intake/receive" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink">
          <ArrowLeft size={12} /> Receive Package
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono font-semibold text-ink" data-testid="receive-subnumber">{pkg.subNumber}</span>
          <StatusPill status={pkg.status} testId="receive-status" />
          <Stamp by={pkg.arrivedBy} station={pkg.arrivedStation} at={pkg.arrivedAt} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-4">
        <div className="space-y-4">
          <Card title="Identify" subtitle="Tracking + estimate # — a matching estimate pre-fills client and expected contents" testId="receive-identify-card">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Tracking number</label>
                <input data-testid="receive-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} disabled={readOnly} className="h-11 w-full rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] focus:border-ink focus:bg-surface focus:outline-none" />
                <p className="mt-1 text-[11px] text-ink-400">{pkg.carrier}{pkg.signatureNoted ? ' · signature noted at arrival' : ''}</p>
              </div>
              {readOnly ? (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-500">Estimate</label>
                  <div className="h-11 rounded-sm border border-line bg-canvas px-3 font-mono text-[15px] leading-[44px]">{estimate?.number ?? '—'}</div>
                </div>
              ) : (
                <ScanInput label="Estimate #" testId="receive-estimate-input" onScan={scanEstimate} error={estError} placeholder="EST-26-1053 … then Enter" hint="Try EST-26-1055 (Kowalski) or 1051 · Enter to look up" />
              )}
            </div>

            {estimate && (
              <div data-testid="receive-estimate-match" className="mt-4 rounded-md bg-brand-50/60 p-3 animate-rise">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-ink">
                      {fullName(estimate.client)} <span className="ml-1 font-mono text-xs font-normal text-ink-500">{estimate.number}</span>
                    </div>
                    <div className="text-xs text-ink-500">
                      {estimate.watch.brand} {estimate.watch.model} · <span className="font-mono">{estimate.watch.reference}</span> · {estimate.client.email}
                    </div>
                  </div>
                  <StatusPill status={estimate.status} />
                </div>
                <ul className="mt-2 space-y-0.5">
                  {estimate.lines.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-ink-700">
                      <DeptBadge code={l.dept} /> {l.description} <span className="tabular ml-auto text-ink-400">{fmtMoneyCents(l.unitPrice * l.qty)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!estimate && pkg.client && <p className="mt-3 text-xs text-ink-500">Client from arrival: <span className="font-medium text-ink">{fullName(pkg.client)}</span></p>}
          </Card>

          <Card title="Photos" subtitle="Webcam capture and file upload — multiple" testId="receive-photos-card">
            {!readOnly && <PhotoCapture onAdd={(p) => setPhotos((prev) => [...prev, ...p])} />}
            <div className={readOnly ? '' : 'mt-3 border-t border-line pt-3'}>
              <PhotoStrip photos={photos} onRemove={readOnly ? undefined : (pid) => setPhotos((prev) => prev.filter((p) => p.id !== pid))} />
            </div>
          </Card>

          <Card title="What was received" subtitle="Tap pills — no sentences" testId="receive-contents-card">
            {readOnly ? (
              <div className="flex flex-wrap gap-1.5">{contents.map((c) => <span key={c} className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">{c}</span>)}</div>
            ) : (
              <ContentPills value={contents} onChange={setContents} />
            )}
            <textarea
              data-testid="receive-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={readOnly}
              placeholder="Optional note for the inspector (condition of packaging, anything odd)"
              rows={2}
              className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:bg-surface focus:outline-none"
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Drop-off receipt" subtitle="Optional · mock print" testId="receive-receipt-card">
            <ReceiptPreview lines={receiptLines} onPrint={printReceipt} printed={receiptPrinted} />
            {receiptPrinted && <p data-testid="receipt-printed-flag" className="mt-2 inline-flex items-center gap-1 text-xs text-moss-700"><Check size={12} /> Receipt printed</p>}
          </Card>

          <Card title="Finish" testId="receive-finish-card">
            {readOnly ? (
              <p className="text-xs text-ink-500">This package was processed {pkg.processedAt && fmtDate(pkg.processedAt)} by {pkg.processedBy}. It’s now in Stage 3 or beyond.</p>
            ) : (
              <>
                <ul className="mb-3 space-y-1 text-xs text-ink-700">
                  <li className="flex items-center gap-1.5"><Check size={12} className={estimate ? 'text-moss' : 'text-ink-300'} /> Estimate linked {estimate ? estimate.number : '(optional)'}</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className={photos.length ? 'text-moss' : 'text-ink-300'} /> {photos.length} photo{photos.length === 1 ? '' : 's'}</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className={contents.length ? 'text-moss' : 'text-ink-300'} /> {contents.length} content pill{contents.length === 1 ? '' : 's'}</li>
                  <li className="flex items-center gap-1.5"><Mail size={12} className={client ? 'text-moss' : 'text-ink-300'} /> {client ? `Confirmation email → ${client.email}` : 'No client email (unknown client)'}</li>
                </ul>
                {error && <p data-testid="receive-error" className="mb-2 text-xs font-medium text-rose-700">{error}</p>}
                <Button variant="primary" className="w-full justify-center" data-testid="receive-process-button" onClick={process} disabled={busy || contents.length === 0}>
                  {busy ? 'Processing…' : 'Process & queue confirmation email'}
                </Button>
                <p className="mt-2 text-[11px] text-ink-400">Status → processed — awaiting work order. Email goes to the Outbox; nothing ever sends.</p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
