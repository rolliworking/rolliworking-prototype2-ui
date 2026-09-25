import clsx from 'clsx';
import { ArrowLeft, CameraOff, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { AuditEvent, AuditEventType } from '@/api/client';
import { FilterChip, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtTime, humanize } from '@/lib/format';

const TYPE_TONE: Record<AuditEventType, string> = {
  sign_in: 'bg-moss-50 text-moss-700',
  purchasing: 'bg-teal-50 text-teal-800',
  companion: 'bg-violet-50 text-violet-700',
  inventory: 'bg-teal-50 text-teal-800',
  setup: 'bg-slate-100 text-slate-700',
  evidence: 'bg-violet-50 text-violet-700',
  labels: 'bg-slate-100 text-slate-700',
  accounting: 'bg-amber-50 text-amber-800',
  sign_in_failed: 'bg-rose-50 text-rose-700',
  sign_out: 'bg-slate-100 text-slate-600',
  station_registered: 'bg-brand-50 text-brand',
  station_renamed: 'bg-brand-50 text-brand',
  station_reset: 'bg-amber-50 text-amber-800',
  intake: 'bg-teal-50 text-teal-800',
  estimate: 'bg-violet-50 text-violet-700',
  job: 'bg-orange-50 text-orange-800',
  task: 'bg-moss-50 text-moss-700',
  pin: 'bg-moss-50 text-moss-700',
  sales: 'bg-teal-50 text-teal-800',
  parts: 'bg-violet-50 text-violet-700',
  portal: 'bg-amber-50 text-amber-800',
};

type Filter = 'all' | 'sign_in' | 'station' | 'intake' | 'estimate' | 'job' | 'sales' | 'portal';

export default function AuditLogPage() {
  const { data } = useAsync(() => api.getAuditLog());
  const [filter, setFilter] = useState<Filter>('all');
  const [zoom, setZoom] = useState<AuditEvent | null>(null);

  const rows = useMemo(
    () =>
      (data ?? []).filter((e) => {
        if (filter === 'sign_in') return e.type === 'sign_in' || e.type === 'sign_in_failed' || e.type === 'sign_out';
        if (filter === 'station') return e.type.startsWith('station_');
        if (filter === 'intake') return e.type === 'intake';
        if (filter === 'estimate') return e.type === 'estimate';
        if (filter === 'job') return e.type === 'job' || e.type === 'task' || e.type === 'pin' || e.type === 'parts';
        if (filter === 'sales') return e.type === 'sales';
        if (filter === 'portal') return e.type === 'portal';
        return true;
      }),
    [data, filter],
  );

  return (
    <div data-testid="audit-log-page">
      <Link to="/setup" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink">
        <ArrowLeft size={12} /> Setup
      </Link>
      <PageHeader title="Audit log" subtitle={data ? `${data.length} events on this device · newest first` : 'Loading…'} />

      <div className="mb-3 flex items-center gap-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} testId="audit-filter-all">All</FilterChip>
        <FilterChip active={filter === 'sign_in'} onClick={() => setFilter('sign_in')} testId="audit-filter-sign-in">Sign-ins</FilterChip>
        <FilterChip active={filter === 'station'} onClick={() => setFilter('station')} testId="audit-filter-station">Station</FilterChip>
        <FilterChip active={filter === 'intake'} onClick={() => setFilter('intake')} testId="audit-filter-intake">Intake</FilterChip>
        <FilterChip active={filter === 'estimate'} onClick={() => setFilter('estimate')} testId="audit-filter-estimate">Estimates</FilterChip>
        <FilterChip active={filter === 'job'} onClick={() => setFilter('job')} testId="audit-filter-job">Jobs</FilterChip>
        <FilterChip active={filter === 'sales'} onClick={() => setFilter('sales')} testId="audit-filter-sales">Sales</FilterChip>
        <FilterChip active={filter === 'portal'} onClick={() => setFilter('portal')} testId="audit-filter-portal">RolliConnect</FilterChip>
      </div>

      <Card bodyClassName="p-0">
        <Table testId="audit-table">
          <thead>
            <tr>
              <Th>Photo</Th>
              <Th>When</Th>
              <Th>Event</Th>
              <Th>User</Th>
              <Th>Station</Th>
              <Th>Method</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} data-testid={`audit-row-${e.id}`} data-event-type={e.type} className="transition-colors hover:bg-canvas/70">
                <Td className="w-[72px]">
                  {e.photoDataUrl ? (
                    <button type="button" data-testid={`audit-photo-${e.id}`} onClick={() => setZoom(e)} className="block overflow-hidden rounded-sm ring-1 ring-line transition-transform hover:scale-105">
                      <img src={e.photoDataUrl} alt={`Verification photo for ${e.userShortName}`} className="h-9 w-12 object-cover" />
                    </button>
                  ) : e.type === 'sign_in' && e.method === 'password_photo' ? (
                    <span className="grid h-9 w-12 place-items-center rounded-sm bg-amber-50 text-amber-700" title={humanize(e.cameraStatus ?? 'no_camera')}>
                      <CameraOff size={13} />
                    </span>
                  ) : (
                    <span className="block h-9 w-12 rounded-sm bg-canvas" />
                  )}
                </Td>
                <Td className="tabular whitespace-nowrap text-ink-500">
                  {fmtDate(e.timestamp)} <span className="text-ink">{fmtTime(e.timestamp)}</span>
                </Td>
                <Td>
                  <span className={clsx('inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-medium', TYPE_TONE[e.type])}>{humanize(e.type)}</span>
                </Td>
                <Td className="font-medium text-ink">{e.userShortName ?? <span className="text-ink-300">—</span>}</Td>
                <Td className="text-ink-700">{e.stationName}</Td>
                <Td className="text-ink-500">
                  {e.method ? (e.method === 'pin_switch' ? 'PIN switch' : 'Password + photo') : '—'}
                  {e.cameraStatus && e.cameraStatus !== 'captured' && <span className="ml-1 text-amber-800">({humanize(e.cameraStatus)})</span>}
                </Td>
                <Td className="text-ink-500">{e.detail}</Td>
              </tr>
            ))}
            {data && rows.length === 0 && <EmptyRow colSpan={7} text="No events match." />}
          </tbody>
        </Table>
      </Card>

      {zoom && (
        <div data-testid="audit-photo-zoom" className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-8" onClick={() => setZoom(null)}>
          <div className="animate-rise overflow-hidden rounded-md bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.photoDataUrl} alt="" className="block w-[480px]" />
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
              <span className="text-ink">
                <span className="font-semibold">{zoom.userDisplayName}</span> · {zoom.stationName} · {fmtDate(zoom.timestamp)} {fmtTime(zoom.timestamp)}
              </span>
              <button type="button" data-testid="audit-photo-zoom-close" onClick={() => setZoom(null)} className="text-ink-500 hover:text-ink">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
