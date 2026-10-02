import { ArrowLeft, Check, Download } from 'lucide-react';
import { RcSendWatch } from '@/rc/RcSendWatch';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClientLink } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { LinkExpired, LinkFooter, StepUpModal } from '@/rc/RcAuthBits';
import { RcButton, RcCard, RcError, RcLabel, rcDate, rcMoney } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const PLAIN_STATUS: Record<string, string> = { draft: 'Being prepared', sent: 'Waiting for your decision', approved: 'Approved — thank you', converted: 'Approved — work under way', declined: 'Declined', expired: 'Expired' };

// LINK tier (?t=token) opens this one estimate without sign-in; signed-in clients see the same page. Approve = money → fresh code / Touch ID either way.
export default function RcEstimatePage() {
  const { id = '' } = useParams(); const [sp] = useSearchParams(); const token = sp.get('t');
  const { client } = useRcSession();
  const [link, setLink] = useState<ClientLink | null>(null); const [linkErr, setLinkErr] = useState<string | null>(null);
  const { data: e, loading, reload } = useAsync(async () => { if (token && !client) { const r = await api.portalGetEstimateByLink(token).catch((x) => { setLinkErr(x.message); return null; }); if (!r) return null; setLink(r.link); return r.estimate; } return api.portalGetEstimate(client!.id, id); }, [id, token, client?.id]);
  const clientId = client?.id ?? link?.clientId ?? '';
  const [stepUp, setStepUp] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setErr(null); setBusy(true);
    try { await fn(); setDeclining(false); reload(); } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  if (loading) return null;
  if (linkErr) return <LinkExpired message={linkErr} />;
  if (!e) return <p className="text-rc-muted" data-testid="rc-estimate-missing">We couldn’t find that estimate on your account.</p>;
  const open = e.status === 'sent'; const newer = e.supersededById ? e.supersededById : undefined;

  return (
    <div className="space-y-6" data-testid="rc-estimate-page">
      {client && <Link to="/rc/home" className="inline-flex items-center gap-1 text-sm text-rc-muted hover:text-rc-ink" data-testid="rc-back-home"><ArrowLeft size={14} /> My watches</Link>}
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Estimate {e.number}{e.revision > 1 ? ` · revision ${e.revision}` : ''}</div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight">{e.watch ? `${e.watch.brand} ${e.watch.model}` : 'Your estimate'}</h1>
        <p className="mt-2 font-serif text-lg italic text-rc-ink" data-testid="rc-estimate-status">{PLAIN_STATUS[e.status] ?? e.status}</p>
        {e.watch && <p className="text-sm text-rc-muted">Ref. {e.watch.reference} · Sent {e.sentAt ? rcDate(e.sentAt) : rcDate(e.createdAt)} · Valid until {rcDate(e.validUntil)}{e.targetDate && <> · <span data-testid="rc-estimate-target">Target completion {rcDate(e.targetDate)}</span></>}</p>}
      </div>

      {newer && <div data-testid="rc-estimate-superseded" className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">A newer estimate replaces this one. <Link to={`/rc/estimates/${newer}`} data-testid="rc-estimate-newer-link" className="font-medium underline">Open the current estimate →</Link></div>}
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
        <div className="mt-4 flex items-center justify-between border-t border-rc-line pt-3 text-sm text-rc-muted"><span>This is the copy we sent you{e.sentAt ? ` on ${rcDate(e.sentAt)}` : ''} — it never changes.</span><button type="button" data-testid="rc-estimate-download" onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-rc-ink underline decoration-rc-accent underline-offset-4"><Download size={14} /> Download PDF</button></div>
      </RcCard>

      {open ? (
        <RcCard eyebrow="Your decision" testId="rc-estimate-actions">
          {!declining ? (
            <div className="flex flex-wrap gap-3">
              <RcButton data-testid="rc-approve" disabled={busy} onClick={() => setStepUp(true)}><Check size={16} /> Approve this estimate</RcButton>
              <RcButton tone="danger" data-testid="rc-decline" disabled={busy} onClick={() => setDeclining(true)}>Decline</RcButton>
            </div>
          ) : (
            <div className="space-y-3">
              <RcLabel htmlFor="rc-decline-reason">Tell us why (required)</RcLabel>
              <textarea id="rc-decline-reason" data-testid="rc-decline-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} rows={3} placeholder="e.g. I’d like to wait until after the summer." className="w-full rounded-md border border-rc-line bg-white px-3 py-2 text-[15px] focus:border-rc-accent focus:outline-none focus:ring-2 focus:ring-rc-accent/20" />
              <div className="flex gap-3">
                <RcButton tone="danger" data-testid="rc-decline-confirm" disabled={busy || !reason.trim()} onClick={() => run(() => api.portalDeclineEstimate(clientId, e.id, reason))}>Decline estimate</RcButton>
                <RcButton tone="quiet" data-testid="rc-decline-cancel" onClick={() => setDeclining(false)}>Keep thinking</RcButton>
              </div>
            </div>
          )}
          <RcError text={err} />
          <p className="mt-4 text-sm text-rc-muted">Approving tells our workshop to proceed. Nothing is charged until the work is complete. We confirm it’s you with a fresh emailed code{client ? ' or Touch ID' : ''} before the approval lands.</p>
        </RcCard>
      ) : (
        <RcCard testId="rc-estimate-decided">
          <p className="text-[15px] text-rc-muted">
            {e.status === 'approved' || e.status === 'converted' ? <>You approved this estimate{e.approvedAt ? ` on ${rcDate(e.approvedAt)}` : ''}{e.approvedVia === 'portal' ? ' here in RolliConnect' : ''}. {e.jobId ? <Link to={e.watchId ? `/rc/watches/${e.watchId}` : '/rc/home'} className="text-rc-ink underline decoration-rc-accent underline-offset-4">Follow the work</Link> : 'We’ll let you know when your watch is on the bench.'}</> : null}
            {e.status === 'declined' && <>You declined this estimate{e.declinedAt ? ` on ${rcDate(e.declinedAt)}` : ''}{e.declineReason ? ` — “${e.declineReason}”` : ''}. If you change your mind, just message us.</>}
            {e.status === 'expired' && <span data-testid="rc-estimate-expired">This estimate expired on {rcDate(e.validUntil)} — ready to send it in? {e.engagement?.some((x) => x.kind === 'requote_requested') ? <span data-testid="rc-requote-sent" className="text-rc-ink">We have your request — a refreshed quote is on its way.</span> : <button type="button" data-testid="rc-requote" disabled={busy} onClick={() => run(() => api.portalRequestRequote(client!.id, e.id))} className="font-medium text-rc-ink underline decoration-rc-accent underline-offset-4">Ask us to refresh this quote</button>}</span>}
            {e.status === 'draft' && <>Our team is still preparing this estimate.</>}
          </p>
          <RcError text={err} />
        </RcCard>
      )}
      {(open || e.status === 'approved' || e.status === 'converted') && !newer && (client ? <RcSendWatch estimate={e} onChange={reload} /> : <RcCard testId="rc-send-watch-signin"><p className="text-[15px] text-rc-muted">Want a prepaid shipping label or to ask a question? <Link to={`/rc?email=${encodeURIComponent(link?.email ?? '')}&next=${encodeURIComponent(`/rc/estimates/${e.id}`)}`} data-testid="rc-estimate-signin-for-more" className="text-rc-ink underline decoration-rc-accent underline-offset-4">Sign in</Link> — this link only shows the estimate.</p></RcCard>)}
      {link && !client && <LinkFooter link={link} what={`estimate ${e.number}`} />}
      {stepUp && <StepUpModal clientId={clientId} action={api.STEP_UP_ACTION.approveEstimate(e.id)} title={`Approve ${e.number} · ${rcMoney(e.total)}`} what="You’re approving the work and the price on this estimate." onClose={() => setStepUp(false)} onVerified={() => { setStepUp(false); void run(() => api.portalApproveEstimate(clientId, e.id)); }} />}
    </div>
  );
}
