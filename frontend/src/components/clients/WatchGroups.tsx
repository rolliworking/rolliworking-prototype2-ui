import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WatchGroup, WatchHistoryRow } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents } from '@/lib/format';

const KIND_LABEL: Record<WatchHistoryRow['kind'], string> = { estimate: 'EST', job: 'JOB', sales_order: 'INV', request: 'REQ' };
const KIND_TONE: Record<WatchHistoryRow['kind'], string> = { estimate: 'text-brand', job: 'text-violet-700', sales_order: 'text-moss-700', request: 'text-amber-800' };

const yearOf = (iso: string) => new Date(iso).getFullYear();

const HistoryRow = ({ r, showYear }: { r: WatchHistoryRow; showYear: boolean }) => (
  <li data-hit={r.hitKey} data-testid={`watch-history-${r.kind}-${r.id}`} className="grid grid-cols-[38px_88px_1fr_auto_auto] items-center gap-x-2 px-3 py-1 text-xs transition-colors hover:bg-canvas">
    <span className={`font-mono text-[10px] font-semibold ${KIND_TONE[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
    <Link to={r.path} className="truncate font-mono text-xs font-medium text-ink hover:underline">{r.number}</Link>
    <span className="truncate text-ink-700" title={r.title}>{r.title}</span>
    <StatusPill status={r.status} />
    <span className="tabular w-[132px] text-right text-ink-500">
      {r.amount !== undefined && <span className="mr-2 font-medium text-ink-700">{fmtMoneyCents(r.amount)}</span>}
      {showYear ? `${fmtDate(r.at)} ${yearOf(r.at)}` : fmtDate(r.at)}
    </span>
  </li>
);

const WatchCard = ({ g }: { g: WatchGroup }) => {
  const { watch: w } = g;
  const thisYear = new Date().getFullYear();
  return (
    <section data-hit={`watch-${w.id}`} data-testid={`watch-group-${w.id}`} className="rounded-md bg-surface shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="truncate text-[13px] font-semibold text-ink">{w.brand} {w.model}</h3>
          <span className="font-mono text-[11px] text-ink-500">{w.reference}</span>
          <span className="font-mono text-[11px] text-ink-400">S/N {w.serial}</span>
          <span className="hidden text-[11px] text-ink-400 xl:inline">{w.dial} · {w.bracelet}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-ink-500">
          {g.lastServiceAt && <span>last service {fmtDate(g.lastServiceAt)} {yearOf(g.lastServiceAt)}</span>}
          {g.lifetimeSpend > 0 && <span className="tabular">{fmtMoneyCents(g.lifetimeSpend)} paid</span>}
          <StatusPill status={w.status} testId={`watch-status-${w.id}`} />
          {g.activeJobId && (
            <Link to={`/jobs/${g.activeJobId}`} data-testid={`watch-active-job-${w.id}`} className="inline-flex items-center gap-0.5 text-brand hover:underline">
              open job <ArrowUpRight size={11} />
            </Link>
          )}
        </div>
      </header>
      {g.history.length ? (
        <ul className="divide-y divide-line/60 py-1">
          {g.history.map((r) => <HistoryRow key={`${r.kind}-${r.id}`} r={r} showYear={yearOf(r.at) !== thisYear} />)}
        </ul>
      ) : (
        <p className="px-3 py-3 text-xs text-ink-400">No history on this watch yet.</p>
      )}
    </section>
  );
};

export const WatchGroups = ({ groups }: { groups: WatchGroup[] }) => (
  <Card title="Watches" subtitle={`${groups.length} on file · each with its own service history, newest first`} bodyClassName="space-y-3 p-3" testId="client360-watches">
    {groups.map((g) => <WatchCard key={g.watch.id} g={g} />)}
    {groups.length === 0 && <p className="text-xs text-ink-400">No watches on file.</p>}
  </Card>
);
