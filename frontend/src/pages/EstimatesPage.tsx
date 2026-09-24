import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { EstimateStatus } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';
import { DeptTag, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoneyCents, fullName, humanize } from '@/lib/format';

const STATUSES: EstimateStatus[] = ['draft', 'sent', 'awaiting_approval', 'approved', 'declined'];

export default function EstimatesPage() {
  const { data } = useAsync(() => api.getEstimates());
  const [params, setParams] = useSearchParams();
  const status = params.get('status');

  const rows = useMemo(() => (data ?? []).filter((e) => !status || e.status === status), [data, status]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (data ?? []).filter((e) => e.status === s).length])), [data]);

  return (
    <div data-testid="estimates-page">
      <PageHeader title="Estimates" subtitle={data ? `${data.length} total · ${rows.length} shown` : 'Loading…'} />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip active={!status} onClick={() => setParams({})} testId="est-filter-all">
          All
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => setParams({ status: s })} testId={`est-filter-${s}`}>
            {humanize(s)} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
          </FilterChip>
        ))}
      </div>

      <Card bodyClassName="p-0">
        <Table testId="estimates-table">
          <thead>
            <tr>
              <Th>Estimate</Th>
              <Th>Client</Th>
              <Th>Watch</Th>
              <Th>Dept</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Created</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} data-testid={`estimate-row-${e.id}`} className="transition-colors hover:bg-canvas/70">
                <Td className="font-mono text-xs font-medium text-ink">{e.number}</Td>
                <Td>
                  <Link to={`/clients/${e.clientId}`} className="font-medium text-ink hover:underline">
                    {fullName(e.client)}
                  </Link>
                </Td>
                <Td>
                  <span className="text-ink">{e.watch.brand} {e.watch.model}</span>
                  <span className="ml-1.5 font-mono text-xs text-ink-400">{e.watch.reference}</span>
                </Td>
                <Td><DeptTag dept={e.department} /></Td>
                <Td><StatusPill status={e.status} /></Td>
                <Td className="tabular text-right font-medium">{fmtMoneyCents(e.total)}</Td>
                <Td className="tabular text-right text-ink-500">{fmtDate(e.createdAt)}</Td>
              </tr>
            ))}
            {data && rows.length === 0 && <EmptyRow colSpan={7} text="No estimates in this state." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
