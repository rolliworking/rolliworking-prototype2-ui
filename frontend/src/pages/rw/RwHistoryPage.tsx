import { History, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { RwHistoryHit } from '@/api/client';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { fmtDate, fullName } from '@/lib/format';

const KIND_CLS: Record<string, string> = { job: 'bg-sky-900/60 text-sky-200', estimate: 'bg-violet-900/60 text-violet-200', sales_order: 'bg-emerald-900/60 text-emerald-200', request: 'bg-amber-900/60 text-amber-200' };

// Client / job history lookup inside RolliWorking — every watch the client has brought us, every record on it. No dollar amounts.
export default function RwHistoryPage() {
  const [params, setParams] = useSearchParams(); const q = params.get('q') ?? ''; const [draft, setDraft] = useState(q); const [hits, setHits] = useState<RwHistoryHit[]>([]); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.searchRwHistory(q).then((h) => { setHits(h); setOpen(h[0]?.client.id ?? null); }); }, [q]);
  return <div data-testid="rw-history-page" className="space-y-3">
    <div><h1 className="flex items-center gap-2 text-lg font-semibold text-white"><History size={18} className="text-amber-400" /> Client / job history</h1><p className="text-xs text-slate-400">Type a client name, job number, reference or serial → every watch and every record we hold on it. Read-only · <span className="text-amber-300">no dollar amounts in RolliWorking</span>.</p></div>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setParams(draft ? { q: draft } : {}); }}><div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" /><input data-testid="rw-history-search" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Calloway · E02041 · 126334 · serial" className="w-full rounded-md border border-white/10 bg-[#0f131a] py-2 pl-8 pr-3 text-sm text-slate-100" /></div><button data-testid="rw-history-go" className="rounded-md bg-amber-400 px-4 text-sm font-semibold text-[#161b22]">Look up</button></form>
    {q && <div data-testid="rw-history-count" className="text-[11px] text-slate-400">{hits.length} client{hits.length === 1 ? '' : 's'} match “{q}”</div>}
    <ul className="space-y-2">{hits.map((h) => <li key={h.client.id} data-testid={`rw-history-client-${h.client.id}`} className="rounded-md border border-white/10 bg-[#1f2630]">
      <button data-testid={`rw-history-toggle-${h.client.id}`} onClick={() => setOpen(open === h.client.id ? null : h.client.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm"><span className="font-semibold text-white">{fullName(h.client)}</span>{h.client.company && <span className="text-slate-400">{h.client.company}</span>}<RatingBadge clientId={h.client.id} testId={`rw-history-rating-${h.client.id}`} /><span className="ml-auto text-xs text-slate-400">{h.watches.length} watch{h.watches.length === 1 ? '' : 'es'} · {h.jobs} job{h.jobs === 1 ? '' : 's'}{h.openRequests ? ` · ${h.openRequests} open request${h.openRequests === 1 ? '' : 's'}` : ''} · since {fmtDate(h.client.since)}</span></button>
      {open === h.client.id && <div className="space-y-2 border-t border-white/10 p-3">{h.watches.map((w) => <div key={w.watch.id} data-testid={`rw-history-watch-${w.watch.id}`} className="rounded-md bg-[#0f131a] p-2.5">
        <div className="flex items-center gap-2 text-sm"><span className="font-semibold text-white">{w.watch.brand} {w.watch.model}</span><span className="font-mono text-xs text-slate-400">{w.watch.reference} · {w.watch.serial}</span>{w.activeJobId && <Link to={`/rw/jobs/${w.activeJobId}`} data-testid={`rw-history-active-${w.watch.id}`} className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-[#161b22]">in house → open job</Link>}</div>
        <ul className="mt-1.5 divide-y divide-white/5">{w.rows.map((r) => <li key={r.id} className="flex items-center gap-2 py-1 text-xs"><span className={`w-16 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase ${KIND_CLS[r.kind]}`}>{r.kind.replace('_', ' ')}</span>{r.kind === 'job' ? <Link to={`/rw/jobs/${r.id}`} className="font-mono font-semibold text-slate-100 hover:underline">{r.number}</Link> : <span className="font-mono text-slate-300">{r.number}</span>}<span className="flex-1 truncate text-slate-300">{r.title}</span>{r.legacy && <span className="rounded bg-white/10 px-1 text-[9px] uppercase text-slate-400">legacy</span>}<span className="text-slate-500">{r.status}</span><span className="w-20 text-right text-slate-500">{fmtDate(r.at)}</span></li>)}{!w.rows.length && <li className="py-1 text-xs text-slate-500">No records yet</li>}</ul>
      </div>)}{!h.watches.length && <p className="text-xs text-slate-500">No watches on file.</p>}</div>}
    </li>)}{q && !hits.length && <li className="rounded-md border border-white/10 px-3 py-6 text-center text-xs text-slate-500">Nothing matches in this division</li>}</ul>
  </div>;
}
