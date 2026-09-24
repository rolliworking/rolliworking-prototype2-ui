import clsx from 'clsx';
import { AlertTriangle, Clock, Kanban, PauseCircle, Plus, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import * as api from '@/api/client';
import type { HoldType, JobKind, JobPriority, JobWithRefs, Role } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge, OwnerChip, StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';
import { TailPill } from '@/components/sales/SalesBits';

export { Provisional };

const PRIORITY_TONE: Record<JobPriority, string> = {
  low: 'text-slate-500 bg-slate-100',
  normal: 'text-ink-500 bg-canvas',
  high: 'text-orange-800 bg-orange-50',
  urgent: 'text-rose-700 bg-rose-50 ring-1 ring-inset ring-rose-200',
};

export const PriorityPill = ({ priority, testId }: { priority: JobPriority; testId?: string }) => (
  <span data-testid={testId} className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', PRIORITY_TONE[priority])}>
    {priority === 'urgent' && <AlertTriangle size={9} />}{priority}
  </span>
);

const KIND_TONE: Record<JobKind, string> = { service: 'bg-canvas text-ink-500', small_job: 'bg-teal-50 text-teal-800', warranty: 'bg-violet-50 text-violet-700' };
export const KindPill = ({ kind, testId }: { kind: JobKind; testId?: string }) => (
  <span data-testid={testId} className={clsx('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', KIND_TONE[kind])}>{api.JOB_KIND_CONFIG[kind].label}</span>
);

// Owner = accountable ROLE (never "PM" — that code is precious metals); shows current holders
export const OwnerBadge = ({ owner, testId, compact }: { owner?: Role; testId?: string; compact?: boolean }) => {
  if (!owner) return <span data-testid={testId} className="text-[11px] text-ink-400">no owner</span>;
  const holders = api.roleHolders(owner).map((u) => u.shortName).join(', ');
  return (
    <span data-testid={testId} title={`Owner role: ${owner} · holders: ${holders || 'none'}`} className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-100">
      <UserCog size={10} /> {compact ? owner : `Owner · ${owner}`}{!compact && holders && <span className="font-normal text-amber-800/70">({holders})</span>}
    </span>
  );
};

export const AssigneeChips = ({ assignees }: { assignees: string[] }) => (
  assignees.length ? <span className="inline-flex items-center gap-0.5">{assignees.map((a) => <OwnerChip key={a} owner={a} />)}</span> : <span className="text-[11px] text-ink-400">unassigned</span>
);

export const WorkflowBadges = ({ workflow, className }: { workflow: string[]; className?: string }) => (
  <span className={clsx('inline-flex items-center gap-0.5', className)} title={`Workflow ${workflow.join(' → ')}`}>
    {workflow.map((d) => <DeptBadge key={d} code={d} />)}
  </span>
);

export const HoldBadge = ({ job, compact }: { job: JobWithRefs; compact?: boolean }) => {
  const h = api.activeHold(job);
  if (!h) return null;
  return (
    <span data-testid={`hold-badge-${job.id}`} className="inline-flex items-center gap-1 rounded-sm bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200" title={h.reason}>
      <PauseCircle size={11} /> {h.type === 'parts' ? 'Parts hold' : 'Outsource hold'}{!compact && <span className="font-normal opacity-80">· parked from {h.priorStatus.replace(/_/g, ' ')}</span>}
    </span>
  );
};

export const isOverdue = (j: JobWithRefs) => !!j.dueAt && j.status !== 'closed' && new Date(j.dueAt) < new Date();

export const JobCard = ({ job: j }: { job: JobWithRefs }) => (
  <Link to={`/jobs/${j.id}`} data-testid={`job-card-${j.id}`} className="block rounded-md border border-line bg-surface p-2.5 shadow-card transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-xs font-semibold text-ink">{j.number}</span>
      <div className="flex items-center gap-1">{j.kind !== 'service' && <KindPill kind={j.kind} />}{j.priority !== 'normal' && <PriorityPill priority={j.priority} />}<WorkflowBadges workflow={j.workflow} /></div>
    </div>
    <div className="mt-1 truncate text-[13px] font-medium text-ink">{fullName(j.client)}</div>
    <div className="truncate text-xs text-ink-500">{j.watch.brand} {j.watch.model} <span className="font-mono text-ink-400">{j.watch.reference}</span></div>
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <AssigneeChips assignees={j.assignees} />
        {j.owner && <OwnerBadge owner={j.owner} compact />}
        <HoldBadge job={j} compact />
        <TailPill stage={api.tailStage(j)} />
      </div>
      {j.dueAt && <span className={clsx('inline-flex items-center gap-1 tabular text-[11px]', isOverdue(j) ? 'font-semibold text-rose-700' : 'text-ink-400')}><Clock size={10} /> {fmtDate(j.dueAt)}</span>}
    </div>
  </Link>
);

export const JobsSubNav = () => {
  const cls = ({ isActive }: { isActive: boolean }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink');
  return (
    <div className="flex items-center gap-1" data-testid="jobs-subnav">
      <NavLink to="/jobs" end data-testid="jobs-tab-board" className={cls}><Kanban size={13} /> All jobs</NavLink>
      <NavLink to="/jobs/shop-time" data-testid="jobs-tab-shop-time" className={cls}><Clock size={13} /> Shop Time</NavLink>
      <NavLink to="/jobs/new" data-testid="jobs-tab-new" className={cls}><Plus size={13} /> New job</NavLink>
    </div>
  );
};

interface ReasonModalProps { title: string; hint?: string; confirmLabel: string; danger?: boolean; testId: string; onClose: () => void; onConfirm: (reason: string) => Promise<void>; optional?: boolean }

export const ReasonModal = ({ title, hint, confirmLabel, danger, testId, onClose, onConfirm, optional }: ReasonModalProps) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (!optional && !reason.trim()) return setErr('A reason is required');
    try { await onConfirm(reason); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Modal onClose={onClose} testId={testId} width="w-[460px]">
      <div className="p-5">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        <textarea data-testid={`${testId}-reason`} autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void go(); }} placeholder={optional ? 'Note (optional)' : 'Reason (required)'} className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:outline-none" />
        {err && <p data-testid={`${testId}-error`} className="mt-1 text-xs font-medium text-rose-700">{err}</p>}
        <div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-ink-400">⌘/Ctrl + Enter to confirm</span><div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" className={danger ? '!bg-rose-700 hover:!bg-rose-800' : undefined} data-testid={`${testId}-confirm`} onClick={go}>{confirmLabel}</Button></div></div>
      </div>
    </Modal>
  );
};

export const HoldModal = ({ onClose, onConfirm }: { onClose: () => void; onConfirm: (type: HoldType, reason: string) => Promise<void> }) => {
  const [type, setType] = useState<HoldType>('parts');
  return (
    <Modal onClose={onClose} testId="hold-modal" width="w-[460px]">
      <HoldForm type={type} setType={setType} onClose={onClose} onConfirm={onConfirm} />
    </Modal>
  );
};

const HoldForm = ({ type, setType, onClose, onConfirm }: { type: HoldType; setType: (t: HoldType) => void; onClose: () => void; onConfirm: (type: HoldType, reason: string) => Promise<void> }) => {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (!reason.trim()) return setErr('A hold reason is required');
    try { await onConfirm(type, reason); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <div className="p-5">
      <div className="text-[14px] font-semibold text-ink">Place hold</div>
      <p className="mt-1 text-xs text-ink-500">Held jobs park visibly and release back to their prior status. The hold history stays on the record.</p>
      <div className="mt-3 flex gap-1.5">
        {(['parts', 'outsource'] as HoldType[]).map((t) => (
          <button key={t} type="button" data-testid={`hold-type-${t}`} onClick={() => setType(t)} className={clsx('h-8 rounded-sm border px-3 text-xs font-medium', type === t ? 'border-ink bg-ink text-white' : 'border-line text-ink-500 hover:border-ink-300')}>{t === 'parts' ? 'Parts hold' : 'Outsource hold'}</button>
        ))}
      </div>
      <textarea data-testid="hold-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === 'parts' ? 'What part, from where, ETA (required)' : 'Which vendor, what work, due back (required)'} className="mt-3 w-full rounded-sm border border-line bg-canvas px-2.5 py-1.5 text-[13px] focus:border-ink focus:outline-none" />
      {err && <p data-testid="hold-error" className="mt-1 text-xs font-medium text-rose-700">{err}</p>}
      <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="hold-confirm" onClick={go}><PauseCircle size={13} /> Place hold</Button></div>
    </div>
  );
};

export const StatusWithHold = ({ job }: { job: JobWithRefs }) => (
  <span className="inline-flex items-center gap-1.5"><StatusPill status={job.status} testId="job-status" /><HoldBadge job={job} /></span>
);
