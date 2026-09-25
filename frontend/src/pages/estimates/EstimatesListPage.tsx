import { Briefcase, Copy, FilePlus2, MoreHorizontal, PackageCheck, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { EstimateStatus, EstimateWithRefs } from '@/api/client';
import { EstimateStatusPill, Provisional } from '@/components/estimates/EstimateBits';
import { PrintPreview } from '@/components/estimates/PrintPreview';
import { Button, FilterChip, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

const STATUSES: (EstimateStatus | 'all')[] = ['all', 'draft', 'sent', 'approved', 'converted', 'expired', 'declined'];
const LABEL: Record<string, string> = { all: 'All', draft: 'Draft', sent: 'Sent', approved: 'Approved', converted: 'Closed', expired: 'Expired', declined: 'Declined' };
const PAGE = 50;

const RowMenu = ({ e, onDuplicate, onDelete, onPrint, onConvert }: { e: EstimateWithRefs; onDuplicate: () => void; onDelete: () => void; onPrint: () => void; onConvert: (target: 'job' | 'intake') => void }) => {
  const canIntake = !e.historical && (e.status === 'sent' || e.status === 'approved' || (e.status === 'converted' && !!e.jobId));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => !ref.current?.contains(ev.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={(ev) => ev.stopPropagation()}>
      <button type="button" data-testid={`est-menu-${e.id}`} onClick={() => setOpen((o) => !o)} className="rounded-sm p-1 text-ink-400 hover:bg-canvas hover:text-ink"><MoreHorizontal size={14} /></button>
      {open && (
        <div data-testid={`est-menu-${e.id}-items`} className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md bg-surface p-1 shadow-pop animate-rise">
          <Link to={`/estimates/${e.id}`} data-testid={`est-open-${e.id}`} className="block rounded-sm px-2.5 py-1.5 text-xs text-ink hover:bg-canvas">Open / edit</Link>
          <button type="button" data-testid={`est-print-${e.id}`} onClick={() => { setOpen(false); onPrint(); }} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-ink hover:bg-canvas"><Printer size={12} /> Print</button>
          <button type="button" data-testid={`est-duplicate-${e.id}`} onClick={() => { setOpen(false); onDuplicate(); }} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-ink hover:bg-canvas"><Copy size={12} /> Duplicate</button>
          <button type="button" data-testid={`est-delete-${e.id}`} onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-rose-700 hover:bg-rose-50"><Trash2 size={12} /> Delete…</button>
          <div className="my-1 border-t border-line" />
          {e.status === 'approved' && <button type="button" data-testid={`est-create-job-${e.id}`} onClick={() => { setOpen(false); onConvert('job'); }} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-ink hover:bg-canvas"><Briefcase size={12} /> Create job</button>}
          {canIntake && <button type="button" data-testid={`est-convert-intake-${e.id}`} onClick={() => { setOpen(false); onConvert('intake'); }} className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-ink hover:bg-canvas"><PackageCheck size={12} /> Convert to intake</button>}
          {e.status === 'converted' && e.jobId && <Link to={`/jobs/${e.jobId}`} data-testid={`est-open-job-${e.id}`} className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-ink hover:bg-canvas"><Briefcase size={12} /> Open job</Link>}
          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-ink-400">Convert to invoice <Provisional note="Empty stub in legacy — not wired" /></div>
        </div>
      )}
    </div>
  );
};

export default function EstimatesListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'all') as EstimateStatus | 'all';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [rows, setRows] = useState<EstimateWithRefs[] | null>(null);
  const [page, setPage] = useState(0);
  const [printing, setPrinting] = useState<EstimateWithRefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const convert = async (e: EstimateWithRefs, target: 'job' | 'intake') => {
    try { const j = await api.convertEstimate(e.id, target); navigate(`/jobs/${j.id}`); } catch (err) { setError(err instanceof Error ? err.message : 'Convert failed'); }
  };

  const load = () => api.searchEstimates(q, status).then(setRows);
  useEffect(() => {
    const t = setTimeout(load, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (rows ?? []).forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const visible = (rows ?? []).slice(page * PAGE, page * PAGE + PAGE);

  const duplicate = async (e: EstimateWithRefs) => {
    const copy = await api.duplicateEstimate(e.id);
    navigate(`/estimates/${copy.id}`);
  };
  const del = async (e: EstimateWithRefs) => {
    if (!window.confirm(`Delete ${e.number} for ${fullName(e.client)}? This cannot be undone.`)) return;
    try {
      await api.deleteEstimate(e.id);
      setError(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div data-testid="estimates-page">
      <PageHeader
        title="Estimates"
        subtitle={rows ? `${rows.length} match · page ${page + 1} of ${Math.max(1, Math.ceil(rows.length / PAGE))} · 50 per page` : 'Loading…'}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">Batch print / send <Provisional note="Empty stubs in legacy — not wired" /></span>
            <Link to="/estimates/new" data-testid="est-new-button"><Button variant="primary"><FilePlus2 size={14} /> New estimate</Button></Link>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {STATUSES.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => { setPage(0); setParams(s === 'all' ? {} : { status: s }); }} testId={`est-filter-${s}`}>
            {LABEL[s]} {s !== 'all' && <span className="ml-1 opacity-60">{status === 'all' ? counts[s] ?? 0 : ''}</span>}
          </FilterChip>
        ))}
        <input
          data-testid="est-search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Search number (E / EST-), customer, email…"
          className="ml-2 h-7 w-72 rounded-sm border border-line bg-surface px-2.5 text-xs focus:border-ink focus:outline-none"
        />
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-ink-400">
          <input type="date" data-testid="est-date-filter" className="h-7 rounded-sm border border-line bg-surface px-1.5 text-xs text-ink-400" title="Date filter control exists in legacy without filtering" />
          <Provisional note="Date filter control may exist without filtering — UNKNOWN" />
        </span>
      </div>
      {error && <p data-testid="est-list-error" className="mb-2 text-xs font-medium text-rose-700">{error}</p>}

      <Card bodyClassName="p-0">
        <Table testId="estimates-table">
          <thead>
            <tr><Th>Date</Th><Th>Number</Th><Th>Customer</Th><Th>Watch</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th className="w-10" /></tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id} data-testid={`estimate-row-${e.id}`} onClick={() => navigate(`/estimates/${e.id}`)} className="cursor-pointer transition-colors hover:bg-canvas/70">
                <Td className="tabular text-ink-500">{fmtDate(e.createdAt)}</Td>
                <Td className="font-mono text-xs font-medium text-ink">{e.number}{api.threadNeedsReplyFor({ kind: 'estimate', id: e.id }) && <span data-testid={`reply-indicator-${e.id}`} title="Client reply waiting" className="ml-1 rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-700">reply</span>}{e.revision > 1 && <span className="ml-1 text-ink-400">r{e.revision}</span>}{e.historical && <span className="ml-1 rounded-sm bg-slate-100 px-1 text-[10px] text-slate-500">HIST</span>}</Td>
                <Td><span className="font-medium text-ink">{fullName(e.client)}</span><span className="ml-1.5 text-xs text-ink-400">{e.client.email}</span></Td>
                <Td className="text-ink-700">{e.watch ? <>{e.watch.brand} {e.watch.model} <span className="font-mono text-xs text-ink-400">{e.watch.reference}</span></> : <span className="text-ink-300">—</span>}</Td>
                <Td className="tabular text-right font-medium">{fmtMoneyCents(e.total)}</Td>
                <Td><EstimateStatusPill status={e.status} /></Td>
                <Td><RowMenu e={e} onDuplicate={() => duplicate(e)} onDelete={() => del(e)} onPrint={() => setPrinting(e)} onConvert={(t) => convert(e, t)} /></Td>
              </tr>
            ))}
            {rows && visible.length === 0 && <EmptyRow colSpan={7} text="No estimates match." />}
          </tbody>
        </Table>
      </Card>
      {rows && rows.length > PAGE && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="sm" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
      {printing && <PrintPreview estimate={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}
