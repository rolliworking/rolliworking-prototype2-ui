import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { IntegrationTile, JobWithRefs, QboQueueRow, Report, SalesOrderWithRefs } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { downloadCsv, field, Flash, Head, Tabs, useLoad } from '@/components/rs/RsBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

// ---- Labels: batch reprint → existing Label Queue -------------------------------------------------
export function LabelsPage() {
  const { data, error, msg, run } = useLoad(async () => ({ jobs: await api.getJobs(), estimates: await api.getEstimates(), watches: await api.getWatches(), queue: await api.getLabelQueue() }));
  const [kind, setKind] = useState<'job' | 'estimate' | 'watch'>('job');
  const [sel, setSel] = useState<string[]>([]);
  const [range, setRange] = useState('');
  if (!data) return null;
  const rows: { id: string; label: string; sub: string }[] = kind === 'job' ? data.jobs.map((j: JobWithRefs) => ({ id: j.id, label: j.number, sub: `${j.client.lastName} · ${j.watch.model}` })) : kind === 'estimate' ? data.estimates.filter((e) => e.watchId).map((e) => ({ id: e.id, label: e.number, sub: `${e.client.lastName} · ${e.watch?.model ?? ''}` })) : data.watches.map((w) => ({ id: w.id, label: `${w.reference} / ${w.serial}`, sub: `${w.brand} ${w.model}` }));
  const applyRange = () => { const [a, b] = range.split(/[-–]/).map((s) => s.trim().toUpperCase()); if (!a) return; const ids = rows.filter((r) => { const n = r.label.toUpperCase(); return b ? n >= a && n <= b : n.startsWith(a); }).map((r) => r.id); setSel(Array.from(new Set([...sel, ...ids]))); };
  return <div data-testid="labels-page" className="space-y-4">
    <Head title="Labels" sub={<>Batch reprint by job, estimate or watch — ranges accepted (e.g. <span className="font-mono">E02011–E02015</span>) · everything queues unprinted to the <Link to="/intake/labels" className="text-brand underline-offset-2 hover:underline">Label Queue</Link> <Provisional note="Printing is a mock flag" /></>} />
    <Flash error={error} msg={msg} />
    <Card title="Pick records" action={<div className="flex items-center gap-2"><input data-testid="labels-range" value={range} onChange={(e) => setRange(e.target.value)} placeholder="range / prefix" className={`${field} w-40 font-mono`} /><Button size="sm" data-testid="labels-range-apply" onClick={applyRange}>Select range</Button><Button size="sm" variant="primary" data-testid="labels-queue" disabled={!sel.length} onClick={() => run(async () => { await api.queueLabelsFor(kind, sel); setSel([]); }, `${sel.length * 2} labels queued`)}>Queue {sel.length ? `${sel.length * 2} labels` : ''}</Button></div>} bodyClassName="p-0" testId="labels-card">
      <div className="px-4 pt-3"><Tabs prefix="labels" active={kind} onChange={(k) => { setKind(k as typeof kind); setSel([]); }} tabs={[{ key: 'job', label: 'By job' }, { key: 'estimate', label: 'By estimate' }, { key: 'watch', label: 'By watch' }]} /></div>
      <ul className="max-h-[480px] divide-y divide-line/70 overflow-auto">{rows.map((r) => <li key={r.id}><label data-testid={`label-pick-${r.id}`} className="flex cursor-pointer items-center gap-3 px-4 py-1.5 text-xs hover:bg-canvas"><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /><span className="w-40 font-mono font-semibold">{r.label}</span><span className="text-ink-500">{r.sub}</span></label></li>)}</ul>
    </Card>
    <div className="text-xs text-ink-500" data-testid="labels-queue-count">Label Queue now holds {data.queue.length} labels ({data.queue.filter((l) => !l.printed).length} unprinted).</div>
  </div>;
}

// ---- Reports ---------------------------------------------------------------------------------------
const REPORTS = [{ key: 'funnel', label: 'Estimate funnel' }, { key: 'throughput', label: 'Job throughput' }, { key: 'aging', label: 'Aging' }, { key: 'pnl', label: 'Department P&L' }] as const;
export function ReportsPage() {
  const [key, setKey] = useState<typeof REPORTS[number]['key']>('funnel');
  const { data: r } = useLoad<Report>(() => api.getReport(key), [key]);
  const { data: stats } = useLoad(() => api.getDashboardStats());
  const money = (c: string) => /value|revenue/.test(c);
  return <div data-testid="reports-page" className="space-y-4">
    <Head title="Reports" sub={<>Four reports, each exportable as CSV · numbers reconcile with the dashboard cards <Provisional note="P&L uses the labor-only rule: service lines → W/B/P/PM; parts & shipping = no_dept_product" /></>} action={r && <Button variant="primary" data-testid="report-export" onClick={() => downloadCsv(`${r.key}.csv`, api.reportToCsv(r))}>Export CSV</Button>} />
    <Tabs prefix="report" active={key} onChange={(k) => setKey(k as typeof key)} tabs={REPORTS.map((x) => ({ key: x.key, label: x.label }))} />
    {r && <Card title={r.title} subtitle={r.note} bodyClassName="p-0" testId={`report-${r.key}`}><Table><thead><tr>{r.columns.map((c) => <Th key={c} className={money(c) || /count|jobs|estimates|total|^\d{4}-\d{2}$/.test(c) ? 'text-right' : ''}>{c}</Th>)}</tr></thead><tbody>
      {r.rows.map((row) => <tr key={row.label} data-testid={`report-row-${row.label}`}>{r.columns.map((c) => { const v = row.values[c]; return <Td key={c} className={`text-xs ${typeof v === 'number' ? 'tabular text-right' : ''} ${row.label === 'total' || row.label === 'in_progress' ? 'font-semibold' : ''}`}>{typeof v === 'number' && money(c) ? fmtMoneyCents(v) : v ?? ''}</Td>; })}</tr>)}
    </tbody></Table></Card>}
    {stats && <div data-testid="report-reconcile" className="text-[11px] text-ink-500">Dashboard now: open estimates {stats.openEstimates} · awaiting approval {stats.awaitingApproval} · in progress {stats.inProgress} · awaiting pickup {stats.awaitingPickup} · revenue this month {fmtMoneyCents(stats.revenueThisMonth)}</div>}
  </div>;
}

// ---- Accounting (QBO stub) -------------------------------------------------------------------------
export function AccountingPage() {
  const { data, error, msg, run } = useLoad(async () => ({ orders: await api.getSalesOrders(), qbo: await api.getQboQueue() }));
  const [tab, setTab] = useState('invoices');
  if (!data) return null;
  const live = data.orders.filter((o: SalesOrderWithRefs) => o.status !== 'draft');
  const payments = data.orders.flatMap((o) => o.payments.map((p) => ({ ...p, so: o })));
  const exp = (k: 'invoices' | 'payments' | 'qbo') => run(async () => downloadCsv(`${k}-export.csv`, await api.exportAccountingCsv(k)), 'Export file downloaded (stub)');
  return <div data-testid="accounting-page" className="space-y-4">
    <Head title="Accounting" sub={<>Invoice register · payment register · QuickBooks queue — all local <Provisional note="QBO is a HARD-STOP stub: fake ids, fake sync states, nothing external" /></>} action={<Button variant="primary" data-testid="acct-export" onClick={() => exp(tab as 'invoices' | 'payments' | 'qbo')}>Export {tab} CSV (stub)</Button>} />
    <Flash error={error} msg={msg} />
    <Tabs prefix="acct" active={tab} onChange={setTab} tabs={[{ key: 'invoices', label: 'Invoice register', count: live.length }, { key: 'payments', label: 'Payment register', count: payments.length }, { key: 'qbo', label: 'Queued for QBO', count: data.qbo.filter((q: QboQueueRow) => q.syncState !== 'not_queued').length }]} />
    {tab === 'invoices' && <Card bodyClassName="p-0" testId="acct-invoices"><Table><thead><tr><Th>SO</Th><Th>Client</Th><Th>Status</Th><Th>Date</Th><Th className="text-right">Total</Th><Th className="text-right">Paid</Th><Th className="text-right">Balance</Th></tr></thead><tbody>{live.map((o) => <tr key={o.id} data-testid={`acct-inv-${o.id}`}><Td className="font-mono text-xs">{o.number}</Td><Td className="text-xs">{o.client.firstName} {o.client.lastName}</Td><Td><StatusPill status={o.status} /></Td><Td className="text-xs text-ink-500">{fmtDate(o.orderDate)}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(o.total)}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(o.total - o.balanceDue)}</Td><Td className={`tabular text-right text-xs ${o.balanceDue > 0 ? 'text-rose-700' : ''}`}>{fmtMoneyCents(o.balanceDue)}</Td></tr>)}</tbody></Table></Card>}
    {tab === 'payments' && <Card bodyClassName="p-0" testId="acct-payments"><Table><thead><tr><Th>When</Th><Th>SO</Th><Th>Method</Th><Th className="text-right">Amount</Th><Th>By</Th><Th>Note</Th></tr></thead><tbody>{payments.sort((a, b) => b.at.localeCompare(a.at)).map((p) => <tr key={p.id} data-testid={`acct-pay-${p.id}`}><Td className="text-xs text-ink-500">{fmtDate(p.at)}</Td><Td className="font-mono text-xs">{p.so.number}</Td><Td className="text-xs capitalize">{p.method}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(p.amount)}</Td><Td className="text-xs">{p.by} · {p.station}</Td><Td className="text-[11px] text-ink-500">{p.note}</Td></tr>)}{!payments.length && <EmptyRow colSpan={6} text="No payments" />}</tbody></Table></Card>}
    {tab === 'qbo' && <Card bodyClassName="p-0" testId="acct-qbo"><Table><thead><tr><Th>SO</Th><Th>Client</Th><Th className="text-right">Total</Th><Th>QBO id</Th><Th>Sync state</Th></tr></thead><tbody>{data.qbo.map((q) => <tr key={q.salesOrderId} data-testid={`acct-qbo-${q.salesOrderId}`}><Td className="font-mono text-xs">{q.number}</Td><Td className="text-xs">{q.client}</Td><Td className="tabular text-right text-xs">{fmtMoneyCents(q.total)}</Td><Td className="font-mono text-[11px] text-ink-500">{q.qboInvoiceId ?? '—'}</Td><Td><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${q.syncState === 'error_stub' ? 'bg-rose-50 text-rose-700' : q.syncState === 'pushed_stub' ? 'bg-moss-50 text-moss-700' : q.syncState === 'queued' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{q.syncState.replace('_', ' ')}</span></Td></tr>)}</tbody></Table></Card>}
  </div>;
}

// ---- Integrations + Help ---------------------------------------------------------------------------
export function IntegrationsPage() {
  const { data } = useLoad(() => api.getIntegrations());
  return <div data-testid="integrations-page" className="space-y-4">
    <Head title="Integrations" sub={<>Honest health tiles — nothing here is connected <Provisional note="All integrations are stubs in the prototype" /></>} />
    <div className="grid grid-cols-2 gap-3">{(data ?? []).map((t: IntegrationTile) => <Card key={t.key} title={t.name} testId={`integration-${t.key}`} action={<span data-testid={`integration-health-${t.key}`} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.health === 'stub' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'}`}>{t.health === 'stub' ? 'not connected — stub' : 'not connected'}</span>}><p className="text-xs text-ink-700">{t.blurb}</p><p className="mt-2 text-[11px] text-ink-400">Last check {fmtDate(t.lastCheck)} · <button data-testid={`integration-connect-${t.key}`} className="text-brand underline-offset-2 hover:underline" onClick={() => alert(`${t.name}: connecting is out of scope for the prototype (stub).`)}>Connect…</button></p></Card>)}</div>
  </div>;
}

const HELP = [
  { role: 'Concierge', items: ['Answer the phone: type any identifier in the top bar → Client 360', 'Intake: Arrival → Receive Package → Work Order; discrepancy packages land on your Today', 'Pickup Station: verify code or proxy + ID, take hand-back photos, log a bypass if unpaid', 'RolliConnect Inbox: reply; the email queues to Outbox'] },
  { role: 'Inspector', items: ['Receive Watch: verify against the estimate, pick the workflow (routing authority), labels queue automatically', 'Review gate: photos for every kind, report for service jobs', 'QC evidence: four slots keyed to the watch label before QC pass'] },
  { role: 'Watchmaker', items: ['Bench: pull next, start service, send to QC', 'Parts: chat → attach → submit; approval learns aliases and parks a parts hold', 'Shop Time: minutes never move status'] },
  { role: 'Manager', items: ['Supervisor board: assign, approve parts, holds, QC queue', 'Sales: fulfil (QBO stub), push to pickup/ship, admin marks with a reason', 'Setup: stations, users & roles, catalog, templates', 'Reports & Accounting: CSV exports reconcile with the dashboard'] },
];
export function HelpPage() {
  return <div data-testid="help-page" className="space-y-4">
    <Head title="Help" sub={<>Per-role quickstarts · keyboard: Enter submits, ⌘/Ctrl+Enter confirms, Alt+T quick-add <Provisional note="Placeholder content — real guides pending" /></>} />
    <div className="grid grid-cols-2 gap-3">{HELP.map((h) => <Card key={h.role} title={`${h.role} quickstart`} testId={`help-${h.role.toLowerCase()}`}><ol className="list-decimal space-y-1 pl-4 text-xs text-ink-700">{h.items.map((i) => <li key={i}>{i}</li>)}</ol></Card>)}</div>
  </div>;
}
