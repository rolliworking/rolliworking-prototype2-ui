import { Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { BenchView, PartsRequestWithRefs } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PartsRequestModal, PartsRequestPill } from '@/components/parts/PartsChat';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtTime } from '@/lib/format';

export default function RwPartsPage() {
  const { user } = useAuth();
  const [v, setV] = useState<BenchView | null>(null); const [all, setAll] = useState<PartsRequestWithRefs[]>([]); const [open, setOpen] = useState<PartsRequestWithRefs | null>(null); const [jobId, setJobId] = useState(''); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([api.getBenchView().then(setV), api.getPartsRequests().then(setAll)]), []);
  useEffect(() => { void load(); }, [load, user?.id]);
  const mine = all.filter((r) => r.requestedBy === user?.shortName);
  const start = async () => { if (!jobId) return; try { setOpen(await api.openPartsRequest(jobId)); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return <div data-testid="rw-parts-page" className="space-y-3">
    <div><h1 className="text-lg font-semibold text-white">Parts</h1><p className="text-xs text-slate-400">Request a part from one of your jobs, work the scripted lookup assistant, then the supervisor approves. Status flows back here and onto the job.</p></div>
    <div className="grid grid-cols-[1fr_380px] gap-3">
      <Card title="My requests" subtitle={`${mine.length} requested by ${user?.shortName} · newest first`} testId="rw-parts-mine" bodyClassName="p-0">
        <ul className="divide-y divide-line/70">{mine.map((r) => <li key={r.id}><button type="button" data-testid={`rw-pr-${r.id}`} onClick={() => setOpen(r)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs hover:bg-canvas"><Wrench size={11} className="text-ink-400" /><span className="font-mono font-medium text-ink">{r.number}</span><span className="font-mono text-ink">{r.part?.partNumber ?? 'no part yet'}</span><span className="flex-1 truncate text-ink-700">{r.part?.name ?? 'lookup in progress'} · <Link to={`/rw/jobs/${r.job.id}`} className="text-brand hover:underline">{r.job.number}</Link> · {r.watch.model}</span><span className="text-ink-400">{fmtDate(r.requestedAt)} {fmtTime(r.requestedAt)}</span><PartsRequestPill status={r.status} /></button></li>)}{v && !mine.length && <li className="px-4 py-4 text-xs text-ink-400">No requests yet — start one on the right.</li>}</ul>
      </Card>
      <div className="space-y-3">
        <Card title="New request" subtitle="Pick one of your bench jobs" testId="rw-parts-new" accent="moss">
          <div className="flex gap-2"><select data-testid="rw-parts-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className="flex-1 rounded-md border border-line px-2 py-1.5 text-xs"><option value="">Choose a job…</option>{v?.jobs.map((j) => <option key={j.id} value={j.id}>{j.number} · {j.watch.model}</option>)}</select><button data-testid="rw-parts-start" disabled={!jobId} onClick={start} className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Open</button></div>
          {err && <p data-testid="rw-parts-error" className="mt-2 text-xs text-rose-400">{err}</p>}
          {v && !v.jobs.length && <p className="mt-2 text-xs text-ink-400">Nothing on your bench — pull a job first.</p>}
        </Card>
        <Card title="Shop-wide" subtitle={`${all.filter((r) => r.status === 'pending').length} pending approval · ${all.length} total`} testId="rw-parts-all" bodyClassName="p-0">
          <ul className="divide-y divide-line/70">{all.slice(0, 8).map((r) => <li key={r.id} className="flex items-center gap-2 px-4 py-1.5 text-[11px]"><span className="font-mono text-ink">{r.number}</span><span className="truncate text-ink-500">{r.requestedBy} · {r.job.number}</span><span className="ml-auto"><PartsRequestPill status={r.status} /></span></li>)}</ul>
        </Card>
      </div>
    </div>
    {open && <PartsRequestModal request={open} onClose={() => { setOpen(null); void load(); }} onChange={setOpen} />}
  </div>;
}
