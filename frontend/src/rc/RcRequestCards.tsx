import { ArrowRight, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PortalRequestCard, PortalRequestState } from '@/api/client';
import { rcDate } from '@/rc/RcBits';

const TONE: Record<PortalRequestState, string> = {
  in_progress: 'border-rc-accent bg-rc-accentSoft/40 text-rc-ink',
  decision: 'border-amber-500/60 bg-amber-50 text-amber-900',
  received: 'border-sky-500/50 bg-sky-50 text-sky-900',
  stale_estimate: 'border-rc-line bg-rc-paper text-rc-muted',
  history: 'border-rc-line bg-rc-paper text-rc-muted',
};

// "Your requests" — every card carries the watch identity + reference so a multi-request client never wonders which watch it is about
export const RcRequestCards = ({ cards }: { cards: PortalRequestCard[] }) => {
  const live = cards.filter((c) => c.state !== 'history'); const history = cards.filter((c) => c.state === 'history');
  return <section className="space-y-4" data-testid="rc-request-cards">
    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Your requests · {cards.length}</div>
    {live.map((c) => <article key={c.id} data-testid={`rc-req-${c.id}`} data-state={c.state} className={`rounded-lg border px-6 py-5 ${c.state === 'in_progress' ? 'border-rc-accent/60 bg-rc-paper shadow-[0_6px_24px_rgba(0,0,0,0.04)]' : 'border-rc-line bg-rc-paper'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div><h3 className="font-serif text-2xl font-medium tracking-tight">{c.watchName}</h3><div className="mt-0.5 text-sm text-rc-muted" data-testid={`rc-req-ref-${c.id}`}>{c.reference}{c.estimateNumber && ` · Estimate ${c.estimateNumber}`}{c.requestNumber && ` · Request ${c.requestNumber}`}</div></div>
        <span data-testid={`rc-req-state-${c.id}`} className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${TONE[c.state]}`}>{c.stateLabel}</span>
      </div>
      <div className="mt-3 text-[17px] font-medium">{c.title}</div>
      <p className="mt-1 text-[15px] leading-relaxed text-rc-muted">{c.blurb}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-rc-muted">{c.lastUpdateLabel} <span className="text-rc-ink">{rcDate(c.lastUpdate)}</span></span>
        {c.photoCount > 0 && <span className="inline-flex items-center gap-1 text-rc-muted"><Camera size={13} /> {c.photoCount} photos</span>}
        <span className="ml-auto flex items-center gap-3">
          {c.cta && <Link to={c.cta.path} data-testid={`rc-req-cta-${c.id}`} className="rounded-full bg-rc-ink px-4 py-1.5 text-sm font-medium text-rc-cream hover:opacity-90">{c.cta.label}</Link>}
          <Link to={c.path} data-testid={`rc-req-open-${c.id}`} className="inline-flex items-center gap-1 text-rc-ink hover:text-rc-accent">Details <ArrowRight size={14} /></Link>
        </span>
      </div>
    </article>)}
    {history.length > 0 && <div className="pt-2">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">History</div>
      <ul className="divide-y divide-rc-line rounded-lg border border-rc-line bg-rc-paper">{history.map((c) => <li key={c.id}><Link to={c.path} data-testid={`rc-req-${c.id}`} data-state="history" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-rc-accentSoft/30"><span className="font-serif text-lg">{c.watchName}</span><span className="text-rc-muted" data-testid={`rc-req-ref-${c.id}`}>{c.reference}</span><span data-testid={`rc-req-state-${c.id}`} className="rounded-full border border-rc-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-rc-muted">{c.stateLabel}</span><span className="ml-auto text-rc-muted">{c.lastUpdateLabel} {rcDate(c.lastUpdate)}{c.photoCount > 0 && ` · ${c.photoCount} photos`}</span></Link></li>)}</ul>
    </div>}
    {cards.length === 0 && <p className="text-[15px] text-rc-muted">No requests yet.</p>}
  </section>;
};
