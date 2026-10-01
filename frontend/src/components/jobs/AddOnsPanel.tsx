import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { AddonChannel, JobAddonsView, JobWithRefs } from '@/api/client';
import { useShowMoney } from '@/components/MoneyContext';
import { Button } from '@/components/ui/Button';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const SOURCE: Record<string, { label: string; cls: string }> = { parts_request: { label: 'parts request', cls: 'bg-sky-50 text-sky-800 ring-sky-200' }, estimate_revision: { label: 'estimate revision', cls: 'bg-canvas text-ink-600 ring-line' }, manual: { label: 'manual', cls: 'bg-amber-50 text-amber-900 ring-amber-300' } };
const channelLabel = (k: AddonChannel) => api.ADDON_CHANNELS.find((c) => c.key === k)?.label ?? k;
type Run = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

const AddForm = ({ jobId, defaultApprover, onDone, run }: { jobId: string; defaultApprover: string; onDone: () => void; run: Run }) => {
  const [f, setF] = useState({ description: '', approver: defaultApprover, channel: 'counter' as AddonChannel, amount: '', note: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const cls = 'h-8 rounded-sm border border-line bg-canvas px-2 text-xs focus:border-ink focus:outline-none';
  return (
    <div data-testid="addon-form" className="mt-3 rounded-sm border border-amber-300 bg-amber-50/40 p-3">
      <div className="grid grid-cols-[1fr_160px_140px_110px] gap-2">
        <input data-testid="addon-description" value={f.description} onChange={set('description')} placeholder="What was added (e.g. Crown + tube replacement)" className={cls} />
        <input data-testid="addon-approver" value={f.approver} onChange={set('approver')} placeholder="Approved by" className={cls} />
        <select data-testid="addon-channel" value={f.channel} onChange={set('channel')} className={cls}>{api.ADDON_CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        <input data-testid="addon-amount" type="number" min={0} step="0.01" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="$ amount" className={`${cls} text-right tabular`} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input data-testid="addon-note" value={f.note} onChange={set('note')} placeholder="Note (optional) — what the client said, who took the call…" className={`${cls} flex-1`} />
        <Button size="sm" variant="primary" data-testid="addon-save" onClick={() => run(() => api.addJobAddon(jobId, { description: f.description, approver: f.approver, channel: f.channel, amount: Number(f.amount || 0), note: f.note }), 'Add-on logged · flagged manual · in the audit log').then(onDone)}>Log add-on</Button>
        <Button size="sm" data-testid="addon-cancel" onClick={onDone}>Cancel</Button>
      </div>
      <p className="mt-1.5 text-[10px] text-amber-900/80">Manual rows are flagged "manual" and land in the audit log. Client-approved parts requests and estimate-revision lines appear here automatically.</p>
    </div>
  );
};

// ADD-ONS SINCE ESTIMATE — replaces the open Line items card: only what was approved AFTER the estimate went out, with date · approver · channel · amount
export const AddOnsPanel = ({ job: j, run }: { job: JobWithRefs; run: Run }) => {
  const money = useShowMoney();
  const [view, setView] = useState<JobAddonsView | null>(null); const [adding, setAdding] = useState(false);
  const load = useCallback(() => api.getJobAddons(j.id).then(setView), [j.id]);
  useEffect(() => { void load(); }, [load, j.timeline.length]);
  if (!view) return null;
  return (
    <div data-testid="addons-panel" data-count={view.rows.length}>
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>{view.since ? `Since ${j.estimate ? `estimate ${j.estimate.number} was sent` : 'the job opened'} · ${fmtDate(view.since)}` : ''}</span>
        {j.status !== 'closed' && !adding && <Button size="sm" data-testid="addon-add" onClick={() => setAdding(true)}><Plus size={12} /> Add add-on</Button>}
      </div>
      {adding && <AddForm jobId={j.id} defaultApprover={`${j.client.firstName} ${j.client.lastName}`} run={run} onDone={() => { setAdding(false); void load(); }} />}
      <div className="mt-2 -mx-4 -mb-4">
        <Table testId="addons-table">
          <thead><tr><Th className="w-20">Date</Th><Th>Add-on</Th><Th className="w-40">Approved by</Th><Th className="w-28">Channel</Th>{money && <Th className="w-24 text-right">Amount</Th>}</tr></thead>
          <tbody>
            {view.rows.map((r) => <tr key={r.id} data-testid={`addon-row-${r.id}`} data-source={r.source}><Td className="tabular text-ink-500">{fmtDate(r.at)}</Td><Td className="text-ink">{r.description}{r.ref && <span className="ml-1.5 font-mono text-[10px] text-ink-400">{r.ref}</span>}<span className={`ml-1.5 rounded-sm px-1 text-[9px] font-semibold uppercase tracking-wide ring-1 ${SOURCE[r.source].cls}`}>{SOURCE[r.source].label}</span>{r.pendingConfirmation && <span data-testid={`addon-pending-${r.id}`} className="ml-1.5 rounded-sm bg-amber-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300">pending client confirmation</span>}{r.confirmedAt && r.channel === 'phone' && <span data-testid={`addon-confirmed-${r.id}`} className="ml-1.5 rounded-sm bg-moss-50 px-1 text-[9px] font-semibold uppercase tracking-wide text-moss-700 ring-1 ring-moss-200">confirmed via {r.confirmedVia}</span>}{r.note && <div className="text-[11px] text-ink-500">{r.note}{r.loggedBy ? ` — logged by ${r.loggedBy}` : ''}</div>}{r.pendingConfirmation && j.status !== 'closed' && <div className="mt-1 flex gap-1">{(['portal', 'email', 'counter'] as const).map((via) => <button key={via} data-testid={`addon-confirm-${r.id}-${via}`} onClick={() => void run(() => api.confirmJobAddon(j.id, r.id, via), `Add-on confirmed via ${via}`).then(load)} className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] hover:bg-canvas">Client confirmed · {via}</button>)}</div>}</Td><Td className="text-ink-700">{r.approver}</Td><Td className="text-ink-500">{channelLabel(r.channel)}</Td>{money && <Td className="tabular text-right font-medium">{fmtMoneyCents(r.amount)}</Td>}</tr>)}
            {view.rows.length === 0 && <tr><Td colSpan={money ? 5 : 4} className="text-center text-xs text-ink-400" data-testid="addons-empty">Nothing added since the estimate — the original scope stands.</Td></tr>}
            {view.rows.length > 0 && money && <tr className="bg-canvas/60"><Td colSpan={4} className="text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Add-ons total</Td><Td className="tabular text-right font-semibold" data-testid="addons-total">{fmtMoneyCents(view.total)}</Td></tr>}
          </tbody>
        </Table>
      </div>
    </div>
  );
};
