import clsx from 'clsx';
import { ArrowRight, PenLine } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Bin, PackageWithRefs } from '@/api/client';
import { Stamp } from '@/components/intake/IntakeBits';
import { useIntakeCounts } from '@/components/intake/IntakeLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fullName } from '@/lib/format';

export default function WorkOrderPage() {
  const { data, reload } = useAsync(() => api.getPackages());
  const { refreshCounts } = useIntakeCounts();
  const [selected, setSelected] = useState<PackageWithRefs | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [bin, setBin] = useState<Bin>('inspection');
  const [flash, setFlash] = useState<string | null>(null);

  const processed = (data ?? []).filter((p) => p.status === 'processed');
  const awaiting = (data ?? []).filter((p) => p.status === 'awaiting_inspection');

  const pick = (p: PackageWithRefs) => {
    setSelected(p);
    setConfirmed(false);
    setBin(p.bin ?? 'inspection');
  };

  const commit = async () => {
    if (!selected) return;
    const pkg = await api.recordWorkOrder(selected.id, bin);
    setFlash(`${pkg.subNumber} → ${bin} bin · awaiting inspection`);
    setSelected(null);
    reload();
    refreshCounts();
    setTimeout(() => setFlash(null), 3500);
  };

  return (
    <div data-testid="work-order-page" className="grid grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        <Card title="Processed — needs a work order" subtitle="Select a package, confirm the handwritten work order, assign a bin" bodyClassName="p-0" testId="wo-todo-card">
          <Table testId="wo-todo-table">
            <thead><tr><Th /><Th>Sub#</Th><Th>Client</Th><Th>Estimate</Th><Th>Contents</Th><Th>Processed</Th></tr></thead>
            <tbody>
              {processed.map((p) => (
                <tr key={p.id} data-testid={`wo-row-${p.id}`} onClick={() => pick(p)} className={clsx('cursor-pointer transition-colors', selected?.id === p.id ? 'bg-brand-50/70' : 'hover:bg-canvas/70')}>
                  <Td className="w-8"><input type="radio" name="wo" data-testid={`wo-select-${p.id}`} checked={selected?.id === p.id} onChange={() => pick(p)} className="accent-ink" /></Td>
                  <Td className="font-mono text-xs font-medium text-ink">{p.subNumber}</Td>
                  <Td>{p.client ? fullName(p.client) : <span className="italic text-ink-400">unknown</span>}</Td>
                  <Td className="font-mono text-xs">{p.estimate?.number ?? '—'}</Td>
                  <Td className="text-ink-700">{p.contents.join(', ')}</Td>
                  <Td><span className="tabular">{p.processedAt && fmtDate(p.processedAt)}</span> <Stamp by={p.processedBy} station={p.arrivedStation} /></Td>
                </tr>
              ))}
              {data && processed.length === 0 && <EmptyRow colSpan={6} text="Nothing waiting for a work order." />}
            </tbody>
          </Table>
        </Card>

        <Card title="Awaiting inspection" subtitle={`${awaiting.length} in bins — Stage 4 picks these up by scanning the estimate`} bodyClassName="p-0" testId="wo-done-card">
          <Table testId="wo-done-table">
            <thead><tr><Th>Sub#</Th><Th>Client</Th><Th>Estimate</Th><Th>Bin</Th><Th>Status</Th><Th>Work order</Th><Th /></tr></thead>
            <tbody>
              {awaiting.map((p) => (
                <tr key={p.id} data-testid={`wo-awaiting-${p.id}`} className="transition-colors hover:bg-canvas/70">
                  <Td className="font-mono text-xs font-medium text-ink">{p.subNumber}</Td>
                  <Td>{p.client ? fullName(p.client) : '—'}</Td>
                  <Td className="font-mono text-xs">{p.estimate?.number ?? '—'}</Td>
                  <Td className="capitalize text-ink-700">{p.bin}</Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td><span className="tabular">{p.workOrderAt && fmtDate(p.workOrderAt)}</span> <Stamp by={p.workOrderBy} station={p.arrivedStation} /></Td>
                  <Td className="text-right">
                    <Link to={`/intake/inspection/${p.id}`} data-testid={`wo-inspect-${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Inspect <ArrowRight size={12} /></Link>
                  </Td>
                </tr>
              ))}
              {data && awaiting.length === 0 && <EmptyRow colSpan={7} text="Bins are empty." />}
            </tbody>
          </Table>
        </Card>
      </div>

      <Card title="Record work order" subtitle="Handwritten in the shop — the system records that it happened" testId="wo-panel">
        {flash && <div data-testid="wo-flash" className="mb-3 rounded-sm bg-moss-50 px-2.5 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}
        {selected ? (
          <div className="space-y-4 animate-rise" data-testid="wo-form">
            <div>
              <div className="font-mono text-xs font-semibold text-ink">{selected.subNumber}</div>
              <div className="text-[13px] text-ink">{selected.client ? fullName(selected.client) : 'Unknown client'} {selected.estimate && <span className="font-mono text-xs text-ink-500">· {selected.estimate.number}</span>}</div>
              {selected.estimate?.watch && <div className="text-xs text-ink-500">{selected.estimate.watch.brand} {selected.estimate.watch.model}</div>}
            </div>
            <label className="flex items-start gap-2 rounded-sm border border-line p-2.5 text-[13px] text-ink-700">
              <input type="checkbox" data-testid="wo-confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-ink" />
              <span><PenLine size={12} className="mr-1 inline text-ink-400" />Work order handwritten and filed with the package</span>
            </label>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Assign to bin</div>
              <div className="grid gap-1.5">
                {api.BINS.map((b) => (
                  <label key={b.key} className={clsx('flex cursor-pointer items-start gap-2 rounded-sm border p-2.5 transition-colors', bin === b.key ? 'border-ink bg-canvas' : 'border-line hover:border-ink-300')}>
                    <input type="radio" name="bin" data-testid={`wo-bin-${b.key}`} checked={bin === b.key} onChange={() => setBin(b.key)} className="mt-0.5 accent-ink" />
                    <span>
                      <span className="block text-[13px] font-medium text-ink">{b.label}</span>
                      <span className="block text-[11px] text-ink-400">{b.blurb}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button variant="primary" className="w-full justify-center" data-testid="wo-commit" disabled={!confirmed} onClick={commit}>
              Confirm → awaiting inspection
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-400" data-testid="wo-empty">Select a processed package on the left.</p>
        )}
      </Card>
    </div>
  );
}
