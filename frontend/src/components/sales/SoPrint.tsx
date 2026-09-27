import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import * as api from '@/api/client';
import type { SalesOrderWithRefs } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { fmtDate, fmtMoney, fullName } from '@/lib/format';

// Print / PDF view of the sales order. Bottom corner: QR → the client's tokened Watch Records link (same link rides the invoice email).
export const SoPrintButton = ({ order }: { order: SalesOrderWithRefs }) => {
  const [open, setOpen] = useState(false);
  return <>
    <Button data-testid="act-print-so" onClick={() => setOpen(true)}><Printer size={13} /> Print / PDF</Button>
    {open && <SoPrintModal order={order} onClose={() => setOpen(false)} />}
  </>;
};

const SoPrintModal = ({ order: o, onClose }: { order: SalesOrderWithRefs; onClose: () => void }) => {
  const link = api.soRecordsLink(o); const url = `${window.location.origin}${link}`;
  return <Modal testId="so-print-modal" title={`${o.number} · print view`} width="w-[760px]" onClose={onClose}>
    <div className="mb-2 flex justify-end gap-2 print:hidden"><Button size="sm" variant="primary" data-testid="so-print-now" onClick={() => window.print()}><Printer size={12} /> Print</Button></div>
    <div data-testid="so-print-sheet" className="so-print rounded-md border border-line bg-white p-8 text-ink">
      <div className="flex items-start justify-between"><div><div className="text-lg font-semibold tracking-tight">Rolliworks · Luxury Watch Service</div><div className="text-xs text-ink-500">Invoice {o.number} · {fmtDate(o.orderDate)}{o.job && <> · Job {o.job.number}</>}</div></div><div className="text-right text-xs"><div className="font-semibold">{fullName(o.client)}</div><div className="text-ink-500">{o.client.email}</div></div></div>
      <table className="mt-6 w-full text-xs"><thead><tr className="border-b border-line text-left text-[10px] uppercase text-ink-400"><th className="py-1">Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead><tbody>{o.lines.map((l) => <tr key={l.id} className="border-b border-line/60"><td className="py-1.5">{l.description}</td><td className="text-right tabular">{l.qty}</td><td className="text-right tabular">{fmtMoney(l.rate)}</td><td className="text-right tabular">{fmtMoney(l.qty * l.rate)}</td></tr>)}</tbody></table>
      <div className="mt-3 flex justify-end text-xs"><div className="w-56 space-y-0.5"><div className="flex justify-between"><span className="text-ink-500">Shipping</span><span className="tabular">{fmtMoney(o.shippingAmount)}</span></div><div className="flex justify-between font-semibold"><span>Total</span><span className="tabular">{fmtMoney(o.total)}</span></div><div className="flex justify-between"><span className="text-ink-500">Paid</span><span className="tabular">{fmtMoney(o.total - o.balanceDue)}</span></div><div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular">{fmtMoney(o.balanceDue)}</span></div></div></div>
      <div className="mt-10 flex items-end justify-between"><div className="text-[10px] text-ink-400">Thank you for trusting us with your {o.watch ? `${o.watch.brand} ${o.watch.model}` : 'watch'}.</div>
        <div data-testid="so-print-qr" className="flex flex-col items-center gap-1"><a href={link} data-testid="so-print-qr-link" title={url}><QRCodeSVG value={url} size={84} level="M" /></a><div className="text-[9px] text-ink-500">Scan for your watch’s service records</div></div></div>
    </div>
    <p className="mt-2 text-[11px] text-ink-500 print:hidden">The QR opens the client’s tokened RolliConnect records page (<span className="font-mono">{link.slice(0, 44)}…</span>). The same link is in the invoice email.</p>
  </Modal>;
};
