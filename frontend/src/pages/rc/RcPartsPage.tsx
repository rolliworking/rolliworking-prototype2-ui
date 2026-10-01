import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcButton, RcCard, RcError, rcDate, rcMoney } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Parts approval — a money decision: the lines and the price on one page, one tap to approve. Same ledger as the email flow; the email link opens this page.
export default function RcPartsPage() {
  const { id = '' } = useParams(); const { client } = useRcSession();
  const { data, loading, reload } = useAsync(() => api.portalGetPartsRequest(client!.id, id), [id]);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (loading) return null;
  if (!data) return <p className="text-rc-muted" data-testid="rc-parts-missing">We couldn’t find that parts approval on your account.</p>;
  const decide = async (d: 'approve' | 'decline') => { setBusy(true); setErr(null); try { await api.portalDecideParts(client!.id, id, d); reload(); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); } };
  const open = data.request.status === 'awaiting_client';
  return <div className="space-y-6" data-testid="rc-parts-page" data-status={data.request.status}>
    <Link to={`/rc/watches/${data.watch.id}`} className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink" data-testid="rc-parts-back"><ArrowLeft size={14} /> {data.watch.brand} {data.watch.model}</Link>
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Parts approval · {data.request.number}</div>
      <h1 className="mt-1 font-serif text-4xl font-light tracking-tight sm:text-5xl">{open ? 'A few parts need your go-ahead' : data.decided?.decision === 'approve' ? 'Approved — thank you' : 'Declined'}</h1>
      <p className="mt-2 max-w-[560px] text-[15px] leading-relaxed text-rc-muted">While servicing your {data.watch.brand} {data.watch.model} our watchmaker found these parts are needed. {open ? 'The work on this part of the watch pauses until you decide.' : `You decided on ${rcDate(data.decided!.at)}.`}</p>
    </div>
    <RcCard eyebrow="What we need" title={`${data.lines.length} part${data.lines.length === 1 ? '' : 's'}`} testId="rc-parts-lines">
      <ul className="divide-y divide-rc-line">{data.lines.map((l, i) => <li key={i} data-testid={`rc-parts-line-${i}`} className="flex items-baseline justify-between gap-4 py-3 text-[15px]"><span>{l.description}{l.qty > 1 && <span className="text-rc-muted"> × {l.qty}</span>}</span><span className="tabular-nums">{rcMoney(l.price)}</span></li>)}</ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-rc-line pt-3 text-[15px]"><span className="font-medium">Total parts</span><span data-testid="rc-parts-total" className="font-serif text-2xl">{rcMoney(data.total)}</span></div>
      {data.request.note && <p className="mt-3 text-sm text-rc-muted">{data.request.note}</p>}
    </RcCard>
    {open && <div className="flex flex-wrap gap-3">
      <RcButton data-testid="rc-parts-approve" disabled={busy} onClick={() => void decide('approve')}><Check size={16} /> Approve these parts · {rcMoney(data.total)}</RcButton>
      <RcButton tone="danger" data-testid="rc-parts-decline" disabled={busy} onClick={() => void decide('decline')}>Decline</RcButton>
    </div>}
    {!open && <p data-testid="rc-parts-decided" className="text-sm text-rc-muted">{data.decided?.decision === 'approve' ? 'We’ll order the parts and carry on. You can follow the dots on your watch page.' : 'We’ll pause this part of the work and reach out to talk through the options.'} <Link to="/rc/messages" className="underline decoration-rc-accent/60 underline-offset-4">Message us</Link> any time.</p>}
    <RcError text={err} />
  </div>;
}
