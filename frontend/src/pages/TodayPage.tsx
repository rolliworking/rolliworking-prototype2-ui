import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Home, Users, UsersRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { AppointmentsTodayCard } from '@/pages/SchedulePage';
import type { TodayRow, TodaySource, TodayView, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { InboxChip, InboxDrawer } from '@/components/today/InboxDrawer';
import { DerivedGroups } from '@/components/today/DerivedGroups';
import { NewTaskForm } from '@/components/today/NewTaskForm';
import { WaitingOnList } from '@/components/today/TodayBits';
import { PinForm, PinModal, PinnedList } from '@/components/today/PinBits';
import { LtsCard } from '@/components/today/LtsCard';
import { BonusProgressCard, BonusResultsCard } from '@/components/today/BonusCards';
import { SafesOverCard } from '@/components/today/SafesOverCard';
import { StaffHitListModal } from '@/components/today/StaffHitListModal';
import { Card } from '@/components/ui/Card';
import { FilterChip, PageHeader } from '@/components/ui/Button';

const SOURCES: TodaySource[] = ['owner', 'assignee', 'hold', 'discrepancy', 'task'];
const LABEL: Record<TodaySource, string> = { owner: 'Owner actions', assignee: 'Bench', hold: 'Holds', discrepancy: 'Discrepancies', task: 'Tasks', thread: 'Replies' };
// Header label: "MH · Owner", otherwise the duty label (first segment)
export const roleTitle = (u: User) => u.id === api.OWNER_USER_ID ? 'Owner' : u.dutyLabel.split(/ [·/—-] /)[0];

// RW shell blocks non-/rw links, so the hitlist lives at both /hitlist/:slug and /rw/hitlist/:slug
export const useHitlistBase = () => { const { pathname } = useLocation(); const rw = pathname.startsWith('/rw'); return { base: rw ? '/rw/hitlist' : '/hitlist', jobBase: rw ? '/rw/jobs' : '/jobs', rw }; };

// Personal Hitlist — Appointments | Pinned on top (stack on a pad), Inbox behind a chip (slide-out), Derived grouped by priority
export default function TodayPage({ forUser }: { forUser?: User }) {
  const { user, station } = useAuth(); const nav = useNavigate(); const { base, jobBase } = useHitlistBase();
  const me = forUser ?? user!;
  const own = me.id === user?.id;
  const [view, setView] = useState<TodayView | null>(null);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [source, setSource] = useState<TodaySource | 'all'>('all');
  const [flash, setFlash] = useState<string | null>(null);
  const [pinFrom, setPinFrom] = useState<TodayRow | null>(null);
  const [showStaffHitList, setShowStaffHitList] = useState(false);

  const load = useCallback(() => Promise.all([api.getToday(me.id).then(setView), hl.getInbox(me.id).then(setInbox)]), [me.id]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (view?.rows ?? []).filter((r) => source === 'all' || r.source === source), [view, source]);
  const counts = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, (view?.rows ?? []).filter((r) => r.source === s).length])), [view]);
  const overdue = (view?.rows ?? []).filter((r) => r.overdue).length;
  const unread = inbox.filter((i) => i.unread).length;

  // "Staff hit lists" is available to managers and concierge (admin-assistants) per ruling
  const canViewStaffHitLists = !!user && (user.accessTier === 'manager' || user.roles.includes('concierge'));
  const switchable = canViewStaffHitLists ? api.getDivisionStaff(station?.division ?? 'rolliworks') : [];
  const divLabel = api.entityName(station?.division ?? 'rolliworks');
  const home = hl.getHomeScreen(me.id);

  const say = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };
  const dismiss = async (id: string, reason?: string) => { try { await api.dismissPinned(id, reason); say(reason ? 'Dismissed' : 'Pinned item done'); } catch (e) { say(e instanceof Error ? e.message : 'Failed'); } await load(); };
  const done = async (taskId: string) => { await api.setTaskDone(taskId, true); setFlash('Task completed — the sender sees it in their waiting-on list'); window.setTimeout(() => setFlash(null), 3000); await load(); };
  const closeInbox = useCallback(() => setInboxOpen(false), []);

  return (
    <div data-testid="today-page" data-for={me.shortName} className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={`Hitlist · ${me.shortName} · ${roleTitle(me)}${own ? '' : ` · viewed by ${user?.shortName}`}`}
          subtitle={view ? `${view.rows.length} derived · ${view.pinned.length} pinned${overdue ? ` · ${overdue} overdue` : ''} · ${divLabel}` : 'Loading…'}
          testId="today-header"
        />
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">
          <InboxChip count={inbox.length} unread={unread} onClick={() => setInboxOpen(true)} />
          <span data-testid="hitlist-bookmark" className="hidden items-center gap-1 rounded-sm bg-canvas px-2 py-1 font-mono text-[11px] text-ink-500 xl:inline-flex" title="Bookmark this — it always opens this person's list"><Bookmark size={11} /> {base}/{hl.slugOf(me)}</span>
          {home !== 'default' && own && <span data-testid="hitlist-home-badge" className="inline-flex items-center gap-1 rounded-sm bg-moss-50 px-2 py-1 text-[11px] font-medium text-moss-700"><Home size={11} /> home screen</span>}
          {hl.isSupervisor(me) && <Link to={`${base}/${hl.slugOf(me)}/team`} data-testid="hitlist-team-link" className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas"><UsersRound size={13} /> Team view · {hl.teamLabel(me)}</Link>}
          {switchable.length > 0 && <select data-testid="hitlist-person-switch" value={me.id} onChange={(e) => { const u = switchable.find((x) => x.id === e.target.value); if (u) nav(`${base}/${hl.slugOf(u)}`); }} className="h-9 rounded-sm border border-line bg-surface px-2 text-xs">{switchable.map((u) => <option key={u.id} value={u.id}>{u.shortName} · {u.dutyLabel}</option>)}</select>}
          {canViewStaffHitLists && <button type="button" data-testid="staff-hitlist-open" onClick={() => setShowStaffHitList(true)} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line bg-surface px-3 font-medium text-ink-700 hover:border-ink-400 hover:bg-canvas"><Users size={13} /> Staff hit lists</button>}
        </div>
      </div>

      {flash && <div data-testid="today-flash" className="rounded-sm bg-moss-50 px-3 py-1.5 text-xs font-medium text-moss-700 animate-rise">{flash}</div>}

      <div data-testid="hitlist-top-row" className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <AppointmentsTodayCard />
        <Card title={<span className="inline-flex items-center gap-2">Pinned <span className="font-mono text-[11px] text-ink-400">{view?.pinned.length ?? 0}</span></span>} subtitle="Manual layer — dismiss when done · never hides the derived rows" testId="today-pinned-card" bodyClassName="p-0" className="border-l-[3px] border-amber-500">
          <div className="max-h-[320px] overflow-y-auto">
            {view && view.pinned.length === 0 ? <p data-testid="pinned-empty" className="px-4 py-3 text-xs text-ink-400">Nothing pinned for {own ? 'you' : me.shortName}.</p> : <PinnedList items={view?.pinned ?? []} onDismiss={dismiss} dense />}
          </div>
          <div className="border-t border-line px-4 py-3"><PinForm me={me.shortName} onPinned={() => { say('Pinned'); void load(); }} /></div>
        </Card>
      </div>
      {own && api.isOwnerSync() && <SafesOverCard />}
      {own && api.isOwnerSync() && <LtsCard />}
      {own && api.isOwnerSync() && <BonusResultsCard />}
      <BonusProgressCard userId={me.id} />

      <Card accent="moss" title={<span className="inline-flex items-center gap-2">Derived <span className="font-mono text-[11px] text-ink-400">{rows.length}</span></span>} subtitle="From jobs, holds, discrepancies and tasks — grouped by priority · hover a row to pin it" bodyClassName="p-0" testId="today-list-card"
        action={<div className="flex flex-wrap items-center gap-1.5" data-testid="today-filters">
          <FilterChip active={source === 'all'} onClick={() => setSource('all')} testId="today-filter-all">All</FilterChip>
          {SOURCES.map((s) => <FilterChip key={s} active={source === s} onClick={() => setSource(s)} testId={`today-filter-${s}`}>{LABEL[s]} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span></FilterChip>)}
        </div>}>
        <DerivedGroups rows={rows} onDone={done} onPin={setPinFrom} />
        {view && rows.length === 0 && <p className="px-4 py-8 text-center text-ink-400">Nothing needs {own ? 'you' : me.shortName} here — nice.</p>}
      </Card>

      {pinFrom && <PinModal defaultTitle={pinFrom.title} jobId={pinFrom.jobId} taskId={pinFrom.taskId} onClose={() => setPinFrom(null)} onPinned={() => { setPinFrom(null); say('Pinned'); void load(); }} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <Card title="Send a task" subtitle="The explicit 20% — assign to a person or a role; linked tasks also show on the job's timeline" testId="today-new-task-card"><NewTaskForm onCreated={() => void load()} /></Card>
        <Card title="Waiting on" subtitle={`Tasks ${own ? 'you' : me.shortName} sent to others, still open`} testId="today-waiting-card" bodyClassName="p-0"><WaitingOnList tasks={view?.waitingOn ?? []} /></Card>
      </div>

      <InboxDrawer open={inboxOpen} me={me} items={inbox} onChange={() => void load()} onClose={closeInbox} jobBase={jobBase} />
      {showStaffHitList && <StaffHitListModal onClose={() => setShowStaffHitList(false)} />}
    </div>
  );
}
