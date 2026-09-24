import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoneyCents, fullName, humanize } from '@/lib/format';

export default function ClientDetailPage() {
  const { id = '' } = useParams();
  const { data, loading } = useAsync(
    () =>
      Promise.all([api.getClient(id), api.getWatchesForClient(id), api.getEstimatesForClient(id), api.getJobsForClient(id)]).then(
        ([client, watches, estimates, jobs]) => ({ client, watches, estimates, jobs }),
      ),
    [id],
  );

  if (loading) return null;
  if (!data?.client) {
    return (
      <div data-testid="client-not-found" className="text-ink-500">
        Client not found. <Link to="/" className="underline">Back to dashboard</Link>
      </div>
    );
  }

  const { client, watches, estimates, jobs } = data;

  return (
    <div data-testid="client-detail-page" className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink">
        <ArrowLeft size={12} /> Dashboard
      </Link>
      <PageHeader
        title={fullName(client)}
        subtitle={[client.company, `${humanize(client.type)} client`, `since ${fmtDate(client.since)}`].filter(Boolean).join(' · ')}
        testId="client-header"
      />

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-700" data-testid="client-contact">
        <span className="inline-flex items-center gap-1.5"><Mail size={13} className="text-ink-400" /> {client.email}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs"><Phone size={13} className="text-ink-400" /> {client.phone}</span>
        <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-ink-400" /> {client.city}, {client.state}</span>
      </div>

      <Card title="Watches" subtitle={`${watches.length} on file`} bodyClassName="p-0">
        <Table testId="client-watches-table">
          <thead>
            <tr><Th>Watch</Th><Th>Reference</Th><Th>Serial</Th><Th>Dial / Bracelet</Th><Th>Status</Th><Th className="text-right">Received</Th></tr>
          </thead>
          <tbody>
            {watches.map((w) => (
              <tr key={w.id} data-testid={`client-watch-${w.id}`}>
                <Td className="font-medium text-ink">{w.brand} {w.model}</Td>
                <Td className="font-mono text-xs">{w.reference}</Td>
                <Td className="font-mono text-xs text-ink-500">{w.serial}</Td>
                <Td className="text-ink-500">{w.dial} · {w.bracelet}</Td>
                <Td><StatusPill status={w.status} /></Td>
                <Td className="tabular text-right text-ink-500">{fmtDate(w.receivedAt)}</Td>
              </tr>
            ))}
            {watches.length === 0 && <EmptyRow colSpan={6} text="No watches on file." />}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Estimates" bodyClassName="p-0">
          <Table testId="client-estimates-table">
            <thead><tr><Th>Estimate</Th><Th>Dept</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id}>
                  <Td className="font-mono text-xs font-medium text-ink">{e.number}</Td>
                  <Td className="text-ink-500">{humanize(e.department)}</Td>
                  <Td><StatusPill status={e.status} /></Td>
                  <Td className="tabular text-right font-medium">{fmtMoneyCents(e.total)}</Td>
                </tr>
              ))}
              {estimates.length === 0 && <EmptyRow colSpan={4} text="No estimates yet." />}
            </tbody>
          </Table>
        </Card>
        <Card title="Jobs" bodyClassName="p-0">
          <Table testId="client-jobs-table">
            <thead><tr><Th>Job</Th><Th>Tech</Th><Th>Status</Th><Th className="text-right">Due</Th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <Td className="font-mono text-xs font-medium text-ink"><Link to={`/jobs/${j.id}`} className="hover:underline" data-testid={`client-job-link-${j.id}`}>{j.number}</Link></Td>
                  <Td className="text-ink-700">{j.assignedTo ?? <span className="text-ink-400">—</span>}</Td>
                  <Td><StatusPill status={j.status} /></Td>
                  <Td className="tabular text-right text-ink-500">{j.dueAt ? fmtDate(j.dueAt) : '—'}</Td>
                </tr>
              ))}
              {jobs.length === 0 && <EmptyRow colSpan={4} text="No jobs yet." />}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
