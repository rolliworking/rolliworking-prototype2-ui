import { Hammer, Lock, MessageSquare, Settings, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/api/client';
import type { BenchBoard, BenchSettings, JobWithRefs, MessageInboxRow, User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BenchGoalsSection } from '@/components/rw/bench/BenchGoals';
import { BenchLock } from '@/components/rw/bench/BenchLock';
import { BenchMessagesSection, BenchThreadSheet } from '@/components/rw/bench/BenchMessages';
import { BenchSection, CompletedList, JobRowCard, OutsourcedList, SplitCard } from '@/components/rw/bench/BenchSections';
import { BenchSettingsSheet } from '@/components/rw/bench/BenchSettings';
import { Clock } from '@/components/rw/RwBits';

const RETRY_MS = 4000;

// Idle re-lock: any touch/key/pointer resets the timer; firing returns the kiosk to the PIN pad
const useIdle = (minutes: number, active: boolean, onIdle: () => void) => {
  useEffect(() => {
    if (!active) return; let t = 0; const arm = () => { window.clearTimeout(t); t = window.setTimeout(onIdle, minutes * 60_000); };
    const evs = ['pointerdown', 'touchstart', 'keydown', 'pointermove'] as const; evs.forEach((e) => window.addEventListener(e, arm, { passive: true })); arm();
    return () => { window.clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, arm)); };
  }, [minutes, active, onIdle]);
};

// Long-press (600ms) reveals the settings gate — a plain tap does nothing, so the gear can't be hit by accident on the floor
const LongPressGear = ({ onLong }: { onLong: () => void }) => {
  const t = useRef(0); const start = () => { t.current = window.setTimeout(onLong, 600); }; const stop = () => window.clearTimeout(t.current);
  return <button data-testid="bench-gear" aria-label="Bench settings (long-press)" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()} className="min-h-[44px] min-w-[44px] rounded-full text-slate-600 hover:text-slate-300"><Settings size={18} className="mx-auto" /></button>;
};

// Bench Pad — one kiosked iPad per watchmaker bench. Device = station, PIN = person. Own numbers only, no money, never navigates away.
export default function RwBenchPage() {
  const { user, refreshStation } = useAuth();
  const [settings, setSettings] = useState<BenchSettings>(api.getBenchSettings()); const [locked, setLocked] = useState(!user); const [board, setBoard] = useState<BenchBoard | null>(null); const [offline, setOffline] = useState(false);
  const [thread, setThread] = useState<{ job: JobWithRefs; rootId?: string } | null>(null); const [gear, setGear] = useState(false); const [lastUser, setLastUser] = useState<User | null>(user);
  const load = useCallback(async () => { if (!user) return; try { setBoard(await api.getBenchBoard(user.id)); setOffline(false); } catch { setOffline(true); } }, [user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!offline) return; const i = window.setInterval(() => void load(), RETRY_MS); return () => window.clearInterval(i); }, [offline, load]);
  useEffect(() => { if (user) { setLocked(false); setLastUser(user); } }, [user]);
  const relock = useCallback(() => { setThread(null); setGear(false); setLocked(true); }, []);
  useIdle(settings.idleMinutes, !locked && !!user, relock);
  const unlock = async (u: User) => { setLastUser(u); await refreshStation(); setLocked(false); };
  const openRow = (r: MessageInboxRow) => setThread({ job: r.job, rootId: r.thread.root.id });
  const showLock = locked || !user;
  return <div data-testid="rw-bench-page" className="bench-kiosk flex h-full flex-col" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif' }}>
    <header data-testid="bench-header" className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0f14]/95 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-4">
        <Hammer size={20} className="text-amber-400" />
        <div><div data-testid="bench-name" className="text-lg font-bold text-slate-100">{settings.benchName}</div><div className="text-xs text-slate-500">Bench Pad · {showLock ? 'locked' : `${user?.shortName} · ${board ? `${board.inProgress.length} in progress` : 'loading…'}`}</div></div>
        {!showLock && board && board.unread > 0 && <span data-testid="bench-unread" className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-[#0b0f14]"><MessageSquare size={12} /> {board.unread} unread</span>}
        <div className="ml-auto flex items-center gap-3"><Clock />{!showLock && <button data-testid="bench-lock-now" onClick={relock} aria-label="Lock" className="min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:text-slate-200"><Lock size={18} className="mx-auto" /></button>}<LongPressGear onLong={() => setGear(true)} /></div>
      </div>
    </header>
    {offline && <div data-testid="bench-offline-banner" className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1 text-xs font-semibold text-amber-200"><WifiOff size={12} className="bench-pulse" /> reconnecting… <span className="font-normal text-amber-200/70">showing last data</span></div>}
    {showLock ? <BenchLock onUnlock={unlock} lastUser={lastUser} />
    : <main data-testid="bench-board" className="flex-1 overflow-y-auto px-5 pb-16 pt-4">
      {board && <div className="mx-auto max-w-5xl space-y-8">
        <BenchSection title="In progress" count={board.inProgress.length} testId="bench-in-progress"><div className="grid gap-3 lg:grid-cols-2">{board.inProgress.map((r) => <JobRowCard key={r.job.id} r={r} onMessage={(j) => setThread({ job: j })} />)}</div>{!board.inProgress.length && <p className="text-sm text-slate-500">Nothing on your bench right now.</p>}</BenchSection>
        <BenchSection title="Needs attention" count={board.attention.length} testId="bench-attention" tone={board.attention.length ? 'rose' : undefined}><p className="text-xs text-slate-500">stuck = no scan movement in {board.stuckDays} working days · late = past promise date</p><div className="grid gap-3 lg:grid-cols-2">{board.attention.map((r) => <JobRowCard key={r.job.id} r={r} showFlags onMessage={(j) => setThread({ job: j })} />)}</div>{!board.attention.length && <p className="text-sm text-slate-500">Nothing stuck or late.</p>}</BenchSection>
        <BenchSection title="Bands & splits" count={board.splits.length} testId="bench-splits"><div className="grid gap-3 lg:grid-cols-2">{board.splits.map((s) => <SplitCard key={s.job.id} s={s} onMessage={(j) => setThread({ job: j })} />)}</div>{!board.splits.length && <p className="text-sm text-slate-500">No multi-part jobs on your bench.</p>}</BenchSection>
        <BenchSection title="Outsourced components" count={board.outsourced.length} testId="bench-outsourced"><OutsourcedList rows={board.outsourced} onMessage={(j) => setThread({ job: j })} />{!board.outsourced.length && <p className="text-sm text-slate-500">Nothing out with a vendor.</p>}</BenchSection>
        <BenchSection title="Messages" count={board.messages.length} testId="bench-messages" tone={board.unread ? 'amber' : undefined}><BenchMessagesSection rows={board.messages} onOpen={openRow} /></BenchSection>
        <BenchSection title="Completed this month" count={board.goals.current.actual} testId="bench-completed"><CompletedList rows={board.completed} /></BenchSection>
        <BenchSection title="Goals" count={board.goals.history.filter((m) => m.hit).length} testId="bench-goals-section"><p className="text-xs text-slate-500">Your numbers only · past 6 months shown as they were · hit and missed both count</p><BenchGoalsSection g={board.goals} /></BenchSection>
      </div>}
      {!board && !offline && <p className="py-10 text-center text-slate-500">Loading your board…</p>}
    </main>}
    {thread && <BenchThreadSheet job={thread.job} rootId={thread.rootId} onClose={() => setThread(null)} onChanged={() => void load()} />}
    {gear && <BenchSettingsSheet current={settings} onClose={() => setGear(false)} onSaved={(s) => { setSettings(s); setGear(false); void load(); }} />}
  </div>;
}
