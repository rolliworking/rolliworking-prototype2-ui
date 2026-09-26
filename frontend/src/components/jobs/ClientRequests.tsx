import { Check, MessageSquareWarning, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { ClientRequest, ClientRequestAlert, JobWithRefs } from '@/api/client';
import { fmtDate, fmtTime } from '@/lib/format';

type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;
const when = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`;

// High-visibility amber badge — cards on the pad / bench, job page header
export const ClientRequestBadge = ({ n, testId, big }: { n: number; testId?: string; big?: boolean }) => (n > 0 ? (
  <span data-testid={testId} className={`inline-flex items-center gap-1.5 rounded-full bg-amber-400 font-bold uppercase tracking-wide text-[#161b22] ${big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[10px]'}`}><MessageSquareWarning size={big ? 16 : 11} /> Client requests ({n})</span>
) : null);

// Requests listed right on a card — never buried in a tab
export const ClientRequestList = ({ job, testId }: { job: JobWithRefs; testId?: string }) => {
  const open = api.openClientRequests(job); if (!open.length) return null;
  return <div data-testid={testId ?? `client-requests-${job.id}`} className="rounded-2xl border border-amber-400/50 bg-amber-400/10 p-3"><ClientRequestBadge n={open.length} big />
    <ul className="mt-2 space-y-1.5">{open.map((r) => <li key={r.id} data-testid={`client-request-${r.id}`} className="flex items-start gap-2 text-base leading-snug text-amber-50"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />{r.text}</li>)}</ul></div>;
};

// Mandatory QC checklist: every request → Done, or N/A with a required reason. Check-offs log who / when.
export const QcRequestChecklist = ({ job, run, dark }: { job: JobWithRefs; run: Run; dark?: boolean }) => {
  const [na, setNa] = useState<string | null>(null); const [reason, setReason] = useState('');
  const reqs = job.clientRequests ?? []; const gaps = api.qcRequestGaps(job);
  const btn = `inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3 text-sm font-semibold ${dark ? 'border border-white/20 text-slate-100 hover:bg-white/10' : 'border border-line bg-surface text-ink hover:bg-canvas'}`;
  return <div data-testid={`qc-checklist-${job.id}`} className="space-y-2">
    {gaps.length > 0 && <p data-testid={`qc-checklist-gate-${job.id}`} className={`rounded-xl px-3 py-2 text-sm font-semibold ${dark ? 'bg-rose-950/60 text-rose-200' : 'bg-rose-50 text-rose-800'}`}>QC cannot complete — unchecked: “{gaps[0].text}”{gaps.length > 1 && ` (+${gaps.length - 1} more)`}</p>}
    <ul className="space-y-1.5">{reqs.map((r) => <li key={r.id} data-testid={`qc-item-${r.id}`} className={`rounded-xl border p-2.5 ${r.check ? (dark ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-moss-200 bg-moss-50/60') : dark ? 'border-amber-400/50 bg-amber-400/10' : 'border-amber-300 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center gap-2"><span className={`flex-1 text-base ${dark ? 'text-white' : 'text-ink'} ${r.check ? 'line-through opacity-70' : ''}`}>{r.text}</span>
        {r.check ? <><span data-testid={`qc-item-check-${r.id}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${dark ? 'bg-emerald-800 text-emerald-100' : 'bg-moss-100 text-moss-800'}`}><Check size={12} /> {r.check.result === 'done' ? 'Done' : 'N/A'} · {r.check.by} · {when(r.check.at)}</span><button data-testid={`qc-item-undo-${r.id}`} title="Reopen" onClick={() => void run(() => api.uncheckClientRequest(job.id, r.id), 'Request reopened')} className={`min-h-[36px] min-w-[36px] rounded-full ${dark ? 'text-slate-400 hover:bg-white/10' : 'text-ink-400 hover:bg-canvas'}`}><RotateCcw size={14} className="mx-auto" /></button></>
          : <><button data-testid={`qc-item-done-${r.id}`} onClick={() => void run(() => api.checkClientRequest(job.id, r.id, 'done'), 'Checked off · done')} className={`${btn} ${dark ? '!bg-amber-400 !text-[#161b22] !border-transparent' : '!bg-ink !text-white'}`}><Check size={14} /> Done</button><button data-testid={`qc-item-na-${r.id}`} onClick={() => { setNa(na === r.id ? null : r.id); setReason(''); }} className={btn}>N/A…</button></>}</div>
      {r.check?.reason && <p className={`mt-1 text-xs ${dark ? 'text-slate-300' : 'text-ink-600'}`}>Reason: {r.check.reason}</p>}
      {na === r.id && !r.check && <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => api.checkClientRequest(job.id, r.id, 'na', reason), 'Checked off · N/A').then(() => setNa(null)); }}><input data-testid={`qc-item-na-reason-${r.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does this not apply? (required)" className={`min-h-[40px] flex-1 rounded-xl border px-3 text-sm ${dark ? 'border-white/15 bg-[#0f131a] text-slate-100' : 'border-line bg-canvas text-ink'}`} /><button data-testid={`qc-item-na-confirm-${r.id}`} disabled={!reason.trim()} className={`${btn} disabled:opacity-40`}>Mark N/A</button></form>}
    </li>)}</ul>
  </div>;
};

// Staff / bench job page section: add, remove, and (in testing) the QC checklist. Visually far from internal notes.
export const ClientRequestsPanel = ({ job, run, dark }: { job: JobWithRefs; run: Run; dark?: boolean }) => {
  const [text, setText] = useState(''); const reqs = job.clientRequests ?? []; const open = api.openClientRequests(job);
  const add = () => { if (!text.trim()) return; void run(() => api.addClientRequest(job.id, text), 'Client request added').then(() => setText('')); };
  return <div data-testid="client-requests-panel" className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><ClientRequestBadge n={open.length} testId="client-requests-badge" />{!open.length && <span className={`text-xs ${dark ? 'text-slate-400' : 'text-ink-500'}`}>{reqs.length ? 'All requests checked off' : 'Nothing recorded from the client yet'}</span>}<span className={`ml-auto text-[11px] ${dark ? 'text-amber-200/80' : 'text-amber-800'}`}>Pops on every label scan · mandatory checklist at QC</span></div>
    {job.status === 'testing' && reqs.length > 0 ? <QcRequestChecklist job={job} run={run} dark={dark} /> : <ul className="space-y-1.5">{reqs.map((r) => <li key={r.id} data-testid={`client-request-row-${r.id}`} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${r.check ? (dark ? 'border-white/10 text-slate-400' : 'border-line text-ink-500') : dark ? 'border-amber-400/50 bg-amber-400/10 text-amber-50' : 'border-amber-300 bg-amber-50 text-ink'}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.check ? 'bg-slate-400' : 'bg-amber-400'}`} /><span className={`flex-1 ${r.check ? 'line-through' : ''}`}>{r.text}<span className={`ml-2 text-[11px] ${dark ? 'text-slate-400' : 'text-ink-400'}`}>— {r.by} · {fmtDate(r.at)}{r.acks.length > 0 && ` · seen ${r.acks.length}× (last ${r.acks[r.acks.length - 1].by})`}{r.check && ` · ${r.check.result === 'done' ? 'done' : 'N/A'} by ${r.check.by}`}</span></span>
      {!r.check && <button data-testid={`client-request-remove-${r.id}`} title="Remove" onClick={() => void run(() => api.removeClientRequest(job.id, r.id), 'Client request removed')} className={`min-h-[28px] min-w-[28px] rounded-full ${dark ? 'text-slate-400 hover:bg-white/10' : 'text-ink-400 hover:bg-canvas'}`}><Trash2 size={13} className="mx-auto" /></button>}
    </li>)}</ul>}
    {job.status !== 'closed' && <div className="flex gap-1.5"><input data-testid="client-request-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="What did the client ask for? e.g. Photograph movement before casing — Enter to add" className={`h-9 flex-1 rounded-xl border px-3 text-[13px] focus:outline-none ${dark ? 'border-amber-400/40 bg-[#0f131a] text-slate-100 focus:border-amber-400' : 'border-amber-300 bg-amber-50/60 text-ink focus:border-amber-500'}`} /><button data-testid="client-request-add" onClick={add} className="inline-flex h-9 items-center gap-1 rounded-xl bg-amber-400 px-3 text-[13px] font-semibold text-[#161b22]"><Plus size={13} /> Add</button></div>}
  </div>;
};

// The scan pop-up: demands attention until "Understood" — which logs who saw it and when. Re-surfaces on every scan while requests stay open.
export const ClientRequestModal = ({ alert, via, onClose }: { alert: ClientRequestAlert; via: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4"><div data-testid="client-request-modal" className="w-full max-w-2xl space-y-5 rounded-3xl border-4 border-amber-400 bg-[#1f2630] p-7 text-slate-100 shadow-2xl">
    <div className="flex items-start gap-3"><MessageSquareWarning size={36} className="shrink-0 text-amber-400" /><div className="flex-1"><div className="text-xs font-bold uppercase tracking-widest text-amber-300">Client requests · read before you touch it</div><div className="mt-1 font-mono text-3xl font-semibold text-white">{alert.jobNumber}</div><div className="text-lg text-slate-300">{alert.watchLabel}</div></div></div>
    <ol className="space-y-3">{alert.requests.map((r: ClientRequest, i) => <li key={r.id} data-testid={`client-request-modal-item-${r.id}`} className="flex items-start gap-4 rounded-2xl bg-amber-400/10 p-4 text-2xl leading-snug text-white"><span className="font-mono text-amber-300">{i + 1}.</span>{r.text}</li>)}</ol>
    <button data-testid="client-request-understood" autoFocus onClick={() => { void api.ackClientRequests(alert.jobId, via).then(onClose); }} className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-amber-400 text-2xl font-bold text-[#161b22] active:scale-[0.99]"><Check size={28} /> Understood</button>
    <p className="text-center text-xs text-slate-500">The scan already registered. Tapping Understood logs your name and the time on each request.</p>
  </div></div>
);
