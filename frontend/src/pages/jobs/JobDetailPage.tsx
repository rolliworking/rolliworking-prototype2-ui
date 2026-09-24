import { ArrowLeft, FileText, Package, Receipt, Trash2, Watch as WatchIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobAction, JobWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { HoldModal, KindPill, OwnerBadge, PriorityPill, Provisional, ReasonModal, StatusWithHold, WorkflowBadges } from '@/components/jobs/JobBits';
import { AssignmentPanel, DetailsPanel, HoldPanel, JobTasksPanel, LinesTable, NotesPanel, OwnerPanel, PhotosPanel, ShopTimePanel } from '@/components/jobs/JobPanels';
import { JobTimeline } from '@/components/jobs/JobTimeline';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

type ModalState = { kind: 'reason'; action: JobAction } | { kind: 'hold' } | { kind: 'release' } | null;

export default function JobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<JobWithRefs | null | undefined>(undefined);
  const [modal, setModal] = useState<ModalState>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setJob(await api.getJob(id)), [id]);
  useEffect(() => { void load(); }, [load]);

  const say = (msg: string) => { setFlash(msg); setError(null); window.setTimeout(() => setFlash(null), 3000); };
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); await load(); if (msg) say(msg); } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); }
  };

  if (job === undefined) return null;
  if (!job) return <div className="text-ink-500">Job not found. <Link to="/jobs" className="underline">Back to Jobs</Link></div>;
  const j = job;
  const actions = api.legalJobActions(j);

  const act = (a: JobAction) => (a.needsReason ? setModal({ kind: 'reason', action: a }) : run(() => api.transitionJob(j.id, a.key), `${a.label} → ${a.to.replace(/_/g, ' ')}${a.notifies ? ' · client email queued' : ''}`));

  return (
    <div data-testid="job-detail-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Jobs</Link>
        <span className="text-[11px] text-ink-400">Created {fmtDate(j.createdAt)} by {j.createdBy}{j.intakeDate && ` · On hand since ${fmtDate(j.intakeDate)}`}{j.finishedAt && ` · Finished ${fmtDate(j.finishedAt)}`}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-ink" data-testid="job-number">{j.number}</h1>
            <StatusWithHold job={j} />
            <KindPill kind={j.kind} testId="job-kind-pill" />
            <PriorityPill priority={j.priority} testId="job-priority" />
            <WorkflowBadges workflow={j.workflow} />
            <StatusPill status={j.simpleStatus} testId="job-simple-status" />
            <OwnerBadge owner={j.owner} testId="job-owner" />
          </div>
          <div className="mt-0.5 text-xs text-ink-500"><Link to={`/clients/${j.clientId}`} className="font-medium text-ink hover:underline" data-testid="job-client-link">{fullName(j.client)}</Link> · {j.client.email} · {j.client.phone}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5" data-testid="job-actions">
          {actions.map((a) => (
            <span key={a.key} className="inline-flex items-center gap-1">
              <Button data-testid={`act-${a.key}`} variant={a.tone === 'primary' ? 'primary' : 'secondary'} className={a.tone === 'danger' ? '!border-rose-200 !text-rose-700 hover:!bg-rose-50' : undefined} onClick={() => act(a)}>{a.label}</Button>
              {a.provisional && <Provisional note={a.provisional} />}
              {a.notifies && <Provisional note="Pack is silent on which transitions notify the client — emailing here is provisional" />}
            </span>
          ))}
          {(j.status === 'ready_to_ship' || j.status === 'closed') && <span className="inline-flex items-center gap-1"><Button data-testid="act-invoice" onClick={() => run(() => api.invoiceJob(j.id), '')}><Receipt size={13} /> Create invoice</Button><Provisional note="Invoicing arrives next session — stub" /></span>}
          {user?.accessTier === 'manager' && <Button data-testid="act-delete-job" title="Delete (can-delete-jobs)" onClick={() => { if (window.confirm(`Delete ${j.number}?`)) void run(() => api.deleteJob(j.id), '').then(() => navigate('/jobs')); }}><Trash2 size={13} className="text-rose-700" /></Button>}
        </div>
      </div>

      {flash && <div data-testid="job-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      {error && <div data-testid="job-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
      {api.activeHold(j) && <div data-testid="held-banner" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs text-rose-900">This job is parked on hold — status actions return when the hold is released.</div>}
      {actions.length === 0 && !api.activeHold(j) && j.status === 'closed' && <div data-testid="closed-banner" className="rounded-sm bg-slate-100 px-3 py-1.5 text-xs text-slate-600">Closed — end of the line. Invoice / pickup is the next session.</div>}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          <Card title="Watch" testId="job-watch-card">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-ink"><WatchIcon size={13} className="text-ink-400" /> {j.watch.brand} {j.watch.model}</span>
              <span className="font-mono text-xs text-ink-500">Ref {j.watch.reference} · Serial {j.watch.serial}</span>
              <StatusPill status={j.watch.status} />
              <span className="ml-auto inline-flex items-center gap-3 text-xs">
                {j.estimate ? <Link to={`/estimates/${j.estimate.id}`} data-testid="job-estimate-link" className="inline-flex items-center gap-1 text-brand hover:underline"><FileText size={12} /> Estimate {j.estimate.number}</Link> : <span className="text-ink-400">No estimate linked</span>}
                {j.pkg ? <Link to={`/intake/receive/${j.pkg.id}`} data-testid="job-package-link" className="inline-flex items-center gap-1 text-brand hover:underline"><Package size={12} /> {j.pkg.subNumber}</Link> : <span className="text-ink-400">No intake package</span>}
              </span>
            </div>
          </Card>
          <Card title="Line items" subtitle="Carried from the estimate · department tags route the shop floor" testId="job-lines-card" bodyClassName="p-0"><LinesTable job={j} /></Card>
          <Card title="Notes" subtitle="Freeform, stamped who / when / station" testId="job-notes-card"><NotesPanel job={j} run={run} /></Card>
          <Card title="Photos" testId="job-photos-card"><PhotosPanel job={j} run={run} /></Card>
          <Card title="Shop time" subtitle="Time rows never move job status" testId="job-shop-time-card"><ShopTimePanel job={j} /></Card>
        </div>
        <div className="space-y-4">
          <Card title="Status timeline" subtitle="Every transition — who, when, station · linked tasks below" testId="job-timeline-card"><JobTimeline job={j} /><div className="mt-3"><JobTasksPanel job={j} tick={j.timeline.length + j.notes.length} /></div></Card>
          <Card title="Owner" subtitle="Accountable shepherd — role-based" testId="job-owner-card"><OwnerPanel job={j} run={run} /></Card>
          <Card title="Assignees" subtitle="Working techs" testId="job-assignment-card"><AssignmentPanel job={j} run={run} /></Card>
          <Card title="Holds" testId="job-holds-card"><HoldPanel job={j} onPlace={() => setModal({ kind: 'hold' })} onRelease={() => setModal({ kind: 'release' })} /></Card>
          <Card title="Details" testId="job-details-card"><DetailsPanel job={j} run={run} /></Card>
        </div>
      </div>

      {modal?.kind === 'reason' && <ReasonModal testId={`reason-modal-${modal.action.key}`} title={modal.action.label.replace('…', '')} hint={modal.action.key === 'qc_fail' ? 'Fail moves the job back to service and queues a client email with this reason.' : 'A reason is required; it lands on the timeline.'} confirmLabel={modal.action.label.replace('…', '')} danger={modal.action.tone === 'danger'} onClose={() => setModal(null)} onConfirm={async (r) => { await api.transitionJob(j.id, modal.action.key, r); setModal(null); await load(); say(`${modal.action.label.replace('…', '')}${modal.action.notifies ? ' · client email queued' : ''}`); }} />}
      {modal?.kind === 'hold' && <HoldModal onClose={() => setModal(null)} onConfirm={async (t, r) => { await api.placeHold(j.id, t, r); setModal(null); await load(); say(`${t === 'parts' ? 'Parts' : 'Outsource'} hold placed`); }} />}
      {modal?.kind === 'release' && <ReasonModal testId="release-modal" title="Release hold" hint={`Returns the job to ${api.activeHold(j)?.priorStatus.replace(/_/g, ' ')}.`} confirmLabel="Release" optional onClose={() => setModal(null)} onConfirm={async (r) => { await api.releaseHold(j.id, r); setModal(null); await load(); say('Hold released'); }} />}
    </div>
  );
}
