import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { HitListRow } from '@/components/hitlist/HitListRow';
import { useHitList } from '@/hooks/useHitList';

export const HitListPanel = () => {
  const { items, loading, toggle } = useHitList();
  const remaining = items.filter((i) => !i.done).length;

  return (
    <Card
      testId="hit-list-panel"
      accent="moss"
      title="Daily Hit List"
      subtitle={loading ? 'Loading…' : `${remaining} of ${items.length} remaining today`}
      bodyClassName="py-1"
      action={
        <Link to="/hit-list" data-testid="hit-list-open-link" className="inline-flex items-center gap-1 text-xs font-medium text-moss-700 hover:underline">
          Open list <ArrowRight size={12} />
        </Link>
      }
    >
      <ul className="divide-y divide-line/70 -mx-4">
        {items.map((item) => (
          <HitListRow key={item.id} item={item} onToggle={toggle} dense />
        ))}
      </ul>
    </Card>
  );
};
