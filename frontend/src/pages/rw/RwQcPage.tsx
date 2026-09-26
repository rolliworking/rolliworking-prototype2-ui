import { CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs, SupervisorBoard } from '@/api/client';
import { ReasonModal, WorkflowBadges } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate, fullName } from '@/lib/format';

// Supervisor-tier QC lane: jobs in testing, evidence completeness, pass / fail straight from the queue
export default function RwQcPage() {
  const [b, setB] = useState<SupervisorBoard | null>(null); const [fail, setFail] = useState<JobWithRefs | null>(null); const [flash, setFlash] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api.getSupervisorBoard().then(setB), []);
  useEffect(() => { void load(); }, [load]);
  const say = (m: string) => { setFlash(m); setErr(null); window.setTimeout(() => setFlash(null), 3000); };
  const pass = (j: JobWithRefs) => api.transitionJob(j.id, 'qc_pass').then(() => { say(`${j.number} passed QC → ready`); void load(); }).catch((e) => setErr(e.message));
  return <div data-testid="rw-qc-page" className="space-y-3">
    <div><h1 className="text-lg font-semibold text-white">QC queue</h1><p className="text-xs text-slate-400">Everything in testing. Pass needs the required evidence slots filed (service: all four · small job: hidden serial · warranty: serial + timing). Fail sends the job back to the bench with a reason.</p></div>
    {flash && <div data-testid="rw-qc-flash" className="rounded-sm bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-300">{flash}</div>}
    {err && <div data-testid="rw-qc-error" className="rounded-sm bg-rose-950/50 px-3 py-1.5 text-xs text-rose-300">{err}</div>}
    <Card title="In testing" subtitle={`${b?.qcQueue.length ?? 0} job${b?.qcQueue.length === 1 ? '' : 's'}`} testId="rw-qc-list" bodyClassName="p-0">
      <ul className="divide-y divide-line/70">{b?.qcQueue.map((j) => { const gaps = api.evidenceGaps(j); const req = api.EVIDENCE_REQUIRED[j.kind]; return <li key={j.id} data-testid={`rw-qc-${j.id}`} className="flex items-center gap-3 px-4 py-2 text-xs">
        <Link to={`/rw/jobs/${j.id}`} className="font-mono font-semibold text-ink hover:underline">{j.number}</Link><span className="truncate text-ink-700">{fullName(j.client)} · {j.watch.brand} {j.watch.model}</span><WorkflowBadges workflow={j.workflow} /><span className="text-ink-400">{j.assignees.join(', ') || 'unassigned'} · since {fmtDate(j.createdAt)}</span>
        <span data-testid={`rw-qc-evidence-${j.id}`} className={`ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${gaps.length ? 'bg-amber-50 text-amber-300' : 'bg-moss-50 text-emerald-300'}`}>evidence {req.length - gaps.length}/{req.length}</span>
        <Button size="sm" variant="primary" data-testid={`rw-qc-pass-${j.id}`} disabled={gaps.length > 0} title={gaps.length ? `Missing: ${gaps.map((g) => api.EVIDENCE_SLOTS.find((s) => s.key === g)!.label).join(', ')}` : undefined} onClick={() => void pass(j)}><CheckCircle2 size={12} /> Pass</Button>
        <Button size="sm" data-testid={`rw-qc-fail-${j.id}`} className="!text-rose-300" onClick={() => setFail(j)}><XCircle size={12} /> Fail…</Button>
      </li>; })}{b && !b.qcQueue.length && <li className="px-4 py-6 text-center text-xs text-ink-400">Nothing in testing.</li>}</ul>
    </Card>
    {fail && <ReasonModal testId="rw-qc-fail-modal" title={`Fail ${fail.number}`} hint="Back to the bench under its assignees; the client is notified with this reason." confirmLabel="Fail QC" danger onClose={() => setFail(null)} onConfirm={async (r) => { const j = fail; setFail(null); await api.transitionJob(j.id, 'qc_fail', r).then(() => { say(`${j.number} failed QC → back in service`); void load(); }).catch((e) => setErr(e.message)); }} />}
  </div>;
}
