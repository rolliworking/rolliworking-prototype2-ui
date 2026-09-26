import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { PartsRequestWithRefs } from '@/api/client';
import { Chip, Sheet, statusTone } from './PadBits';
import { fmtDate, fmtTime } from '@/lib/format';

type Row = PartsRequestWithRefs & { stageLabel: string };
const STAGES = ['pending review', 'awaiting client', 'approved', 'declined', 'on order', 'received', 'picked'];
const tone = (l: string) => statusTone(l === 'picked' ? 'received' : l.replace(' ', '_'));

export const HistoryRow = ({ r, onOpen, compact }: { r: Row; onOpen: (r: Row) => void; compact?: boolean }) => (
  <button data-testid={`pad-hist-${r.id}`} onClick={() => onOpen(r)} className={`flex w-full items-center gap-3 rounded-2xl px-4 text-left hover:bg-white/5 active:bg-white/10 ${compact ? 'min-h-[48px]' : 'min-h-[60px]'}`}>
    <span className="flex-1"><span className={`${compact ? 'text-sm' : 'text-base'} text-white`}>{r.part?.name ?? r.items?.map((i) => i.description).join(', ')}</span>{!compact && <span className="ml-2 font-mono text-xs text-slate-500">{r.part?.partNumber ?? 'generic'}</span>}<span className="block text-xs text-slate-500">{r.number} · {r.job.number} · {r.watch.brand} {r.watch.model} · {r.requestedBy} · {fmtDate(r.requestedAt)}</span></span>
    <Chip tone={tone(r.stageLabel)} testId={`pad-hist-status-${r.id}`}>{r.stageLabel}</Chip>
  </button>
);

export const HistoryDetail = ({ r, onClose }: { r: Row; onClose: () => void }) => (
  <Sheet testId="pad-hist-detail" title={<span className="font-mono">{r.number}</span>} sub={<>{r.job.number} · {r.watch.brand} {r.watch.model} <span className="font-mono">{r.watch.reference}</span> · <Chip tone={tone(r.stageLabel)}>{r.stageLabel}</Chip></>} onClose={onClose}>
    <ul className="mb-4 space-y-1 text-base text-slate-200">{(r.items ?? [{ description: r.part?.name ?? 'part', qty: r.qty, partNumber: r.part?.partNumber }]).map((i, k) => <li key={k} className="flex justify-between"><span>{i.description} ×{i.qty}</span><span className="font-mono text-sm text-slate-400">{i.partNumber ?? 'generic'}</span></li>)}</ul>
    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Who touched it</h3>
    <ol data-testid="pad-hist-steps" className="space-y-2">{[...(r.history ?? [])].reverse().map((h, i) => <li key={i} className="flex gap-3 rounded-2xl bg-white/5 px-4 py-2"><span className="w-36 shrink-0 font-mono text-xs text-slate-400">{fmtDate(h.at)} {fmtTime(h.at)}</span><span className="flex-1 text-sm text-slate-100"><b>{h.by}</b> · {h.action}<span className="block text-xs text-slate-500">{h.station}</span></span></li>)}{!r.history?.length && <li className="text-slate-500">No steps recorded.</li>}</ol>
  </Sheet>
);

// History segment: every past request in the room, filter by status / job, search a part name to see everywhere it was requested
export const PadHistory = ({ tick }: { tick: number }) => {
  const [rows, setRows] = useState<Row[]>([]); const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [job, setJob] = useState(''); const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => { api.getRoomPartsHistory().then(setRows); }, [tick]);
  const jobs = [...new Map(rows.map((r) => [r.job.id, r.job.number])).entries()];
  const list = rows.filter((r) => (!status || r.stageLabel === status) && (!job || r.job.id === job) && (!q.trim() || `${r.part?.name ?? ''} ${r.part?.partNumber ?? ''} ${r.items?.map((i) => i.description).join(' ') ?? ''} ${r.number}`.toLowerCase().includes(q.trim().toLowerCase())));
  const sel = 'min-h-[48px] rounded-2xl border border-white/15 bg-[#0f131a] px-3 text-base text-slate-100';
  return <div data-testid="pad-history" className="space-y-3">
    <div className="flex flex-wrap gap-2"><div className="relative min-w-[260px] flex-1"><Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input data-testid="pad-hist-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a part name — everywhere it's been requested" className={`${sel} w-full pl-11`} /></div>
      <select data-testid="pad-hist-status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="">All statuses</option>{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <select data-testid="pad-hist-job" value={job} onChange={(e) => setJob(e.target.value)} className={sel}><option value="">All jobs</option>{jobs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
    <div className="divide-y divide-white/5 rounded-[28px] border border-white/10 bg-[#1f2630]">{list.map((r) => <HistoryRow key={r.id} r={r} onOpen={setOpen} />)}{!list.length && <p className="px-4 py-8 text-center text-slate-500">No requests match.</p>}</div>
    {open && <HistoryDetail r={open} onClose={() => setOpen(null)} />}
  </div>;
};

// Compact list inside the composer: what's already been asked for on this watch
export const PastOnJob = ({ jobId, tick }: { jobId: string; tick: number }) => {
  const [rows, setRows] = useState<Row[]>([]); const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => { api.getRoomPartsHistory().then((all) => setRows(all.filter((r) => r.job.id === jobId))); }, [jobId, tick]);
  if (!rows.length) return null;
  return <div data-testid="pad-past-on-job" className="rounded-[28px] border border-white/10 bg-[#1f2630] p-3"><div className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Past requests on this job · {rows.length}</div><div className="divide-y divide-white/5">{rows.slice(0, 5).map((r) => <HistoryRow key={r.id} r={r} onOpen={setOpen} compact />)}</div>{open && <HistoryDetail r={open} onClose={() => setOpen(null)} />}</div>;
};
