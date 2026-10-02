import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { Client } from '@/api/client';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { RequestBuilder } from '@/components/requests/RequestBuilder';
import { field } from '@/components/rs/RsBits';
import { WbpClientRows } from '@/components/shared/WbpDots';
import { PageHeader } from '@/components/ui/Button';

// /requests/new — "New request on behalf of client": pick the client first, then the same builder the portal uses. Result: source = staff, every line shows key + rate.
export default function RequestNewPage() {
  const nav = useNavigate(); const [params] = useSearchParams();
  const [q, setQ] = useState(''); const [hits, setHits] = useState<Client[]>([]); const [client, setClient] = useState<Client | undefined>(() => (params.get('client') ? api.clientByIdSync(params.get('client')!) ?? undefined : undefined));
  useEffect(() => { if (q.trim().length < 2) { setHits([]); return; } let live = true; void api.searchClients(q).then((r) => { if (live) setHits(r.slice(0, 8)); }); return () => { live = false; }; }, [q]);
  return <div data-testid="request-new-page" className="space-y-3">
    <Link to="/requests" data-testid="request-new-back" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Requests</Link>
    <PageHeader title="New request on behalf of client" subtitle="Phone-in · walk-in · email — same structured form the portal uses; the result lands on the Requests page tagged source = staff, with a draft estimate (or an instant quote for auto-quote trade accounts)." />
    <section data-testid="request-new-client" className="rounded-md border border-line bg-surface p-3">
      {client ? <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold text-ink" data-testid="request-new-client-name">{client.firstName} {client.lastName}</span>{client.company && <span className="text-ink-500">· {client.company}</span>}<RatingBadge clientId={client.id} testId="request-new-client-rating" /><WbpClientRows clientId={client.id} compact testId="request-new-client-wbp" /><span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${client.type === 'trade' ? 'bg-amber-100 text-amber-900' : 'bg-canvas text-ink-600'}`} data-testid="request-new-client-type">{client.type}{client.autoQuote ? ' · auto-quote' : ''}</span><span className="text-xs text-ink-400">{client.email} · {client.phone}</span><button type="button" data-testid="request-new-client-change" onClick={() => setClient(undefined)} className="ml-auto text-xs text-brand hover:underline">Change client</button></div>
        : <div><div className="relative"><Search size={13} className="pointer-events-none absolute left-2 top-2 text-ink-400" /><input autoFocus data-testid="request-new-client-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name, email or phone…" className={`${field} w-full pl-7`} /></div>
          {hits.length > 0 && <ul data-testid="request-new-client-hits" className="mt-1 divide-y divide-line rounded-md border border-line">{hits.map((c) => <li key={c.id}><button type="button" data-testid={`request-new-client-pick-${c.id}`} onClick={() => { setClient(c); setQ(''); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-canvas"><span className="font-medium text-ink">{c.firstName} {c.lastName}</span>{c.company && <span className="text-ink-500">· {c.company}</span>}<span className={`rounded-sm px-1 text-[10px] font-semibold uppercase ${c.type === 'trade' ? 'bg-amber-100 text-amber-900' : 'bg-canvas text-ink-500'}`}>{c.type}</span><span className="ml-auto text-ink-400">{c.email}</span></button></li>)}</ul>}
          <p className="mt-1 text-[11px] text-ink-400">Pick the client first — the form adapts (trade accounts get multi-line shipments, waivers and pre-approvals).</p></div>}
    </section>
    {client && <RequestBuilder mode="staff" client={client} onDone={(r) => nav(`/requests/${r.request.id}`, { state: { flash: `${r.request.number} created · ${r.request.builder?.outcome === 'quoted' ? `auto-quoted ${r.estimate?.number}` : `draft estimate ${r.estimate?.number}`}` } })} />}
  </div>;
}
