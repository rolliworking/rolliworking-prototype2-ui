import { Link2, Link2Off, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { QboSetup, QboSyncState } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Provisional } from '@/components/estimates/EstimateBits';
import { Flash, Head } from '@/components/rs/RsBits';
import { Card } from '@/components/ui/Card';
import { fmtDate, fmtMoney, fmtTime } from '@/lib/format';

const STATE_CLS: Record<QboSyncState, string> = { synced: 'bg-moss-50 text-moss-700', pending: 'bg-amber-50 text-amber-800', conflict: 'bg-rose-50 text-rose-700', not_linked: 'bg-canvas text-ink-400' };
const TOGGLES: { key: keyof QboSetup['toggles']; label: string; blurb: string }[] = [
  { key: 'pushInvoices', label: 'Push invoices', blurb: 'Fulfilled sales orders → QBO Invoice (one per SO, dept items per line)' },
  { key: 'pushPayments', label: 'Push payments', blurb: 'Card / cash / check / wire recorded here → QBO Payment applied to the invoice' },
  { key: 'pushClients', label: 'Push clients', blurb: 'New / edited clients → QBO Customer (required before client sync)' },
  { key: 'pullPayments', label: 'Pull payments', blurb: 'Payments taken inside QBO (Intuit hosted page) flow back to the SO balance' },
];

// Setup → Integrations → QuickBooks. MOCKED end to end: connection, toggles, field mapping, client sync table, push queue. No OAuth, no network.
export default function QboSetupPage() {
  const { user } = useAuth(); const mgr = user?.accessTier === 'manager';
  const [s, setS] = useState<QboSetup | null>(null); const [company, setCompany] = useState('Rolli Group LLC'); const [filter, setFilter] = useState<QboSyncState | 'all'>('all'); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { api.getQboSetup().then(setS); }, []);
  const run = async (f: () => Promise<QboSetup>, ok?: string) => { try { setErr(null); setS(await f()); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } };
  if (!s) return null;
  const rows = s.clients.filter((r) => filter === 'all' || r.state === filter); const count = (k: QboSyncState) => s.clients.filter((r) => r.state === k).length;
  return <div data-testid="qbo-setup-page" className="space-y-4">
    <Head title="QuickBooks Online" sub={<><Link to="/integrations" className="text-brand hover:underline">Integrations</Link> → QuickBooks · <span className="rounded bg-amber-50 px-1 font-semibold text-amber-800">MOCKED</span> — no OAuth, nothing leaves the browser <Provisional note="Keeper owns the real Intuit OAuth + webhook; this screen fixes the mapping and the operator flow" /></>} />
    <Flash error={err} msg={msg} />
    <div className="grid grid-cols-2 gap-3">
      <Card title="Connection" testId="qbo-connection" action={<span data-testid="qbo-status" className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.connected ? 'bg-moss-50 text-moss-700' : 'bg-rose-50 text-rose-700'}`}>{s.connected ? 'connected · mock' : 'not connected'}</span>}>
        {s.connected ? <div className="space-y-1 text-xs text-ink-700"><div><b>{s.company}</b> · realm <span className="font-mono">{s.realmId}</span></div><div className="text-ink-500">Connected by {s.connectedBy} · {fmtDate(s.connectedAt!)} {fmtTime(s.connectedAt!)}{s.lastSync && <> · last sync {fmtTime(s.lastSync)}</>}</div>{mgr && <button data-testid="qbo-disconnect" onClick={() => void run(api.qboDisconnect, 'Disconnected')} className="mt-2 inline-flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs hover:bg-canvas"><Link2Off size={12} /> Disconnect</button>}</div>
          : <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => api.qboConnect(company), 'Connected (mock)'); }}><input data-testid="qbo-company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 flex-1 rounded-sm border border-line px-2 text-xs" placeholder="QBO company name" /><button data-testid="qbo-connect" disabled={!mgr} className="inline-flex h-8 items-center gap-1 rounded-sm bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40"><Link2 size={12} /> Connect (mock)</button></form>}
        {!mgr && <p className="mt-2 text-[11px] text-ink-400">Manager tier changes the connection and toggles.</p>}
      </Card>
      <Card title="Push / pull" testId="qbo-toggles">
        <ul className="space-y-1.5">{TOGGLES.map((t) => <li key={t.key} className="flex items-center gap-3 text-xs"><button data-testid={`qbo-toggle-${t.key}`} role="switch" aria-checked={s.toggles[t.key]} disabled={!mgr} onClick={() => void run(() => api.setQboToggle(t.key, !s.toggles[t.key]))} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${s.toggles[t.key] ? 'bg-moss' : 'bg-ink-300'} disabled:opacity-40`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${s.toggles[t.key] ? 'left-[18px]' : 'left-0.5'}`} /></button><div><div className="font-medium text-ink">{t.label}</div><div className="text-[11px] text-ink-500">{t.blurb}</div></div></li>)}</ul>
      </Card>
    </div>
    <Card title="Field mapping" subtitle="RolliSuite record → QBO object · fixed for the prototype" testId="qbo-mapping" bodyClassName="p-0">
      <table className="w-full text-xs"><thead><tr className="text-left text-[10px] uppercase tracking-wide text-ink-400"><th className="px-3 py-1.5 font-medium">RolliSuite</th><th className="px-3 py-1.5 font-medium">QuickBooks</th><th className="px-3 py-1.5 font-medium">Direction</th></tr></thead><tbody>{s.mapping.map((m) => <tr key={m.rolli} data-testid="qbo-map-row" className="border-t border-line"><td className="px-3 py-1.5 text-ink">{m.rolli}</td><td className="px-3 py-1.5 font-mono text-ink-700">{m.qbo}</td><td className="px-3 py-1.5"><span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-500">{m.direction}</span></td></tr>)}</tbody></table>
    </Card>
    <Card title="Client sync" subtitle={`${count('synced')} synced · ${count('conflict')} conflicts · ${count('not_linked')} not linked`} testId="qbo-clients" action={mgr && <button data-testid="qbo-sync-all" onClick={() => void run(api.qboSyncAllClients, 'Client sync finished')} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-1 text-xs font-semibold text-white"><RefreshCw size={12} /> Sync all clients</button>} bodyClassName="p-0">
      <div className="flex gap-1 border-b border-line px-3 py-1.5">{(['all', 'synced', 'conflict', 'not_linked'] as const).map((k) => <button key={k} data-testid={`qbo-filter-${k}`} onClick={() => setFilter(k)} className={`rounded-full px-2 py-0.5 text-[11px] ${filter === k ? 'bg-ink text-white' : 'text-ink-500 hover:bg-canvas'}`}>{k.replace('_', ' ')}{k !== 'all' && <span className="ml-1 opacity-60">{count(k)}</span>}</button>)}</div>
      <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">{rows.map((r) => <li key={r.client.id} data-testid={`qbo-client-${r.client.id}`} className="flex items-center gap-3 px-3 py-1.5 text-xs"><Link to={`/clients/${r.client.id}`} className="w-44 truncate font-medium text-ink hover:underline">{r.client.firstName} {r.client.lastName}{r.client.company && <span className="text-ink-400"> · {r.client.company}</span>}</Link><span className="w-24 font-mono text-ink-500">{r.qboCustomerId ?? '—'}</span><span data-testid={`qbo-client-state-${r.client.id}`} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATE_CLS[r.state]}`}>{r.state.replace('_', ' ')}</span><span className="flex-1 truncate text-[11px] text-rose-700">{r.issue}</span><span className="text-[10px] text-ink-400">{r.lastSync ? fmtTime(r.lastSync) : ''}</span>
        {mgr && (r.state === 'conflict' ? <><button data-testid={`qbo-link-${r.client.id}`} onClick={() => void run(() => api.qboResolveConflict(r.client.id, 'link'))} className="rounded-sm border border-line px-2 py-0.5 hover:bg-canvas">Link existing</button><button data-testid={`qbo-skip-${r.client.id}`} onClick={() => void run(() => api.qboResolveConflict(r.client.id, 'skip'))} className="rounded-sm border border-line px-2 py-0.5 hover:bg-canvas">Skip</button></> : <button data-testid={`qbo-sync-${r.client.id}`} onClick={() => void run(() => api.qboSyncClient(r.client.id))} className="rounded-sm border border-line px-2 py-0.5 hover:bg-canvas">{r.state === 'synced' ? 'Re-sync' : 'Push'}</button>)}</li>)}</ul>
    </Card>
    <div className="grid grid-cols-2 gap-3">
      <Card title="Invoice push queue" subtitle="Sales orders marked for QBO · pushed by the connector when live" testId="qbo-queue" bodyClassName="p-0"><ul className="divide-y divide-line">{s.queue.map((q) => <li key={q.salesOrderId} className="flex items-center gap-3 px-3 py-1.5 text-xs"><Link to={`/sales/${q.salesOrderId}`} className="font-mono font-semibold text-ink hover:underline">{q.number}</Link><span className="flex-1 truncate text-ink-700">{q.client}</span><span className="font-mono">{fmtMoney(q.total)}</span><span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-500">{q.syncState.replace('_', ' ')}</span></li>)}{!s.queue.length && <li className="px-3 py-4 text-center text-xs text-ink-400">Nothing queued</li>}</ul></Card>
      <Card title="Activity" testId="qbo-log" bodyClassName="p-0"><ul className="max-h-60 divide-y divide-line overflow-y-auto">{s.log.map((l, i) => <li key={i} data-testid="qbo-log-row" className="px-3 py-1.5 text-[11px] text-ink-700">{fmtDate(l.at)} {fmtTime(l.at)} · <b>{l.by}</b> · {l.text}</li>)}{!s.log.length && <li className="px-3 py-4 text-center text-xs text-ink-400">No activity yet</li>}</ul></Card>
    </div>
  </div>;
}
