import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { TodayView } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { TodayRowItem } from '@/components/today/TodayBits';
import { Card } from '@/components/ui/Card';

export const HitListPanel = () => {
  const { user } = useAuth();
  const [view, setView] = useState<TodayView | null>(null);
  const load = useCallback(() => api.getToday().then(setView), []);
  useEffect(() => { void load(); }, [load, user?.id]);
  const rows = view?.rows ?? [];
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <Card
      testId="hit-list-panel"
      accent="moss"
      title={`Today · ${user?.shortName ?? ''}`}
      subtitle={view ? `${rows.length} derived for you${overdue ? ` · ${overdue} overdue` : ''}` : 'Loading…'}
      bodyClassName="py-1"
      action={<Link to="/today" data-testid="hit-list-open-link" className="inline-flex items-center gap-1 text-xs font-medium text-moss-700 hover:underline">Open Today <ArrowRight size={12} /></Link>}
    >
      <ul className="divide-y divide-line/70">
        {rows.slice(0, 8).map((r) => <TodayRowItem key={r.id} row={r} dense onDone={async (id) => { await api.setTaskDone(id, true); await load(); }} />)}
        {view && rows.length === 0 && <li className="px-4 py-4 text-center text-xs text-ink-400">Nothing needs you right now.</li>}
      </ul>
    </Card>
  );
};
