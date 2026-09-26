import { ScanLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import { EvidencePanel } from '@/components/jobs/EvidencePanel';
import { WorkflowBadges } from '@/components/jobs/JobBits';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fullName } from '@/lib/format';

// Evidence capture station: scan the watch label → job → the four QC slots
export default function RwEvidencePage() {
  const [params, setParams] = useSearchParams(); const jobId = params.get('job');
  const [scan, setScan] = useState(''); const [err, setErr] = useState<string | null>(null); const [job, setJob] = useState<JobWithRefs | null>(null); const [queue, setQueue] = useState<JobWithRefs[]>([]); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(async () => { setJob(jobId ? await api.getJob(jobId) : null); setQueue((await api.getSupervisorBoard()).qcQueue); }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  const go = async () => { const j = await api.findJobByLabel(scan); if (!j) { setErr('No job matches that label'); return; } setErr(null); setParams({ job: j.id }); };
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); await load(); setFlash(msg); window.setTimeout(() => setFlash(null), 3000); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <div data-testid="rw-evidence-page" className="space-y-3">
    <div><h1 className="text-lg font-semibold text-white">Evidence capture</h1><p className="text-xs text-slate-400">Scan the watch label (job #, ref/serial or PDF417 payload). Evidence is keyed to the watch AND the job — QC pass is gated on the required slots.</p></div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void go(); }}><div className="relative flex-1"><ScanLine size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="rw-evidence-scan" autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan or type the label" className="w-full rounded-md border border-white/10 bg-[#0f131a] py-2 pl-8 pr-3 font-mono text-sm text-slate-100" /></div><button data-testid="rw-evidence-go" className="rounded-md bg-amber-400 px-4 text-sm font-semibold text-[#161b22]">Open</button></form>
    {err && <p data-testid="rw-evidence-error" className="text-xs text-rose-400">{err}</p>}
    {flash && <p data-testid="rw-evidence-flash" className="rounded-sm bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-300">{flash}</p>}
    {job ? <Card title={<span className="inline-flex items-center gap-2"><Link to={`/rw/jobs/${job.id}`} className="font-mono hover:underline">{job.number}</Link><StatusPill status={job.status} /><WorkflowBadges workflow={job.workflow} /></span>} subtitle={`${fullName(job.client)} · ${job.watch.brand} ${job.watch.model} · ${job.watch.reference} / ${job.watch.serial}`} testId="rw-evidence-job"><EvidencePanel job={job} run={run} /></Card>
      : <Card title="Waiting for evidence" subtitle="Jobs in testing — tap to open the slots" testId="rw-evidence-queue" bodyClassName="p-0"><ul className="divide-y divide-line/70">{queue.map((j) => { const gaps = api.evidenceGaps(j); const req = api.EVIDENCE_REQUIRED[j.kind]; return <li key={j.id}><button data-testid={`rw-evidence-pick-${j.id}`} onClick={() => setParams({ job: j.id })} className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs hover:bg-canvas"><span className="font-mono font-semibold text-ink">{j.number}</span><span className="flex-1 truncate text-ink-700">{fullName(j.client)} · {j.watch.model}</span><span className={`font-mono text-[10px] ${gaps.length ? 'text-amber-300' : 'text-emerald-300'}`}>{req.length - gaps.length}/{req.length} slots</span></button></li>; })}{!queue.length && <li className="px-4 py-6 text-center text-xs text-ink-400">Nothing in testing.</li>}</ul></Card>}
  </div>;
}
