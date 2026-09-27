import { Camera, CreditCard, ShieldAlert, Vault } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { BypassEvent } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoney, fmtTime } from '@/lib/format';

const KIND: Record<BypassEvent['kind'], { label: string; icon: typeof Camera; tone: string }> = { receiving_camera: { label: 'Receiving · camera bypass', icon: Camera, tone: 'bg-sky-50 text-sky-800 ring-sky-200' }, payment_release: { label: 'Payment-release bypass', icon: CreditCard, tone: 'bg-amber-50 text-amber-900 ring-amber-200' }, other: { label: 'Bypass', icon: ShieldAlert, tone: 'bg-canvas text-ink-700 ring-line' } };
const legit = (e: BypassEvent) => e.kind === 'payment_release' && e.context.minutesSincePayment !== undefined && e.context.minutesSincePayment <= 10;

// Owner accountability surface — the first real instance of the "manager hit list": live client-asset $ on premises + every bypass use, newest first.
export default function HitlistPage() {
  const { data, reload } = useAsync(() => api.getHitlist());
  useEffect(() => { const t = window.setInterval(reload, 15_000); return () => window.clearInterval(t); }, [reload]);
  if (!data) return null;
  return <div data-testid="hitlist-page" className="space-y-4">
    <div><h1 className="text-xl font-semibold tracking-tight text-ink">MH Hitlist</h1><p className="mt-0.5 text-xs text-ink-500">Live — recomputed from custody + shipping on every load (refreshes every 15 s). Bypasses are a visibility feed, not an approval gate: the override already happened, this makes sure it's seen.</p></div>
    <div className="grid gap-3 md:grid-cols-[360px_1fr]">
      <Card testId="asset-value-card" className="border-l-[3px] border-ink">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><Vault size={13} /> Client asset value on hand</div>
        <div data-testid="asset-value-total" className="mt-1 text-4xl font-semibold tabular text-ink">{fmtMoney(data.assetTotal)}</div>
        <div className="mt-1 text-xs text-ink-500">{data.assets.length} client items in custody · Σ shipping-insurance declared value · drop-offs count $0</div>
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">{data.assets.map((a) => <li key={a.jobId} data-testid={`asset-row-${a.jobId}`} data-source={a.source} className="flex items-center gap-2 border-t border-line pt-1"><Link to={`/jobs/${a.jobId}`} className="font-mono font-semibold text-ink hover:underline">{a.jobNumber}</Link><span className="truncate text-ink-700">{a.client} · {a.watch}</span><span className="ml-auto text-[10px] text-ink-400">{a.holders.join(', ')}</span><span className={`tabular w-20 text-right font-semibold ${a.value ? 'text-ink' : 'text-ink-400'}`}>{fmtMoney(a.value)}</span><span className={`w-16 text-right text-[10px] ${a.source === 'insurance' ? 'text-moss-700' : 'text-ink-400'}`}>{a.source === 'insurance' ? 'insured' : a.source === 'dropoff' ? 'drop-off' : 'no value'}</span></li>)}</ul>
      </Card>
      <Card title="Bypass use" subtitle={`${data.bypasses.length} entries · who · when · what it was used on · context to judge legitimacy at a glance`} testId="bypass-card" bodyClassName="p-0">
        <ul className="divide-y divide-line text-xs">{data.bypasses.map((e) => { const k = KIND[e.kind]; const I = k.icon; return <li key={e.id} data-testid={`bypass-${e.id}`} data-kind={e.kind} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
          <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${k.tone}`}><I size={11} /> {k.label}</span>
          <span className="font-semibold text-ink">{e.by}</span><span className="text-ink-500">{e.station}</span><span className="text-ink-500">{fmtDate(e.at)} {fmtTime(e.at)}</span>
          {e.jobNumber && <span className="font-mono font-semibold text-ink">{e.jobNumber}</span>}
          {e.kind === 'payment_release' && <span data-testid={`bypass-ctx-${e.id}`} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${legit(e) ? 'bg-moss-50 text-moss-800' : 'bg-rose-50 text-rose-800'}`}>{e.context.invoiceAmount !== undefined && `invoice ${fmtMoney(e.context.invoiceAmount)} · `}{e.context.minutesSincePayment !== undefined ? `${e.context.minutesSincePayment} min since payment${legit(e) ? ' · within Intuit sync lag' : ' · beyond sync lag — check'}` : 'no payment on file — check'}</span>}
          <span className="basis-full text-ink-700">{e.reason}{e.context.detail && <span className="text-ink-400"> · {e.context.detail}</span>}</span>
        </li>; })}{!data.bypasses.length && <li className="px-3 py-6 text-center text-ink-400">No bypasses used.</li>}</ul>
      </Card>
    </div>
  </div>;
}
