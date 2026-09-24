import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';
import { HitListRow } from '@/components/hitlist/HitListRow';
import { useHitList } from '@/hooks/useHitList';

const OWNERS = ['MH', 'Vienna', 'Walter', 'MM'];

export default function HitListPage() {
  const { items, loading, toggle } = useHitList();
  const [owner, setOwner] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);

  const visible = useMemo(
    () => items.filter((i) => (owner ? i.ownerShortName === owner : true) && (showDone || !i.done)),
    [items, owner, showDone],
  );
  const remaining = items.filter((i) => !i.done).length;

  return (
    <div data-testid="hit-list-page">
      <PageHeader title="Daily Hit List" subtitle={loading ? 'Loading…' : `${remaining} open · ${items.length - remaining} done`} />

      <div className="mb-3 flex items-center gap-1.5">
        <FilterChip active={owner === null} onClick={() => setOwner(null)} testId="hit-filter-all">
          Everyone
        </FilterChip>
        {OWNERS.map((o) => (
          <FilterChip key={o} active={owner === o} onClick={() => setOwner(o)} testId={`hit-filter-${o.toLowerCase()}`}>
            {o}
          </FilterChip>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" data-testid="hit-show-done" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-moss" />
          Show completed
        </label>
      </div>

      <Card accent="moss" bodyClassName="py-1" testId="hit-list-card">
        <ul className="-mx-4 divide-y divide-line/70">
          {visible.map((item) => (
            <HitListRow key={item.id} item={item} onToggle={toggle} />
          ))}
          {!loading && visible.length === 0 && <li className="px-4 py-8 text-center text-ink-400">Nothing here — nice.</li>}
        </ul>
      </Card>
    </div>
  );
}
