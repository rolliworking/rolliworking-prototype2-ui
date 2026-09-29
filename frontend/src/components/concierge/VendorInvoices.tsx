import { useState } from 'react';
import * as cz from '@/api/concierge';
import type { PayMethod, SwoWithRefs } from '@/api/client';
import { field } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const METHODS: PayMethod[] = ['card', 'ACH', 'wire', 'check', 'PayPal', 'cash'];
type Run = (fn: () => Promise<unknown>, m: string) => Promise<void>;
// Vendor invoices replace the bare Paid checkbox: number required, duplicate guard (hard on vendor+number, soft on vendor+amount+date≤7d), Mark paid demands method + our reference; QBO DocNumber/PrivateNote written back
export const VendorInvoicesPanel = ({ w, run }: { w: SwoWithRefs; run: Run }) => {
  const [add, setAdd] = useState(false); const [f, setF] = useState({ number: '', vendorRef: '', amount: '', date: new Date().toISOString().slice(0, 10), attachment: '' }); const [soft, setSoft] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [errLink, setErrLink] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null); const [pf, setPf] = useState<{ method: PayMethod; ourRef: string; overrideReason: string }>({ method: 'ACH', ourRef: '', overrideReason: '' }); const [blocked, setBlocked] = useState<string | null>(null);
  const submit = async (force = false) => { setErr(null); setErrLink(null); try { await cz.addVendorInvoice(w.id, { number: f.number, vendorRef: f.vendorRef || undefined, amount: Number(f.amount), date: f.date, attachment: f.attachment || undefined, force }); setAdd(false); setSoft(null); setF({ number: '', vendorRef: '', amount: '', date: new Date().toISOString().slice(0, 10), attachment: '' }); await run(async () => undefined, `Vendor invoice ${f.number} added`); } catch (e) { const d = (e as { dup?: cz.DuplicateHit }).dup; if (d && !d.hard) setSoft(d.message); else { setErr(e instanceof Error ? e.message : 'Failed'); if (d) setErrLink(d.swoId); } } };
  const doPay = async (invId: string) => { setBlocked(null); try { await cz.markInvoicePaid(w.id, invId, { method: pf.method, ourRef: pf.ourRef, overrideReason: pf.overrideReason || undefined }); setPay(null); setPf({ method: 'ACH', ourRef: '', overrideReason: '' }); await run(async () => undefined, 'Marked paid · QBO bill + bill-payment stub written'); } catch (e) { setBlocked(e instanceof Error ? e.message : 'Failed'); } };
  return <div data-testid="vendor-invoices" className="rounded-sm border border-line">
    <div className="flex items-center justify-between border-b border-line bg-canvas px-2 py-1"><span className="text-[11px] font-semibold">Vendor invoices · {w.invoices.length}</span><Button size="sm" data-testid="vi-add-toggle" onClick={() => setAdd((o) => !o)}>{add ? 'Cancel' : '+ Invoice'}</Button></div>
    <ul className="divide-y divide-line/70">
      {w.invoices.map((i) => <li key={i.id} data-testid={`vi-${i.id}`} className="px-2 py-1.5 text-xs">
        <div className="flex items-center gap-2"><span className="font-mono font-semibold">inv {i.number}</span>{i.vendorRef && <span className="text-ink-400">their ref {i.vendorRef}</span>}<span className="ml-auto font-semibold">{fmtMoneyCents(i.amount)}</span><span className="text-ink-400">{fmtDate(i.date)}</span>{i.charge === 'redo' && <span className="rounded-sm bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">redo charge</span>}</div>
        {i.paid ? <div data-testid={`vi-paid-${i.id}`} className="mt-0.5 text-[11px] text-moss-700">Paid {fmtDate(i.paid.at)} · {i.paid.method} ref <b>{i.paid.ourRef}</b> · by {i.paid.by}{i.paid.overrideReason && <> · <span className="text-amber-800">override: {i.paid.overrideReason}</span></>} · QBO {i.qboBillId} / {i.qboBillPaymentId}</div>
          : pay === i.id ? <div className="mt-1 grid grid-cols-3 gap-1"><select data-testid="vi-pay-method" value={pf.method} onChange={(e) => setPf({ ...pf, method: e.target.value as PayMethod })} className={field}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select><input data-testid="vi-pay-ref" placeholder="our payment reference *" value={pf.ourRef} onChange={(e) => setPf({ ...pf, ourRef: e.target.value })} className={field} /><Button size="sm" variant="primary" data-testid="vi-pay-go" onClick={() => void doPay(i.id)}>Mark paid</Button>
              {blocked && <div data-testid="vi-pay-blocked" className="col-span-3 rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">{blocked}{/redo/.test(blocked) && <input data-testid="vi-pay-override" placeholder="manager override reason (creates a second invoice line)" value={pf.overrideReason} onChange={(e) => setPf({ ...pf, overrideReason: e.target.value })} className={`${field} mt-1 w-full`} />}</div>}</div>
          : <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">Unpaid<Button size="sm" data-testid={`vi-pay-${i.id}`} onClick={() => { setPay(i.id); setBlocked(null); }}>Mark paid…</Button></div>}
      </li>)}
      {!w.invoices.length && <li className="px-2 py-2 text-[11px] text-ink-400">No vendor invoice yet — nothing shows on the card until one is entered.</li>}
    </ul>
    {add && <div data-testid="vi-add-form" className="space-y-1 border-t border-line p-2 text-xs">
      <div className="grid grid-cols-4 gap-1"><input data-testid="vi-number" placeholder="vendor invoice # *" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} className={field} /><input data-testid="vi-vendor-ref" placeholder="their ref / job #" value={f.vendorRef} onChange={(e) => setF({ ...f, vendorRef: e.target.value })} className={field} /><input data-testid="vi-amount" type="number" min={0} step="0.01" placeholder="amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={field} /><input data-testid="vi-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={field} /></div>
      <label className="flex items-center gap-2 text-[11px] text-ink-500">Attachment (photo / PDF)<input data-testid="vi-attachment" type="file" accept="image/*,application/pdf" onChange={(e) => setF({ ...f, attachment: e.target.files?.[0]?.name ?? '' })} className="text-[11px]" />{f.attachment && <span className="font-mono">{f.attachment}</span>}</label>
      {soft && <div data-testid="vi-soft-dup" className="rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{soft} <Button size="sm" data-testid="vi-soft-continue" onClick={() => void submit(true)}>Continue anyway</Button></div>}
      {err && <div data-testid="vi-hard-dup" className="rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">{err}{errLink && <> · <a data-testid="vi-dup-link" href={`/concierge?swo=${errLink}`} className="underline">open existing SWO</a></>}</div>}
      <div className="flex justify-end"><Button size="sm" variant="primary" data-testid="vi-save" onClick={() => void submit(false)}>Add invoice</Button></div>
    </div>}
  </div>;
};
