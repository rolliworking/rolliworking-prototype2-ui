import clsx from 'clsx';
import { LayoutList, Kanban, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { DeptCode, JobWithRefs } from '@/api/client';
import { JobBoard, JobGroupedList, LANES, LANE_LABEL, laneOf } from '@/components/jobs/JobBoard';
import { JobsSubNav, Provisional } from '@/components/jobs/JobBits';
import { JobTabs, TAB_LABEL, tabOf, type JobTab } from '@/components/jobs/JobTabs';
import { StorageList } from '@/components/jobs/StorageList';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/Button';
import { DeptBadge } from '@/components/ui/Pills';

const WORKFLOWS: DeptCode[] = ['W', 'B', 'P', 'PM'];

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'list' ? 'list' : 'board';
  const tab = (['queue', 'progress', 'finished'].includes(params.get('tab') ?? '') ? params.get('tab') : 'all') as JobTab;
  const lane = params.get('status') ?? 'all';
  const wf = params.get('wf') ?? 'all';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<JobWithRefs[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { api.searchJobs(q).then(setRows); }, 120);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v && v !== 'all' ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  // In storage (MH 2026-10-02) drops off every active lane / board; it lives behind its own filter chip
  const stored = useMemo(() => (rows ?? []).filter((j) => j.status === 'in_storage' && (wf === 'all' || j.workflow.includes(wf as DeptCode))), [rows, wf]);
  const byWf = useMemo(() => (rows ?? []).filter((j) => j.status !== 'in_storage' && (wf === 'all' || j.workflow.includes(wf as DeptCode))), [rows, wf]);
  const shown = useMemo(() => byWf.filter((j) => lane === 'all' || laneOf(j) === lane), [byWf, lane]);
  const laneCounts = useMemo(() => Object.fromEntries(LANES.map((l) => [l, byWf.filter((j) => laneOf(j) === l).length])), [byWf]);
  const wfCounts = useMemo(() => Object.fromEntries(WORKFLOWS.map((d) => [d, (rows ?? []).filter((j) => j.workflow.includes(d)).length])), [rows]);

  return (
    <div data-testid="jobs-page" className="flex h-full flex-col">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Jobs</h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">{rows ? `${rows.length} jobs · ${shown.length} shown` : 'Loading…'} · shop-floor map reads left to right <Provisional note="Linear machine inferred from the pack's full status list; legacy Job Detail allowed any status" /></p>
        </div>
        <JobsSubNav />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
          <input ref={inputRef} data-testid="jobs-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job #, client, ref, serial, tech…" className="h-8 w-64 rounded-sm border border-line bg-surface pl-7 pr-2 text-[13px] focus:border-ink focus:outline-none" />
        </label>
        <span className="mx-1 h-5 w-px bg-line" />
        <FilterChip active={wf === 'all'} onClick={() => set({ wf: 'all' })} testId="wf-filter-all">All workflows</FilterChip>
        {WORKFLOWS.map((d) => <FilterChip key={d} active={wf === d} onClick={() => set({ wf: d })} testId={`wf-filter-${d}`}><span className="inline-flex items-center gap-1"><DeptBadge code={d} /> <span className="opacity-60">{wfCounts[d] ?? 0}</span></span></FilterChip>)}
        <div className="ml-auto inline-flex rounded-sm border border-line bg-surface p-0.5" data-testid="view-toggle">
          <button type="button" data-testid="view-board" onClick={() => set({ view: '' })} className={clsx('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium', view === 'board' ? 'bg-ink text-white' : 'text-ink-500 hover:text-ink')}><Kanban size={12} /> Board</button>
          <button type="button" data-testid="view-list" onClick={() => set({ view: 'list' })} className={clsx('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium', view === 'list' ? 'bg-ink text-white' : 'text-ink-500 hover:text-ink')}><LayoutList size={12} /> List</button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1 border-b border-line" data-testid="jobs-tabs">{(['all', 'queue', 'progress', 'finished'] as JobTab[]).map((t) => <button key={t} type="button" data-testid={`jobs-tab-${t}`} onClick={() => set({ tab: t === 'all' ? '' : t, status: 'all' })} className={clsx('-mb-px inline-flex h-8 items-center gap-1.5 border-b-2 px-3 text-xs font-medium', tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink')}>{TAB_LABEL[t]}<span data-testid={`jobs-tab-count-${t}`} className="rounded-full bg-canvas px-1.5 font-mono text-[10px] text-ink-500">{t === 'all' ? byWf.length : byWf.filter((j) => tabOf(j) === t).length}</span></button>)}</div>

      {tab === 'all' && <div className="mb-3 flex flex-wrap items-center gap-1.5" data-testid="status-filters">
        <FilterChip active={lane === 'all'} onClick={() => set({ status: 'all' })} testId="job-filter-all">All</FilterChip>
        {LANES.map((l) => <FilterChip key={l} active={lane === l} onClick={() => set({ status: l })} testId={`job-filter-${l}`}>{LANE_LABEL[l]} <span className="ml-1 opacity-60" data-testid={`job-filter-count-${l}`}>{laneCounts[l] ?? 0}</span></FilterChip>)}
        <FilterChip active={lane === 'in_storage'} onClick={() => set({ status: 'in_storage' })} testId="job-filter-in_storage">{LANE_LABEL.in_storage} <span className="ml-1 opacity-60" data-testid="job-filter-count-in_storage">{stored.length}</span></FilterChip>
      </div>}

      {tab === 'all' && lane === 'in_storage' ? <StorageList jobs={stored} /> : tab !== 'all' ? (view === 'board' ? <JobTabs tab={tab} jobs={byWf} /> : <Card bodyClassName="p-0"><JobGroupedList jobs={byWf.filter((j) => tabOf(j) === tab)} /></Card>) : view === 'board' ? <JobBoard jobs={shown} /> : <Card bodyClassName="p-0"><JobGroupedList jobs={shown} /></Card>}
    </div>
  );
}
