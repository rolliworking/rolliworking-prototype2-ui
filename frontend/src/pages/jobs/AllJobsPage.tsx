import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobCategoryKey, JobReportRow } from '@/api/client';
import { AssigneeChips, JobsSubNav, WorkflowBadges } from '@/components/jobs/JobBits';
import { FilterChip } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

// Management-level view of every job across the shop — multi-select quick filters (shared vocabulary with RW Reports) combine with search
export default function AllJobsPage() {
  const nav = useNavigate(); const [q, setQ] = useState(''); const [cats, setCats] = useState<JobCategoryKey[]>([]); const [rows, setRows] = useState<JobReportRow[]>([]); const [total, setTotal] = useState(0);
  useEffect(() => { const t = setTimeout(() => { api.getJobReport({ q, categories: cats }).then((r) => { setRows(r.rows); setTotal(r.total); }); }, 120); return () => clearTimeout(t); }, [q, cats]);
  const toggle = (k: JobCategoryKey) => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  return <div data-testid="all-jobs-page" className="flex h-full flex-col">
    <div className="mb-3 flex items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight text-ink">All jobs</h1><p className="mt-0.5 text-xs text-ink-500">Every job across every department · <span data-testid="all-jobs-count">{rows.length}</span> of {total} shown · filters combine (AND) with search</p></div><JobsSubNav /></div>
    <div className="mb-2 flex flex-wrap items-center gap-2"><label className="relative"><Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="all-jobs-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job #, client, ref, serial, tech…" className="h-8 w-64 rounded-sm border border-line bg-surface pl-7 pr-2 text-[13px] focus:border-ink focus:outline-none" /></label>{cats.length > 0 && <button data-testid="all-jobs-clear" onClick={() => setCats([])} className="text-xs text-brand hover:underline">Clear filters ({cats.length})</button>}</div>
    <div className="mb-3 flex flex-wrap gap-1.5" data-testid="all-jobs-filters">{api.JOB_CATEGORIES.map((c) => <FilterChip key={c.key} active={cats.includes(c.key)} onClick={() => toggle(c.key)} testId={`all-jobs-filter-${c.key}`}>{c.label}</FilterChip>)}</div>
    <Card bodyClassName="p-0">
      <table data-testid="all-jobs-table" className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-3 py-1.5 font-medium">Job</th><th className="px-3 py-1.5 font-medium">Client</th><th className="px-3 py-1.5 font-medium">Watch</th><th className="px-3 py-1.5 font-medium">Dept</th><th className="px-3 py-1.5 font-medium">Status</th><th className="px-3 py-1.5 text-right font-medium">Due</th><th className="px-3 py-1.5 font-medium">Tech</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.job.id} data-testid={`all-jobs-row-${r.job.id}`} tabIndex={0} onClick={() => nav(`/jobs/${r.job.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/jobs/${r.job.id}`)} className="cursor-pointer border-t border-line hover:bg-canvas/70 focus:bg-canvas focus:outline-none"><td className="px-3 py-1 font-mono font-semibold text-ink">{r.job.number}</td><td className="px-3 py-1 text-ink">{fullName(r.job.client)}</td><td className="px-3 py-1 text-ink-700">{r.job.watch.brand} {r.job.watch.model} <span className="font-mono text-ink-400">{r.job.watch.reference}</span></td><td className="px-3 py-1"><WorkflowBadges workflow={r.job.workflow} /></td><td className="px-3 py-1"><StatusPill status={r.job.status} /></td><td className={clsx('px-3 py-1 text-right tabular', r.overdue ? 'font-semibold text-rose-700' : 'text-ink-500')}>{r.due ? fmtDate(r.due) : '—'}{r.overdue && <span className="ml-1 text-[10px]">({Math.abs(r.days!)}d late)</span>}</td><td className="px-3 py-1"><AssigneeChips assignees={r.job.assignees} /></td></tr>)}{!rows.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-400">No jobs match.</td></tr>}</tbody></table>
    </Card>
  </div>;
}
