import { Printer, X } from 'lucide-react';
import type { EstimateWithRefs } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DeptBadge } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

// Mock print: a paper-styled preview; nothing goes to a printer
export const PrintPreview = ({ estimate: e, onClose }: { estimate: EstimateWithRefs; onClose: () => void }) => (
  <div data-testid="print-preview" className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
    <div className="w-[720px] max-h-[90vh] overflow-y-auto rounded-md bg-white shadow-pop animate-rise" onClick={(ev) => ev.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><Printer size={13} /> Print preview — mock, nothing is printed</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" data-testid="print-confirm" onClick={onClose}>Print (mock)</Button>
          <button type="button" data-testid="print-close" onClick={onClose} className="text-ink-500 hover:text-ink"><X size={14} /></button>
        </div>
      </div>
      <div className="p-10 font-sans text-[13px] text-ink">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-semibold tracking-tight">RolliSuite</div>
            <div className="text-xs text-ink-500">Luxury watch service center</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-ink-500">Estimate</div>
            <div className="font-mono text-lg font-semibold">{e.number}{e.revision > 1 ? ` r${e.revision}` : ''}</div>
            <div className="text-xs text-ink-500">{fmtDate(e.createdAt)} · valid until {fmtDate(e.validUntil)}</div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
          <div><div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Bill to</div><div>{e.billingAddress.name}</div><div>{e.billingAddress.street}</div><div>{e.billingAddress.city}, {e.billingAddress.state}</div><div className="text-ink-500">{e.client.email}</div></div>
          <div><div className="mb-1 font-semibold uppercase tracking-wide text-ink-500">Watch</div>{e.watch ? <><div>{e.watch.brand} {e.watch.model}</div><div className="font-mono">Ref {e.watch.reference} · Serial {e.watch.serial}</div></> : <div className="text-ink-400">—</div>}</div>
        </div>
        {e.clientNotes && <p className="mt-6 text-xs text-ink-700"><span className="font-semibold">Client notes:</span> {e.clientNotes}</p>}
        <table className="mt-6 w-full text-xs">
          <thead><tr className="border-b border-ink text-left uppercase tracking-wide text-ink-500"><th className="py-1.5">Description</th><th className="w-12 py-1.5">Dept</th><th className="w-12 py-1.5 text-right">Qty</th><th className="w-24 py-1.5 text-right">Rate</th><th className="w-24 py-1.5 text-right">Amount</th></tr></thead>
          <tbody>
            {e.lines.map((l) => (
              <tr key={l.id} className="border-b border-line/70"><td className="py-1.5">{l.description}</td><td><DeptBadge code={l.dept} /></td><td className="tabular text-right">{l.qty}</td><td className="tabular text-right">{fmtMoneyCents(l.unitPrice)}</td><td className="tabular text-right">{fmtMoneyCents(l.qty * l.unitPrice)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-56 space-y-1 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{fmtMoneyCents(e.subtotal)}</span></div>
          <div className="flex justify-between text-ink-500"><span>Tax</span><span className="tabular">{fmtMoneyCents(0)}</span></div>
          <div className="flex justify-between border-t border-ink pt-1 text-sm font-semibold"><span>Total</span><span className="tabular">{fmtMoneyCents(e.total)}</span></div>
        </div>
        <p className="mt-8 text-xs text-ink-500">{e.messageNotes}</p>
        <p className="mt-1 text-[11px] text-ink-400">Prepared for {fullName(e.client)} · PROTOTYPE — fake data</p>
      </div>
    </div>
  </div>
);
