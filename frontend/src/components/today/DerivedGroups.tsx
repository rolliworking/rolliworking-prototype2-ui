import clsx from 'clsx';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TodayRow } from '@/api/client';
import { componentWaitsSync } from '@/api/concierge';
import { TodayRowItem } from './TodayBits';

// Derived rows grouped by priority / status: Overdue → Urgent → Due today → Upcoming → No date. Each group collapsible, shows count + component-wait total.
export type GroupKey = 'overdue' | 'urgent' | 'today' | 'upcoming' | 'nodate';
const GROUPS: { key: GroupKey; label: string; tone: string }[] = [
  { key: 'overdue', label: 'Overdue', tone: 'text-rose-700 bg-rose-50' },
  { key: 'urgent', label: 'Urgent', tone: 'text-amber-800 bg-amber-50' },
  { key: 'today', label: 'Due today', tone: 'text-ink bg-canvas' },
  { key: 'upcoming', label: 'Upcoming', tone: 'text-ink-600 bg-canvas' },
  { key: 'nodate', label: 'No due date', tone: 'text-ink-400 bg-canvas' },
];
export const bucketOf = (r: TodayRow): GroupKey => r.overdue ? 'overdue' : r.urgent ? 'urgent' : r.dueAt && new Date(r.dueAt).toDateString() === new Date().toDateString() ? 'today' : r.dueAt ? 'upcoming' : 'nodate';

export const DerivedGroups = ({ rows, onDone, onPin }: { rows: TodayRow[]; onDone: (taskId: string) => void; onPin: (row: TodayRow) => void }) => {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return <div data-testid="derived-groups">
    {GROUPS.map((g) => {
      const list = rows.filter((r) => bucketOf(r) === g.key); if (!list.length) return null;
      const waits = list.filter((r) => r.jobId && componentWaitsSync(r.jobId).length > 0).length;
      const open = !closed[g.key];
      return <section key={g.key} data-testid={`derived-group-${g.key}`} data-count={list.length} className="border-b border-line/70 last:border-b-0">
        <button type="button" data-testid={`derived-group-toggle-${g.key}`} onClick={() => setClosed((c) => ({ ...c, [g.key]: open }))} className={clsx('sticky top-0 z-[1] flex w-full items-center gap-2 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide', g.tone)}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{g.label}<span className="rounded-full bg-white/70 px-1.5 font-mono text-[10px] text-ink-700">{list.length}</span>
          {waits > 0 && <span data-testid={`derived-group-waits-${g.key}`} className="rounded-sm bg-sky-100 px-1.5 text-[10px] font-medium normal-case tracking-normal text-sky-800">{waits} waiting on a component</span>}
        </button>
        {open && <ul className="divide-y divide-line/70">{list.map((r) => <TodayRowItem key={r.id} row={r} onDone={onDone} onPin={onPin} dense />)}</ul>}
      </section>;
    })}
  </div>;
};
