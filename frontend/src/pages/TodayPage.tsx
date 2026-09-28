import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Home, Users, UsersRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { AppointmentsTodayCard } from '@/pages/SchedulePage';
import type { TodayRow, TodaySource, TodayView, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { InboxPanel } from '@/components/today/InboxPanel';
import { NewTaskForm } from '@/components/today/NewTaskForm';
import { TodayRowItem, WaitingOnList } from '@/components/today/TodayBits';
import { PinForm, PinModal, PinnedList } from '@/components/today/PinBits';
import { StaffHitListModal } from '@/components/today/StaffHitListModal';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';

const SOURCES: TodaySource[] = ['owner', 'assignee', 'hold', 'discrepancy', 'task'];
const LABEL: Record<TodaySource, string> = { owner: 'Owner actions', assignee: 'Bench', hold: 'Holds', discrepancy: 'Discrepancies', task: 'Tasks', thread: 'Replies' };

// RW shell blocks non-/rw links, so the hitlist lives at both /hitlist/:slug and /rw/hitlist/:slug
export const useHitlistBase = () => { const { pathname } = useLocation(); const rw = pathname.startsWith('/rw'); return { base: rw ? '/rw/hitlist' : '/hitlist', jobBase: rw ? '/rw/jobs' : '/jobs', rw }; };

// Personal Hitlist — every staff member's own work queue (forUser = someone else's list when opened from a slug URL or the team view)
export default function TodayPage({ forUser }: { forUser?: User }) {
  const { user, station } = useAuth(); const nav = useNavigate(); const { base, jobBase } = useHitlistBase();
  const me = forUser ?? user!;
  const own = me.id === user?.id;
  const [view, setView] = useState<TodayView | null>(null);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [source, setSource] = useState<TodaySource | 'all'>('all');
  const [flash, setFlash] = useState<string | null>(null);
  const [pinFrom, setPinFrom] = useState<TodayRow | null>(null);
  const [showStaffHitList, setShowStaffHitList] = useState(false);

  const load = useCallback(() => Promise.all([api.getToday(me.id).then(setView), hl.getInbox(me.id).then(setInbox)]), [me.id]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (view?.rows ?? []).filter((r) => source === 'all' || r.source === source), [view, source]);
  const counts = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, (view?.rows ?? []).filter((r) => r.source === s).length])), [view]);
  const overdue = (view?.rows ?? []).filter((r) => r.overdue).length;

  // "Staff hit lists" is available to managers and concierge (admin-assistants) per ruling
  const canViewStaffHitLists = !!user && (user.accessTier === 'manager' || user.roles.includes('concierge'));
  const switchable = canViewStaffHitLists ? api.getDivisionStaff(station?.division ?? 'rolliworks') : [];
  const divLabel = station?.division === 'rollishop' ? 'RolliShop' : 'Rolliworks';
  const home = hl.getHomeScreen(me.id);

  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const dismiss = async (id: string) => { await api.dismissPinned(id); say('Pinned item done'); await load(); };
  const done = async (taskId: string) => { await api.setTaskDone(taskId, true); setFlash('Task completed — the sender sees it in their waiting-on list'); window.setTimeout(() => setFlash(null), 3000); await load(); };

  return (
    <div data-testid="today-page" data-for={me.shortName} className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`Hitlist · ${me.shortName}${own ? '' : ` · viewed by ${user?.shortName}`}`}
          subtitle={view ? `${view.rows.length} items derived${own ? ' for you' : ''}${overdue ? ` · ${overdue} overdue` : ''} · roles: ${me.roles.join(', ')} · division: ${divLabel} · rows from jobs, holds, discrepancies and tasks` : 'Loading…'}
          testId="today-header"
        />
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
          <span data-testid="hitlist-bookmark" className="inline-flex items-center gap-1 rounded-sm bg-canvas px-2 py-1 font-mono text-[11px] text-ink-500" title="Bookmark this — it always opens this person's list"><Bookmark size={11} /> {base}/{hl.slugOf(me)}</span>
          {home !== 'default' && own && <span data-testid="hitlist-home-badge" className="inline-flex items-center gap-1 rounded-sm bg-moss-50 px-2 py-1 text-[11px] font-medium text-moss-700"><Home size={11} /> home screen</span>}
          {hl.isSupervisor(me) && <Link to={`${base}/${hl.slugOf(me)}/team`} data-testid="hitlist-team-link" className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas"><UsersRound size={13} /> Team view · {hl.TEAM_MAP[me.shortName].label}</Link>}
          {switchable.length > 0 && <select data-testid="hitlist-person-switch" value={me.id} onChange={(e) => { const u = switchable.find((x) => x.id === e.target.value); if (u) nav(`${base}/${hl.slugOf(u)}`); }} className="h-8 rounded-sm border border-line bg-surface px-2 text-xs">{switchable.map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel}</option>)}</select>}
          {canViewStaffHitLists && <button type="button" data-testid="staff-hitlist-open" onClick={() => setShowStaffHitList(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas"><Users size={13} /> Staff hit lists</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" data-testid="today-filters">
        <FilterChip active={source === 'all'} onClick={() => setSource('all')} testId="today-filter-all">All</FilterChip>
        {SOURCES.map((s) => <FilterChip key={s} active={source === s} onClick={() => setSource(s)} testId={`today-filter-${s}`}>{LABEL[s]} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span></FilterChip>)}
      </div>

      {flash && <div data-testid="today-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}

      <AppointmentsTodayCard />

      <InboxPanel me={me} items={inbox} onChange={() => void load()} jobBase={jobBase} />

      <Card title="Pinned" subtitle="Manual layer — added by you or others · dismiss when done · never hides the derived rows below" testId="today-pinned-card" bodyClassName="p-0" className="border-l-[3px] border-amber-500">
        {view && view.pinned.length === 0 ? <p data-testid="pinned-empty" className="px-4 py-3 text-xs text-ink-400">Nothing pinned for {own ? 'you' : me.shortName}.</p> : <PinnedList items={view?.pinned ?? []} onDismiss={dismiss} />}
        <div className="border-t border-line px-4 py-3"><PinForm me={me.shortName} onPinned={() => { say('Pinned'); void load(); }} /></div>
      </Card>

      <Card accent="moss" title="Derived" subtitle="From jobs, holds, discrepancies and tasks — hover a row to pin it" bodyClassName="py-1" testId="today-list-card">
        <ul className="divide-y divide-line/70">
          {rows.map((r) => <TodayRowItem key={r.id} row={r} onDone={done} onPin={setPinFrom} />)}
          {view && rows.length === 0 && <li className="px-4 py-8 text-center text-ink-400">Nothing needs {own ? 'you' : me.shortName} here — nice.</li>}
        </ul>
      </Card>

      {pinFrom && <PinModal defaultTitle={pinFrom.title} jobId={pinFrom.jobId} taskId={pinFrom.taskId} onClose={() => setPinFrom(null)} onPinned={() => { setPinFrom(null); say('Pinned'); void load(); }} />}

      <div className="grid grid-cols-[1fr_380px] gap-4">
        <Card title="Send a task" subtitle="The explicit 20% — assign to a person or a role; linked tasks also show on the job's timeline" testId="today-new-task-card"><NewTaskForm onCreated={() => void load()} /></Card>
        <Card title="Waiting on" subtitle={`Tasks ${own ? 'you' : me.shortName} sent to others, still open`} testId="today-waiting-card" bodyClassName="p-0"><WaitingOnList tasks={view?.waitingOn ?? []} /></Card>
      </div>

      {showStaffHitList && <StaffHitListModal onClose={() => setShowStaffHitList(false)} />}
    </div>
  );
}
