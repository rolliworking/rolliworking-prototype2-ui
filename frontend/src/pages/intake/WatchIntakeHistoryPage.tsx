import { ArrowRight, Camera, Pencil, Printer, Search, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { IntakeHistoryRow } from '@/api/client';
import { IntakeEditDialog } from '@/components/intake/IntakeHistoryBits';
import { Stamp } from '@/components/intake/IntakeBits';
import { LabelPrintDialog, REPRINT_COPY_PRESETS } from '@/components/intake/LabelBits';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime, fullName } from '@/lib/format';

// Every received watch record — search by brand / model / reference; row actions: edit intake details, reprint labels (small top-up presets)
export default function WatchIntakeHistoryPage() {
  const [q, setQ] = useState(''); const { data, reload } = useAsync(() => api.getIntakeHistory(q), [q]);
  const [edit, setEdit] = useState<IntakeHistoryRow | null>(null); const [reprint, setReprint] = useState<IntakeHistoryRow | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const rows = data ?? [];
  return <div data-testid="intake-history-page" className="space-y-3">
    <Card testId="intake-history-search-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input data-testid="intake-history-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand · model · reference · serial · est# · customer" className="h-10 w-full rounded-sm border border-line bg-canvas pl-9 pr-3 text-sm focus:border-ink focus:bg-surface focus:outline-none" /></div>
        <span data-testid="intake-history-count" className="text-xs text-ink-500">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        {msg && <span data-testid="intake-history-msg" className="rounded-sm bg-moss-50 px-2 py-1 text-xs font-medium text-moss-700">{msg}</span>}
      </div>
    </Card>
    <Card title="Watch Intake History" subtitle="Received watches · Labeled once intake labels have been printed · Edit corrects intake details after the fact" bodyClassName="p-0" testId="intake-history-card">
      <Table testId="intake-history-table">
        <thead><tr><Th>Date</Th><Th>Customer</Th><Th>Watch</Th><Th>Estimate#</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
        <tbody>
          {rows.map((r) => { const w = r.pkg.estimate?.watch; return (
            <tr key={r.pkg.id} data-testid={`intake-history-row-${r.pkg.id}`} data-labeled={r.labeled} className="transition-colors hover:bg-canvas/70">
              <Td><span className="tabular text-ink">{r.pkg.inspectedAt && fmtDate(r.pkg.inspectedAt)}</span> <span className="text-xs text-ink-400">{r.pkg.inspectedAt && fmtTime(r.pkg.inspectedAt)}</span><div><Stamp by={r.pkg.inspectedBy} station={r.pkg.arrivedStation} /></div></Td>
              <Td className="text-ink">{r.pkg.client ? fullName(r.pkg.client) : '—'}</Td>
              <Td>{w && <><span className="text-ink">{w.brand} {w.model}</span> <span className="font-mono text-xs text-ink-500">{w.reference} / {w.serial}</span></>}<div className="mt-0.5 flex items-center gap-1">{(r.pkg.workflow ?? []).map((d) => <DeptBadge key={d} code={d} />)}{r.pkg.itemLabel && <span className="font-mono text-[10px] text-ink-400">{r.pkg.itemLabel}</span>}{r.photos > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-400" data-testid={`intake-history-photos-${r.pkg.id}`}><Camera size={10} /> {r.photos}</span>}</div></Td>
              <Td><span className="font-mono text-xs font-medium text-ink">{r.pkg.estimate?.number}</span><div className="font-mono text-[10px] text-ink-400">{r.pkg.subNumber}</div></Td>
              <Td><span className="flex flex-wrap items-center gap-1"><StatusPill status={r.pkg.status} />{r.labeled && <span data-testid={`intake-history-labeled-${r.pkg.id}`} className="inline-flex items-center gap-1 rounded-sm bg-moss-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-700"><Tags size={10} /> Labeled</span>}</span></Td>
              <Td className="text-right"><span className="inline-flex items-center gap-1.5">
                <Button size="sm" data-testid={`intake-history-edit-${r.pkg.id}`} onClick={() => setEdit(r)}><Pencil size={12} /> Edit</Button>
                <Button size="sm" data-testid={`intake-history-reprint-${r.pkg.id}`} disabled={!r.labels.length} title={r.labels.length ? 'Print additional labels' : 'No labels on file (discrepancy hold)'} onClick={() => setReprint(r)}><Printer size={12} /> Labels</Button>
                <Link to={`/intake/inspection/${r.pkg.id}`} data-testid={`intake-history-open-${r.pkg.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open <ArrowRight size={12} /></Link>
              </span></Td>
            </tr>); })}
          {data && rows.length === 0 && <EmptyRow colSpan={6} text={q ? `No received watches match “${q}”` : 'No watches received yet.'} />}
        </tbody>
      </Table>
    </Card>
    {edit && <IntakeEditDialog row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg(`Intake details updated · ${edit.pkg.estimate?.number}`); reload(); }} />}
    {reprint && <LabelPrintDialog labels={reprint.labels} presets={REPRINT_COPY_PRESETS} title={`Print additional labels · ${reprint.pkg.estimate?.number} · ${reprint.pkg.client?.lastName ?? ''}`} onClose={() => { setReprint(null); reload(); }} onPrinted={() => { setMsg(`Labels reprinted · ${reprint.pkg.estimate?.number}`); reload(); }} />}
  </div>;
}
