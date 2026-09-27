import { AlertTriangle, RotateCcw, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { JobPartsView, PadPartsContext } from '@/api/client';
import { ScanInput } from '@/components/rw/RwBits';
import { fmtMoney, fmtTime } from '@/lib/format';
import { Big } from './PadBits';

type Say = (m: string, tone?: 'ok' | 'learn' | 'err') => void;

// Quick Add — the fast, no-approval path: watch already scanned (ctx) → scan part → saved. Over-allowance additions route to pending approval.
export const PadQuickAdd = ({ ctx, say, tick, isManager }: { ctx: PadPartsContext; say: Say; tick: number; isManager: boolean }) => {
  const [v, setV] = useState<JobPartsView | null>(null); const [note, setNote] = useState(''); const [returning, setReturning] = useState<string | null>(null); const [allow, setAllow] = useState('');
  const load = () => api.getJobParts(ctx.job.id).then(setV);
  useEffect(() => { void load(); }, [ctx.job.id, tick]);
  if (!v) return null;
  const pct = Math.min(100, Math.round((v.used / v.allowance) * 100)); const near = v.used >= v.allowance * 0.8; const over = v.used > v.allowance;
  return <section data-testid="pad-quick-add" className={`rounded-[28px] border p-4 ${over ? 'border-rose-500/60 bg-rose-950/20' : near ? 'border-amber-400/60 bg-amber-400/5' : 'border-emerald-500/30 bg-[#1f2630]'}`}>
    <div className="flex flex-wrap items-center gap-3"><Zap size={20} className="text-emerald-300" /><h3 className="text-lg font-semibold text-white">Quick Add · straight onto {ctx.job.number}</h3><span className="text-sm text-slate-400">no approval while under the job’s allowance</span>
      <span className="ml-auto text-sm text-slate-300">parts <span data-testid="qa-used" className="font-mono text-lg text-white">{fmtMoney(v.used)}</span> of <button data-testid="qa-allowance" onClick={() => isManager && setAllow(allow ? '' : String(v.allowance))} className={`font-mono text-white ${isManager ? 'underline decoration-dotted' : ''}`}>{fmtMoney(v.allowance)}</button> · <span data-testid="qa-remaining" className={`font-mono ${over ? 'text-rose-300' : near ? 'text-amber-300' : 'text-emerald-300'}`}>{fmtMoney(v.remaining)} left</span></span></div>
    {allow && <form data-testid="qa-allowance-form" className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); api.setJobPartsAllowance(ctx.job.id, Number(allow)).then(() => { setAllow(''); say('Allowance updated'); void load(); }).catch((x) => say(x.message, 'err')); }}><input data-testid="qa-allowance-input" inputMode="numeric" value={allow} onChange={(e) => setAllow(e.target.value)} className="min-h-[44px] w-32 rounded-xl border border-white/15 bg-[#0f131a] px-3 font-mono text-white" /><button data-testid="qa-allowance-save" className="min-h-[44px] rounded-xl bg-amber-400 px-4 font-semibold text-[#161b22]">Set ($300–$1,000)</button></form>}
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${over ? 'bg-rose-500' : near ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>
    {(near || over) && <p data-testid="qa-allowance-flag" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-amber-300"><AlertTriangle size={16} /> {over ? 'Over the allowance — further parts route to approval' : 'Near the allowance — the next part may need approval'}</p>}
    <div className="mt-3"><ScanInput big testId="qa-scan" placeholder="Scan part barcode / part # → saved to the job" onScan={async (code) => { try { const r = await api.quickAddPart(ctx.job.id, code); if (r.kind === 'added') say(`${r.part.partNumber} added · ${fmtMoney(r.part.price)} · ${fmtMoney(r.view.remaining)} left`); else say(`${r.part.partNumber} would exceed the allowance → ${r.requestNumber} pending approval`, 'learn'); setV(r.view); } catch (x) { say(x instanceof Error ? x.message : 'Failed', 'err'); } }} /></div>
    <ul data-testid="qa-parts" className="mt-3 divide-y divide-white/5">{v.parts.map((p) => <li key={p.id} data-testid={`qa-part-${p.id}`} className="flex flex-wrap items-center gap-3 py-2"><span className="font-mono text-white">{p.partNumber}</span><span className="flex-1 text-slate-200">{p.name} <span className="text-slate-500">×{p.qty}</span></span><span className="font-mono text-white">{fmtMoney(p.price * p.qty)}</span><span className="text-xs text-slate-500">{p.addedBy} · {fmtTime(p.at)}</span>
      {returning === p.id ? <span className="flex w-full gap-2 sm:w-auto"><input data-testid={`qa-return-note-${p.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional) — didn’t need it after all" className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-[#0f131a] px-3 text-sm text-white" /><Big testId={`qa-return-confirm-${p.id}`} tone="warn" onClick={() => api.returnJobPart(p.id, note).then((nv) => { setV(nv); setReturning(null); setNote(''); say(`${p.partNumber} returned to stock`); }).catch((x) => say(x.message, 'err'))}>Return</Big></span>
        : <button data-testid={`qa-return-${p.id}`} onClick={() => setReturning(p.id)} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/15 px-3 text-sm text-slate-200"><RotateCcw size={14} /> Return</button>}</li>)}{!v.parts.length && <li className="py-3 text-center text-sm text-slate-500">No parts on this job yet — scan one.</li>}</ul>
    {v.returns.length > 0 && <ul data-testid="qa-returns" className="mt-2 text-xs text-slate-500">{v.returns.map((r) => <li key={r.id} data-testid={`qa-returned-${r.id}`}>↩ {r.partNumber} ×{r.qty} returned by {r.by} {fmtTime(r.at)}{r.note && ` · “${r.note}”`}</li>)}</ul>}
  </section>;
};
