import { ArrowRight, Check, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { BuilderSubmitResult } from '@/api/client';
import * as rb from '@/api/requestBuilder';
import { RequestBuilder } from '@/components/requests/RequestBuilder';
import { RcCard, RcButton, rcMoney } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

// Where a visitor without a portal session goes: the public rw.com Request tab (emulator Tab 3) — it already produces an unowned RQ with source = web (D-418)
export const PUBLIC_REQUEST_PATH = '/www?tab=request';

// /rc/request/new — "Request service". SIGNED-IN ONLY (D-418): client / trade mode by client.type. Not signed in → rw.com Request tab; the portal never serves a public form.
const Done = ({ r, onAgain }: { r: BuilderSubmitResult; onAgain: () => void }) => {
  const lines = r.request.lines ?? []; const groups = rb.groupLabels(lines); const outcome = r.request.builder?.outcome; const quoted = outcome === 'quoted'; const est = r.estimate;
  return <div className="space-y-6" data-testid="rc-request-done" data-outcome={outcome}>
    <div><h1 className="font-serif text-4xl font-light tracking-tight">Thank you, {r.client.firstName}.</h1><p className="mt-2 text-[15px] text-rc-muted">{quoted ? 'Every line matched our rate card — your quote is ready now.' : outcome === 'queued' ? 'Your shipment is logged — a person prices every line and sends the estimate within one business day.' : 'A person reads every request — expect an estimate or a question within one business day.'}</p></div>
    <RcCard testId="rc-request-result" eyebrow="Request" title={<span className="inline-flex items-center gap-2"><Check size={18} className="text-rc-accent" /> <span data-testid="rc-request-number" className="font-mono">{r.request.number}</span></span>}>
      <ul className="divide-y divide-rc-line text-[15px]">{lines.map((l) => <li key={l.id} data-testid={`rc-request-line-${l.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{l.jobTypes.map((j) => rb.JOB_TYPES.find((x) => x.key === j)?.label).join(' + ')}{l.ref ? ` · ref ${l.ref}` : ''}{l.bracelet && rb.braceletKey(l.bracelet) ? ` · ${rb.braceletKey(l.bracelet)}` : ''}{groups[l.id] ? ` · ${groups[l.id]}` : ''}{l.polishNumber ? ` · polish #${l.polishNumber}` : ''}</span><span className="text-rc-muted">{quoted && l.rate ? `${rb.rateLabel(l.rate)} · about ${l.rate.days} days` : 'by estimate'}</span></li>)}</ul>
      {quoted && est && <div data-testid="rc-request-quote" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-rc-accentSoft px-4 py-3"><span className="inline-flex items-center gap-2 text-[15px]"><FileText size={16} className="text-rc-accent" /> Quote <b className="font-mono">{est.number}</b> · {rcMoney(est.total)}</span><Link to={`/rc/estimates/${est.id}`} data-testid="rc-request-open-quote"><RcButton type="button">Review & approve <ArrowRight size={14} /></RcButton></Link></div>}
      {!quoted && <p className="mt-3 text-sm text-rc-muted">It will appear under “Needs you” the moment the estimate is ready.</p>}
    </RcCard>
    <div className="flex flex-wrap gap-3"><Link to="/rc/home" data-testid="rc-request-home"><RcButton type="button" tone="quiet">Back to my watches</RcButton></Link><RcButton type="button" tone="quiet" data-testid="rc-request-another" onClick={onAgain}>Send another request</RcButton></div>
  </div>;
};

export default function RcRequestNewPage() {
  const { client } = useRcSession(); const [res, setRes] = useState<BuilderSubmitResult | null>(null);
  if (!client) return <Navigate to={PUBLIC_REQUEST_PATH} replace />;
  const mode = client.type === 'trade' ? 'trade' : 'client';
  if (res) return <Done r={res} onAgain={() => setRes(null)} />;
  return <div className="space-y-6" data-testid="rc-request-new" data-mode={mode}>
    <div><h1 className="font-serif text-4xl font-light tracking-tight">Request service</h1><p className="mt-2 text-[15px] text-rc-muted">{mode === 'trade' ? `Trade account · ${client.company ?? `${client.firstName} ${client.lastName}`} — list every piece in the shipment${client.autoQuote ? '; lines that match our rate card are quoted the moment you send.' : '; a person prices every line and sends the estimate within one business day.'}` : 'Tell us about the watch and what it needs — we prepare the estimate.'}</p></div>
    <RequestBuilder mode={mode} client={client} onDone={setRes} />
  </div>;
}
