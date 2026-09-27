import { Check, CircleDashed, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { DeptCode, VerificationChain } from '@/api/client';
import { fmtDate, fmtTime } from '@/lib/format';

const CODES: DeptCode[] = ['W', 'B', 'P', 'PM'];
const CODE_CLS: Record<DeptCode, string> = { W: 'border-sky-300 bg-sky-50 text-sky-800', B: 'border-violet-300 bg-violet-50 text-violet-800', P: 'border-emerald-300 bg-emerald-50 text-emerald-800', PM: 'border-amber-300 bg-amber-50 text-amber-800' };

// Component code chips — W · B · P · PM. Auto-inferred from the lines' departments until a human toggles one; every toggle is an explicit override.
export const ComponentCodeChips = ({ value, inferred, onToggle, readOnly, testId = 'component-chips' }: { value: DeptCode[]; inferred?: boolean; onToggle?: (c: DeptCode) => void; readOnly?: boolean; testId?: string }) => (
  <div data-testid={testId} className="flex flex-wrap items-center gap-1.5">
    {CODES.map((c) => { const on = value.includes(c); return <button key={c} type="button" data-testid={`${testId}-${c}`} aria-pressed={on} disabled={readOnly} onClick={() => onToggle?.(c)} title={`${api.DEPT_LABEL[c]} → ${api.DEPT_COMPONENTS[c].join(' + ')}`} className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 font-mono text-xs font-semibold transition-colors ${on ? CODE_CLS[c] : 'border-line bg-canvas text-ink-400'} ${readOnly ? 'cursor-default' : 'hover:border-ink-400'}`}>{on ? <Check size={11} /> : <Plus size={11} />}{c}</button>; })}
    <span data-testid={`${testId}-source`} className="text-[10px] text-ink-400">{inferred ? 'inferred from lines' : 'set by staff'} · expects {api.uniqComponents(value).join(', ') || '—'}</span>
  </div>
);

const STATE_CLS: Record<string, string> = { ok: 'bg-moss-50 text-moss-700 border-moss-200', missing: 'bg-rose-50 text-rose-700 border-rose-200', extra: 'bg-amber-50 text-amber-800 border-amber-200', pending: 'bg-canvas text-ink-500 border-line' };
const Cell = ({ v }: { v?: boolean }) => v === undefined ? <CircleDashed size={12} className="text-ink-300" /> : v ? <Check size={12} className="text-moss-700" /> : <Minus size={12} className="text-rose-600" />;

// Trickle-down chain: Expected (estimate chips) → Received (Scan 1, package contents) → Verified (Scan 2, inspector). Never overwritten — each column is its own record.
export const VerificationChainPanel = ({ chain, compact, testId = 'chain' }: { chain: VerificationChain; compact?: boolean; testId?: string }) => (
  <div data-testid={testId} className="text-xs">
    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-ink-500">{chain.estimateNumber}</span><ComponentCodeChips value={chain.codes} inferred={chain.inferred} readOnly testId={`${testId}-codes`} /><span data-testid={`${testId}-status`} className={`ml-auto rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${chain.complete ? (chain.discrepancies ? STATE_CLS.missing : STATE_CLS.ok) : chain.received ? STATE_CLS.extra : STATE_CLS.pending}`}>{chain.complete ? (chain.discrepancies ? `${chain.discrepancies} discrepanc${chain.discrepancies === 1 ? 'y' : 'ies'}` : 'verified · all in') : chain.received ? 'received · awaiting Scan 2' : 'awaiting arrival'}</span></div>
    <table className="mt-2 w-full"><thead><tr className="text-[10px] uppercase tracking-wide text-ink-400"><th className="py-1 text-left font-medium">Component</th><th className="w-20 font-medium">Expected</th><th className="w-20 font-medium">Received</th><th className="w-20 font-medium">Verified</th>{!compact && <th className="w-24 text-right font-medium">State</th>}</tr></thead>
      <tbody>{chain.rows.map((r) => <tr key={r.component} data-testid={`${testId}-row-${r.component.replace(/\s+/g, '-')}`} data-state={r.state} className="border-t border-line"><td className="py-1 text-ink">{r.component}</td><td className="text-center"><Cell v={r.expected} /></td><td className="text-center"><Cell v={r.received} /></td><td className="text-center"><Cell v={r.verified} /></td>{!compact && <td className="text-right"><span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${STATE_CLS[r.state]}`}>{r.state}</span></td>}</tr>)}</tbody></table>
    {!compact && <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-ink-400"><span>Scan 1 · {chain.received ? `${chain.received.subNumber} · ${chain.received.by} · ${fmtDate(chain.received.at)} ${fmtTime(chain.received.at)}` : 'not yet'}</span><span>Scan 2 · {chain.verified ? `${chain.verified.by} · ${fmtDate(chain.verified.at)} ${fmtTime(chain.verified.at)}` : 'not yet'}</span></div>}
  </div>
);

export const ChainForEstimate = ({ estimateId, tick }: { estimateId: string; tick?: unknown }) => { const [c, setC] = useState<VerificationChain | null>(null); useEffect(() => { api.getVerificationChain(estimateId).then(setC); }, [estimateId, tick]); return c ? <VerificationChainPanel chain={c} testId="estimate-chain" /> : null; };
export const ChainForJob = ({ jobId }: { jobId: string }) => { const [c, setC] = useState<VerificationChain | null>(null); useEffect(() => { api.getJobVerificationChain(jobId).then(setC); }, [jobId]); return c ? <VerificationChainPanel chain={c} testId="job-chain" /> : <p className="text-xs text-ink-400">No estimate on this job — no expected-components chain.</p>; };
