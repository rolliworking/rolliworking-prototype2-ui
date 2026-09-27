import clsx from 'clsx';
import { AlertTriangle, Clock, Kanban, PauseCircle, Plus, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import * as api from '@/api/client';
import { ComponentChips } from '@/components/jobs/ComponentBits';
import type { Client, HoldType, Job, JobKind, JobPriority, JobWithRefs, Role } from '@/api/client';
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

const KIND_TONE: Record<JobKind, string> = { service: 'bg-canvas text-ink-500', small_job: 'bg-teal-50 text-teal-800', warranty: 'bg-violet-50 text-violet-700', trade: 'bg-amber-100 text-amber-900' };
export const KindPill = ({ kind, testId, client }: { kind: JobKind; testId?: string; client?: Client }) => (
  <span data-testid={testId} className={clsx('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', KIND_TONE[kind])}>{api.JOB_KIND_CONFIG[kind].label}{kind === 'trade' && client && ` · ${client.company ?? fullName(client)}${client.internal ? ' (internal)' : ''}`}</span>
);

// Trade lane path strip — the abbreviated Job Story: Scan-in → Work → Inspection → Manager review → Invoice
export const TradePathStrip = ({ job, dark, testId = 'trade-path' }: { job: Job; dark?: boolean; testId?: string }) => {
  const idx = api.tradePathIndex(job);
  return <ol data-testid={testId} data-stage={api.TRADE_PATH[idx].key} className={clsx('flex flex-wrap items-center gap-1 rounded-md border px-3 py-2 text-[11px]', dark ? 'border-amber-400/30 bg-amber-400/5' : 'border-amber-200 bg-amber-50/60')}>
    <span className={clsx('mr-1 font-semibold uppercase tracking-wide', dark ? 'text-amber-300' : 'text-amber-800')}>Trade path</span>
    {api.TRADE_PATH.map((p, i) => <li key={p.key} data-testid={`${testId}-${p.key}`} data-state={i < idx ? 'done' : i === idx ? 'current' : 'next'} className="inline-flex items-center gap-1">
      <span className={clsx('rounded-full px-2 py-0.5 font-medium', i === idx ? 'bg-amber-400 text-[#161b22]' : i < idx ? (dark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-moss-50 text-moss-700') : (dark ? 'bg-white/5 text-slate-500' : 'bg-canvas text-ink-400'))}>{i < idx ? '✓ ' : ''}{p.label}</span>
      {i < api.TRADE_PATH.length - 1 && <span className={dark ? 'text-slate-600' : 'text-ink-300'}>→</span>}
    </li>)}
    <span className={clsx('ml-auto', dark ? 'text-slate-400' : 'text-ink-500')}>no inspection report · no estimate · {api.isInternalTrade(job.clientId) ? 'no client emails' : 'invoice email only'}</span>
  </ol>;
};

// Trade send-back: reason picker (supervisor send-back pattern) + optional note → back to the bench
export const TradeSendBackModal = ({ testId, onClose, onConfirm }: { testId: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) => {
  const [key, setKey] = useState('rework'); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const label = api.TRADE_SEND_BACK.find((r) => r.key === key)!.label;
  const go = async () => { if (key === 'other' && !note.trim()) return setErr('Add a note for "Other"'); try { await onConfirm(`${label}${note.trim() ? ` — ${note.trim()}` : ''}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <Modal onClose={onClose} testId={testId} width="w-[460px]">
    <div className="p-5">
      <div className="text-[14px] font-semibold text-ink">Send back to the bench</div>
      <p className="mt-1 text-xs text-ink-500">Returns the job to In service; parts go back to their benches; completions are cleared and logged as rework.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{api.TRADE_SEND_BACK.map((r) => <button key={r.key} data-testid={`${testId}-reason-${r.key}`} onClick={() => setKey(r.key)} className={clsx('rounded-sm border px-3 py-2 text-left text-[13px]', key === r.key ? 'border-ink bg-ink text-white' : 'border-line hover:bg-canvas')}>{r.label}</button>)}</div>
      <textarea data-testid={`${testId}-note`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={key === 'other' ? 'Note (required)' : 'Note (optional)'} className="mt-3 w-full rounded-sm border border-line bg-canvas px-3 py-2 text-[13px] outline-none focus:border-ink" />
      {err && <p data-testid={`${testId}-error`} className="mt-2 text-xs text-rose-700">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button data-testid={`${testId}-confirm`} className="!border-rose-200 !text-rose-700 hover:!bg-rose-50" onClick={() => void go()}>Send back · {label}</Button></div>
    </div>
  </Modal>;
};

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
  <Link to={`/jobs/${j.id}`} data-testid={`job-card-${j.id}`} className="block rounded-md border border-line bg-surface px-2 py-1.5 shadow-card transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[11px] font-semibold text-ink">{j.number}</span>
      <div className="flex items-center gap-1">{api.threadNeedsReplyFor({ kind: 'job', id: j.id }) && <span data-testid={`reply-indicator-${j.id}`} title="Client reply waiting" className="rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-700">reply</span>}{j.kind !== 'service' && <KindPill kind={j.kind} />}{j.priority !== 'normal' && <PriorityPill priority={j.priority} />}<WorkflowBadges workflow={j.workflow} /></div>
    </div>
    <div className="truncate text-xs leading-tight"><span className="font-medium text-ink">{fullName(j.client)}</span> <span className="text-ink-500">· {j.watch.model}</span> <span className="font-mono text-[10px] text-ink-400">{j.watch.reference}</span></div>
    <div className="mt-1 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <AssigneeChips assignees={j.assignees} />
        {j.owner && <OwnerBadge owner={j.owner} compact />}
        <HoldBadge job={j} compact />
        {j.components.length > 1 && j.components.some((c) => c.completedAt) && <ComponentChips job={j} />}
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
