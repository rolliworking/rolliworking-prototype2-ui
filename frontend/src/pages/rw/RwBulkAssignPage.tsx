import { Mail, Undo2, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { OutboxEmail, ScanSession } from '@/api/client';
import { ScanInput } from '@/components/rw/RwBits';
import { fmtTime } from '@/lib/format';

// Morning handout: scan TECH-<short> once, then watch labels — each label = custody + assign + start service
export default function RwBulkAssignPage() {
  const [s, setS] = useState<ScanSession>(api.getScanSession()); const [outbox, setOutbox] = useState<OutboxEmail[]>([]); const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(() => api.getQueuedOutbox().then(setOutbox), []);
  useEffect(() => { void load(); }, [load]);
  const scan = async (code: string) => {
    if (api.parseTechCode(code)) { setS({ ...(await api.scanTech(code)) }); setFlash(`Active tech: ${api.parseTechCode(code)!.shortName}`); return; }
    const next = await api.scanLabelAssign(code); setS({ ...next }); setFlash(`${next.rows[0].jobNumber} → ${next.tech!.shortName} · ${next.rows[0].part} · started`); await load();
  };
  const techs = api.getDivisionStaff(api.getSessionDivision());
  return <div data-testid="rw-bulk-page" className="space-y-3">
    <div><h1 className="text-lg font-semibold text-white">Bulk Assign — morning handout</h1><p className="text-xs text-slate-400">Step 1 scan a TECH code · Step 2 scan watch labels one after another. Each label transfers custody, assigns the job + part, and starts service — no confirm buttons. Band-only labels (<span className="font-mono">BAND-…</span> or payload ending <span className="font-mono">|B</span>) create the bracelet component and tag the band department.</p></div>
    <div className="grid grid-cols-[1fr_360px] gap-3">
      <div className="space-y-3">
        <div data-testid="bulk-active-tech" className={`flex items-center gap-4 rounded-xl border p-4 ${s.tech ? 'border-amber-400/60 bg-amber-400/10' : 'border-dashed border-white/15'}`}><UserCheck size={36} className={s.tech ? 'text-amber-300' : 'text-slate-600'} /><div><div className="text-[10px] uppercase tracking-wide text-slate-400">Active tech</div><div data-testid="bulk-active-tech-name" className="text-3xl font-semibold text-white">{s.tech ? s.tech.shortName : 'Scan TECH code'}</div>{s.tech && <div className="text-xs text-slate-300">{s.tech.dutyLabel} · {s.rows.length} watch{s.rows.length === 1 ? '' : 'es'} handed out this session</div>}</div>
          <div className="ml-auto flex flex-wrap gap-1">{techs.map((u) => <button key={u.id} data-testid={`bulk-tech-code-${u.shortName.toLowerCase()}`} onClick={() => void scan(`TECH-${u.shortName.toUpperCase()}`)} className="rounded-full border border-white/15 px-2 py-1 font-mono text-[10px] text-slate-300 hover:bg-white/10">TECH-{u.shortName.toUpperCase()}</button>)}</div></div>
        <ScanInput big testId="bulk-scan" placeholder={s.tech ? 'Scan watch label (job #, ref/serial, PDF417 payload, BAND-…)' : 'Scan TECH-MM / TECH-WALTER …'} onScan={scan} />
        {flash && <p data-testid="bulk-flash" className="rounded-md bg-emerald-950/60 px-3 py-2 text-sm text-emerald-300">{flash}</p>}
        <div className="rounded-md border border-white/10 bg-[#1f2630]"><div className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">Session list</div>
          <table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="px-3 py-1.5">Time</th><th className="px-3 py-1.5">Job</th><th className="px-3 py-1.5">Watch</th><th className="px-3 py-1.5">Part</th><th className="px-3 py-1.5">Email</th></tr></thead>
            <tbody className="divide-y divide-white/5">{s.rows.map((r, i) => <tr key={i} data-testid={`bulk-row-${r.jobId}`}><td className="px-3 py-1.5 font-mono text-slate-400">{fmtTime(r.at)}</td><td className="px-3 py-1.5"><Link to={`/rw/jobs/${r.jobId}`} className="font-mono text-amber-300 hover:underline">{r.jobNumber}</Link></td><td className="px-3 py-1.5 text-slate-200">{r.watchLabel}</td><td className="px-3 py-1.5 text-slate-200">{r.part}</td><td className="px-3 py-1.5 text-slate-400">{r.outboxId ? 'queued' : 'withdrawn'}</td></tr>)}{!s.rows.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nothing scanned yet this session.</td></tr>}</tbody></table></div>
      </div>
      <aside data-testid="bulk-outbox" className="rounded-md border border-white/10 bg-[#1f2630]"><div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs font-semibold text-slate-200"><Mail size={13} /> Courtesy emails queued (Outbox — nothing sends) <span className="ml-auto font-mono text-slate-400">{outbox.length}</span></div>
        <ul className="divide-y divide-white/5 text-xs">{outbox.map((e) => <li key={e.id} data-testid={`bulk-outbox-${e.id}`} className="flex items-start gap-2 px-3 py-2"><div className="flex-1"><div className="text-slate-100">{e.subject}</div><div className="text-slate-500">to {e.toName} · {fmtTime(e.createdAt)} · {e.createdBy}</div></div><button data-testid={`bulk-undo-${e.id}`} onClick={async () => { await api.undoOutbox(e.id); setS({ ...api.getScanSession() }); await load(); }} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"><Undo2 size={10} /> Undo</button></li>)}{!outbox.length && <li className="px-3 py-6 text-center text-slate-500">Outbox empty.</li>}</ul></aside>
    </div>
  </div>;
}
