import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { PackageWithRefs } from '@/api/client';
import { PhotoStrip, Stamp } from '@/components/intake/IntakeBits';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtTime, fullName } from '@/lib/format';

const Row = ({ p, action }: { p: PackageWithRefs; action?: string }) => (
  <tr data-testid={`receive-row-${p.id}`} className="transition-colors hover:bg-canvas/70">
    <Td className="font-mono text-xs font-medium text-ink">{p.subNumber}</Td>
    <Td className="font-mono text-xs text-ink-500">{p.trackingNumber ?? '—'}</Td>
    <Td>{p.client ? fullName(p.client) : <span className="italic text-ink-400">unknown</span>}</Td>
    <Td className="font-mono text-xs">{p.estimate?.number ?? '—'}</Td>
    <Td>{p.contents.length ? <span className="text-ink-700">{p.contents.join(', ')}</span> : <span className="text-ink-300">—</span>}</Td>
    <Td>{p.photos.length ? <PhotoStrip photos={p.photos.slice(0, 3)} size="sm" /> : <span className="text-ink-300">—</span>}</Td>
    <Td><StatusPill status={p.status} /></Td>
    <Td><span className="tabular">{fmtTime(p.processedAt ?? p.arrivedAt)}</span> <Stamp by={p.processedBy ?? p.arrivedBy} station={p.arrivedStation} /></Td>
    <Td className="text-right">
      {action && (
        <Link to={`/intake/receive/${p.id}`} data-testid={`receive-open-${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          {action} <ArrowRight size={12} />
        </Link>
      )}
    </Td>
  </tr>
);

export default function ReceivePackageListPage() {
  const { data } = useAsync(() => api.getPackages());
  const arrived = (data ?? []).filter((p) => p.status === 'arrived');
  const processed = (data ?? []).filter((p) => p.status === 'processed');

  return (
    <div data-testid="receive-list-page" className="space-y-4">
      <Card title="To process" subtitle="End-of-day: open a package from the shelf, link its estimate, photograph, describe" bodyClassName="p-0" testId="receive-todo-card">
        <Table testId="receive-todo-table">
          <thead><tr><Th>Sub#</Th><Th>Tracking</Th><Th>Client</Th><Th>Estimate</Th><Th>Contents</Th><Th>Photos</Th><Th>Status</Th><Th>Arrived</Th><Th /></tr></thead>
          <tbody>
            {arrived.map((p) => <Row key={p.id} p={p} action="Open" />)}
            {data && arrived.length === 0 && <EmptyRow colSpan={9} text="Nothing on the shelf." />}
          </tbody>
        </Table>
      </Card>
      <Card title="Processed — awaiting work order" subtitle={`${processed.length} ready for Stage 3`} bodyClassName="p-0" testId="receive-done-card">
        <Table testId="receive-done-table">
          <thead><tr><Th>Sub#</Th><Th>Tracking</Th><Th>Client</Th><Th>Estimate</Th><Th>Contents</Th><Th>Photos</Th><Th>Status</Th><Th>Processed</Th><Th /></tr></thead>
          <tbody>
            {processed.map((p) => <Row key={p.id} p={p} />)}
            {data && processed.length === 0 && <EmptyRow colSpan={9} text="No processed packages." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
