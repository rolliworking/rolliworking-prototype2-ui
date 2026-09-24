import clsx from 'clsx';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { JobStatus } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';
import { DeptTag, StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoneyCents, fullName, humanize } from '@/lib/format';

const STATUSES: JobStatus[] = ['in_progress', 'awaiting_parts', 'qc', 'awaiting_pickup', 'complete'];
const OPEN: JobStatus[] = ['queued', 'in_progress', 'awaiting_parts', 'qc'];

export default function JobsPage() {
  const { data } = useAsync(() => api.getJobs());
  const [params, setParams] = useSearchParams();
  const status = params.get('status');

  const rows = useMemo(() => (data ?? []).filter((j) => !status || j.status === status), [data, status]);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (data ?? []).filter((j) => j.status === s).length])), [data]);

  return (
    <div data-testid="jobs-page">
      <PageHeader title="Jobs" subtitle={data ? `${data.length} total · ${rows.length} shown` : 'Loading…'} />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <FilterChip active={!status} onClick={() => setParams({})} testId="job-filter-all">
          All
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => setParams({ status: s })} testId={`job-filter-${s}`}>
            {s === 'qc' ? 'QC' : humanize(s)} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
          </FilterChip>
        ))}
      </div>

      <Card bodyClassName="p-0">
        <Table testId="jobs-table">
          <thead>
            <tr>
              <Th>Job</Th>
              <Th>Client</Th>
              <Th>Watch</Th>
              <Th>Dept</Th>
              <Th>Status</Th>
              <Th>Tech</Th>
              <Th className="text-right">Due</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const overdue = OPEN.includes(j.status) && new Date(j.dueAt) < new Date();
              return (
                <tr key={j.id} data-testid={`job-row-${j.id}`} className="transition-colors hover:bg-canvas/70">
                  <Td className="font-mono text-xs font-medium text-ink">{j.number}</Td>
                  <Td>
                    <Link to={`/clients/${j.clientId}`} className="font-medium text-ink hover:underline">
                      {fullName(j.client)}
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-ink">{j.watch.brand} {j.watch.model}</span>
                    <span className="ml-1.5 font-mono text-xs text-ink-400">{j.watch.reference}</span>
                  </Td>
                  <Td><DeptTag dept={j.department} /></Td>
                  <Td><StatusPill status={j.status} /></Td>
                  <Td className="text-ink-700">{j.technician}</Td>
                  <Td className={clsx('tabular text-right', overdue ? 'font-medium text-rose-700' : 'text-ink-500')}>{fmtDate(j.dueAt)}</Td>
                  <Td className="tabular text-right font-medium">{fmtMoneyCents(j.total)}</Td>
                </tr>
              );
            })}
            {data && rows.length === 0 && <EmptyRow colSpan={8} text="No jobs in this state." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
