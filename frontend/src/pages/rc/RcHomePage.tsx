import { ArrowRight, CreditCard, FileCheck2, MapPin, MessageCircle, PackageCheck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { NeedsYouKind, PortalWatch } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { RcCard, StatusWord, rcDate } from '@/rc/RcBits';
import { useRcSession } from '@/rc/RcSession';

const NY_ICON: Record<NeedsYouKind, LucideIcon> = { approve_estimate: FileCheck2, pay_balance: CreditCard, confirm_pickup: PackageCheck, shipping_info: MapPin, staff_reply: MessageCircle };

const WatchRow = ({ pw }: { pw: PortalWatch }) => {
  const { watch: w, status } = pw;
  const last = pw.history[0];
  return (
    <Link to={`/rc/watches/${w.id}`} data-testid={`rc-watch-${w.id}`} className="group block rounded-lg border border-rc-line bg-rc-paper px-6 py-5 transition-[border-color,transform] hover:-translate-y-px hover:border-rc-accent/60">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className="font-serif text-2xl font-medium tracking-tight">{w.brand} {w.model}</h3>
          <div className="mt-0.5 text-sm text-rc-muted">Ref. {w.reference} · {w.dial} dial · {w.bracelet}</div>
        </div>
        <StatusWord status={status} testId={`rc-watch-status-${w.id}`} />
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-rc-muted">{status.blurb}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-rc-muted">
          {pw.eta && status.active && <span className="mr-4">Expected ready around <span className="text-rc-ink">{rcDate(pw.eta)}</span></span>}
          {last && <span>Latest: {last.title} · {rcDate(last.at)}</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-rc-ink group-hover:text-rc-accent">Details <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
};

export default function RcHomePage() {
  const { client } = useRcSession();
  const { data } = useAsync(() => api.portalGetHome(client!.id), [client!.id]);
  if (!data) return null;
  const active = data.watches.filter((w) => w.status.active);
  const rest = data.watches.filter((w) => !w.status.active);

  return (
    <div className="space-y-10" data-testid="rc-home-page">
      <div>
        <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">Hello, {data.client.firstName}.</h1>
        <p className="mt-2 text-[15px] text-rc-muted">{active.length ? `${active.length} watch${active.length === 1 ? '' : 'es'} with us right now.` : 'Nothing in progress right now.'}</p>
      </div>

      <RcCard eyebrow="Needs you" title={data.needsYou.length ? `${data.needsYou.length} thing${data.needsYou.length === 1 ? '' : 's'} waiting on you` : 'Nothing waiting on you'} testId="rc-needs-you">
        {data.needsYou.length ? (
          <ul className="divide-y divide-rc-line">
            {data.needsYou.map((n) => {
              const Icon = NY_ICON[n.kind];
              return (
                <li key={n.id}>
                  <Link to={n.path} data-testid={`rc-needs-${n.id}`} className="group flex items-center gap-4 py-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-accentSoft text-rc-accent"><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-rc-ink">{n.title}</span>
                      <span className="block truncate text-sm text-rc-muted">{n.detail}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-rc-muted group-hover:text-rc-accent" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[15px] text-rc-muted">We’ll list anything that needs a decision or a detail from you here.</p>
        )}
      </RcCard>

      <section className="space-y-4" data-testid="rc-watches">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Your watches</div>
        {active.map((pw) => <WatchRow key={pw.watch.id} pw={pw} />)}
        {rest.length > 0 && active.length > 0 && <div className="pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Back with you</div>}
        {rest.map((pw) => <WatchRow key={pw.watch.id} pw={pw} />)}
        {data.watches.length === 0 && <p className="text-[15px] text-rc-muted">No watches on file yet.</p>}
      </section>
    </div>
  );
}
