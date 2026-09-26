import { CheckCircle2, CreditCard, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { PayPage as PayPageData } from '@/api/client';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

// MOCK hosted payment page (Intuit placeholder). Public, no staff session. Always renders the LIVE invoice — edit the SO in RS and this page changes.
export default function PayPage() {
  const { token = '' } = useParams(); const nav = useNavigate();
  const [d, setD] = useState<PayPageData | null>(null); const [err, setErr] = useState<string | null>(null); const [amount, setAmount] = useState<string>(''); const [busy, setBusy] = useState(false); const [receipt, setReceipt] = useState<{ amount: number; balance: number } | null>(null);
  const load = useCallback(() => api.getPayPage(token).then((x) => { setD(x); setErr(null); }).catch((e) => setErr(e instanceof Error ? e.message : 'Link not valid')), [token]);
  useEffect(() => { void load(); const onFocus = () => void load(); window.addEventListener('focus', onFocus); const i = window.setInterval(() => void load(), 4000); return () => { window.removeEventListener('focus', onFocus); window.clearInterval(i); }; }, [load]);
  useEffect(() => { if (d && amount === '') setAmount(d.order.balanceDue.toFixed(2)); }, [d, amount]);
  const pay = async () => { if (!d) return; const n = Number(amount); setBusy(true); try { const before = d.order.balanceDue; const r = await api.payViaLink(token, n); setD(r); setReceipt({ amount: Math.min(n, before), balance: r.order.balanceDue }); setAmount(r.order.balanceDue.toFixed(2)); setErr(null); } catch (e) { setErr(e instanceof Error ? e.message : 'Payment failed'); } finally { setBusy(false); } };
  const o = d?.order;
  return <div data-testid="pay-page" className="min-h-screen bg-[#f3f4f1] px-4 py-8 text-[#1c1f1a]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
    <div data-testid="pay-mock-banner" className="mx-auto mb-6 flex max-w-lg items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900"><ShieldAlert size={14} /> Mock payment page — placeholder for Intuit Payments · no card is charged</div>
    <div className="mx-auto max-w-lg overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
      <div className="border-b border-black/5 bg-[#0d2b1f] px-6 py-5 text-white"><div className="text-[11px] uppercase tracking-[0.18em] text-white/60">{d?.merchant ?? 'Rolliworks'}</div><div className="mt-1 text-lg font-semibold">Invoice {o?.number ?? '…'}</div>{o && <div className="text-xs text-white/70">{o.client.firstName} {o.client.lastName}{o.watch && ` · ${o.watch.brand} ${o.watch.model}`} · issued {fmtDate(o.orderDate)}</div>}</div>
      {err && !o && <p data-testid="pay-error" className="px-6 py-8 text-sm text-rose-700">{err}</p>}
      {o && <div className="px-6 py-5">
        <ul className="divide-y divide-black/5 text-sm">{o.lines.map((l) => <li key={l.id} className="flex justify-between gap-4 py-2"><span>{l.description}{l.qty > 1 && <span className="text-black/50"> × {l.qty}</span>}</span><span className="tabular">{fmtMoneyCents(l.qty * l.rate)}</span></li>)}{o.shippingAmount > 0 && <li data-testid="pay-shipping-line" className="flex justify-between py-2 text-black/60"><span>Insured shipping</span><span className="tabular">{fmtMoneyCents(o.shippingAmount)}</span></li>}</ul>
        <dl className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-black/60">Total</dt><dd data-testid="pay-total" className="tabular">{fmtMoneyCents(o.total)}</dd></div>
          <div className="flex justify-between"><dt className="text-black/60">Paid so far</dt><dd data-testid="pay-paid" className="tabular">−{fmtMoneyCents(d.paid)}</dd></div>
          <div className="flex items-baseline justify-between pt-2"><dt className="text-xs uppercase tracking-[0.14em] text-black/60">Balance due</dt><dd data-testid="pay-balance" className="text-3xl font-semibold tabular">{fmtMoneyCents(o.balanceDue)}</dd></div>
        </dl>
        <p data-testid="pay-live-note" className="mt-2 inline-flex items-center gap-1 text-[11px] text-black/50"><RefreshCw size={11} /> Live — updates the moment the shop adjusts this invoice{d.sends.length > 0 && ` · sent ${d.sends.length}× · last told ${fmtMoneyCents(d.sends[d.sends.length - 1].balanceDue)}`}</p>
        {receipt && <div data-testid="pay-receipt" className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle2 size={16} className="mt-0.5" /><div><b>Payment of {fmtMoneyCents(receipt.amount)} recorded (mock).</b><div className="text-xs">{receipt.balance > 0 ? `Remaining balance ${fmtMoneyCents(receipt.balance)} — you can pay the rest any time from this same link.` : 'Paid in full — thank you. The shop sees this immediately.'}</div></div></div>}
        {o.balanceDue > 0 && o.status !== 'draft' ? <div className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-black/70">Amount to pay <span className="text-black/40">(partial payments allowed)</span><div className="mt-1 flex items-center gap-2"><span className="text-lg text-black/50">$</span><input data-testid="pay-amount" type="number" min={0.01} max={o.balanceDue} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 flex-1 rounded-md border border-black/15 px-3 text-lg tabular focus:border-[#0d2b1f] focus:outline-none" /><button type="button" data-testid="pay-full" onClick={() => setAmount(o.balanceDue.toFixed(2))} className="h-11 rounded-md border border-black/15 px-3 text-xs font-medium hover:bg-black/5">Full balance</button></div></label>
          <div className="grid gap-2 rounded-md border border-dashed border-black/15 p-3 text-xs text-black/50"><div className="flex items-center gap-2"><CreditCard size={14} /> Card number ···· ···· ···· 4242 <span className="ml-auto">MOCK</span></div><div>Exp 12/28 · CVC ···</div></div>
          <button type="button" data-testid="pay-submit" disabled={busy || !(Number(amount) > 0)} onClick={() => void pay()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0d2b1f] text-base font-semibold text-white disabled:opacity-40"><Lock size={15} /> Pay {Number(amount) > 0 ? fmtMoneyCents(Number(amount)) : ''}</button>
          {err && <p data-testid="pay-error" className="text-sm text-rose-700">{err}</p>}
        </div> : o.balanceDue <= 0 ? <div data-testid="pay-paid-in-full" className="mt-5 rounded-md bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900">Paid in full — nothing due.</div> : <p className="mt-5 text-sm text-black/60">This invoice is not open for payment yet.</p>}
      </div>}
      <div className="flex items-center justify-between border-t border-black/5 px-6 py-3 text-[11px] text-black/40"><button type="button" data-testid="pay-back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} className="shrink-0 whitespace-nowrap font-medium text-[#0d2b1f] hover:underline">← Return</button><span>Secured by <b>MOCK Intuit Payments</b> · this page is a prototype placeholder — in production this is the hosted Intuit/QuickBooks payment page for invoice {o?.qboInvoiceId ?? '(not yet pushed)'}.</span></div>
    </div>
  </div>;
}
