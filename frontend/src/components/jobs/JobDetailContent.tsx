import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobAction, JobWithRefs, LabelJob, PartsRequestWithRefs } from '@/api/client';
import { JobCallsLine } from '@/components/clients/CallLedger';
import { AuthCapturePanel } from '@/components/inspection/GuidedAuthCapture';
import { OpinionCard } from '@/components/inspection/OpinionCard';
import { LabelPrintDialog } from '@/components/intake/LabelBits';
import { PackageCustodyCard } from '@/components/intake/TwoScanBits';
import { AddOnsPanel } from '@/components/jobs/AddOnsPanel';
import { AppraisalsPanel } from '@/components/jobs/AppraisalsPanel';
import { BenchTestsPanel } from '@/components/jobs/BenchTestsPanel';
import { ClientRequestsPanel } from '@/components/jobs/ClientRequests';
import { JobCustodyCard } from '@/components/custody/CustodyChip';
import { CollapsedCard } from '@/components/jobs/CollapsedCard';
import { EvidencePanel } from '@/components/jobs/EvidencePanel';
import { InspectionPanel, ReviewGate } from '@/components/jobs/InspectionPanel';
import { InspectionReportPanel } from '@/components/jobs/InspectionReportPanel';
import { HoldModal, ReasonModal, TradePathStrip, TradeSendBackModal } from '@/components/jobs/JobBits';
import { JobDecisionRecords } from '@/components/jobs/JobDecisionRecords';
import { MessagesPanel } from '@/components/jobs/JobMessages';
import { AssignmentPanel, DetailsPanel, HoldPanel, JobTasksPanel, LinesTable, OwnerPanel, PhotosPanel, ShopTimePanel } from '@/components/jobs/JobPanels';
import { JobSummaryDraft } from '@/components/jobs/JobSummaryDraft';
import { JobTimeline } from '@/components/jobs/JobTimeline';
import { OutsourceInfo } from '@/components/jobs/OutsourceInfo';
import { ProcessFlow } from '@/components/jobs/ProcessFlow';
import { TimingCard } from '@/components/jobs/TimingCard';
import { PartsRequestModal, PartsRequestPill } from '@/components/parts/PartsChat';
import { PinModal } from '@/components/today/PinBits';
import { Card } from '@/components/ui/Card';
import { fmtMoneyCents, fullName } from '@/lib/format';

// Everything on /jobs/:id below the header — shared by the job page (two columns) and the Inbox job-card panel's "Expand full job card" (stacked). Actions bar stays on the page.
export type JobModalState = { kind: 'reason'; action: JobAction } | { kind: 'hold' } | { kind: 'release' } | { kind: 'pin' } | { kind: 'trade_back' } | null;
export type JobRun = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

// "More" — everything that is not about where the piece is: folded by default, Photos + Parts requests carry a count on the header (MH order)
export const MoreSection = ({ j, run, prs, setOpenPr }: { j: JobWithRefs; run: JobRun; prs: PartsRequestWithRefs[]; setOpenPr: (p: PartsRequestWithRefs) => void }) => (
  <div data-testid="job-more" className="space-y-2">
    <div className="flex items-center gap-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400"><span>More</span><span className="h-px flex-1 bg-line" /></div>
    <CollapsedCard title="Photos" count={j.photos.length} testId="more-photos"><PhotosPanel job={j} run={run} /></CollapsedCard>
    <CollapsedCard title="Parts requests" count={prs.length} subtitle="lookup → attach → supervisor approval" testId="more-parts">
      <ul className="-mx-4 -my-4 divide-y divide-line/70">{prs.map((r) => <li key={r.id}><button type="button" data-testid={`job-pr-${r.id}`} onClick={() => setOpenPr(r)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-canvas"><span className="font-mono font-medium">{r.number}</span><span className="font-mono text-ink">{r.part?.partNumber ?? '—'}</span><span className="truncate text-ink-700">{r.part?.name ?? r.items?.[0]?.description ?? 'no part attached'}</span><span className="ml-auto text-ink-400">{r.requestedBy}</span><PartsRequestPill status={r.status} /></button></li>)}{prs.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">No parts requests — open one from the actions bar.</li>}</ul>
    </CollapsedCard>
    <CollapsedCard title="Messages" subtitle="internal thread · @mention routes to a hit list or the bench" testId="more-messages"><MessagesPanel job={j} onChanged={() => void run(async () => (await api.getJob(j.id))!, '')} /></CollapsedCard>
    <CollapsedCard title="Bench tests" subtitle="before / after timing · pressure · Chronoscope" testId="more-bench-tests"><BenchTestsPanel jobId={j.id} /></CollapsedCard>
    <CollapsedCard title="Timing" subtitle="RolliTime runs on this watch" testId="more-timing"><TimingCard jobId={j.id} watchId={j.watchId} status={j.status} bare /></CollapsedCard>
    <CollapsedCard title="Service evidence" subtitle="four QC slots keyed to watch and job" testId="more-evidence"><EvidencePanel job={j} run={run} /></CollapsedCard>
    <CollapsedCard title="Shop time" subtitle="time rows never move job status" testId="more-shop-time"><ShopTimePanel job={j} /></CollapsedCard>
    <CollapsedCard title="Appraisals" subtitle="draft → confirm value → finalize & sign → PDF" testId="more-appraisals"><AppraisalsPanel job={j} /></CollapsedCard>
    <CollapsedCard title="Authentication photos" subtitle="guided 11-step capture" testId="more-auth-photos"><AuthCapturePanel jobId={j.id} /></CollapsedCard>
  </div>
);

export const JobDetailContent = ({ j, run, load, prs, setOpenPr, setModal, money, embedded }: { j: JobWithRefs; run: JobRun; load: () => void; prs: PartsRequestWithRefs[]; setOpenPr: (p: PartsRequestWithRefs) => void; setModal: (m: JobModalState) => void; money: boolean; embedded?: boolean }) => (
  <div data-testid={embedded ? 'job-detail-embedded' : 'job-detail-body'} className={embedded ? 'space-y-3' : 'space-y-4'}>
    {j.kind === 'trade' && <TradePathStrip job={j} />}
    <JobDecisionRecords jobId={j.id} />
    <JobCallsLine job={j} />
    <ReviewGate job={j} />
    {api.activeHold(j) && <div data-testid="held-banner" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs text-rose-900">This job is parked on hold — status actions return when the hold is released.</div>}
    {api.legalJobActions(j).length === 0 && !api.activeHold(j) && j.status === 'closed' && <div data-testid="closed-banner" className="rounded-sm bg-slate-100 px-3 py-1.5 text-xs text-slate-600">Closed — end of the line. Invoice / pickup is the next session.</div>}
    <div className={embedded ? 'space-y-3' : 'grid grid-cols-[1fr_380px] gap-4'}>
      <div className={embedded ? 'space-y-3' : 'space-y-4'}>
        <Card title="Process flow" subtitle="Where each component is in the process · filled dot = here now · red ring = blocker · custody at the end comes from the custody record, never from status" testId="job-flow-card"><ProcessFlow job={j} /></Card>
        <JobCustodyCard job={j} onChange={load} />
        <Card title="Client requests" subtitle="What the client asked for · badge on bench cards · pops on every label scan · mandatory checklist at QC" testId="job-client-requests-card" className="border-l-[3px] border-amber-400 bg-amber-50/40"><ClientRequestsPanel job={j} run={run} /></Card>
        <Card title="Add-ons since estimate" subtitle="Approved after the estimate went out · client-approved parts requests + estimate-revision lines (derived) · manual rows flagged + audited" testId="job-addons-card"><AddOnsPanel job={j} run={run} /></Card>
        <CollapsedCard title="Original estimate" subtitle={j.estimate ? `${j.estimate.number} · ${j.lines.length} line${j.lines.length === 1 ? '' : 's'}${money ? ` · ${fmtMoneyCents(j.total)}` : ''}` : `${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · job opened without an estimate`} action={j.estimate ? <Link to={`/estimates/${j.estimate.id}`} data-testid="original-estimate-link" className="text-xs text-brand hover:underline">Open {j.estimate.number} →</Link> : undefined} testId="job-original-estimate"><div className="-m-4"><LinesTable job={j} /></div></CollapsedCard>
        <CollapsedCard title="Inspection report" subtitle={j.inspection ? `completed ${j.inspection.by}` : api.JOB_KIND_CONFIG[j.kind].inspectionReport ? 'not yet completed' : 'skipped for this kind · photos still required'} testId="job-inspection-report">
          <div className="space-y-4">
            <InspectionPanel key={`${j.id}-${j.status}`} job={j} run={run} />
            <div className="border-t border-line pt-3"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Report to client · portal-first</div><InspectionReportPanel job={j} run={run} /></div>
          </div>
        </CollapsedCard>
        <OpinionCard jobId={j.id} onChange={load} />
        <Card title="Outsource / concierge" subtitle="Information only — vendor, stage, expected date, health, point person, tracking · moves happen on the Concierge board" testId="job-vendor-card"><OutsourceInfo jobId={j.id} /></Card>
        {embedded && <SideCards j={j} run={run} setModal={setModal} />}
        <MoreSection j={j} run={run} prs={prs} setOpenPr={setOpenPr} />
      </div>
      {!embedded && <div className="space-y-4"><SideCards j={j} run={run} setModal={setModal} /></div>}
    </div>
  </div>
);

const SideCards = ({ j, run, setModal }: { j: JobWithRefs; run: JobRun; setModal: (m: JobModalState) => void }) => <>
  <Card title="Status timeline" subtitle="Every transition — who, when, station · linked tasks below" testId="job-timeline-card"><JobTimeline job={j} /><div className="mt-3"><JobTasksPanel job={j} tick={j.timeline.length + j.notes.length} /></div></Card>
  <Card title="Owner" subtitle="Accountable shepherd — role-based" testId="job-owner-card"><OwnerPanel job={j} run={run} /></Card>
  <Card title="Assignees" subtitle="Working techs" testId="job-assignment-card"><AssignmentPanel job={j} run={run} /></Card>
  <Card title="Holds" testId="job-holds-card"><HoldPanel job={j} onPlace={() => setModal({ kind: 'hold' })} onRelease={() => setModal({ kind: 'release' })} /></Card>
  <Card title="Client update · summary draft" subtitle="For phone / email replies — AI fills a fixed template from this job's live data; you review and paste" testId="job-summary-card"><JobSummaryDraft jobId={j.id} job={j} /></Card>
  <Card title="Details" testId="job-details-card"><DetailsPanel job={j} run={run} /></Card>
  {j.packageId && <PackageCustodyCard packageId={j.packageId} />}
</>;

// The page's modals — reason / hold / release / pin / trade send-back / label print / parts request
export const JobModals = ({ j, modal, setModal, labels, setLabels, openPr, setOpenPr, load, say }: { j: JobWithRefs; modal: JobModalState; setModal: (m: JobModalState) => void; labels: LabelJob[] | null; setLabels: (l: LabelJob[] | null) => void; openPr: PartsRequestWithRefs | null; setOpenPr: (p: PartsRequestWithRefs | null) => void; load: () => Promise<void> | void; say: (m: string) => void }) => <>
  {modal?.kind === 'trade_back' && <TradeSendBackModal testId="trade-send-back-modal" onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, 'trade_send_back', r); setModal(null); await load(); say('Sent back to the bench'); }} />}
  {labels && <LabelPrintDialog labels={labels} title={`${j.number} · ${api.isBandOnlyJob(j, j.watch) ? 'band-only label (PDF417 = job #)' : 'job labels'}`} onClose={() => { setLabels(null); void load(); }} onPrinted={() => say(`${labels.length} label${labels.length === 1 ? '' : 's'} printed`)} />}
  {modal?.kind === 'reason' && <ReasonModal testId={`reason-modal-${modal.action.key}`} title={modal.action.label.replace('…', '')} hint={modal.action.key === 'qc_fail' ? 'Fail moves the job back to service and queues a client email with this reason.' : 'A reason is required; it lands on the timeline.'} confirmLabel={modal.action.label.replace('…', '')} danger={modal.action.tone === 'danger'} onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, modal.action.key, r); setModal(null); await load(); say(`${modal.action.label.replace('…', '')}${modal.action.notifies ? ' · client email queued' : ''}`); }} />}
  {openPr && <PartsRequestModal request={openPr} onClose={() => { setOpenPr(null); void load(); }} onChange={setOpenPr} />}
  {modal?.kind === 'pin' && <PinModal defaultTitle={`${j.number} · ${fullName(j.client)} · ${j.watch.model}`} jobId={j.id} onClose={() => setModal(null)} onPinned={() => { setModal(null); say('Pinned to their hit list'); }} />}
  {modal?.kind === 'hold' && <HoldModal components={j.components.map((c) => ({ key: c.key, label: c.label }))} onClose={() => setModal(null)} onConfirm={async (t, r, comp) => { await api.placeHold(j.id, t, r, comp); setModal(null); await load(); say(`${t === 'parts' ? 'Parts' : 'Outsource'} hold placed${comp ? ` · ${api.PART_LABELS[comp]} only` : ''}`); }} />}
  {modal?.kind === 'release' && <ReasonModal testId="release-modal" title="Release hold" hint={`Returns the job to ${api.activeHold(j)?.priorStatus.replace(/_/g, ' ')}.`} confirmLabel="Release" optional onClose={() => setModal(null)} onConfirm={async (r) => { await api.releaseHold(j.id, r); setModal(null); await load(); say('Hold released'); }} />}
</>;
