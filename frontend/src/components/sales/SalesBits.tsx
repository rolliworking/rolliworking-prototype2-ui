import clsx from 'clsx';
import { CreditCard, PackageCheck, Plus, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as api from '@/api/client';
import type { PaymentMethod, SOLineInput, SalesOrder, SalesOrderWithRefs, TailStage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fmtTime } from '@/lib/format';

export const SOBadge = ({ order, testId }: { order: SalesOrder; testId?: string }) => <StatusPill status={api.SO_BADGE(order)} testId={testId} />;

const TAIL_LABEL: Record<TailStage, string> = { awaiting_invoice: 'Awaiting invoice', awaiting_payment: 'Awaiting payment', ready_for_pickup: 'Ready for pickup', ready_to_ship: 'Ready to ship', picked_up: 'Picked up', shipped: 'Shipped' };
export const TailPill = ({ stage, testId }: { stage: TailStage | null; testId?: string }) => (stage ? <span data-testid={testId} className={clsx('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', { 'bg-amber-50 text-amber-800': stage === 'awaiting_invoice', 'bg-orange-50 text-orange-800': stage === 'awaiting_payment', 'bg-teal-50 text-teal-800': stage === 'ready_for_pickup' || stage === 'ready_to_ship', 'bg-slate-100 text-slate-600': stage === 'picked_up' || stage === 'shipped' })}>{TAIL_LABEL[stage]}</span> : null);

export const SalesSubNav = () => {
  const cls = ({ isActive }: { isActive: boolean }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink');
  return (
    <div className="flex items-center gap-1" data-testid="sales-subnav">
      <NavLink to="/sales" end data-testid="sales-tab-orders" className={cls}><ShoppingCart size={13} /> Sales orders</NavLink>
      <NavLink to="/sales/pickup" data-testid="sales-tab-pickup" className={cls}><PackageCheck size={13} /> Pickup Station</NavLink>
      <NavLink to="/sales/ship" data-testid="sales-tab-ship" className={cls}><Truck size={13} /> Ship Station</NavLink>
      <NavLink to="/sales/new" data-testid="sales-tab-new" className={cls}><Plus size={13} /> New order</NavLink>
    </div>
  );
};

const field = 'h-8 rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:outline-none';

export const LinesEditor = ({ lines, onChange }: { lines: SOLineInput[]; onChange: (l: SOLineInput[]) => void }) => {
  const set = (i: number, patch: Partial<SOLineInput>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div data-testid="so-lines-editor" className="space-y-1.5">
      <div className="grid grid-cols-[1fr_110px_70px_110px_110px_28px] gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span>Description</span><span>Part #</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span /></div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_70px_110px_110px_28px] items-center gap-1.5">
          <input data-testid={`so-line-desc-${i}`} value={l.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Part / product / service" className={field} />
          <input data-testid={`so-line-part-${i}`} value={l.partNumber ?? ''} onChange={(e) => set(i, { partNumber: e.target.value })} className={`${field} font-mono text-xs`} />
          <input data-testid={`so-line-qty-${i}`} type="number" min={1} value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} className={`${field} tabular text-right`} />
          <input data-testid={`so-line-rate-${i}`} type="number" min={0} step="0.01" value={l.rate} onChange={(e) => set(i, { rate: Number(e.target.value) })} className={`${field} tabular text-right`} />
          <span className="tabular text-right text-[13px] font-medium" data-testid={`so-line-amount-${i}`}>{fmtMoneyCents(l.qty * l.rate)}</span>
          <button type="button" data-testid={`so-line-remove-${i}`} onClick={() => onChange(lines.filter((_, k) => k !== i))} className="text-ink-400 hover:text-rose-700"><Trash2 size={13} /></button>
        </div>
      ))}
      <Button size="sm" data-testid="so-line-add" onClick={() => onChange([...lines, { description: '', qty: 1, rate: 0 }])}><Plus size={12} /> Add line</Button>
    </div>
  );
};

export const SOLinesTable = ({ order: o, showFulfil }: { order: SalesOrder; showFulfil?: boolean }) => (
  <Table testId="so-lines">
    <thead><tr><Th>Line</Th><Th>Part #</Th><Th className="text-right">Qty</Th><Th className="text-right">Rate</Th><Th className="text-right">Amount</Th>{showFulfil && <Th className="text-right">Picked / Shipped</Th>}</tr></thead>
    <tbody>
      {o.lines.map((l) => <tr key={l.id} data-testid={`so-line-${l.id}`}><Td className="text-ink">{l.dept && <DeptBadge code={l.dept} />} <span className="ml-1">{l.description}</span></Td><Td className="font-mono text-xs text-ink-500">{l.partNumber ?? '—'}</Td><Td className="tabular text-right">{l.qty}</Td><Td className="tabular text-right text-ink-500">{fmtMoneyCents(l.rate)}</Td><Td className="tabular text-right font-medium">{fmtMoneyCents(l.qty * l.rate)}</Td>{showFulfil && <Td className="tabular text-right text-ink-500">{l.pickedUpQty} / {l.shippedQty}</Td>}</tr>)}
      <tr className="bg-canvas/60"><Td colSpan={showFulfil ? 5 : 4} className="text-right text-xs text-ink-500">Shipping</Td><Td className="tabular text-right">{fmtMoneyCents(o.shippingAmount)}</Td></tr>
      <tr className="bg-canvas/60"><Td colSpan={showFulfil ? 5 : 4} className="text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Order total</Td><Td className="tabular text-right font-semibold" data-testid="so-total">{fmtMoneyCents(o.total)}</Td></tr>
    </tbody>
  </Table>
);

export const MoneyStrip = ({ order: o }: { order: SalesOrder }) => (
  <div data-testid="money-strip" className="grid grid-cols-4 gap-3 text-xs">
    <div><div className="text-ink-500">Total</div><div className="tabular text-[15px] font-semibold text-ink">{fmtMoneyCents(o.total)}</div></div>
    <div><div className="text-ink-500">Paid</div><div className="tabular text-[15px] font-semibold text-moss-700">{fmtMoneyCents(o.total - o.balanceDue)}</div></div>
    <div><div className="text-ink-500">Balance due</div><div data-testid="so-balance" className={clsx('tabular text-[15px] font-semibold', o.balanceDue > 0 ? 'text-rose-700' : 'text-ink-400')}>{fmtMoneyCents(o.balanceDue)}</div></div>
    <div><div className="text-ink-500">QBO</div><div data-testid="so-qbo" className="inline-flex items-center gap-1 text-[13px] font-medium">{o.qboStatus === 'queued' ? <><span className="h-2 w-2 rounded-full bg-amber-500" /> Queued for QBO <span className="font-mono text-xs text-ink-400">{o.qboInvoiceId}</span></> : <><span className="h-2 w-2 rounded-full bg-slate-300" /> Not queued</>}</div></div>
  </div>
);

export const PaymentsList = ({ order: o }: { order: SalesOrder }) => (
  <ul data-testid="payments-list" className="divide-y divide-line/70 text-xs">
    {o.payments.map((p) => <li key={p.id} data-testid={`payment-${p.id}`} className="flex items-center gap-3 py-1.5"><CreditCard size={12} className="text-ink-400" /><span className="tabular font-medium text-ink">{fmtMoneyCents(p.amount)}</span><span className="capitalize text-ink-700">{p.method}</span>{p.note && <span className="truncate text-ink-500">{p.note}</span>}<span className="ml-auto whitespace-nowrap text-ink-400">{fmtDate(p.at)} {fmtTime(p.at)} · {p.by} · {p.station}</span></li>)}
    {o.payments.length === 0 && <li className="py-1.5 text-ink-400">No payments recorded.</li>}
  </ul>
);

const METHODS: PaymentMethod[] = ['card', 'cash', 'check', 'wire', 'other'];
export const PaymentModal = ({ order: o, onClose, onDone }: { order: SalesOrderWithRefs; onClose: () => void; onDone: () => void }) => {
  const [amount, setAmount] = useState(String(o.balanceDue));
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = async () => { try { await api.recordPayment(o.id, Number(amount), method, note); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  return (
    <Modal onClose={onClose} testId="payment-modal" width="w-[440px]" title={`Record payment · ${o.number}`}>
      <div className="space-y-3 p-5">
        <p className="text-xs text-ink-500">Stub ledger only — no processor. Balance due <span className="tabular font-semibold text-ink">{fmtMoneyCents(o.balanceDue)}</span>. Partial amounts allowed.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-500">Amount<input data-testid="payment-amount" autoFocus type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} className={`${field} mt-1 block w-full tabular`} /></label>
          <label className="text-xs text-ink-500">Method<select data-testid="payment-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={`${field} mt-1 block w-full`}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        </div>
        <label className="block text-xs text-ink-500">Note<input data-testid="payment-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Last 4, check #, …" className={`${field} mt-1 block w-full`} /></label>
        {err && <p data-testid="payment-error" className="text-xs font-medium text-rose-700">{err}</p>}
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" data-testid="payment-confirm" onClick={go}><CreditCard size={13} /> Record</Button></div>
      </div>
    </Modal>
  );
};
