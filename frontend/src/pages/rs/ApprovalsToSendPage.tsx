import { ArrowLeft, Mail, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ApprovalToSend } from '@/api/client';
import { Button, PageHeader } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, Td, Th } from '@/components/ui/Table';
import { WbpJobDots } from '@/components/shared/WbpDots';
import { fmtMoney, fullName } from '@/lib/format';

// MH daily · APPROVALS TO SEND — parts approvals priced (addendum ready) but not yet sent to the client. One-tap Send each → mail seam (Outbox). List refreshes live; the hitlist item clears at zero.
export default function ApprovalsToSendPage() {
  const [rows, setRows] = useState<ApprovalToSend[]>([]); const [all, setAll] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.getApprovalsToSend().then(setRows);
  useEffect(() => { void load(); }, []);
  const shown = rows.filter((r) => all || r.ready); const ready = rows.filter((r) => r.ready);
  const send = async (id: string) => { setBusy(id); try { const r = await api.sendReadyApproval(id); setMsg(`${r.number} sent to ${fullName(r.client)} — email queued (mail seam)`); } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); await load(); } };
  return <div data-testid="approvals-to-send-page" className="space-y-4">
    <Link to="/hitlist" className="inline-flex h-8 items-center gap-1 text-xs text-ink-500 hover:text-ink"><ArrowLeft size={12} /> Hitlist</Link>
    <PageHeader title="Approvals to send" subtitle={`${ready.length} ready · oldest ${ready[0]?.ageDays ?? 0}d · ${rows.length - ready.length} still need prices (pad review)`} testId="approvals-summary" />
    {msg && <p data-testid="approvals-flash" className="rounded-md bg-moss-50 px-3 py-1.5 text-xs text-moss-800">{msg}</p>}
    <Card title="Parts approvals · not yet sent" subtitle="Estimate addendum priced, no send — tap Send to queue the client email" bodyClassName="p-0" testId="approvals-card" action={<label className="inline-flex items-center gap-1 text-xs text-ink-500"><input type="checkbox" data-testid="approvals-show-all" checked={all} onChange={(e) => setAll(e.target.checked)} /> show unpriced too</label>}>
      <Table><thead><tr><Th>Request</Th><Th>Job · client</Th><Th>Lines</Th><Th className="text-right">Total</Th><Th className="text-right">Age</Th><Th>Requested by</Th><Th /></tr></thead>
        <tbody>{shown.map(({ request: r, total, ageDays, ready: ok }) => <tr key={r.id} data-testid={`approval-row-${r.id}`} data-ready={ok}>
          <Td className="font-mono text-xs font-semibold">{r.number}</Td>
          <Td className="text-xs"><Link to={`/jobs/${r.job.id}`} className="font-mono font-semibold text-ink hover:underline">{r.job.number}</Link> · {fullName(r.client)} · {r.watch.brand} {r.watch.model} <WbpJobDots jobId={r.job.id} /></Td>
          <Td className="text-xs text-ink-600">{(r.items ?? []).map((i) => `${i.description} ×${i.qty}${i.price === undefined ? ' (no price)' : ''}`).join(' · ')}</Td>
          <Td className="tabular text-right text-xs">{fmtMoney(total)}</Td><Td className="tabular text-right text-xs">{ageDays}d</Td><Td className="text-xs">{r.requestedBy} · {r.station}</Td>
          <Td className="text-right">{ok ? <Button size="sm" variant="primary" data-testid={`approval-send-${r.id}`} disabled={busy === r.id} onClick={() => void send(r.id)}><Send size={11} /> Send</Button> : <Link to="/rw/pad" data-testid={`approval-price-${r.id}`} className="text-xs text-brand underline">price on the pad</Link>}</Td>
        </tr>)}{!shown.length && <tr><Td className="py-6 text-center text-xs text-ink-400"><Mail size={12} className="mr-1 inline" /> Nothing waiting — every priced approval has gone out.</Td></tr>}</tbody></Table>
    </Card>
  </div>;
}
