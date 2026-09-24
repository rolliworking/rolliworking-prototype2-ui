import { PauseCircle, UserCog, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs, PartsRequestWithRefs, SupervisorBoard } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { HoldBadge, PriorityPill, WorkflowBadges } from '@/components/jobs/JobBits';
import { PartsRequestModal } from '@/components/parts/PartsChat';
import { Card } from '@/components/ui/Card';
import { OwnerChip, StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

const Chip = ({ j, onAssign, techs }: { j: JobWithRefs; onAssign: (job: JobWithRefs, who: string, on: boolean) => void; techs: string[] }) => (
  <li data-testid={`sup-job-${j.id}`} className="flex items-center gap-2 rounded-sm border border-line bg-surface px-2 py-1.5 text-xs">
    <Link to={`/jobs/${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link>
    <span className="truncate text-ink-700">{fullName(j.client)} · {j.watch.model}</span>
    <WorkflowBadges workflow={j.workflow} /><StatusPill status={j.status} />{j.priority !== 'normal' && <PriorityPill priority={j.priority} />}
    <span className="ml-auto flex items-center gap-1">{techs.map((t) => { const on = j.assignees.includes(t); return <button key={t} type="button" data-testid={`sup-assign-${j.id}-${t.toLowerCase()}`} aria-pressed={on} onClick={() => onAssign(j, t, !on)} className={`h-6 rounded-sm border px-1.5 text-[11px] ${on ? 'border-ink bg-ink text-white' : 'border-line text-ink-500 hover:border-ink-300'}`}>{t}</button>; })}</span>
  </li>
);

export default function SupervisorPage() {
  const { user } = useAuth();
  const [b, setB] = useState<SupervisorBoard | null>(null);
  const [open, setOpen] = useState<PartsRequestWithRefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api.getSupervisorBoard().then(setB), []);
  useEffect(() => { void load(); }, [load]);
  const techs = b?.byTech.map((t) => t.user.shortName) ?? [];
  const assign = (j: JobWithRefs, who: string, on: boolean) => api.supervisorAssign(j.id, on ? [...j.assignees, who] : j.assignees.filter((a) => a !== who)).then(() => { setError(null); void load(); }).catch((e) => setError(e instanceof Error ? e.message : 'Failed'));

  return (
    <div data-testid="supervisor-page" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Supervisor board</h1>
        <p className="mt-0.5 text-xs text-ink-500">Assign watchmakers · parts-approval queue · holds parked under {user?.shortName} · QC queue. Every change is audit-stamped.</p>
      </div>
      {error && <div data-testid="sup-error" className="rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{error}</div>}
      <div className="grid grid-cols-[1fr_400px] gap-4">
        <div className="space-y-4">
          <Card title="Unassigned bench work" subtitle={`${b?.unassigned.length ?? 0} approved / in service / testing with nobody on them`} testId="sup-unassigned"><ul className="space-y-1.5">{b?.unassigned.map((j) => <Chip key={j.id} j={j} techs={techs} onAssign={assign} />)}{b && b.unassigned.length === 0 && <li className="text-xs text-ink-400">Everything is assigned.</li>}</ul></Card>
          {b?.byTech.map(({ user: u, jobs }) => (
            <Card key={u.id} title={<span className="inline-flex items-center gap-2"><OwnerChip owner={u.shortName} /> {u.displayName}</span>} subtitle={`${jobs.length} on the bench`} testId={`sup-tech-${u.shortName.toLowerCase()}`}>
              <ul className="space-y-1.5">{jobs.map((j) => <Chip key={j.id} j={j} techs={techs} onAssign={assign} />)}{jobs.length === 0 && <li className="text-xs text-ink-400">Free.</li>}</ul>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card title="Parts approval queue" subtitle={`${b?.partsQueue.length ?? 0} pending`} testId="sup-parts-queue" bodyClassName="p-0" accent="moss">
            <ul className="divide-y divide-line/70">{b?.partsQueue.map((r) => <li key={r.id}><button type="button" data-testid={`sup-pr-${r.id}`} onClick={() => setOpen(r)} className="flex w-full flex-col gap-0.5 px-4 py-2 text-left text-xs hover:bg-canvas"><span className="flex items-center gap-2"><Wrench size={11} className="text-ink-400" /><span className="font-mono font-medium">{r.number}</span><span className="font-mono text-ink">{r.part?.partNumber}</span><span className="ml-auto text-ink-400">{r.requestedBy} · {fmtDate(r.requestedAt)} {fmtTime(r.requestedAt)}</span></span><span className="truncate text-ink-700">{r.part?.name} · {r.job.number} · {r.watch.model} {r.watch.reference}{r.note && ` · ${r.note}`}</span></button></li>)}{b && b.partsQueue.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">Queue empty.</li>}</ul>
          </Card>
          <Card title={<span className="inline-flex items-center gap-1.5"><UserCog size={13} /> Holds parked under {user?.shortName}</span>} subtitle="Parts & outsource holds with their logged transitions" testId="sup-holds" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{b?.holds.map((j) => { const h = api.activeHold(j)!; return <li key={j.id} data-testid={`sup-hold-${j.id}`} className="px-4 py-2 text-xs"><div className="flex items-center gap-2"><PauseCircle size={11} className="text-rose-600" /><Link to={`/jobs/${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link><HoldBadge job={j} compact /><span className="ml-auto text-ink-400">{fmtDate(h.placedAt)} · {h.placedBy} · {h.station}</span></div><div className="mt-0.5 truncate text-ink-700">{h.reason}</div><div className="text-[11px] text-ink-400">parked from {h.priorStatus.replace(/_/g, ' ')} · assignees {j.assignees.join(', ') || 'none'} · {j.holds.length} hold event{j.holds.length === 1 ? '' : 's'} on record</div></li>; })}{b && b.holds.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">Nothing parked.</li>}</ul>
          </Card>
          <Card title="QC queue" subtitle={`${b?.qcQueue.length ?? 0} in testing`} testId="sup-qc" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{b?.qcQueue.map((j) => <li key={j.id} data-testid={`sup-qc-${j.id}`} className="flex items-center gap-2 px-4 py-2 text-xs"><Link to={`/jobs/${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link><span className="truncate text-ink-700">{fullName(j.client)} · {j.watch.model}</span><WorkflowBadges workflow={j.workflow} /><span className="ml-auto text-ink-400">{j.assignees.join(', ') || 'unassigned'}</span></li>)}{b && b.qcQueue.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">Nothing in testing.</li>}</ul>
          </Card>
        </div>
      </div>
      {open && <PartsRequestModal request={open} onClose={() => { setOpen(null); void load(); }} onChange={setOpen} />}
    </div>
  );
}
