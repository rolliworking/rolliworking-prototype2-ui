import { ArrowLeft, Watch as WatchIcon, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobAction, JobWithRefs, PartsRequestWithRefs } from '@/api/client';
import { HoldModal, KindPill, PriorityPill, Provisional, ReasonModal, StatusWithHold, WorkflowBadges } from '@/components/jobs/JobBits';
import { AssignmentPanel, HoldPanel, JobTasksPanel, LinesTable, NotesPanel, PhotosPanel, ShopTimePanel } from '@/components/jobs/JobPanels';
import { JobTimeline } from '@/components/jobs/JobTimeline';
import { InspectionPanel, ReviewGate } from '@/components/jobs/InspectionPanel';
import { EvidencePanel } from '@/components/jobs/EvidencePanel';
import { TimingCard } from '@/components/jobs/TimingCard';
import { ComponentsPanel } from '@/components/jobs/ComponentBits';
import { ClientRequestBadge, ClientRequestsPanel } from '@/components/jobs/ClientRequests';
import { PartsRequestModal, PartsRequestPill } from '@/components/parts/PartsChat';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

type ModalState = { kind: 'reason'; action: JobAction } | { kind: 'hold' } | { kind: 'release' } | null;

// Bench-side job page: same panels as RS, minus money / invoice / estimate / client links / delete
export default function RwJobPage() {
  const { id = '' } = useParams();
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined); const [prs, setPrs] = useState<PartsRequestWithRefs[]>([]); const [openPr, setOpenPr] = useState<PartsRequestWithRefs | null>(null);
  const [modal, setModal] = useState<ModalState>(null); const [flash, setFlash] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setJob(await api.getJob(id)); setPrs(await api.getPartsRequestsForJob(id)); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); setError(null); window.setTimeout(() => setFlash(null), 3000); };
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); await load(); if (msg) say(msg); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); } };
  if (job === undefined) return null;
  if (!job) return <div className="text-slate-400">Job not found. <Link to="/rw/jobs" className="underline">Back to lookup</Link></div>;
  const j = job; const actions = api.legalJobActions(j); const gaps = api.reviewGaps(j); const crGaps = api.qcRequestGaps(j);
  const blocked = (a: JobAction) => (a.key === 'qc_pass' && crGaps.length ? `QC blocked — client request not checked off: “${crGaps[0].text}”` : gaps.join(' · '));
  const act = (a: JobAction) => (a.needsReason ? setModal({ kind: 'reason', action: a }) : run(() => api.transitionJob(j.id, a.key), `${a.label} → ${a.to.replace(/_/g, ' ')}${a.notifies ? ' · client notified' : ''}`));
  return <div data-testid="rw-job-page" className="space-y-3">
    <div className="flex items-center justify-between text-xs"><Link to="/rw/jobs" className="inline-flex items-center gap-1 text-slate-400 hover:text-white"><ArrowLeft size={12} /> Jobs</Link><span className="text-slate-500">Created {fmtDate(j.createdAt)} by {j.createdBy}{j.intakeDate && ` · on hand since ${fmtDate(j.intakeDate)}`}</span></div>
    <div className="flex items-start justify-between gap-4">
      <div><div className="flex flex-wrap items-center gap-2"><h1 data-testid="rw-job-number" className="font-mono text-xl font-semibold text-white">{j.number}</h1><StatusWithHold job={j} /><KindPill kind={j.kind} /><PriorityPill priority={j.priority} /><WorkflowBadges workflow={j.workflow} /><ClientRequestBadge n={api.openClientRequests(j).length} testId="rw-job-client-requests-badge" /></div><div className="mt-0.5 text-xs text-slate-400">{fullName(j.client)} · owner {j.owner ?? '—'} · assignees {j.assignees.join(', ') || 'none'}</div></div>
      <div data-testid="rw-job-actions" className="flex flex-wrap items-center justify-end gap-1.5">
        {actions.map((a) => <span key={a.key} className="inline-flex items-center gap-1"><Button data-testid={`rw-act-${a.key}`} disabled={!!blocked(a)} title={blocked(a) || undefined} variant={a.tone === 'primary' ? 'primary' : 'secondary'} className={a.tone === 'danger' ? '!border-rose-400/40 !text-rose-300' : undefined} onClick={() => act(a)}>{a.label}</Button>{a.provisional && <Provisional note={a.provisional} />}</span>)}
        {j.status !== 'closed' && <Button data-testid="rw-act-parts-request" onClick={async () => { try { setOpenPr(await api.openPartsRequest(j.id)); } catch (er) { setError(er instanceof Error ? er.message : 'Failed'); } }}><Wrench size={13} /> Parts request</Button>}
      </div>
    </div>
    {flash && <div data-testid="rw-job-flash" className="rounded-sm bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-300">{flash}</div>}
    {error && <div data-testid="rw-job-error" className="rounded-sm bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300">{error}</div>}
    <ReviewGate job={j} />
    {api.activeHold(j) && <div data-testid="rw-held-banner" className="rounded-sm bg-rose-950/50 px-3 py-1.5 text-xs text-rose-200">Parked on hold — status actions return when the hold is released.</div>}
    <div className="grid grid-cols-[1fr_360px] gap-3">
      <div className="space-y-3">
        <Card title="Watch" testId="rw-job-watch"><div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]"><span className="inline-flex items-center gap-1.5 text-ink"><WatchIcon size={13} className="text-ink-400" /> {j.watch.brand} {j.watch.model}</span><span className="font-mono text-xs text-ink-500">Ref {j.watch.reference} · Serial {j.watch.serial}</span><StatusPill status={j.watch.status} /></div></Card>
        <Card title="Client requests" subtitle="What the client asked for · pops on every scan · mandatory at QC" testId="rw-job-client-requests" className="border-l-[3px] border-amber-400"><ClientRequestsPanel job={j} run={run} /></Card>
        <Card title="Work lines" subtitle="Department tags route the floor · amounts hidden on the bench" testId="rw-job-lines" bodyClassName="p-0"><LinesTable job={j} /></Card>
        <Card title="Components" subtitle="Mark your component done — credit lands now; the job moves on when the last one is in" testId="rw-job-components"><ComponentsPanel job={j} run={run} /></Card>
        <Card title="Inspection" testId="rw-job-inspection"><InspectionPanel key={`${j.id}-${j.status}`} job={j} run={run} /></Card>
        <Card title="Notes" testId="rw-job-notes"><NotesPanel job={j} run={run} /></Card>
        <Card title="Service evidence" subtitle="Four QC slots · scan the watch label" testId="rw-job-evidence"><EvidencePanel job={j} run={run} /></Card>
        <TimingCard jobId={j.id} watchId={j.watchId} status={j.status} />
        <Card title="Photos" testId="rw-job-photos"><PhotosPanel job={j} run={run} /></Card>
        <Card title="Parts requests" testId="rw-job-parts" bodyClassName="p-0"><ul className="divide-y divide-line/70">{prs.map((r) => <li key={r.id}><button type="button" data-testid={`rw-job-pr-${r.id}`} onClick={() => setOpenPr(r)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-canvas"><span className="font-mono font-medium text-ink">{r.number}</span><span className="font-mono text-ink">{r.part?.partNumber ?? '—'}</span><span className="truncate text-ink-700">{r.part?.name ?? 'no part attached'}</span><span className="ml-auto text-ink-400">{r.requestedBy}</span><PartsRequestPill status={r.status} /></button></li>)}{!prs.length && <li className="px-4 py-3 text-xs text-ink-400">No parts requests yet.</li>}</ul></Card>
        <Card title="Shop time" subtitle="Time rows never move job status" testId="rw-job-shop-time"><ShopTimePanel job={j} /></Card>
      </div>
      <div className="space-y-3">
        <Card title="Timeline" testId="rw-job-timeline"><JobTimeline job={j} /><div className="mt-3"><JobTasksPanel job={j} tick={j.timeline.length + j.notes.length} /></div></Card>
        <Card title="Assignees" testId="rw-job-assignees"><AssignmentPanel job={j} run={run} /></Card>
        <Card title="Holds" testId="rw-job-holds"><HoldPanel job={j} onPlace={() => setModal({ kind: 'hold' })} onRelease={() => setModal({ kind: 'release' })} /></Card>
      </div>
    </div>
    {modal?.kind === 'reason' && <ReasonModal testId={`rw-reason-${modal.action.key}`} title={modal.action.label.replace('…', '')} hint="A reason is required; it lands on the timeline." confirmLabel={modal.action.label.replace('…', '')} danger={modal.action.tone === 'danger'} onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, modal.action.key, r); setModal(null); await load(); say(modal.action.label.replace('…', '')); }} />}
    {modal?.kind === 'hold' && <HoldModal onClose={() => setModal(null)} onConfirm={async (t, r) => { await api.placeHold(j.id, t, r); setModal(null); await load(); say('Hold placed'); }} />}
    {modal?.kind === 'release' && <ReasonModal testId="rw-release-modal" title="Release hold" hint={`Returns the job to ${api.activeHold(j)?.priorStatus.replace(/_/g, ' ')}.`} confirmLabel="Release" optional onClose={() => setModal(null)} onConfirm={async (r) => { await api.releaseHold(j.id, r); setModal(null); await load(); say('Hold released'); }} />}
    {openPr && <PartsRequestModal request={openPr} onClose={() => { setOpenPr(null); void load(); }} onChange={setOpenPr} />}
  </div>;
}
