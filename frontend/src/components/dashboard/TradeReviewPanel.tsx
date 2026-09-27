import { Briefcase, CheckCircle2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { TradeReviewRow } from '@/api/client';
import { TradeSendBackModal, WorkflowBadges } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtMoneyCents, relativeTime } from '@/lib/format';

// "Awaiting division manager review" — the account manager marks Inspected/Accepted (→ invoice) or sends back with a reason
export const TradeReviewPanel = () => {
  const [rows, setRows] = useState<TradeReviewRow[]>([]); const [back, setBack] = useState<TradeReviewRow | null>(null); const [flash, setFlash] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api.getTradeReviewQueue().then(setRows), []);
  useEffect(() => { void load(); }, [load]);
  const say = (t: string) => { setFlash(t); setErr(null); window.setTimeout(() => setFlash(null), 3500); void load(); };
  return <Card title={`Trade review · ${rows.length}`} subtitle="Finished trade work awaiting the account's division manager — accept converts straight to invoice" testId="trade-review-panel">
    {flash && <div data-testid="trade-review-flash" className="mb-2 rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700">{flash}</div>}
    {err && <div data-testid="trade-review-error" className="mb-2 rounded-sm bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{err}</div>}
    {rows.length === 0 && <p data-testid="trade-review-empty" className="text-xs text-ink-500">Nothing waiting for review.</p>}
    <ul className="divide-y divide-line">{rows.map((r) => <li key={r.job.id} data-testid={`trade-review-${r.job.id}`} data-mine={r.mine} className="flex flex-wrap items-center gap-3 py-2.5">
      <Briefcase size={15} className={r.mine ? 'text-amber-700' : 'text-ink-400'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13px]"><Link to={`/jobs/${r.job.id}`} data-testid={`trade-review-open-${r.job.id}`} className="font-mono font-semibold text-ink hover:underline">{r.job.number}</Link><span className="text-ink">{r.job.watch.brand} {r.job.watch.model}</span><WorkflowBadges workflow={r.job.workflow} /><span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">{r.account.company ?? `${r.account.firstName} ${r.account.lastName}`}{r.internal && ' · internal'}</span>{r.mine && <span data-testid={`trade-review-mine-${r.job.id}`} className="rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Your account</span>}</div>
        <div className="text-[11px] text-ink-500">Inspected by {r.inspectedBy} · waiting {relativeTime(r.waitingSince)} · {r.job.lines.length} lines · {fmtMoneyCents(r.job.total)} · manager {r.account.managerShort ?? '—'}</div>
      </div>
      <Button data-testid={`trade-send-back-${r.job.id}`} className="!border-rose-200 !text-rose-700 hover:!bg-rose-50" onClick={() => setBack(r)}><Undo2 size={13} /> Send back</Button>
      <Button data-testid={`trade-accept-${r.job.id}`} variant="primary" onClick={async () => { try { await api.transitionJob(r.job.id, 'trade_accept'); say(`${r.job.number} accepted → invoice created${r.internal ? ' · no email (internal)' : ' · invoice email queued'}`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}><CheckCircle2 size={13} /> Inspected / Accepted → invoice</Button>
    </li>)}</ul>
    {back && <TradeSendBackModal testId="trade-review-send-back" onClose={() => setBack(null)} onConfirm={async (reason) => { await api.transitionJob(back.job.id, 'trade_send_back', reason); setBack(null); say(`${back.job.number} sent back · ${reason}`); }} />}
  </Card>;
};
