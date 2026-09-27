import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { B2bMatch, Client, EstimateWithRefs } from '@/api/client';
import { fullName } from '@/lib/format';

const TIER_LABEL: Record<B2bMatch['tier'], string> = { tracking: 'Tier 1 · tracking / estimate #', account_code: 'Tier 2 · trade account code', name: 'Tier 3 · name / email', none: 'No match' };

// No-estimate branch: scan the B2B / trade label → three-tier match chain → link estimate or client, or receive under SUB# only.
export const NoEstimatePanel = ({ packageId, subNumber, onEstimate, onClient }: { packageId: string; subNumber: string; onEstimate: (e: EstimateWithRefs) => void; onClient: (c: Client | null, m: B2bMatch) => void }) => {
  const [code, setCode] = useState(''); const [m, setM] = useState<B2bMatch | null>(null); const [err, setErr] = useState<string | null>(null);
  const go = async () => { try { setErr(null); const r = await api.matchB2bLabel(code, packageId); setM(r); if (r.estimate) { await api.attachB2bMatch(packageId, { tier: r.tier, code: r.code, estimateId: r.estimate.id }); onEstimate(r.estimate); } } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  const pick = async (c: Client | null) => { if (!m) return; await api.attachB2bMatch(packageId, { tier: m.tier, code: m.code, clientId: c?.id }); onClient(c, m); };
  return <div data-testid="no-estimate-panel" className="mt-4 rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3">
    <div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-ink">No estimate? Scan the B2B / trade label</span><span className="font-mono text-[11px] text-ink-500">SUB# {subNumber}</span></div>
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void go(); }}><div className="relative flex-1"><ScanLine size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="b2b-label-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1Z… tracking · RS-VID-0192 account label · “Vidal” · e-mail" className="h-9 w-full rounded-sm border border-line bg-surface pl-7 pr-2 font-mono text-[13px]" /></div><button data-testid="b2b-match-btn" className="h-9 rounded-sm bg-ink px-3 text-xs font-semibold text-white">Match</button></form>
    {err && <p data-testid="b2b-error" className="mt-1 text-xs text-rose-700">{err}</p>}
    {m && <div data-testid="b2b-result" data-tier={m.tier} className="mt-2 text-xs">
      <div className="flex items-center gap-2"><span data-testid="b2b-tier" className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.tier === 'none' ? 'bg-rose-50 text-rose-700' : 'bg-moss-50 text-moss-700'}`}>{TIER_LABEL[m.tier]}</span><span className="text-ink-600">{m.explain}</span></div>
      {m.estimate && <p className="mt-1 text-ink-700">Linked to <b>{m.estimate.number}</b> · {fullName(m.estimate.client)} — the estimate card above is now filled.</p>}
      {!m.estimate && m.candidates.length > 0 && <ul className="mt-1.5 flex flex-wrap gap-1.5">{m.candidates.map((c) => <li key={c.id}><button data-testid={`b2b-pick-${c.id}`} onClick={() => void pick(c)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:border-ink">{fullName(c)}{c.company && <span className="text-ink-400"> · {c.company}</span>}{c.type === 'trade' && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-900">trade</span>}</button></li>)}</ul>}
      {!m.estimate && <button data-testid="b2b-sub-only" onClick={() => void pick(null)} className="mt-2 text-[11px] text-brand hover:underline">Receive under SUB# {m.subNumber} only — resolve the client at the desk</button>}
    </div>}
  </div>;
};
