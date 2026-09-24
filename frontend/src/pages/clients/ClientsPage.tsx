import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import { IdentifierSearch } from '@/components/clients/IdentifierSearch';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/Button';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { fmtDate, fmtMoneyCents, fullName, relativeTime } from '@/lib/format';

// /clients — the phone-call entry point: one search box for any identifier, then the directory by recent activity
export default function ClientsPage() {
  const { data: rows, loading } = useAsync(() => api.getClientDirectory(), []);

  return (
    <div data-testid="clients-page" className="space-y-4">
      <PageHeader title="Clients" subtitle="Type anything the caller gives you — name, email, phone, estimate #, SUB#, tracking, watch ref or serial, invoice #" testId="clients-header" />
      <div className="max-w-[720px]">
        <IdentifierSearch autoFocus inline testIdPrefix="clients-search" />
      </div>

      <Card title="Directory" subtitle="Most recent activity first" bodyClassName="p-0" testId="clients-directory">
        <Table testId="clients-directory-table">
          <thead>
            <tr><Th>Client</Th><Th>Contact</Th><Th>Location</Th><Th className="text-right">Watches</Th><Th className="text-right">Open est.</Th><Th className="text-right">Active jobs</Th><Th className="text-right">Balance</Th><Th className="text-right">Last activity</Th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.client.id} data-testid={`directory-row-${r.client.id}`} className="transition-colors hover:bg-canvas">
                <Td className="font-medium text-ink"><Link to={`/clients/${r.client.id}`} className="hover:underline" data-testid={`directory-link-${r.client.id}`}>{fullName(r.client)}</Link>{r.client.company && <span className="ml-1.5 text-xs font-normal text-ink-400">{r.client.company}</span>}</Td>
                <Td className="text-ink-500"><span className="block truncate">{r.client.email}</span><span className="font-mono text-[11px]">{r.client.phone}</span></Td>
                <Td className="text-ink-500">{r.client.city}, {r.client.state}</Td>
                <Td className="tabular text-right">{r.watchCount}{r.inHouse > 0 && <span className="ml-1 text-[11px] text-moss-700">{r.inHouse} in</span>}</Td>
                <Td className="tabular text-right">{r.openEstimates || <span className="text-ink-300">—</span>}</Td>
                <Td className="tabular text-right">{r.activeJobs || <span className="text-ink-300">—</span>}</Td>
                <Td className={`tabular text-right ${r.openBalance > 0 ? 'font-medium text-rose-700' : 'text-ink-300'}`}>{r.openBalance > 0 ? fmtMoneyCents(r.openBalance) : '—'}</Td>
                <Td className="tabular text-right text-ink-500">{r.lastActivityAt ? <span title={fmtDate(r.lastActivityAt)}>{relativeTime(r.lastActivityAt)}</span> : '—'}</Td>
              </tr>
            ))}
            {!loading && (rows ?? []).length === 0 && <EmptyRow colSpan={8} text="No clients." />}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
