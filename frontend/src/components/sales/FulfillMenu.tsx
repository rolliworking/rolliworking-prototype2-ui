import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { SalesOrderWithRefs, ZeroBalanceReason } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type Item = { key: string; label: string; onClick?: () => void; disabled?: boolean; hint?: string; danger?: boolean; ownerOnly?: boolean } | 'sep';

// Legacy SO "Fulfill" dropdown, ported — same actions, same grouping. Items that exist elsewhere in the new system are wired to those features, not stubbed twice.
export const FulfillMenu = ({ order: o, isOwner, editing, onSave, onRun, onModal }: { order: SalesOrderWithRefs; isOwner: boolean; editing: boolean; onSave: (close: boolean) => void; onRun: (fn: () => Promise<unknown>, msg: string) => void; onModal: (m: 'cancel' | 'zero') => void }) => {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const nav = useNavigate();
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  const live = ['open', 'partial_fulfilled', 'fulfilled'].includes(o.status); const done = ['shipped', 'picked_up', 'cancelled'].includes(o.status);
  const items: Item[] = [
    { key: 'fulfill', label: 'Fulfill (Save & Continue)', disabled: !['open', 'partial_fulfilled'].includes(o.status), hint: 'queues QBO (stub)', onClick: () => onRun(() => api.fulfillSalesOrder(o.id), 'Fulfilled · QBO queued (stub)') },
    { key: 'save', label: 'Save', disabled: !editing, onClick: () => onSave(false) },
    { key: 'save-close', label: 'Save and Close', onClick: () => onSave(true) },
    'sep',
    { key: 'perf', label: 'Edit Performance Report', hint: 'Completions report', onClick: () => nav(`/reports?key=completions&job=${o.jobId ?? ''}`) },
    'sep',
    { key: 'qbo-pull', label: 'Sync from QuickBooks', disabled: !!o.zeroBalance, hint: o.zeroBalance ? 'excluded — zero-balanced' : 'stub', onClick: () => onRun(() => api.qboSyncInvoice(o.id, 'pull'), 'Synced from QuickBooks (stub)') },
    { key: 'qbo-push', label: 'Push Edits to QuickBooks', disabled: !!o.zeroBalance, hint: o.zeroBalance ? 'excluded — zero-balanced' : 'stub', onClick: () => onRun(() => api.qboSyncInvoice(o.id, 'push'), 'Edits pushed to QuickBooks (stub)') },
    'sep',
    { key: 'ship-info', label: 'Send Shipping Info Request', disabled: !live, onClick: () => onRun(() => api.requestShippingInfo(o.id), 'Shipping info request queued to Outbox') },
    { key: 'pickup-email', label: 'Send Pickup Reminder Email', disabled: !live || o.channel !== 'pickup', onClick: () => onRun(() => api.sendSoReminder(o.id, 'pickup', 'email'), 'Pickup reminder email queued') },
    { key: 'pickup-sms', label: 'Send Pickup Reminder SMS', disabled: !live || o.channel !== 'pickup', onClick: () => onRun(() => api.sendSoReminder(o.id, 'pickup', 'sms'), 'Pickup reminder SMS queued') },
    { key: 'pay-email', label: 'Send Payment Reminder Email', disabled: !live || o.balanceDue <= 0, onClick: () => onRun(() => api.sendSoReminder(o.id, 'payment', 'email'), 'Payment reminder email queued') },
    { key: 'pay-sms', label: 'Send Payment Reminder SMS', disabled: !live || o.balanceDue <= 0, onClick: () => onRun(() => api.sendSoReminder(o.id, 'payment', 'sms'), 'Payment reminder SMS queued') },
    'sep',
    { key: 'push-ship', label: 'Push to Ship Station', disabled: !live || o.channel === 'ship', onClick: () => onRun(() => api.setFulfillmentChannel(o.id, 'ship'), 'Pushed to Ship Station') },
    { key: 'push-pickup', label: 'Push to Pickup Station', disabled: !live || o.channel === 'pickup', onClick: () => onRun(() => api.setFulfillmentChannel(o.id, 'pickup'), 'Pushed to Pickup Station · code emailed') },
    'sep',
    { key: 'appraisal', label: 'Create Appraisal', onClick: () => nav(`/estimates/new?client=${o.clientId}&kind=appraisal&from=${o.number}`) },
    { key: 'warranty', label: 'Create Warranty Estimate', onClick: () => nav(`/estimates/new?client=${o.clientId}&kind=warranty&from=${o.number}`) },
    'sep',
    { key: 'zero', label: 'Zero balance — no QBO sync', ownerOnly: true, disabled: !live || o.balanceDue <= 0, hint: o.zeroBalance ? 'already zero-balanced' : 'MH only · barter / internal work', onClick: () => onModal('zero') },
    'sep',
    { key: 'print', label: 'Print Sales Order', onClick: () => document.querySelector<HTMLButtonElement>('[data-testid="act-print-so"]')?.click() },
    { key: 'delete', label: o.status === 'draft' ? 'Delete' : 'Delete (cancel — history kept)', danger: true, disabled: done, onClick: () => (o.status === 'draft' ? onRun(async () => { await api.deleteSalesOrder(o.id); nav('/sales'); }, 'Draft deleted') : onModal('cancel')) },
  ];
  const visible = items.filter((i) => i === 'sep' || !i.ownerOnly || isOwner);
  return <div ref={ref} className="relative">
    <Button variant="primary" data-testid="so-fulfill-menu" onClick={() => setOpen(!open)}>Fulfill <ChevronDown size={13} /></Button>
    {open && <div data-testid="so-fulfill-menu-list" className="absolute left-0 z-40 mt-1 w-80 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg animate-rise">
      {visible.map((it, i) => (it === 'sep' ? (visible[i - 1] !== 'sep' && i > 0 && i < visible.length - 1 ? <div key={`s${i}`} className="my-1 border-t border-line/70" /> : null)
        : <button key={it.key} data-testid={`so-menu-${it.key}`} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick?.(); }} className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 ${it.danger ? 'text-rose-700' : it.ownerOnly ? 'font-semibold text-amber-900' : 'text-ink'}`}><span className="whitespace-nowrap">{it.label}</span>{it.hint && <span className="truncate text-[10px] text-ink-400">{it.hint}</span>}</button>))}
    </div>}
  </div>;
};

const REASONS: ZeroBalanceReason[] = ['barter_client', 'barter_b2b', 'internal_work'];
// MH-only: $0 / Paid in RS, never pushed to QBO as revenue, performance credit untouched, logged for reconciliation; auto-routes to Ship or Pickup cart
export const ZeroBalanceModal = ({ order: o, onClose, onDone }: { order: SalesOrderWithRefs; onClose: () => void; onDone: (msg: string) => void }) => {
  const [reason, setReason] = useState<ZeroBalanceReason | ''>(''); const [notes, setNotes] = useState(''); const [err, setErr] = useState<string | null>(null);
  const hasShipping = o.shippingAmount > 0 || o.lines.some((l) => /shipping|insured ship|ship /i.test(l.description));
  const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex justify-between gap-3"><span className="text-ink-500">{k}</span><span className="text-right font-medium text-ink">{v}</span></div>;
  return <Modal testId="zero-balance-modal" title="Zero balance — no QBO sync" width="w-[560px]" onClose={onClose}>
    <div className="space-y-3 text-xs">
      <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-amber-900">MH-only. Balance → $0 and Paid inside RS (satisfies the Pickup payment gate). <b>Excluded from the QuickBooks revenue push</b> and tagged so the accountant can see why there is no QBO counterpart. Tech / department completion credit is not affected.</div>
      <div className="space-y-1 rounded-md border border-line bg-canvas/60 px-3 py-2"><Row k="Invoice" v={o.number} /><Row k="Balance to zero" v={<span data-testid="zero-amount">${o.balanceDue.toFixed(2)}</span>} /><Row k="Then routes to" v={<span data-testid="zero-route">{hasShipping ? 'Ship cart (shipping product on order)' : 'Pickup cart (no shipping product)'}</span>} /></div>
      <div>Reason category <span className="text-rose-700">*</span><div className="mt-1 flex gap-1">{REASONS.map((r) => <button key={r} data-testid={`zero-reason-${r}`} onClick={() => setReason(r)} className={`rounded-sm border px-3 py-1.5 font-medium ${reason === r ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:bg-canvas'}`}>{api.ZERO_REASON_LABEL[r]}</button>)}</div></div>
      <label className="block text-ink-500">Notes <span className="text-rose-700">*</span> — who / what was exchanged, why no cash (this is the record MH and Khadija will need later)<textarea data-testid="zero-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
      {err && <div data-testid="zero-error" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
      <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="zero-confirm" disabled={!reason || !notes.trim()} onClick={async () => { try { if (!reason) return; const r = await api.zeroBalanceNoSync(o.id, reason, notes); onDone(`Zero-balanced · ${api.ZERO_REASON_LABEL[reason]} · excluded from QBO · routed to ${r.channel === 'ship' ? 'Ship' : 'Pickup'} Station`); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } }}>Zero balance</Button></div>
    </div>
  </Modal>;
};

export const ZeroBalanceBadge = ({ order: o }: { order: SalesOrderWithRefs }) => o.zeroBalance ? <span data-testid="so-zero-balance-badge" title={o.zeroBalance.notes} className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 ring-1 ring-amber-300">Zero-balanced · {api.ZERO_REASON_LABEL[o.zeroBalance.reason]} · no QBO sync</span> : null;
