import { Globe, Mail, Phone, Tablet, User, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { RequestRow, RequestSource } from '@/api/client';
import { Button, FilterChip, PageHeader } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { fmtDate, fmtTime } from '@/lib/format';

const SOURCE_ICON: Record<RequestSource, LucideIcon> = { call: Phone, email: Mail, web: Globe, walk_in: User, kiosk: Tablet };
const isOpen = (r: RequestRow) => r.status === 'new' || r.status === 'quoted';

export default function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]); const [view, setView] = useState<'open' | 'all'>('open'); const [err, setErr] = useState<string | null>(null);
  const load = () => api.getRequestsQueue().then(setRows);
  useEffect(() => { void load(); }, []);
  const shown = rows.filter((r) => view === 'all' || isOpen(r));
  const pending = rows.filter((r) => r.kiosk?.matchState === 'possible').length;
  const decide = (id: string, d: 'confirm' | 'split') => api.resolveKioskMatch(id, d).then(load).catch((e) => setErr(e.message));
  return <div data-testid="requests-page">
    <PageHeader title="Requests" subtitle={`${rows.filter(isOpen).length} open · ${api.RG_DIVISION_LABEL[api.getSessionDivision()]} · kiosk check-ins land here${pending ? ` · ${pending} possible existing client${pending === 1 ? '' : 's'} to confirm` : ''}`} action={<div className="flex gap-1"><FilterChip testId="requests-view-open" active={view === 'open'} onClick={() => setView('open')}>Open</FilterChip><FilterChip testId="requests-view-all" active={view === 'all'} onClick={() => setView('all')}>All</FilterChip></div>} />
    {err && <p data-testid="requests-error" className="mb-2 text-xs text-rose-700">{err}</p>}
    <Table testId="requests-table">
      <thead><tr><Th>Request</Th><Th>Source</Th><Th>Client</Th><Th>Summary</Th><Th>Status</Th><Th>Created</Th><Th /></tr></thead>
      <tbody>
        {shown.map((r) => { const Icon = SOURCE_ICON[r.source]; const k = r.kiosk; return (
          <tr key={r.id} data-testid={`request-row-${r.id}`} className={`align-top ${isOpen(r) ? '' : 'opacity-60'}`}>
            <Td className="font-mono text-[11px] font-medium text-ink">{r.number}</Td>
            <Td><span className="inline-flex items-center gap-1 text-xs text-ink-500"><Icon size={12} /> {r.source.replace('_', '-')}</span></Td>
            <Td><Link data-testid={`request-client-${r.id}`} to={`/clients/${r.clientId}`} className="text-xs font-medium text-brand hover:underline">{r.client.firstName} {r.client.lastName}</Link>{k && <div className="text-[10px] text-ink-400">{k.email} · {k.phone}</div>}</Td>
            <Td className="max-w-md text-xs text-ink">{r.summary}{k?.matchState === 'possible' && <div data-testid={`request-match-${r.id}`} className="mt-1 inline-flex flex-wrap items-center gap-1.5 rounded-sm bg-amber-50 px-1.5 py-1 text-[11px] text-amber-900 ring-1 ring-inset ring-amber-200">Possible existing client — kiosk gave “{k.firstName} {k.lastName}”, matched {r.client.firstName} {r.client.lastName} on {k.matchedOn?.join(' + ')}.<Button size="sm" variant="primary" data-testid={`request-confirm-${r.id}`} onClick={() => decide(r.id, 'confirm')}>Confirm link</Button><Button size="sm" data-testid={`request-split-${r.id}`} onClick={() => decide(r.id, 'split')}>Not the same — new client</Button></div>}{k?.matchState === 'confirmed' && <div className="mt-1 text-[10px] text-moss-700">Linked to existing client (confirmed)</div>}{k?.matchState === 'split' && <div className="mt-1 text-[10px] text-ink-400">Split into a new client record</div>}</Td>
            <Td><StatusPill status={r.status} /></Td>
            <Td className="whitespace-nowrap text-xs text-ink-500">{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}<div className="text-[10px] text-ink-400">{r.createdBy} · {r.station}</div></Td>
            <Td><Link data-testid={`request-open-${r.id}`} to={`/clients/${r.clientId}?hit=req-${r.id}`} className="text-xs text-brand hover:underline">Client 360 →</Link></Td>
          </tr>
        ); })}
        {!shown.length && <EmptyRow colSpan={7} text="No requests" />}
      </tbody>
    </Table>
  </div>;
}
