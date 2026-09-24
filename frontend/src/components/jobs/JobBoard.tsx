import clsx from 'clsx';
import { ChevronDown, ChevronRight, PauseCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobStatus, JobWithRefs } from '@/api/client';
import { AssigneeChips, HoldBadge, JobCard, KindPill, OwnerBadge, PriorityPill, WorkflowBadges, isOverdue } from '@/components/jobs/JobBits';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fullName, humanize } from '@/lib/format';

export type Lane = JobStatus | 'on_hold';
export const LANES: Lane[] = ['intake', 'in_review', 'awaiting_customer_approval', 'approved', 'in_service', 'on_hold', 'testing', 'ready_to_ship', 'closed'];
export const LANE_LABEL: Record<Lane, string> = { intake: 'Intake', in_review: 'In review', awaiting_customer_approval: 'Awaiting customer', approved: 'Approved', in_service: 'In service', on_hold: 'On hold', testing: 'Testing / QC', ready_to_ship: 'Ready to ship', closed: 'Closed' };

export const laneOf = (j: JobWithRefs): Lane => (api.activeHold(j) ? 'on_hold' : j.status);

export const groupByLane = (jobs: JobWithRefs[]) => {
  const g = Object.fromEntries(LANES.map((l) => [l, [] as JobWithRefs[]])) as Record<Lane, JobWithRefs[]>;
  jobs.forEach((j) => g[laneOf(j)].push(j));
  return g;
};

export const JobBoard = ({ jobs }: { jobs: JobWithRefs[] }) => {
  const groups = groupByLane(jobs);
  return (
    <div data-testid="jobs-board" className="flex gap-2.5 overflow-x-auto pb-3">
      {LANES.map((lane) => (
        <section key={lane} data-testid={`lane-${lane}`} className={clsx('flex w-[236px] shrink-0 flex-col rounded-md p-2', lane === 'on_hold' ? 'bg-rose-50/60 ring-1 ring-inset ring-rose-100' : 'bg-canvas')}>
          <header className="mb-2 flex items-center justify-between px-0.5">
            <span className={clsx('inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide', lane === 'on_hold' ? 'text-rose-700' : 'text-ink-500')}>{lane === 'on_hold' && <PauseCircle size={11} />}{LANE_LABEL[lane]}</span>
            <span data-testid={`lane-count-${lane}`} className="rounded-full bg-surface px-1.5 font-mono text-[11px] text-ink-500 shadow-card">{groups[lane].length}</span>
          </header>
          <div className="flex flex-col gap-1.5">
            {groups[lane].map((j) => <JobCard key={j.id} job={j} />)}
            {groups[lane].length === 0 && <div className="rounded-md border border-dashed border-line px-2 py-3 text-center text-[11px] text-ink-400">Empty</div>}
          </div>
        </section>
      ))}
    </div>
  );
};

export const JobGroupedList = ({ jobs }: { jobs: JobWithRefs[] }) => {
  const navigate = useNavigate();
  const groups = groupByLane(jobs);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ closed: true });
  const toggle = (l: Lane) => setCollapsed((c) => ({ ...c, [l]: !c[l] }));
  return (
    <Table testId="jobs-table">
      <thead>
        <tr><Th>Job</Th><Th>Kind</Th><Th>Client</Th><Th>Watch</Th><Th>Workflow</Th><Th>Status</Th><Th>Priority</Th><Th>Owner</Th><Th>Assignees</Th><Th className="text-right">Due</Th><Th className="text-right">Total</Th></tr>
      </thead>
      <tbody>
        {LANES.map((lane) => {
          const rows = groups[lane];
          if (rows.length === 0) return null;
          return [
            <tr key={`${lane}-h`} className="bg-canvas/70">
              <td colSpan={11} className="px-3 py-1">
                <button type="button" data-testid={`group-toggle-${lane}`} onClick={() => toggle(lane)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500 hover:text-ink">
                  {collapsed[lane] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}{LANE_LABEL[lane]} <span data-testid={`group-count-${lane}`} className="font-mono font-normal text-ink-400">{rows.length}</span>
                </button>
              </td>
            </tr>,
            ...(collapsed[lane] ? [] : rows.map((j) => (
              <tr key={j.id} data-testid={`job-row-${j.id}`} tabIndex={0} onClick={() => navigate(`/jobs/${j.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/jobs/${j.id}`)} className="cursor-pointer transition-colors hover:bg-canvas/70 focus:bg-canvas focus:outline-none">
                <Td className="font-mono text-xs font-medium text-ink">{j.number}</Td>
                <Td><KindPill kind={j.kind} /></Td>
                <Td className="font-medium text-ink">{fullName(j.client)}</Td>
                <Td><span className="text-ink">{j.watch.brand} {j.watch.model}</span> <span className="ml-1 font-mono text-xs text-ink-400">{j.watch.reference}</span></Td>
                <Td><WorkflowBadges workflow={j.workflow} /></Td>
                <Td><span className="inline-flex items-center gap-1.5"><StatusPill status={j.status} /><HoldBadge job={j} compact /></span></Td>
                <Td><PriorityPill priority={j.priority} /></Td>
                <Td><OwnerBadge owner={j.owner} compact /></Td>
                <Td><AssigneeChips assignees={j.assignees} /></Td>
                <Td className={clsx('tabular text-right', isOverdue(j) ? 'font-medium text-rose-700' : 'text-ink-500')}>{j.dueAt ? fmtDate(j.dueAt) : '—'}</Td>
                <Td className="tabular text-right font-medium">{fmtMoneyCents(j.total)}</Td>
              </tr>
            ))),
          ];
        })}
        {jobs.length === 0 && <EmptyRow colSpan={11} text="No jobs match." />}
      </tbody>
    </Table>
  );
};

export const laneLabel = (l: string) => LANE_LABEL[l as Lane] ?? humanize(l);
