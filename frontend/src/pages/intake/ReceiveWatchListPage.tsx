import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { ScanInput, Stamp } from '@/components/intake/IntakeBits';
import { Card } from '@/components/ui/Card';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fullName } from '@/lib/format';

export default function ReceiveWatchListPage() {
  const navigate = useNavigate();
  const { data } = useAsync(() => api.getPackages());
  const [error, setError] = useState<string | null>(null);

  const awaiting = (data ?? []).filter((p) => p.status === 'awaiting_inspection');
  const done = (data ?? []).filter((p) => p.status === 'received' || p.status === 'discrepancy_hold');

  const scan = async (value: string) => {
    const pkg = await api.findPackageForInspection(value);
    if (!pkg) {
      setError(`No package awaiting inspection for “${value}”`);
      return;
    }
    setError(null);
    navigate(`/intake/inspection/${pkg.id}`);
  };

  return (
    <div data-testid="inspection-list-page" className="grid grid-cols-[380px_1fr] gap-4">
      <Card title="Scan estimate barcode" subtitle="Opens the Receive Watch screen pre-populated from upstream" testId="inspection-scan-card">
        <ScanInput label="Estimate #" testId="inspection-scan-input" onScan={scan} error={error} placeholder="EST-26-1053 … then Enter" hint="Bins below: click a row is the same as scanning it" />
      </Card>

      <div className="space-y-4">
        <Card title="In bins — awaiting inspection" subtitle={`${awaiting.length} to receive`} bodyClassName="p-0" testId="inspection-todo-card">
          <Table testId="inspection-todo-table">
            <thead><tr><Th>Estimate</Th><Th>Sub#</Th><Th>Client</Th><Th>Expected watch</Th><Th>Scope</Th><Th>Bin</Th><Th>Work order</Th><Th /></tr></thead>
            <tbody>
              {awaiting.map((p) => (
                <tr key={p.id} data-testid={`inspection-row-${p.id}`} className="transition-colors hover:bg-canvas/70">
                  <Td className="font-mono text-xs font-medium text-ink">{p.estimate?.number}</Td>
                  <Td className="font-mono text-xs text-ink-500">{p.subNumber}</Td>
                  <Td>{p.client ? fullName(p.client) : '—'}</Td>
                  <Td>{p.estimate && <>{p.estimate.watch.brand} {p.estimate.watch.model} <span className="font-mono text-xs text-ink-400">{p.estimate.watch.reference}</span></>}</Td>
                  <Td><span className="flex gap-1">{Array.from(new Set(p.estimate?.lines.map((l) => l.dept))).map((d) => <DeptBadge key={d} code={d} />)}</span></Td>
                  <Td className="capitalize text-ink-700">{p.bin}</Td>
                  <Td><span className="tabular">{p.workOrderAt && fmtDate(p.workOrderAt)}</span> <Stamp by={p.workOrderBy} station={p.arrivedStation} /></Td>
                  <Td className="text-right">
                    <Link to={`/intake/inspection/${p.id}`} data-testid={`inspection-open-${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Open <ArrowRight size={12} /></Link>
                  </Td>
                </tr>
              ))}
              {data && awaiting.length === 0 && <EmptyRow colSpan={8} text="Bins are empty." />}
            </tbody>
          </Table>
        </Card>

        <Card title="Received & holds" subtitle="Outcome of Stage 4" bodyClassName="p-0" testId="inspection-done-card">
          <Table testId="inspection-done-table">
            <thead><tr><Th>Estimate</Th><Th>Sub#</Th><Th>Client</Th><Th>Workflow</Th><Th>Status</Th><Th>Inspected</Th><Th>Reason</Th></tr></thead>
            <tbody>
              {done.map((p) => (
                <tr key={p.id} data-testid={`inspection-done-${p.id}`} data-status={p.status}>
                  <Td className="font-mono text-xs font-medium text-ink">{p.estimate?.number}</Td>
                  <Td className="font-mono text-xs text-ink-500">{p.subNumber}</Td>
                  <Td>{p.client ? fullName(p.client) : '—'}</Td>
                  <Td><span className="flex gap-1">{(p.workflow ?? []).map((d) => <DeptBadge key={d} code={d} />)}</span></Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td><span className="tabular">{p.inspectedAt && fmtDate(p.inspectedAt)}</span> <Stamp by={p.inspectedBy} station={p.arrivedStation} /></Td>
                  <Td className="max-w-[320px] text-xs text-rose-700">{p.discrepancyReason}</Td>
                </tr>
              ))}
              {data && done.length === 0 && <EmptyRow colSpan={7} text="Nothing received yet." />}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
