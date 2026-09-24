import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { SOStatus, SalesOrderWithRefs } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { SOBadge, SalesSubNav } from '@/components/sales/SalesBits';
import { FilterChip } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fullName, humanize } from '@/lib/format';

const STATUSES: SOStatus[] = ['draft', 'open', 'partial_fulfilled', 'fulfilled', 'shipped', 'picked_up', 'cancelled'];

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<SOStatus | 'all'>('all');
  const [rows, setRows] = useState<SalesOrderWithRefs[] | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { api.findSalesOrders(q).then(setRows); }, 120); return () => clearTimeout(t); }, [q]);
  useEffect(() => { ref.current?.focus(); }, []);
  const shown = useMemo(() => (rows ?? []).filter((o) => status === 'all' || o.status === status), [rows, status]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (rows ?? []).filter((o) => o.status === s).length])), [rows]);

  return (
    <div data-testid="sales-orders-page" className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Sales orders</h1>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">The invoicing vehicle · fulfil = QBO handoff (stub, hard stop) · pickup & ship close custody <Provisional note="Pack: invoice = fulfilled sales order with a stub QBO id. Separate invoice entity not modelled." /></p>
        </div>
        <SalesSubNav />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="relative mr-2"><Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" /><input ref={ref} data-testid="so-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SO #, estimate #, job #, name, pickup code…" className="h-8 w-72 rounded-sm border border-line bg-surface pl-7 pr-2 text-[13px] focus:border-ink focus:outline-none" /></label>
        <FilterChip active={status === 'all'} onClick={() => setStatus('all')} testId="so-filter-all">All</FilterChip>
        {STATUSES.map((s) => <FilterChip key={s} active={status === s} onClick={() => setStatus(s)} testId={`so-filter-${s}`}>{humanize(s)} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span></FilterChip>)}
      </div>
      <Card bodyClassName="p-0">
        <Table testId="so-table">
          <thead><tr><Th>SO</Th><Th>Customer</Th><Th>Job</Th><Th>Status</Th><Th>Badge</Th><Th>Channel</Th><Th className="text-right">Total</Th><Th className="text-right">Balance</Th><Th className="text-right">Order date</Th></tr></thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} data-testid={`so-row-${o.id}`} tabIndex={0} onClick={() => navigate(`/sales/${o.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/sales/${o.id}`)} className="cursor-pointer hover:bg-canvas/70 focus:bg-canvas focus:outline-none">
                <Td className="font-mono text-xs font-medium text-ink">{o.number}</Td>
                <Td className="font-medium text-ink">{fullName(o.client)}</Td>
                <Td className="font-mono text-xs text-ink-500">{o.job?.number ?? '—'}</Td>
                <Td><StatusPill status={o.status} /></Td>
                <Td><SOBadge order={o} /></Td>
                <Td className="text-xs capitalize text-ink-700">{o.channel ?? <span className="text-ink-400">—</span>}</Td>
                <Td className="tabular text-right font-medium">{fmtMoneyCents(o.total)}</Td>
                <Td className={`tabular text-right ${o.balanceDue > 0 ? 'font-medium text-rose-700' : 'text-ink-400'}`}>{fmtMoneyCents(o.balanceDue)}</Td>
                <Td className="tabular text-right text-ink-500">{fmtDate(o.orderDate)}</Td>
              </tr>
            ))}
            {rows && shown.length === 0 && <EmptyRow colSpan={9} text="No sales orders match." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
