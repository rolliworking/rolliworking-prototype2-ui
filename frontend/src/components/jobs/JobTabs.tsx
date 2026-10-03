import clsx from 'clsx';
import { useMemo, useState } from 'react';
import * as api from '@/api/client';
import * as org from '@/api/org';
import type { JobWithRefs } from '@/api/client';
import { JobCard } from '@/components/jobs/JobBits';
import { FilterChip } from '@/components/ui/Button';
import { LANE_LABEL, laneOf, type Lane } from './JobBoard';

export type JobTab = 'all' | 'queue' | 'progress' | 'finished';
export const TAB_LANES: Record<Exclude<JobTab, 'all'>, Lane[]> = {
  queue: ['intake', 'in_review', 'awaiting_customer_approval', 'approved'],
  progress: ['in_service', 'awaiting_components', 'on_hold', 'testing', 'awaiting_manager_review'],
  finished: ['ready_to_ship', 'closed'],
};
export const TAB_LABEL: Record<JobTab, string> = { all: 'All lanes', queue: 'Queue', progress: 'In progress', finished: 'Finished' };
export const tabOf = (j: JobWithRefs): Exclude<JobTab, 'all'> => { const l = laneOf(j); return TAB_LANES.queue.includes(l) ? 'queue' : TAB_LANES.finished.includes(l) ? 'finished' : 'progress'; };

const Column = ({ id, title, jobs, tone }: { id: string; title: string; jobs: JobWithRefs[]; tone?: 'rose' | 'amber' }) => (
  <section data-testid={`tab-col-${id}`} className={clsx('flex w-[224px] shrink-0 flex-col rounded-md p-1.5', tone === 'rose' ? 'bg-rose-50/60 ring-1 ring-inset ring-rose-100' : tone === 'amber' ? 'bg-amber-50/50 ring-1 ring-inset ring-amber-100' : 'bg-canvas')}>
    <header className="mb-1.5 flex items-center justify-between px-0.5"><span className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</span><span data-testid={`tab-col-count-${id}`} className="rounded-full bg-surface px-1.5 font-mono text-[11px] text-ink-500 shadow-card">{jobs.length}</span></header>
    <div className="flex flex-col gap-1">{jobs.map((j) => <JobCard key={j.id} job={j} />)}{!jobs.length && <div className="rounded-md border border-dashed border-line px-2 py-2 text-center text-[11px] text-ink-400">Empty</div>}</div>
  </section>
);

// Queue: lanes as columns. In progress: one column per tech (unassigned first), chip filters by tech / lane. Finished: ready vs closed.
export const JobTabs = ({ tab, jobs }: { tab: Exclude<JobTab, 'all'>; jobs: JobWithRefs[] }) => {
  const [tech, setTech] = useState<string>('all'); const [lane, setLane] = useState<string>('all');
  const inTab = useMemo(() => jobs.filter((j) => tabOf(j) === tab), [jobs, tab]);
  const techs = useMemo(() => api.getDivisionStaff(api.getSessionDivision()).map((u) => u.shortName), []);
  const shown = inTab.filter((j) => lane === 'all' || laneOf(j) === lane);
  if (tab !== 'progress') {
    // Routing-only departments (Setup → Departments, e.g. EN Engraving): the job ALSO appears in that queue and keeps its W·B·P dots (D-497)
    const routed = tab === 'queue' ? org.getDepartmentsSync().filter((d) => d.active && !d.dotLeg).map((d) => ({ d, jobs: inTab.filter((j) => org.routeDepartmentsSync(j.lines).some((x) => x.code === d.code)) })): [];
    return <div data-testid={`jobs-tab-${tab}`} className="flex gap-2 overflow-x-auto pb-3">{TAB_LANES[tab].map((l) => <Column key={l} id={l} title={LANE_LABEL[l]} jobs={inTab.filter((j) => laneOf(j) === l)} tone={l === 'on_hold' ? 'rose' : undefined} />)}{routed.map(({ d, jobs: js }) => <Column key={d.code} id={`dept-${d.code}`} title={`${d.queue} · ${d.code}`} jobs={js} tone="amber" />)}</div>;
  }
  const byTech = (t: string) => shown.filter((j) => (t === 'unassigned' ? j.assignees.length === 0 : j.assignees.includes(t)));
  const cols = ['unassigned', ...techs].filter((t) => tech === 'all' || tech === t);
  return <div data-testid="jobs-tab-progress">
    <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="progress-filters">
      <FilterChip active={tech === 'all'} onClick={() => setTech('all')} testId="tech-filter-all">All techs</FilterChip>
      <FilterChip active={tech === 'unassigned'} onClick={() => setTech('unassigned')} testId="tech-filter-unassigned">Unassigned <span className="ml-1 opacity-60">{inTab.filter((j) => !j.assignees.length).length}</span></FilterChip>
      {techs.map((t) => <FilterChip key={t} active={tech === t} onClick={() => setTech(t)} testId={`tech-filter-${t.toLowerCase()}`}>{t} <span className="ml-1 opacity-60">{inTab.filter((j) => j.assignees.includes(t)).length}</span></FilterChip>)}
      <span className="mx-1 h-5 w-px bg-line" />
      <FilterChip active={lane === 'all'} onClick={() => setLane('all')} testId="progress-lane-all">Any stage</FilterChip>
      {TAB_LANES.progress.map((l) => <FilterChip key={l} active={lane === l} onClick={() => setLane(l)} testId={`progress-lane-${l}`}>{LANE_LABEL[l]} <span className="ml-1 opacity-60">{inTab.filter((j) => laneOf(j) === l).length}</span></FilterChip>)}
    </div>
    <div className="flex gap-2 overflow-x-auto pb-3">{cols.map((t) => <Column key={t} id={`tech-${t.toLowerCase()}`} title={t === 'unassigned' ? 'Unassigned' : t} jobs={byTech(t)} tone={t === 'unassigned' ? 'amber' : undefined} />)}</div>
  </div>;
};
