import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '@/api/client';
import type { TodayRow, TodaySource, TodayView } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { NewTaskForm } from '@/components/today/NewTaskForm';
import { TodayRowItem, WaitingOnList } from '@/components/today/TodayBits';
import { PinForm, PinModal, PinnedList } from '@/components/today/PinBits';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';

const SOURCES: TodaySource[] = ['owner', 'assignee', 'hold', 'discrepancy', 'task'];
const LABEL: Record<TodaySource, string> = { owner: 'Owner actions', assignee: 'Bench', hold: 'Holds', discrepancy: 'Discrepancies', task: 'Tasks' };

export default function TodayPage() {
  const { user } = useAuth();
  const [view, setView] = useState<TodayView | null>(null);
  const [source, setSource] = useState<TodaySource | 'all'>('all');
  const [flash, setFlash] = useState<string | null>(null);
  const [pinFrom, setPinFrom] = useState<TodayRow | null>(null);

  const load = useCallback(() => api.getToday().then(setView), []);
  useEffect(() => { void load(); }, [load, user?.id]);

  const rows = useMemo(() => (view?.rows ?? []).filter((r) => source === 'all' || r.source === source), [view, source]);
  const counts = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, (view?.rows ?? []).filter((r) => r.source === s).length])), [view]);
  const overdue = (view?.rows ?? []).filter((r) => r.overdue).length;

  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const dismiss = async (id: string) => { await api.dismissPinned(id); say('Pinned item done'); await load(); };
  const done = async (taskId: string) => { await api.setTaskDone(taskId, true); setFlash('Task completed — the sender sees it in their waiting-on list'); window.setTimeout(() => setFlash(null), 3000); await load(); };

  return (
    <div data-testid="today-page" className="space-y-4">
      <PageHeader title={`Today · ${user?.shortName ?? ''}`} subtitle={view ? `${view.rows.length} items derived for you${overdue ? ` · ${overdue} overdue` : ''} · roles: ${user?.roles.join(', ')} · no manual curation — rows come from jobs, holds, discrepancies and tasks` : 'Loading…'} testId="today-header" />

      <div className="flex flex-wrap items-center gap-1.5" data-testid="today-filters">
        <FilterChip active={source === 'all'} onClick={() => setSource('all')} testId="today-filter-all">All</FilterChip>
        {SOURCES.map((s) => <FilterChip key={s} active={source === s} onClick={() => setSource(s)} testId={`today-filter-${s}`}>{LABEL[s]} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span></FilterChip>)}
      </div>

      {flash && <div data-testid="today-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}

      <Card title="Pinned" subtitle="Manual layer — added by you or others · dismiss when done · never hides the derived rows below" testId="today-pinned-card" bodyClassName="p-0" className="border-l-[3px] border-amber-500">
        {view && view.pinned.length === 0 ? <p data-testid="pinned-empty" className="px-4 py-3 text-xs text-ink-400">Nothing pinned for you.</p> : <PinnedList items={view?.pinned ?? []} onDismiss={dismiss} />}
        <div className="border-t border-line px-4 py-3"><PinForm me={user?.shortName ?? ''} onPinned={() => { say('Pinned'); void load(); }} /></div>
      </Card>

      <Card accent="moss" title="Derived" subtitle="From jobs, holds, discrepancies and tasks — hover a row to pin it" bodyClassName="py-1" testId="today-list-card">
        <ul className="divide-y divide-line/70">
          {rows.map((r) => <TodayRowItem key={r.id} row={r} onDone={done} onPin={setPinFrom} />)}
          {view && rows.length === 0 && <li className="px-4 py-8 text-center text-ink-400">Nothing needs you here — nice.</li>}
        </ul>
      </Card>

      {pinFrom && <PinModal defaultTitle={pinFrom.title} jobId={pinFrom.jobId} taskId={pinFrom.taskId} onClose={() => setPinFrom(null)} onPinned={() => { setPinFrom(null); say('Pinned'); void load(); }} />}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        <Card title="Send a task" subtitle="The explicit 20% — assign to a person or a role; linked tasks also show on the job's timeline" testId="today-new-task-card"><NewTaskForm onCreated={() => void load()} /></Card>
        <Card title="Waiting on" subtitle="Tasks you sent to others, still open" testId="today-waiting-card" bodyClassName="p-0"><WaitingOnList tasks={view?.waitingOn ?? []} /></Card>
      </div>
    </div>
  );
}
