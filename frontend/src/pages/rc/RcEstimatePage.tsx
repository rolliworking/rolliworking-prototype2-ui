import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcButton, RcCard, RcError, RcLabel, rcDate, rcMoney } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const PLAIN_STATUS: Record<string, string> = { draft: 'Being prepared', sent: 'Waiting for your decision', approved: 'Approved — thank you', converted: 'Approved — work under way', declined: 'Declined', expired: 'Expired' };

export default function RcEstimatePage() {
  const { id = '' } = useParams();
  const { client } = useRcSession();
  const { data: e, loading, reload } = useAsync(() => api.portalGetEstimate(client!.id, id), [id]);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null); setBusy(true);
    try { await fn(); setDeclining(false); reload(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  if (loading) return null;
  if (!e) return <p className="text-rc-muted" data-testid="rc-estimate-missing">We couldn’t find that estimate on your account.</p>;
  const open = e.status === 'sent';

  return (
    <div className="space-y-6" data-testid="rc-estimate-page">
      <Link to="/rc/home" className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink" data-testid="rc-back-home"><ArrowLeft size={14} /> My watches</Link>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Estimate {e.number}{e.revision > 1 ? ` · revision ${e.revision}` : ''}</div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight">{e.watch ? `${e.watch.brand} ${e.watch.model}` : 'Your estimate'}</h1>
        <p className="mt-2 font-serif text-lg italic text-rc-ink" data-testid="rc-estimate-status">{PLAIN_STATUS[e.status] ?? e.status}</p>
        {e.watch && <p className="text-sm text-rc-muted">Ref. {e.watch.reference} · Sent {e.sentAt ? rcDate(e.sentAt) : rcDate(e.createdAt)} · Valid until {rcDate(e.validUntil)}</p>}
      </div>

      <RcCard eyebrow="What we propose" testId="rc-estimate-lines">
        <ul className="divide-y divide-rc-line">
          {e.lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-6 py-3">
              <span className="text-[15px]">{l.description}{l.qty > 1 && <span className="text-rc-muted"> × {l.qty}</span>}</span>
              <span className="tabular whitespace-nowrap text-[15px]">{rcMoney(l.qty * l.unitPrice)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-rc-ink/20 pt-4">
          <span className="text-sm uppercase tracking-[0.12em] text-rc-muted">Total</span>
          <span className="font-serif text-3xl" data-testid="rc-estimate-total">{rcMoney(e.total)}</span>
        </div>
        {e.clientNotes && <p className="mt-4 text-[15px] leading-relaxed text-rc-muted"><span className="font-medium text-rc-ink">What you told us: </span>{e.clientNotes}</p>}
        {e.messageNotes && <p className="mt-2 text-[15px] leading-relaxed text-rc-muted">{e.messageNotes}</p>}
      </RcCard>

      {open ? (
        <RcCard eyebrow="Your decision" testId="rc-estimate-actions">
          {!declining ? (
            <div className="flex flex-wrap gap-3">
              <RcButton data-testid="rc-approve" disabled={busy} onClick={() => run(() => api.portalApproveEstimate(client!.id, e.id))}><Check size={16} /> Approve this estimate</RcButton>
              <RcButton tone="danger" data-testid="rc-decline" disabled={busy} onClick={() => setDeclining(true)}>Decline</RcButton>
            </div>
          ) : (
            <div className="space-y-3">
              <RcLabel htmlFor="rc-decline-reason">Tell us why (required)</RcLabel>
              <textarea id="rc-decline-reason" data-testid="rc-decline-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} rows={3} placeholder="e.g. I’d like to wait until after the summer." className="w-full rounded-md border border-rc-line bg-white px-3 py-2 text-[15px] focus:border-rc-accent focus:outline-none focus:ring-2 focus:ring-rc-accent/20" />
              <div className="flex gap-3">
                <RcButton tone="danger" data-testid="rc-decline-confirm" disabled={busy || !reason.trim()} onClick={() => run(() => api.portalDeclineEstimate(client!.id, e.id, reason))}>Decline estimate</RcButton>
                <RcButton tone="quiet" data-testid="rc-decline-cancel" onClick={() => setDeclining(false)}>Keep thinking</RcButton>
              </div>
            </div>
          )}
          <RcError text={err} />
          <p className="mt-4 text-sm text-rc-muted">Approving tells our workshop to proceed. Nothing is charged until the work is complete.</p>
        </RcCard>
      ) : (
        <RcCard testId="rc-estimate-decided">
          <p className="text-[15px] text-rc-muted">
            {e.status === 'approved' || e.status === 'converted' ? <>You approved this estimate{e.approvedAt ? ` on ${rcDate(e.approvedAt)}` : ''}{e.approvedVia === 'portal' ? ' here in RolliConnect' : ''}. {e.jobId ? <Link to={e.watchId ? `/rc/watches/${e.watchId}` : '/rc/home'} className="text-rc-ink underline decoration-rc-accent underline-offset-4">Follow the work</Link> : 'We’ll let you know when your watch is on the bench.'}</> : null}
            {e.status === 'declined' && <>You declined this estimate{e.declinedAt ? ` on ${rcDate(e.declinedAt)}` : ''}{e.declineReason ? ` — “${e.declineReason}”` : ''}. If you change your mind, just message us.</>}
            {e.status === 'expired' && <>This estimate has expired. Message us and we’ll refresh it.</>}
            {e.status === 'draft' && <>Our team is still preparing this estimate.</>}
          </p>
        </RcCard>
      )}
    </div>
  );
}
