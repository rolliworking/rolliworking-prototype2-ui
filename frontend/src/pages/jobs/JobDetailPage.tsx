import { ArrowLeft, Pin, Receipt, Tags, Trash2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobAction, JobWithRefs, LabelJob, PartsRequestWithRefs, SalesOrderWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { JobCallsLine } from '@/components/clients/CallLedger';
import { AuthCapturePanel } from '@/components/inspection/GuidedAuthCapture';
import { LabelPrintDialog } from '@/components/intake/LabelBits';
import { PackageCustodyCard } from '@/components/intake/TwoScanBits';
import { AddOnsPanel } from '@/components/jobs/AddOnsPanel';
import { AppraisalsPanel } from '@/components/jobs/AppraisalsPanel';
import { BenchTestsPanel } from '@/components/jobs/BenchTestsPanel';
import { ClientRequestsPanel } from '@/components/jobs/ClientRequests';
import { CollapsedCard } from '@/components/jobs/CollapsedCard';
import { EvidencePanel } from '@/components/jobs/EvidencePanel';
import { InspectionPanel, ReviewGate } from '@/components/jobs/InspectionPanel';
import { InspectionReportPanel } from '@/components/jobs/InspectionReportPanel';
import { ItemHeader } from '@/components/jobs/ItemHeader';
import { HoldModal, Provisional, ReasonModal, TradePathStrip, TradeSendBackModal } from '@/components/jobs/JobBits';
import { JobDecisionRecords } from '@/components/jobs/JobDecisionRecords';
import { MessagesPanel } from '@/components/jobs/JobMessages';
import { AssignmentPanel, DetailsPanel, HoldPanel, JobTasksPanel, LinesTable, OwnerPanel, PhotosPanel, ShopTimePanel } from '@/components/jobs/JobPanels';
import { JobSummaryDraft } from '@/components/jobs/JobSummaryDraft';
import { JobTimeline } from '@/components/jobs/JobTimeline';
import { OutsourceInfo } from '@/components/jobs/OutsourceInfo';
import { ProcessFlow } from '@/components/jobs/ProcessFlow';
import { ConciergeBackBar } from '@/components/jobs/SendToVendor';
import { TimingCard } from '@/components/jobs/TimingCard';
import { PartsRequestModal, PartsRequestPill } from '@/components/parts/PartsChat';
import { PinModal } from '@/components/today/PinBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useShowMoney } from '@/components/MoneyContext';
import { fmtMoneyCents, fullName } from '@/lib/format';

type ModalState = { kind: 'reason'; action: JobAction } | { kind: 'hold' } | { kind: 'release' } | { kind: 'pin' } | { kind: 'trade_back' } | null;
type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

const ActionsBar = ({ j, so, run, setModal, setError, setLabels, setOpenPr }: { j: JobWithRefs; so: SalesOrderWithRefs | null; run: Run; setModal: (m: ModalState) => void; setError: (e: string) => void; setLabels: (l: LabelJob[]) => void; setOpenPr: (p: PartsRequestWithRefs) => void }) => {
  const navigate = useNavigate(); const { user } = useAuth();
  const actions = api.legalJobActions(j); const gaps = api.reviewGaps(j); const crGaps = api.qcRequestGaps(j);
  const blocked = (a: JobAction) => (a.key === 'qc_pass' && crGaps.length ? `QC blocked — client request not checked off: “${crGaps[0].text}”` : gaps.join(' · '));
  const act = (a: JobAction) => (a.key === 'trade_send_back' ? setModal({ kind: 'trade_back' }) : a.needsReason ? setModal({ kind: 'reason', action: a }) : run(() => api.transitionJob(j.id, a.key), `${a.label} → ${a.to.replace(/_/g, ' ')}${a.notifies ? ' · client email queued' : ''}`));
  const guard = async (fn: () => Promise<void>, fallback: string) => { try { await fn(); } catch (er) { setError(er instanceof Error ? er.message : fallback); } };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="job-actions">
      {actions.map((a) => (
        <span key={a.key} className="inline-flex items-center gap-1">
          <Button data-testid={`act-${a.key}`} disabled={!!blocked(a)} title={blocked(a) || undefined} variant={a.tone === 'primary' ? 'primary' : 'secondary'} className={a.tone === 'danger' ? '!border-rose-200 !text-rose-700 hover:!bg-rose-50' : undefined} onClick={() => act(a)}>{a.label}</Button>
          {a.provisional && <Provisional note={a.provisional} />}
          {a.notifies && <Provisional note="Pack is silent on which transitions notify the client — emailing here is provisional" />}
        </span>
      ))}
      {(j.status === 'ready_to_ship' || j.status === 'closed') && !so && <Button variant="primary" data-testid="act-invoice" onClick={() => guard(async () => { const o = await api.invoiceJob(j.id); navigate(`/sales/${o.id}`); }, 'Invoice failed')}><Receipt size={13} /> Create invoice (SO)</Button>}
      {so && <Link to={`/sales/${so.id}`} data-testid="act-open-so" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-ink-300 hover:bg-canvas"><Receipt size={13} /> {so.number} · {so.status.replace(/_/g, ' ')}</Link>}
      <Button data-testid="act-print-label" title={api.isBandOnlyJob(j, j.watch) ? 'Band-only job — PDF417 encodes the job number (no ref/serial)' : 'PDF417 (job · ref · serial) + ref/serial label'} onClick={() => guard(async () => setLabels(await api.queueJobLabels(j.id)), 'Label failed')}><Tags size={13} /> {api.isBandOnlyJob(j, j.watch) ? 'Print label · band only' : 'Print labels'}</Button>
      {j.status !== 'closed' && <Button data-testid="act-parts-request" onClick={() => guard(async () => setOpenPr(await api.openPartsRequest(j.id)), 'Failed')}><Wrench size={13} /> Parts request</Button>}
      <Button data-testid="act-pin" onClick={() => setModal({ kind: 'pin' })} title="Add to someone's hit list"><Pin size={13} /> Add to hit list</Button>
      {user?.accessTier === 'manager' && <Button data-testid="act-delete-job" title="Delete (can-delete-jobs)" onClick={() => { if (window.confirm(`Delete ${j.number}?`)) void run(() => api.deleteJob(j.id), '').then(() => navigate('/jobs')); }}><Trash2 size={13} className="text-rose-700" /></Button>}
    </div>
  );
};

// "More" — everything that is not about where the piece is: folded by default, Photos + Parts requests carry a count on the header (MH order)
const MoreSection = ({ j, run, prs, setOpenPr }: { j: JobWithRefs; run: Run; prs: PartsRequestWithRefs[]; setOpenPr: (p: PartsRequestWithRefs) => void }) => (
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

export default function JobDetailPage() {
  const { id = '' } = useParams();
  const money = useShowMoney();
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [so, setSo] = useState<SalesOrderWithRefs | null>(null);
  const [prs, setPrs] = useState<PartsRequestWithRefs[]>([]);
  const [openPr, setOpenPr] = useState<PartsRequestWithRefs | null>(null);
  const [labels, setLabels] = useState<LabelJob[] | null>(null);

  const load = useCallback(async () => { setJob(await api.getJob(id)); setSo(await api.getSalesOrderForJob(id)); setPrs(await api.getPartsRequestsForJob(id)); }, [id]);
  useEffect(() => { void load(); }, [load]);

  const say = (msg: string) => { setFlash(msg); setError(null); window.setTimeout(() => setFlash(null), 3000); };
  const run: Run = async (fn, msg) => { try { await fn(); await load(); if (msg) say(msg); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); } };

  if (job === undefined) return null;
  if (!job) return <div className="text-ink-500">Job not found. <Link to="/jobs" className="underline">Back to Jobs</Link></div>;
  const j = job;

  return (
    <div data-testid="job-detail-page" className="space-y-4">
      <ConciergeBackBar />
      <div className="flex items-start justify-between gap-4">
        <Link to="/jobs" className="inline-flex h-8 items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Jobs</Link>
        <ActionsBar j={j} so={so} run={run} setModal={setModal} setError={setError} setLabels={setLabels} setOpenPr={setOpenPr} />
      </div>

      <ItemHeader job={j} so={so} reload={load} />

      {flash && <div data-testid="job-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="job-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
      {j.kind === 'trade' && <TradePathStrip job={j} />}
      <JobDecisionRecords jobId={j.id} />
      <JobCallsLine job={j} />
      <ReviewGate job={j} />
      {api.activeHold(j) && <div data-testid="held-banner" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs text-rose-900">This job is parked on hold — status actions return when the hold is released.</div>}
      {api.legalJobActions(j).length === 0 && !api.activeHold(j) && j.status === 'closed' && <div data-testid="closed-banner" className="rounded-sm bg-slate-100 px-3 py-1.5 text-xs text-slate-600">Closed — end of the line. Invoice / pickup is the next session.</div>}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          <Card title="Process flow" subtitle="Where each component is in the process · filled dot = here now · red ring = blocker · custody at the end comes from the custody record, never from status" testId="job-flow-card"><ProcessFlow job={j} /></Card>
          <Card title="Client requests" subtitle="What the client asked for · badge on bench cards · pops on every label scan · mandatory checklist at QC" testId="job-client-requests-card" className="border-l-[3px] border-amber-400 bg-amber-50/40"><ClientRequestsPanel job={j} run={run} /></Card>
          <Card title="Add-ons since estimate" subtitle="Approved after the estimate went out · client-approved parts requests + estimate-revision lines (derived) · manual rows flagged + audited" testId="job-addons-card"><AddOnsPanel job={j} run={run} /></Card>
          <CollapsedCard title="Original estimate" subtitle={j.estimate ? `${j.estimate.number} · ${j.lines.length} line${j.lines.length === 1 ? '' : 's'}${money ? ` · ${fmtMoneyCents(j.total)}` : ''}` : `${j.lines.length} line${j.lines.length === 1 ? '' : 's'} · job opened without an estimate`} action={j.estimate ? <Link to={`/estimates/${j.estimate.id}`} data-testid="original-estimate-link" className="text-xs text-brand hover:underline">Open {j.estimate.number} →</Link> : undefined} testId="job-original-estimate"><div className="-m-4"><LinesTable job={j} /></div></CollapsedCard>
          <CollapsedCard title="Inspection report" subtitle={j.inspection ? `completed ${j.inspection.by}` : api.JOB_KIND_CONFIG[j.kind].inspectionReport ? 'not yet completed' : 'skipped for this kind · photos still required'} testId="job-inspection-report">
            <div className="space-y-4">
              <InspectionPanel key={`${j.id}-${j.status}`} job={j} run={run} />
              <div className="border-t border-line pt-3"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Report to client · portal-first</div><InspectionReportPanel job={j} run={run} /></div>
            </div>
          </CollapsedCard>
          <Card title="Outsource / concierge" subtitle="Information only — vendor, stage, expected date, health, point person, tracking · moves happen on the Concierge board" testId="job-vendor-card"><OutsourceInfo jobId={j.id} /></Card>
          <MoreSection j={j} run={run} prs={prs} setOpenPr={setOpenPr} />
        </div>
        <div className="space-y-4">
          <Card title="Status timeline" subtitle="Every transition — who, when, station · linked tasks below" testId="job-timeline-card"><JobTimeline job={j} /><div className="mt-3"><JobTasksPanel job={j} tick={j.timeline.length + j.notes.length} /></div></Card>
          <Card title="Owner" subtitle="Accountable shepherd — role-based" testId="job-owner-card"><OwnerPanel job={j} run={run} /></Card>
          <Card title="Assignees" subtitle="Working techs" testId="job-assignment-card"><AssignmentPanel job={j} run={run} /></Card>
          <Card title="Holds" testId="job-holds-card"><HoldPanel job={j} onPlace={() => setModal({ kind: 'hold' })} onRelease={() => setModal({ kind: 'release' })} /></Card>
          <Card title="Client update · summary draft" subtitle="For phone / email replies — AI fills a fixed template from this job's live data; you review and paste" testId="job-summary-card"><JobSummaryDraft jobId={j.id} job={j} /></Card>
          <Card title="Details" testId="job-details-card"><DetailsPanel job={j} run={run} /></Card>
          {j.packageId && <PackageCustodyCard packageId={j.packageId} />}
        </div>
      </div>

      {modal?.kind === 'trade_back' && <TradeSendBackModal testId="trade-send-back-modal" onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, 'trade_send_back', r); setModal(null); await load(); say('Sent back to the bench'); }} />}
      {labels && <LabelPrintDialog labels={labels} title={`${j.number} · ${api.isBandOnlyJob(j, j.watch) ? 'band-only label (PDF417 = job #)' : 'job labels'}`} onClose={() => { setLabels(null); void load(); }} onPrinted={() => say(`${labels.length} label${labels.length === 1 ? '' : 's'} printed`)} />}
      {modal?.kind === 'reason' && <ReasonModal testId={`reason-modal-${modal.action.key}`} title={modal.action.label.replace('…', '')} hint={modal.action.key === 'qc_fail' ? 'Fail moves the job back to service and queues a client email with this reason.' : 'A reason is required; it lands on the timeline.'} confirmLabel={modal.action.label.replace('…', '')} danger={modal.action.tone === 'danger'} onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, modal.action.key, r); setModal(null); await load(); say(`${modal.action.label.replace('…', '')}${modal.action.notifies ? ' · client email queued' : ''}`); }} />}
      {openPr && <PartsRequestModal request={openPr} onClose={() => { setOpenPr(null); void load(); }} onChange={setOpenPr} />}
      {modal?.kind === 'pin' && <PinModal defaultTitle={`${j.number} · ${fullName(j.client)} · ${j.watch.model}`} jobId={j.id} onClose={() => setModal(null)} onPinned={() => { setModal(null); say('Pinned to their hit list'); }} />}
      {modal?.kind === 'hold' && <HoldModal onClose={() => setModal(null)} onConfirm={async (t, r) => { await api.placeHold(j.id, t, r); setModal(null); await load(); say(`${t === 'parts' ? 'Parts' : 'Outsource'} hold placed`); }} />}
      {modal?.kind === 'release' && <ReasonModal testId="release-modal" title="Release hold" hint={`Returns the job to ${api.activeHold(j)?.priorStatus.replace(/_/g, ' ')}.`} confirmLabel="Release" optional onClose={() => setModal(null)} onConfirm={async (r) => { await api.releaseHold(j.id, r); setModal(null); await load(); say('Hold released'); }} />}
    </div>
  );
}
