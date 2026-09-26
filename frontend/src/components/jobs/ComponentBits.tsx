import { Check, UserCog } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { JobComponent, JobWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

// Per-component chips: ✓ with tech initials when done, hollow when still out
export const ComponentChips = ({ job, testId }: { job: JobWithRefs; testId?: string }) => (
  <span data-testid={testId ?? `component-chips-${job.id}`} className="inline-flex flex-wrap items-center gap-1">
    {job.components.map((c) => <span key={c.key} data-testid={`component-chip-${job.id}-${c.key}`} title={c.completedAt ? `${c.label} complete · ${c.completedBy} · ${fmtDate(c.completedAt)}` : `${c.label} still out`} className={`inline-flex items-center gap-0.5 rounded-sm border px-1 text-[10px] font-medium ${c.completedAt ? 'border-moss-100 bg-moss-50 text-moss-700' : 'border-dashed border-line text-ink-400'}`}>{c.completedAt ? <Check size={9} /> : null}{c.label}{c.completedAt && <span className="font-mono">{c.completedBy}</span>}</span>)}
  </span>
);

// Inline "my component is done" buttons for the bench row
export const ComponentDoneButtons = ({ job, run }: { job: JobWithRefs; run: Run }) => {
  if (!api.canCompleteComponent(job)) return null;
  const out = job.components.filter((c) => !c.completedAt);
  return <span className="inline-flex items-center gap-1">{out.map((c) => <button key={c.key} type="button" data-testid={`component-done-${job.id}-${c.key}`} onClick={() => void run(() => api.completeComponent(job.id, c.key), `${c.label} marked complete${out.length === 1 ? ' — all components in → testing' : ''}`)} className="inline-flex items-center gap-0.5 rounded-sm border border-moss-100 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-moss-700 hover:bg-moss-50"><Check size={9} /> {c.label} done</button>)}</span>;
};

const Amend = ({ job, c, run }: { job: JobWithRefs; c: JobComponent; run: Run }) => {
  const [who, setWho] = useState(c.completedBy ?? '');
  const staff = api.getDivisionStaff(job.division);
  return <span className="inline-flex items-center gap-1 text-[11px]"><UserCog size={11} className="text-ink-400" /><select data-testid={`component-amend-${job.id}-${c.key}`} value={who} onChange={(e) => setWho(e.target.value)} className="h-6 rounded-sm border border-line bg-canvas px-1 text-[11px]">{staff.map((u) => <option key={u.id} value={u.shortName}>{u.shortName}</option>)}</select><Button size="sm" data-testid={`component-amend-save-${job.id}-${c.key}`} disabled={who === c.completedBy} onClick={() => void run(() => api.amendComponentAttribution(job.id, c.key, who), `${c.label} re-attributed to ${who}`)}>Amend</Button></span>;
};

export const ComponentsPanel = ({ job, run }: { job: JobWithRefs; run: Run }) => {
  const { user } = useAuth(); const done = job.components.filter((c) => c.completedAt).length;
  return <div data-testid="components-panel" className="space-y-2 text-xs">
    <div className="flex items-center gap-2 text-ink-500"><span data-testid="components-progress" className="font-mono font-semibold text-ink">{done}/{job.components.length}</span> complete · credit lands in the month each component completes, regardless of invoicing{api.awaitingComponents(job) && <span data-testid="components-awaiting" className="rounded-sm bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Awaiting components</span>}<span className="text-[10px] text-ink-400" title="MH ruling 2026-09-26: QC-fail after completion keeps the credit; rework is logged separately">· QC-fail keeps credit (ruled)</span></div>
    <ul className="divide-y divide-line/70 rounded-md border border-line">{job.components.map((c) => <li key={c.key} data-testid={`component-row-${c.key}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${c.completedAt ? 'bg-moss text-white' : 'border border-dashed border-ink-300 text-ink-300'}`}>{c.completedAt ? <Check size={11} /> : null}</span>
      <span className="font-medium text-ink">{c.label}</span><span className="font-mono text-[10px] text-ink-400">{c.depts.join(' · ') || 'single-track'}</span>
      {c.completedAt ? <span data-testid={`component-done-by-${c.key}`} className="text-ink-500">done by <span className="font-mono font-semibold text-ink">{c.completedBy}</span> · {fmtDate(c.completedAt)} {fmtTime(c.completedAt)} · {c.completedStation}{c.amendedFrom && <span className="ml-1 text-amber-800">(amended from {c.amendedFrom} by {c.amendedBy})</span>}</span> : <span className="text-ink-400">still out</span>}
      {c.rework.length > 0 && <span data-testid={`component-rework-${c.key}`} className="rounded-sm bg-rose-50 px-1.5 text-[10px] text-rose-700" title={c.rework.map((r) => `${fmtDate(r.at)} · ${r.reason}`).join('\n')}>rework ×{c.rework.length}</span>}
      <span className="ml-auto flex items-center gap-2">
        {!c.completedAt && api.canCompleteComponent(job) && <Button size="sm" variant="primary" data-testid={`component-complete-${c.key}`} onClick={() => void run(() => api.completeComponent(job.id, c.key), `${c.label} marked complete`)}><Check size={11} /> Mark complete</Button>}
        {c.completedAt && user?.accessTier === 'manager' && <Amend job={job} c={c} run={run} />}
      </span>
    </li>)}</ul>
  </div>;
};
