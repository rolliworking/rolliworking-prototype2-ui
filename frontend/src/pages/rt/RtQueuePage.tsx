import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { fmtDate } from '@/lib/format';

export default function RtQueuePage() {
  const nav = useNavigate(); const [queue, setQueue] = useState<JobWithRefs[]>([]); const [scan, setScan] = useState(''); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.getTestingQueue().then(setQueue); }, []);
  const go = async () => { const j = await api.findJobByLabel(scan); if (!j) { setErr('No job matches that label'); return; } if (j.status !== 'testing') { setErr(`${j.number} is ${j.status.replace(/_/g, ' ')} — only jobs in testing can be timed`); return; } nav(`/rt/test/${j.id}`); };
  return <div data-testid="rt-queue-page" className="mx-auto max-w-4xl space-y-4">
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setErr(null); void go(); }}><input data-testid="rt-scan" autoFocus value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Scan or enter the watch label — job #, ref/serial, or PDF417 payload" className="flex-1 rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm" /><Button variant="primary" data-testid="rt-scan-go">Open</Button></form>
    {err && <p data-testid="rt-scan-error" className="text-xs text-rose-700">{err}</p>}
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs"><span className="font-semibold text-ink">Testing queue</span><span data-testid="rt-queue-count" className="text-ink-500">{queue.length} job{queue.length === 1 ? '' : 's'} in testing · oldest first</span></div>
      <ul className="divide-y divide-line/70">{queue.map((j) => <li key={j.id}><button data-testid={`rt-queue-${j.id}`} onClick={() => nav(`/rt/test/${j.id}`)} className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-xs hover:bg-canvas"><span className="w-20 font-mono font-semibold text-ink">{j.number}</span><span className="flex-1">{j.watch.brand} {j.watch.model} <span className="font-mono text-ink-400">{j.watch.reference}</span> · {j.client.lastName}</span><span className="text-ink-500">{api.toleranceForWatch(j.watch).label}</span><span className="text-ink-400">{j.assignees.join(', ') || 'unassigned'} · since {fmtDate(j.createdAt)}</span></button></li>)}{!queue.length && <li className="px-4 py-6 text-center text-xs text-ink-400">Nothing in testing</li>}</ul>
    </div>
  </div>;
}
