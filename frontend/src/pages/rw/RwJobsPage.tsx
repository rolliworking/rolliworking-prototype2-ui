import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import { HoldBadge, KindPill, PriorityPill, WorkflowBadges, isOverdue } from '@/components/jobs/JobBits';
import { Provisional } from '@/components/estimates/EstimateBits';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

export default function RwJobsPage() {
  const [params, setParams] = useSearchParams(); const q = params.get('q') ?? '';
  const [rows, setRows] = useState<JobWithRefs[]>([]); const [draft, setDraft] = useState(q);
  const division = api.getSessionDivision();
  useEffect(() => { api.searchJobs(q).then((r) => setRows(r.filter((j) => j.division === division))); }, [q, division]);
  return <div data-testid="rw-jobs-page" className="space-y-3">
    <div className="flex items-end justify-between gap-4">
      <div><h1 className="text-lg font-semibold text-white">Jobs lookup</h1><p className="text-xs text-slate-400">Find a job by number, client name, reference, serial, model or tech. Scope: <span className="font-medium text-slate-200">{api.RG_DIVISION_LABEL[division]} jobs only</span> · open the job to act on it · <span className="text-amber-300">no dollar amounts anywhere in RolliWorking</span> <Provisional note="Hide-money for bench tiers is the amber default pending MH" /></p></div>
    </div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setParams(draft ? { q: draft } : {}); }}><div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="rw-jobs-search" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="J-26-… · last name · 126610LN · serial · Submariner · MM" className="w-full rounded-md border border-white/10 bg-[#0f131a] py-2 pl-8 pr-3 text-sm text-slate-100" /></div><button data-testid="rw-jobs-go" className="rounded-md bg-amber-400 px-4 text-sm font-semibold text-[#161b22]">Search</button></form>
    <div className="rounded-md border border-white/10 bg-[#1f2630]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-slate-400"><span>{q ? `Matches for “${q}”` : 'All open and recent jobs'}</span><span data-testid="rw-jobs-count">{rows.length} job{rows.length === 1 ? '' : 's'}</span></div>
      <ul className="divide-y divide-white/5">{rows.map((j) => <li key={j.id}><Link to={`/rw/jobs/${j.id}`} data-testid={`rw-job-row-${j.id}`} className="flex items-center gap-3 px-3 py-2 text-xs hover:bg-white/5"><span className="w-20 font-mono font-semibold text-slate-100">{j.number}</span><span className="flex-1 truncate text-slate-200">{fullName(j.client)} · {j.watch.brand} {j.watch.model} <span className="font-mono text-slate-500">{j.watch.reference} · {j.watch.serial}</span></span><KindPill kind={j.kind} /><WorkflowBadges workflow={j.workflow} /><StatusPill status={j.status} />{api.activeHold(j) && <HoldBadge job={j} compact />}{j.priority !== 'normal' && <PriorityPill priority={j.priority} />}<span className={`w-16 text-right ${isOverdue(j) ? 'font-semibold text-rose-400' : 'text-slate-500'}`}>{j.dueAt ? fmtDate(j.dueAt) : '—'}</span><span className="w-24 truncate text-right text-slate-500">{j.assignees.join(', ') || 'unassigned'}</span></Link></li>)}{!rows.length && <li className="px-3 py-6 text-center text-xs text-slate-500">No jobs match in this division</li>}</ul>
    </div>
  </div>;
}
