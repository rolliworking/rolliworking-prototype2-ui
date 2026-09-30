import { FileText, Inbox, Receipt, Watch as WatchIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobPhoto, JobWithRefs, SalesOrderWithRefs } from '@/api/client';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { ClientRefPill } from '@/components/intake/ClientRefBits';
import { ClientRequestBadge } from '@/components/jobs/ClientRequests';
import { AtRiskTag } from '@/components/jobs/ComponentWaitChips';
import { KindPill, OwnerBadge, PriorityPill, StatusWithHold, WorkflowBadges } from '@/components/jobs/JobBits';
import { TailPill } from '@/components/sales/SalesBits';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fullName } from '@/lib/format';

// Photo strip — first five thumbnails, tap = lightbox; the full pipeline lives under More → Photos
const PhotoStrip = ({ photos }: { photos: JobPhoto[] }) => {
  const [open, setOpen] = useState<JobPhoto | null>(null);
  if (!photos.length) return <div data-testid="item-photo-strip" data-count={0} className="grid h-16 w-16 shrink-0 place-items-center rounded-sm bg-canvas text-ink-300 ring-1 ring-line"><WatchIcon size={20} /></div>;
  const shown = photos.slice(0, 5);
  return <>
    <div data-testid="item-photo-strip" data-count={photos.length} className="flex shrink-0 gap-1">
      {shown.map((p) => <button key={p.id} type="button" data-testid={`item-photo-${p.id}`} onClick={() => setOpen(p)} className="h-16 w-16 overflow-hidden rounded-sm ring-1 ring-line transition-transform hover:scale-[1.03]"><img src={p.dataUrl} alt={p.fileName ?? 'Job photo'} className="h-full w-full object-cover" /></button>)}
      {photos.length > shown.length && <span data-testid="item-photo-more" className="grid h-16 w-10 place-items-center rounded-sm bg-canvas text-[11px] font-semibold text-ink-500 ring-1 ring-line">+{photos.length - shown.length}</span>}
    </div>
    {open && <Modal testId="item-photo-lightbox" title={`${open.slot ?? open.fileName ?? 'Photo'} · ${open.by} · ${fmtDate(open.at)}`} width="w-[720px]" onClose={() => setOpen(null)}><img src={open.dataUrl} alt={open.fileName ?? 'Job photo'} className="max-h-[70vh] w-full object-contain p-3" /></Modal>}
  </>;
};

// ITEM HEADER — what the piece is, whose it is, what state it is in, and the two records it came from (Request SUB- and the estimate)
export const ItemHeader = ({ job: j, so, reload }: { job: JobWithRefs; so: SalesOrderWithRefs | null; reload: () => Promise<void> }) => (
  <section data-testid="item-header" className="rounded-md bg-surface p-4 shadow-card">
    <div className="flex items-start gap-4">
      <PhotoStrip photos={j.photos} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 data-testid="item-title" className="text-xl font-semibold tracking-tight text-ink">{[j.watch.brand, j.watch.model].filter(Boolean).join(' ') || 'Watch — details pending'}</h1>
          <span data-testid="item-ref-serial" className="font-mono text-xs text-ink-500">Ref {j.watch.reference || '—'} · Serial {j.watch.serial || '—'}</span>
          <span data-testid="job-number" className="font-mono text-xs font-semibold text-ink-700">{j.number}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="item-chips">
          <StatusWithHold job={j} />
          <PriorityPill priority={j.priority} testId="job-priority" />
          <KindPill kind={j.kind} testId="job-kind-pill" client={j.client} />
          <WorkflowBadges workflow={j.workflow} />
          <OwnerBadge owner={j.owner} testId="job-owner" />
          <TailPill stage={api.tailStage(j)} testId="job-tail" />
          <ClientRequestBadge n={api.openClientRequests(j).length} testId="job-client-requests-badge" />
          <AtRiskTag jobId={j.id} />
          {j.wireWarnings?.length ? <span data-testid="job-wire-warning" title={j.wireWarnings.join(' · ')} className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">unmapped live status · {j.wireWarnings.length}</span> : null}
          <ClientRefPill value={api.jobClientRef(j)} sample={`Your watch is ready for pickup — ${j.watch.brand} ${j.watch.model} (${j.number})`} onSave={async (v) => { await api.setJobClientRef(j.id, v); await reload(); }} testId="job-client-ref" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
          <span><Link to={`/clients/${j.clientId}`} className="font-medium text-ink hover:underline" data-testid="job-client-link">{fullName(j.client)}</Link> <RatingBadge clientId={j.clientId} testId="job-client-rating" /> · {j.client.email} · {j.client.phone}</span>
          {j.pkg ? <Link to={`/intake/receive/${j.pkg.id}`} data-testid="job-package-link" className="inline-flex items-center gap-1 text-brand hover:underline"><Inbox size={12} /> Request {j.pkg.subNumber}</Link> : <span data-testid="job-package-none" className="text-ink-400">No request record (SUB-)</span>}
          {j.estimate ? <Link to={`/estimates/${j.estimate.id}`} data-testid="job-estimate-link" className="inline-flex items-center gap-1 text-brand hover:underline"><FileText size={12} /> Est {j.estimate.number}</Link> : <span className="text-ink-400">No estimate linked</span>}
          {so && <Link to={`/sales/${so.id}`} data-testid="job-so-link" className="inline-flex items-center gap-1 text-brand hover:underline"><Receipt size={12} /> {so.number}</Link>}
          <span data-testid="item-dates" className="text-ink-400">{j.dueAt ? `Due ${fmtDate(j.dueAt)}` : 'No due date'} · Created {fmtDate(j.createdAt)} by {j.createdBy}{j.intakeDate ? ` · On hand since ${fmtDate(j.intakeDate)}` : ''}{j.finishedAt ? ` · Finished ${fmtDate(j.finishedAt)}` : ''}</span>
        </div>
      </div>
    </div>
  </section>
);
