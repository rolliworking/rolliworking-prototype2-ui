import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client360, EstimateWithRefs } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, humanize } from '@/lib/format';

const when = (iso: string) => `${fmtDate(iso)} ${new Date(iso).getFullYear() !== new Date().getFullYear() ? new Date(iso).getFullYear() : ''}`.trim();
const watchLabel = (w: { brand: string; model: string } | null) => (w ? `${w.brand} ${w.model}` : '—');

const EstimateRows = ({ e }: { e: EstimateWithRefs }) => {
  const [open, setOpen] = useState(false);
  const hasRevs = e.revisions.length > 0;
  return (
    <Fragment>
      <tr data-hit={`est-${e.id}`} data-testid={`client360-estimate-${e.id}`} className="transition-colors hover:bg-canvas">
        <Td className="font-mono text-xs font-medium text-ink">
          <span className="inline-flex items-center gap-1">
            {hasRevs ? (
              <button type="button" data-testid={`estimate-revisions-toggle-${e.id}`} onClick={() => setOpen((o) => !o)} className="-ml-1 rounded-sm p-0.5 text-ink-400 hover:text-ink" aria-label="Toggle revisions">
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : <span className="w-[13px]" />}
            <Link to={`/estimates/${e.id}`} className="hover:underline">{e.number}</Link>
            {e.revision > 1 && <span className="rounded-sm bg-brand-50 px-1 text-[10px] text-brand">rev {e.revision}</span>}
          </span>
        </Td>
        <Td className="text-ink-700">{watchLabel(e.watch)}</Td>
        <Td className="max-w-[220px] truncate text-ink-500" title={e.lines.map((l) => l.description).join(' · ')}>{e.lines[0]?.description}{e.lines.length > 1 && <span className="text-ink-400"> +{e.lines.length - 1}</span>}</Td>
        <Td><StatusPill status={e.status} /></Td>
        <Td className="tabular text-right font-medium">{fmtMoneyCents(e.total)}</Td>
        <Td className="tabular whitespace-nowrap text-right text-ink-500">{when(e.createdAt)}</Td>
      </tr>
      {open && [...e.revisions].reverse().map((r) => (
        <tr key={r.revision} data-testid={`estimate-revision-${e.id}-${r.revision}`} className="bg-canvas/60">
          <Td className="pl-8 font-mono text-[11px] text-ink-500">rev {r.revision}</Td>
          <Td className="text-[11px] text-ink-400">superseded</Td>
          <Td className="max-w-[220px] truncate text-[11px] text-ink-500">{r.lines.map((l) => l.description).join(' · ')}</Td>
          <Td><StatusPill status={r.status} /></Td>
          <Td className="tabular text-right text-[11px] text-ink-500">{fmtMoneyCents(r.total)}</Td>
          <Td className="tabular whitespace-nowrap text-right text-[11px] text-ink-400">{when(r.savedAt)} · {r.savedBy}</Td>
        </tr>
      ))}
    </Fragment>
  );
};

export const EstimatesSection = ({ estimates }: { estimates: Client360['estimates'] }) => (
  <Card title="Estimates" subtitle={`${estimates.length} total · expand a row for prior revisions`} bodyClassName="p-0" testId="client360-estimates">
    <Table>
      <thead><tr><Th>Estimate</Th><Th>Watch</Th><Th>Lines</Th><Th>Status</Th><Th className="text-right">Total</Th><Th className="text-right">Created</Th></tr></thead>
      <tbody>
        {estimates.map((e) => <EstimateRows key={e.id} e={e} />)}
        {estimates.length === 0 && <EmptyRow colSpan={6} text="No estimates yet." />}
      </tbody>
    </Table>
  </Card>
);

export const JobsSection = ({ jobs }: { jobs: Client360['jobs'] }) => (
  <Card title="Jobs" subtitle={`${jobs.length} total`} bodyClassName="p-0" testId="client360-jobs">
    <Table>
      <thead><tr><Th>Job</Th><Th>Watch</Th><Th>Work</Th><Th>Status</Th><Th>Tech</Th><Th className="text-right">Total</Th><Th className="text-right">Opened</Th></tr></thead>
      <tbody>
        {jobs.map((j) => {
          const hold = j.holds.find((h) => !h.releasedAt);
          return (
            <tr key={j.id} data-hit={`job-${j.id}`} data-testid={`client360-job-${j.id}`} className="transition-colors hover:bg-canvas">
              <Td className="font-mono text-xs font-medium text-ink"><Link to={`/jobs/${j.id}`} className="hover:underline">{j.number}</Link>{j.kind !== 'service' && <span className="ml-1 text-[10px] font-sans text-ink-400">{humanize(j.kind)}</span>}</Td>
              <Td className="text-ink-700">{watchLabel(j.watch)}</Td>
              <Td><span className="inline-flex items-center gap-1">{j.workflow.map((d) => <DeptBadge key={d} code={d} />)}<span className="ml-1 max-w-[160px] truncate text-ink-500">{j.lines[0]?.description}</span></span></Td>
              <Td><span className="inline-flex items-center gap-1"><StatusPill status={j.status} />{hold && <span className="rounded-sm bg-amber-50 px-1 text-[10px] text-amber-800">hold · {hold.type}</span>}</span></Td>
              <Td className="text-ink-700">{j.assignees.join(', ') || <span className="text-ink-400">—</span>}</Td>
              <Td className="tabular text-right font-medium">{fmtMoneyCents(j.total)}</Td>
              <Td className="tabular whitespace-nowrap text-right text-ink-500">{when(j.createdAt)}</Td>
            </tr>
          );
        })}
        {jobs.length === 0 && <EmptyRow colSpan={7} text="No jobs yet." />}
      </tbody>
    </Table>
  </Card>
);

export const InvoicesSection = ({ salesOrders, payments }: { salesOrders: Client360['salesOrders']; payments: Client360['payments'] }) => (
  <Card title="Invoices & payments" subtitle={`${salesOrders.length} sales orders · ${payments.length} payments`} bodyClassName="p-0" testId="client360-invoices">
    <Table>
      <thead><tr><Th>Invoice</Th><Th>Job</Th><Th>Status</Th><Th className="text-right">Total</Th><Th className="text-right">Balance</Th><Th className="text-right">Date</Th></tr></thead>
      <tbody>
        {salesOrders.map((o) => (
          <tr key={o.id} data-hit={`so-${o.id}`} data-testid={`client360-so-${o.id}`} className="transition-colors hover:bg-canvas">
            <Td className="font-mono text-xs font-medium text-ink"><Link to={`/sales/${o.id}`} className="hover:underline">{o.number}</Link></Td>
            <Td className="text-ink-700">{o.job ? <Link to={`/jobs/${o.job.id}`} className="font-mono text-xs hover:underline">{o.job.number}</Link> : <span className="text-ink-400">—</span>}{o.watch && <span className="ml-1.5 text-ink-500">{watchLabel(o.watch)}</span>}</Td>
            <Td><span className="inline-flex items-center gap-1"><StatusPill status={o.status} /><StatusPill status={o.isPaid ? 'paid' : 'unpaid'} />{o.tracking && <span className="font-mono text-[10px] text-ink-400">{o.tracking}</span>}</span></Td>
            <Td className="tabular text-right font-medium">{fmtMoneyCents(o.total)}</Td>
            <Td className={`tabular text-right ${o.balanceDue > 0 ? 'font-medium text-rose-700' : 'text-ink-400'}`}>{fmtMoneyCents(o.balanceDue)}</Td>
            <Td className="tabular whitespace-nowrap text-right text-ink-500">{when(o.orderDate)}</Td>
          </tr>
        ))}
        {salesOrders.length === 0 && <EmptyRow colSpan={6} text="No invoices yet." />}
      </tbody>
    </Table>
    {payments.length > 0 && (
      <ul className="divide-y divide-line/60 border-t border-line" data-testid="client360-payments">
        {payments.map((p) => (
          <li key={p.id} className="grid grid-cols-[72px_1fr_auto_auto] items-center gap-x-3 px-3 py-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-moss-700">Payment</span>
            <span className="text-ink-700"><Link to={`/sales/${p.salesOrderId}`} className="font-mono hover:underline">{p.salesOrderNumber}</Link> · {humanize(p.method)}{p.note ? ` · ${p.note}` : ''} · by {p.by}</span>
            <span className="tabular font-medium text-ink">{fmtMoneyCents(p.amount)}</span>
            <span className="tabular w-[90px] text-right text-ink-500">{when(p.at)}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);
