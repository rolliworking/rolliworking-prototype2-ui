import clsx from 'clsx';
import { AlertTriangle, Download, Gauge } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as cu from '@/api/custody';
import { BackfillModal, useCustodyTick } from '@/components/custody/CustodyChip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { fmtDate } from '@/lib/format';

export const downloadCsv = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };

// The unaccounted list and the −1 list are the SAME list — this card is the entry point from Setup → Custody / Analytics; the chips on job / SO / pickup are the other
export const UnaccountedList = ({ compact }: { compact?: boolean }) => {
  useCustodyTick(); const rows = cu.getUnaccountedSync(); const stubs = cu.getFoundNoJobSync(); const [fix, setFix] = useState<{ jobId: string; part: cu.UnaccountedRow['part'] } | null>(null);
  return <div className="space-y-2 text-xs">
    <ul data-testid="custody-unaccounted-list" data-count={rows.length} className="divide-y divide-line/60 rounded-sm border border-line">
      {rows.map((r) => <li key={r.itemKey} data-testid={`custody-minus1-${r.jobId}-${r.part}`} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <span className="inline-flex items-center gap-1 rounded-sm bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"><AlertTriangle size={10} /> −1</span><Link to={r.link} className="font-mono font-semibold text-brand hover:underline">{r.jobNumber}</Link><span>{r.partLabel}</span><span className="text-ink-600">{r.client} · {r.watch}</span>
        {!compact && <span className="text-ink-400">last seen (legacy): {r.legacy}</span>}{r.soNumber && <Link to={`/sales/${r.soId}`} data-testid={`custody-minus1-so-${r.jobId}-${r.part}`} className="rounded-sm bg-amber-50 px-1 text-amber-800 ring-1 ring-amber-200 hover:underline">{r.soNumber} at invoice</Link>}
        <span className="ml-auto font-mono">{r.value === null ? 'unvalued' : `−$${r.value.toLocaleString()}`}</span><button type="button" data-testid={`custody-minus1-fix-${r.jobId}-${r.part}`} onClick={() => setFix({ jobId: r.jobId, part: r.part })} className="rounded-sm border border-rose-300 bg-rose-50 px-1.5 py-0.5 font-medium text-rose-800 hover:bg-rose-100">Add to custody</button>
      </li>)}
      {!rows.length && <li data-testid="custody-unaccounted-empty" className="px-2 py-3 text-moss-800">Every open-job item has a real custody scan — coverage 100%.</li>}
    </ul>
    {stubs.length > 0 && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Found, no job · review</div><ul data-testid="custody-found-no-job" className="divide-y divide-line/60 rounded-sm border border-amber-200">{stubs.map((s) => <li key={s.id} data-testid={`custody-stub-row-${s.id}`} className="flex items-center gap-2 px-2 py-1.5"><span className="font-mono">{s.label}</span>{s.reference && <span>ref {s.reference}</span>}{s.serial && <span className="font-mono text-ink-500">S/N {s.serial}</span>}<span className="text-ink-500">at {s.nodeLabel} · {fmtDate(s.at)} · {s.by}</span><Button size="sm" className="ml-auto" data-testid={`custody-stub-review-${s.id}`} onClick={() => void cu.reviewStub(s.id)}>Reviewed</Button></li>)}</ul></div>}
    {fix && <BackfillModal jobId={fix.jobId} part={fix.part} onClose={() => setFix(null)} onDone={() => undefined} />}
  </div>;
};

// Custody coverage report — % of open-job items with a real custody event, by node, trend since the first audit. CSV = every audit / backfill event.
export const CustodyCoverageCard = ({ withList }: { withList?: boolean }) => {
  useCustodyTick(); const c = cu.coverageSync(); const [more, setMore] = useState(false);
  return <Card testId="custody-coverage-card" className={clsx('border-l-[3px]', c.pct >= 100 ? 'border-moss' : 'border-rose-600')} title={<span className="inline-flex items-center gap-2"><Gauge size={13} /> Custody coverage <span data-testid="custody-coverage-pct" data-pct={c.pct} className={clsx('rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold', c.pct >= 100 ? 'bg-moss-50 text-moss-800' : 'bg-rose-50 text-rose-700')}>{c.pct}%</span></span>} subtitle={`${c.covered} of ${c.total} open-job items have a real custody scan${c.since ? ` · since audit start ${fmtDate(c.since)}` : ''} · ${c.total - c.covered} not on hand (−${c.total - c.covered})`} action={<span className="flex gap-1.5"><Button size="sm" data-testid="custody-coverage-csv" onClick={() => downloadCsv('custody-audit-log.csv', cu.auditLogCsv())}><Download size={12} /> Audit log CSV</Button><Link to="/setup/custody" data-testid="custody-coverage-open" className="inline-flex h-7 items-center text-xs text-brand hover:underline">Setup → Custody</Link></span>}>
    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-line"><div data-testid="custody-coverage-bar" className={clsx('h-full', c.pct >= 100 ? 'bg-moss' : 'bg-rose-600')} style={{ width: `${Math.min(100, c.pct)}%` }} /></div>
    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
      <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">By node</div><ul data-testid="custody-coverage-nodes" className="max-h-40 space-y-0.5 overflow-y-auto">{(more ? c.byNode : c.byNode.slice(0, 8)).map((n) => <li key={n.key} data-testid={`custody-coverage-node-${n.key}`} data-covered={n.covered} data-total={n.total} className="flex items-center gap-2"><span className="w-44 truncate">{n.label}</span><span className="font-mono">{n.covered}/{n.total}</span>{n.covered < n.total && <span className="rounded-sm bg-rose-50 px-1 text-rose-700">−{n.total - n.covered}</span>}</li>)}</ul>{c.byNode.length > 8 && <button type="button" onClick={() => setMore(!more)} className="mt-1 text-[11px] text-brand hover:underline">{more ? 'less' : `all ${c.byNode.length} nodes`}</button>}</div>
      <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Trend · audit + backfill events</div><ul data-testid="custody-coverage-trend" className="space-y-0.5 font-mono">{c.trend.slice(-6).map((t) => <li key={t.day}>{t.day} · +{t.events} · {t.cumulative} total</li>)}{!c.trend.length && <li className="text-ink-400">no audit events yet</li>}</ul></div>
    </div>
    {withList && <div className="mt-3 border-t border-line pt-2"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700">Not on hand · −1 client assets (= unaccounted)</div><UnaccountedList compact /></div>}
  </Card>;
};

// MH hitlist card until coverage is 100%
export const CustodyCoverageHitlistCard = () => {
  useCustodyTick(); const c = cu.coverageSync(); if (c.pct >= 100) return null; const rows = cu.getUnaccountedSync();
  return <Card testId="custody-coverage-hitlist-card" bodyClassName="p-0" className="border-l-[3px] border-rose-600" title={<span className="inline-flex items-center gap-2"><Gauge size={13} className="text-rose-700" /> Custody coverage <span data-testid="custody-coverage-hitlist-pct" className="rounded-sm bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-700">{c.pct}%</span> · <span data-testid="custody-coverage-hitlist-count" className="font-mono text-[11px] text-ink-500">−{rows.length}</span></span>} subtitle="Client assets on open jobs without a real custody scan · clears at 100%" action={<Link to="/setup/custody" data-testid="custody-coverage-hitlist-open" className="text-xs text-brand hover:underline">Audit / backfill →</Link>}>
    <ul className="divide-y divide-line/70 text-xs">{rows.slice(0, 6).map((r) => <li key={r.itemKey} data-testid={`custody-coverage-hitlist-row-${r.jobId}-${r.part}`} className="flex items-center gap-2 px-4 py-1.5"><Link to={r.link} className="font-mono font-semibold text-brand hover:underline">{r.jobNumber}</Link><span>{r.partLabel}</span><span className="text-ink-500">{r.client}</span>{r.soNumber && <span className="rounded-sm bg-amber-50 px-1 text-[10px] text-amber-800">{r.soNumber} at invoice</span>}<span className="ml-auto font-mono text-rose-700">{r.value === null ? '−1' : `−$${r.value.toLocaleString()}`}</span></li>)}</ul>
  </Card>;
};
