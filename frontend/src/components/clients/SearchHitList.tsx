import clsx from 'clsx';
import { FileText, Inbox, MessageSquare, Receipt, User, Watch as WatchIcon, Wrench, type LucideIcon } from 'lucide-react';
import type { IdentifierKind, SearchHit, SearchResults } from '@/api/client';

const ICON: Record<IdentifierKind, LucideIcon> = { client: User, watch: WatchIcon, estimate: FileText, job: Wrench, sales_order: Receipt, package: Inbox, request: MessageSquare };

export const flattenHits = (r: SearchResults | null): SearchHit[] => (r ? r.groups.flatMap((g) => g.hits) : []);

interface Props {
  results: SearchResults;
  active: number;
  onHover: (i: number) => void;
  onPick: (hit: SearchHit) => void;
  dense?: boolean;
}

// Grouped identifier hits — shared by the top-bar search and the /clients page
export const SearchHitList = ({ results, active, onHover, onPick, dense }: Props) => {
  let idx = -1;
  return (
    <div data-testid="search-hit-list" className={clsx(dense ? 'max-h-[70vh]' : 'max-h-[60vh]', 'overflow-y-auto')}>
      {results.groups.map((g) => (
        <div key={g.kind} data-testid={`search-group-${g.kind}`}>
          <div className="sticky top-0 z-[1] bg-canvas px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {g.label} <span className="ml-1 font-normal">{g.hits.length}</span>
          </div>
          <ul role="listbox">
            {g.hits.map((h) => {
              idx += 1;
              const i = idx;
              const Icon = ICON[h.kind];
              return (
                <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    data-testid={`search-hit-${h.kind}-${h.id}`}
                    onMouseEnter={() => onHover(i)}
                    onClick={() => onPick(h)}
                    className={clsx('flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors', i === active ? 'bg-brand-50' : 'hover:bg-canvas')}
                  >
                    <Icon size={13} className="shrink-0 text-ink-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={clsx('truncate text-[13px] font-medium text-ink', h.kind !== 'client' && h.kind !== 'watch' && 'font-mono text-xs')}>{h.label}</span>
                        {h.kind !== 'client' && <span className="truncate text-xs text-ink-500">{h.clientName}</span>}
                      </div>
                      <div className="truncate text-[11px] text-ink-500">{h.detail}</div>
                    </div>
                    <span className="shrink-0 rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-500">{h.matched}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
