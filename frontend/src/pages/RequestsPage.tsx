import { Globe, Mail, Phone, Tablet, User, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { ConvTag, RequestRow, RequestSource } from '@/api/client';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { TagDots, ThreadContextMenu, useRowMenu } from '@/components/inbox/ThreadContextMenu';
import { WbpClientRows } from '@/components/shared/WbpDots';
import { Button, FilterChip, PageHeader } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Pills';
import { EmptyRow, Table, Td, Th } from '@/components/ui/Table';
import { relativeTime } from '@/lib/format';

const SOURCE_ICON: Record<RequestSource, LucideIcon> = { call: Phone, email: Mail, web: Globe, walk_in: User, kiosk: Tablet };
const SOURCE_LABEL: Record<RequestSource, string> = { call: 'call', email: 'email', web: 'web form', walk_in: 'walk-in', kiosk: 'kiosk' };
const isOpen = (r: RequestRow) => r.status === 'new' || r.status === 'quoted';

// Requests = RQ submissions before an estimate exists — an UNOWNED pool (nobody is assigned). Optional tags via right-click (same tags as the Inbox thread). Row click → the request's thread in the Inbox with the slide-out open on the submission.
export default function RequestsPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<RequestRow[]>([]); const [view, setView] = useState<'open' | 'all'>('open'); const [err, setErr] = useState<string | null>(null);
  const { menu, close, rowProps } = useRowMenu(); const menuRow = menu ? rows.find((r) => r.id === menu.id) : undefined;
  const load = () => api.getRequestsQueue().then(setRows);
  useEffect(() => { void load(); }, []);
  const shown = rows.filter((r) => view === 'all' || isOpen(r));
  const pending = rows.filter((r) => r.kiosk?.matchState === 'possible').length; const noEstimate = rows.filter((r) => isOpen(r) && !r.estimateId).length;
  const decide = (id: string, d: 'confirm' | 'split') => api.resolveKioskMatch(id, d).then(load).catch((e) => setErr(e.message));
  const open = async (r: RequestRow) => { try { const c = await api.ensureRequestThread(r.id); nav(`/inbox?thread=${c.id}&panel=1`); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not open'); } };
  // Tagging a request = tagging its thread (created on first touch); the pool itself stays unowned
  const tag = async (r: RequestRow, t: ConvTag, on: boolean) => { try { const c = await api.ensureRequestThread(r.id); await api.tagConversation(c.id, t, on); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not tag'); } };
  const stop = (e: SyntheticEvent) => e.stopPropagation();
  return <div data-testid="requests-page">
    <PageHeader title="Requests" subtitle={`${rows.filter(isOpen).length} open · ${noEstimate} without an estimate yet · ${api.RG_DIVISION_LABEL[api.getSessionDivision()]} · kiosk check-ins land here${pending ? ` · ${pending} possible existing client${pending === 1 ? '' : 's'} to confirm` : ''} · unowned pool — right-click a row to tag · click a row → its thread + the submission`} action={<div className="flex gap-1"><FilterChip testId="requests-view-open" active={view === 'open'} onClick={() => setView('open')}>Open</FilterChip><FilterChip testId="requests-view-all" active={view === 'all'} onClick={() => setView('all')}>All</FilterChip></div>} />
    {err && <p data-testid="requests-error" className="mb-2 text-xs text-rose-700">{err}</p>}
    <Table testId="requests-table">
      <thead><tr><Th>Request</Th><Th>Client</Th><Th>Dots</Th><Th>Source</Th><Th>Summary</Th><Th>Status</Th><Th>Age</Th><Th>Tags</Th><Th /></tr></thead>
      <tbody>
        {shown.map((r) => { const Icon = SOURCE_ICON[r.source]; const k = r.kiosk; const tags = api.tagsForRequestSync(r.id); return (
          <tr key={r.id} data-testid={`request-row-${r.id}`} onClick={() => void open(r)} {...rowProps(r.id)} className={`cursor-pointer align-top hover:bg-canvas/60 ${isOpen(r) ? '' : 'opacity-60'}`}>
            <Td className="font-mono text-[11px] font-medium text-ink">{r.number}</Td>
            <Td><Link data-testid={`request-client-${r.id}`} to={`/clients/${r.clientId}`} onClick={stop} className="text-xs font-medium text-brand hover:underline">{r.client.firstName} {r.client.lastName}</Link> <RatingBadge clientId={r.clientId} testId={`request-rating-${r.id}`} />{k && <div className="text-[10px] text-ink-400">{k.email} · {k.phone}</div>}</Td>
            <Td><WbpClientRows clientId={r.clientId} compact testId={`request-wbp-${r.id}`} /></Td>
            <Td><span data-testid={`request-source-${r.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-ink-500"><Icon size={12} /> {SOURCE_LABEL[r.source]}</span></Td>
            <Td className="max-w-md text-xs text-ink">{r.summary}{k?.matchState === 'possible' && <div data-testid={`request-match-${r.id}`} onClick={stop} className="mt-1 inline-flex flex-wrap items-center gap-1.5 rounded-sm bg-amber-50 px-1.5 py-1 text-[11px] text-amber-900 ring-1 ring-inset ring-amber-200">Possible existing client — kiosk gave “{k.firstName} {k.lastName}”, matched {r.client.firstName} {r.client.lastName} on {k.matchedOn?.join(' + ')}.<Button size="sm" variant="primary" data-testid={`request-confirm-${r.id}`} onClick={() => decide(r.id, 'confirm')}>Confirm link</Button><Button size="sm" data-testid={`request-split-${r.id}`} onClick={() => decide(r.id, 'split')}>Not the same — new client</Button></div>}{k?.matchState === 'confirmed' && <div className="mt-1 text-[10px] text-moss-700">Linked to existing client (confirmed)</div>}{k?.matchState === 'split' && <div className="mt-1 text-[10px] text-ink-400">Split into a new client record</div>}</Td>
            <Td><StatusPill status={r.status} /></Td>
            <Td data-testid={`request-age-${r.id}`} className="whitespace-nowrap text-xs text-ink-500">{relativeTime(r.createdAt)}<div className="text-[10px] text-ink-400">{r.createdBy} · {r.station}</div></Td>
            <Td data-testid={`request-tags-${r.id}`} data-tags={tags.join(' ') || undefined} className="whitespace-nowrap text-xs text-ink-600">{tags.length ? <TagDots tags={tags} testId={`request-tagdots-${r.id}`} size="md" /> : <span className="text-[10px] text-ink-300">— right-click to tag</span>}</Td>
            <Td className="whitespace-nowrap" onClick={stop}><Link data-testid={`request-open-${r.id}`} to={`/clients/${r.clientId}?hit=req-${r.id}`} className="text-xs text-brand hover:underline">Client 360 →</Link>{r.estimateId ? <Link data-testid={`request-open-estimate-${r.id}`} to={`/estimates/${r.estimateId}`} className="ml-2 rounded-sm bg-moss-50 px-1.5 py-0.5 font-mono text-[11px] text-moss-700 hover:underline">Open estimate →</Link> : isOpen(r) && <Link data-testid={`request-create-estimate-${r.id}`} to={`/estimates/new?request=${r.id}`} className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-ink hover:bg-canvas">Create estimate</Link>}</Td>
          </tr>
        ); })}
        {!shown.length && <EmptyRow colSpan={9} text="No requests" />}
      </tbody>
    </Table>
    {menu && menuRow && <ThreadContextMenu pos={menu.pos} conv={{ tags: api.tagsForRequestSync(menuRow.id), status: 'open' }} actions={{ tag: (t, on) => void tag(menuRow, t, on) }} onClose={close} testId="request-menu" />}
  </div>;
}
