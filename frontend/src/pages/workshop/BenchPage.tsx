import { ArrowRight, Download, PauseCircle, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { BenchView, PartsRequestWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { HoldBadge, KindPill, PriorityPill, WorkflowBadges, isOverdue } from '@/components/jobs/JobBits';
import { PartsRequestModal, PartsRequestPill } from '@/components/parts/PartsChat';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

export default function BenchPage() {
  const { user } = useAuth();
  const [v, setV] = useState<BenchView | null>(null);
  const [open, setOpen] = useState<PartsRequestWithRefs | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(() => api.getBenchView().then(setV), []);
  useEffect(() => { void load(); }, [load, user?.id]);
  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  return (
    <div data-testid="bench-page" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Bench · {user?.shortName}</h1>
        <p className="mt-0.5 text-xs text-ink-500">My day — assigned jobs with the next legal action, my holds, pull-next (respects supervisor assignment).</p>
      </div>
      {flash && <div data-testid="bench-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Card title="My jobs" subtitle={`${v?.jobs.length ?? 0} on my bench`} testId="bench-jobs" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">
              {v?.jobs.map((j) => (
                <li key={j.id} data-testid={`bench-job-${j.id}`} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  <Link to={`/jobs/${j.id}`} className="font-mono text-xs font-semibold text-ink hover:underline">{j.number}</Link>
                  <span className="truncate text-ink">{fullName(j.client)} · {j.watch.brand} {j.watch.model}</span>
                  <KindPill kind={j.kind} /><WorkflowBadges workflow={j.workflow} /><StatusPill status={j.status} />{j.priority !== 'normal' && <PriorityPill priority={j.priority} />}
                  <span className="ml-auto flex items-center gap-2 text-xs">
                    {j.dueAt && <span className={isOverdue(j) ? 'font-semibold text-rose-700' : 'text-ink-400'}>{fmtDate(j.dueAt)}</span>}
                    {j.nextAction ? <Link to={`/jobs/${j.id}`} data-testid={`bench-next-${j.id}`} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-1 font-medium text-white hover:bg-ink-700">{j.nextAction} <ArrowRight size={11} /></Link> : <span className="text-ink-400">—</span>}
                    {j.blocked && <span data-testid={`bench-blocked-${j.id}`} className="max-w-[220px] truncate text-rose-700" title={j.blocked}>blocked: {j.blocked}</span>}
                  </span>
                </li>
              ))}
              {v && v.jobs.length === 0 && <li className="px-4 py-4 text-xs text-ink-400">Nothing assigned — pull the next job.</li>}
            </ul>
          </Card>
          <Card title="My holds" subtitle="Parked — release from the job when the part or vendor lands" testId="bench-holds" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{v?.holds.map((j) => <li key={j.id} data-testid={`bench-hold-${j.id}`} className="flex items-center gap-3 px-4 py-2 text-xs"><PauseCircle size={12} className="text-rose-600" /><Link to={`/jobs/${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link><span className="truncate text-ink-700">{api.activeHold(j)?.reason}</span><span className="ml-auto"><HoldBadge job={j} compact /></span></li>)}{v && v.holds.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">No holds on my jobs.</li>}</ul>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Pull next" subtitle="Oldest approved, on-hand, unassigned — priority first" testId="bench-pull" accent="moss">
            {v?.pullNext ? <div className="text-xs"><div className="font-mono text-sm font-semibold text-ink">{v.pullNext.number}</div><div className="text-ink-700">{fullName(v.pullNext.client)} · {v.pullNext.watch.brand} {v.pullNext.watch.model}</div><div className="mt-1 flex items-center gap-1"><WorkflowBadges workflow={v.pullNext.workflow} /><PriorityPill priority={v.pullNext.priority} /></div><Button variant="primary" data-testid="bench-pull-next" className="mt-2 w-full" onClick={() => api.pullNext().then((j) => { say(`Pulled ${j.number}`); void load(); }).catch((e) => say(e instanceof Error ? e.message : 'Failed'))}><Download size={12} /> Pull {v.pullNext.number}</Button></div> : <p data-testid="bench-pull-empty" className="text-xs text-ink-400">{user && !(user.roles.includes('watchmaker') || user.roles.includes('inspector')) ? 'Pull-next is for bench roles (watchmaker / inspector).' : 'Nothing waiting — supervisor-assigned jobs are never pulled by others.'}</p>}
          </Card>
          <Card title="My parts requests" testId="bench-parts" bodyClassName="p-0">
            <ul className="divide-y divide-line/70">{v?.partsRequests.map((r) => <li key={r.id}><button type="button" data-testid={`bench-pr-${r.id}`} onClick={() => setOpen(r)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-canvas"><Wrench size={11} className="text-ink-400" /><span className="font-mono font-medium">{r.number}</span><span className="truncate text-ink-700">{r.part?.partNumber ?? 'no part'} · {r.job.number}</span><span className="ml-auto"><PartsRequestPill status={r.status} /></span></button></li>)}{v && v.partsRequests.length === 0 && <li className="px-4 py-3 text-xs text-ink-400">None yet — open one from a job.</li>}</ul>
          </Card>
        </div>
      </div>
      {open && <PartsRequestModal request={open} onClose={() => { setOpen(null); void load(); }} onChange={setOpen} />}
    </div>
  );
}
