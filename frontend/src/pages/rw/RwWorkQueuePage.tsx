import { MessageSquareReply } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobStatus, WorkQueueRow } from '@/api/client';
import { KindPill } from '@/components/jobs/JobBits';
import { PartDot } from '@/components/rw/RwBits';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fullName } from '@/lib/format';

export default function RwWorkQueuePage() {
  const nav = useNavigate(); const [rows, setRows] = useState<WorkQueueRow[]>([]); const [status, setStatus] = useState<'' | JobStatus>(''); const [tech, setTech] = useState(''); const [overdue, setOverdue] = useState(false); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(() => api.getWorkQueue().then(setRows), []);
  useEffect(() => { void load(); }, [load]);
  const shown = rows.filter((r) => (!status || r.job.status === status) && (!tech || r.job.assignees.includes(tech)) && (!overdue || r.overdue));
  const techs = [...new Set(rows.flatMap((r) => r.job.assignees))].sort();
  return <div data-testid="rw-queue-page" className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-lg font-semibold text-white">Work Queue</h1><p className="text-xs text-slate-400">All open workshop jobs · part dots solid when that part is done, hollow when still open · no money anywhere.</p></div>
      <div className="flex items-center gap-2 text-xs">
        <select data-testid="queue-filter-status" value={status} onChange={(e) => setStatus(e.target.value as '' | JobStatus)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All statuses</option>{(['intake', 'in_review', 'awaiting_customer_approval', 'approved', 'in_service', 'testing'] as JobStatus[]).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
        <select data-testid="queue-filter-tech" value={tech} onChange={(e) => setTech(e.target.value)} className="rounded-md border border-white/10 bg-[#0f131a] px-2 py-1.5 text-slate-100"><option value="">All techs</option>{techs.map((t) => <option key={t}>{t}</option>)}</select>
        <label className="inline-flex items-center gap-1 text-slate-300"><input data-testid="queue-filter-overdue" type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> overdue only</label>
        <button data-testid="queue-simulate-reply" onClick={async () => { const id = await api.simulateClientReply(); await load(); const r = rows.find((x) => x.job.id === id); setFlash(`Client replied on ${r?.job.number ?? id} — row highlighted`); window.setTimeout(() => setFlash(null), 4000); }} className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 px-2 py-1.5 text-amber-300 hover:bg-amber-400/10"><MessageSquareReply size={12} /> Simulate client reply (demo)</button>
      </div>
    </div>
    {flash && <p data-testid="queue-flash" className="rounded-md bg-emerald-950/60 px-3 py-2 text-xs text-emerald-300">{flash}</p>}
    <div className="rounded-md border border-white/10 bg-[#1f2630]">
      <table data-testid="queue-table" className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="px-3 py-2">Job</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Watch</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Tech</th><th className="px-3 py-2">Parts</th><th className="px-3 py-2">Due</th></tr></thead>
        <tbody className="divide-y divide-white/5">{shown.map((r) => <tr key={r.job.id} data-testid={`queue-row-${r.job.id}`} onClick={() => nav(`/rw/jobs/${r.job.id}`)} className={`cursor-pointer hover:bg-white/5 ${r.clientReplied ? 'bg-amber-400/10' : ''}`}>
          <td className="px-3 py-2 font-mono font-semibold text-slate-100">{r.job.number}{r.clientReplied && <span data-testid={`queue-replied-${r.job.id}`} className="ml-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-[#161b22]">client replied</span>}</td>
          <td className="px-3 py-2 text-slate-200">{fullName(r.job.client)}</td><td className="px-3 py-2 text-slate-300">{r.job.watch.brand} {r.job.watch.model} <span className="font-mono text-slate-500">{r.job.watch.reference}</span></td>
          <td className="px-3 py-2"><KindPill kind={r.job.kind} /></td><td className="px-3 py-2"><StatusPill status={api.awaitingComponents(r.job) ? 'awaiting_components' : r.job.status} /></td><td className="px-3 py-2 text-slate-300">{r.job.assignees.join(', ') || <span className="text-slate-600">unassigned</span>}</td>
          <td className="px-3 py-2"><span className="inline-flex gap-1">{r.parts.map((p) => <PartDot key={p.key} k={p.key} hollow={!p.done} testId={`queue-part-${r.job.id}-${p.key}`} title={`${api.PART_LABELS[p.key]} · ${p.done ? 'done' : 'open'} · ${api.RW_STATIONS.find((s) => s.key === p.station)?.label}`} />)}</span></td>
          <td className={`px-3 py-2 ${r.overdue ? 'font-semibold text-rose-400' : 'text-slate-400'}`}>{r.job.dueAt ? fmtDate(r.job.dueAt) : '—'}</td></tr>)}
          {!shown.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No jobs match.</td></tr>}</tbody></table>
    </div>
  </div>;
}
