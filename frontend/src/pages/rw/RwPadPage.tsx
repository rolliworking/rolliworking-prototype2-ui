import { ClipboardCheck, ClipboardList, LayoutDashboard, Megaphone, Package, ScanSearch, Users, Wrench, Map, Archive } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { BinView, ClientRequestAlert, PadCard, PadPartsContext, PadRoom, PartsRequestWithRefs, RoomSummary } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { canSupervise } from '@/config/roles';
import { ClientRequestModal } from '@/components/jobs/ClientRequests';
import { AuditPanel } from '@/components/rw/AuditPanel';
import { Toast } from '@/components/rw/pad/PadBits';
import { PadBin } from '@/components/rw/pad/PadBin';
import { PadComms } from '@/components/rw/pad/PadComms';
import { PadDashboard, PadTeam } from '@/components/rw/pad/PadDashboard';
import { PadJobs } from '@/components/rw/pad/PadJobs';
import { PadParts } from '@/components/rw/pad/PadParts';
import { PadReview } from '@/components/rw/pad/PadReview';
import { Clock, PinSwitch, ScanInput } from '@/components/rw/RwBits';

type Tab = 'dashboard' | 'jobs' | 'bin' | 'parts' | 'review' | 'audit' | 'team' | 'comms';
type Queue = Awaited<ReturnType<typeof api.getReviewQueue>>;
const TITLE: Record<Tab, string> = { dashboard: '', jobs: 'Jobs', bin: 'JV bin', parts: 'Parts', review: 'Parts request history', audit: 'Audit', team: 'Team', comms: 'Page / Message' };
const NO_SCAN: Tab[] = ['audit', 'dashboard', 'team', 'comms', 'bin'];

// Supervisor Pad v2 — supervisors (MM: watchmaker room + band/polish oversight; JV: band/polish) on iPad or PC. `room` picks the board; band techs open room="band" as their home. Tablet-native shell: large title, bottom tabs, sheets.
export default function RwPadPage({ room = 'wm' }: { room?: PadRoom }) {
  const { user } = useAuth(); const isManager = !!user && canSupervise(user);
  // Non-manager cards land on the read-only Parts Request History only — PROVISIONAL: what Concierge (Chyna) should see on the pad is an OPEN QUESTION for MH (ties to Q91)
  const [tab, setTab] = useState<Tab>(isManager ? 'dashboard' : 'review');
  useEffect(() => { if (!isManager) setTab('review'); }, [isManager]); const [cards, setCards] = useState<PadCard[]>([]); const [sum, setSum] = useState<RoomSummary | null>(null); const [reqs, setReqs] = useState<PartsRequestWithRefs[]>([]); const [queue, setQueue] = useState<Queue | null>(null); const [bin, setBin] = useState<BinView | null>(null);
  const [ctx, setCtx] = useState<PadPartsContext | null>(null); const [hit, setHit] = useState<string | null>(null); const [alert, setAlert] = useState<ClientRequestAlert | null>(null); const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'learn' | 'err' } | null>(null);
  const hasBin = room === 'band' && isManager; // JV's bin lives on the band / polish room pad
  const load = useCallback(() => Promise.all([api.getPadBoard(room).then(setCards), api.getRoomSummary().then(setSum), api.getPadRequests().then(setReqs), api.getReviewQueue().then(setQueue), hasBin ? api.getBin().then(setBin) : Promise.resolve()]).then(() => undefined), [room, hasBin]);
  useEffect(() => { void load(); }, [load]);
  const say = (text: string, tone: 'ok' | 'learn' | 'err' = 'ok') => { setToast({ text, tone }); window.setTimeout(() => setToast(null), tone === 'learn' ? 4500 : 3000); void load(); };
  const globalScan = async (code: string) => {
    const c = await api.getPadPartsContext(code); setAlert(api.clientRequestAlert(c.job.id));
    if (tab === 'parts') setCtx(c); else { setHit(c.job.id); setTab('jobs'); window.setTimeout(() => document.querySelector(`[data-testid="pad-card-${c.job.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }
  };
  const counts: Record<Tab, number> = { team: 0, comms: 0, dashboard: 0, jobs: cards.length, bin: bin?.inBin.length ?? 0, parts: reqs.filter((r) => r.status === 'pending_review' || r.status === 'awaiting_client').length, review: (queue?.review.length ?? 0) + (queue?.toAllocate.length ?? 0) + (queue?.bench.filter((b) => b.status === 'pending').length ?? 0), audit: 0 };
  const tabs: readonly (readonly [Tab, string, typeof Wrench])[] = isManager ? [['dashboard', 'Dashboard', LayoutDashboard], ['jobs', 'Jobs', Wrench], ...(hasBin ? [['bin', 'Bin', Archive] as const] : []), ['parts', 'Parts', Package], ['review', 'Requests', ClipboardCheck], ['audit', 'Audit', ScanSearch], ['team', 'Team', Users], ['comms', 'Page', Megaphone]] : [['review', 'Requests', ClipboardCheck], ['comms', 'Page', Megaphone]];
  const binNight = !!bin && bin.night && bin.binDue;
  return <div data-testid="rw-pad-page" data-room={room} className="flex h-full flex-col bg-[#0b0f14] text-slate-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif' }}>
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0f14]/95 px-5 pb-3 pt-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {sum && <div data-testid="pad-summary" className="flex flex-wrap gap-2 text-sm">{[['in room', sum.jobsInRoom, 'pad-sum-jobs'], ['waiting on parts', sum.waitingOnParts, 'pad-sum-parts'], ['awaiting approval', sum.waitingOnApproval, 'pad-sum-approval'], ['picks', sum.picksRemaining, 'pad-sum-picks']].map(([l, v, t]) => <span key={String(t)} data-testid={String(t)} className="rounded-full bg-white/5 px-3 py-1.5"><span className="font-mono text-lg font-bold text-white">{v}</span> <span className="text-slate-400">{l}</span></span>)}</div>}
        <div className="ml-auto flex items-center gap-3">{isManager && <Link to="/rw/floor" data-testid="pad-shop-floor-link" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10"><Map size={16} /> Shop Floor</Link>}<Clock /><PinSwitch big /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4"><h1 data-testid="pad-title" className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{tab === 'dashboard' ? api.ROOM_LABEL[room] : TITLE[tab]}</h1>{tab !== 'dashboard' && <span data-testid="pad-room" className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">{api.ROOM_LABEL[room]}{!isManager && ' · read-only'}</span>}{!NO_SCAN.includes(tab) && <div className="min-w-[280px] flex-1 max-w-xl"><ScanInput big testId="pad-scan" placeholder={tab === 'parts' ? 'Scan watch → job · ref · caliber' : 'Scan watch label → its card'} onScan={globalScan} /></div>}</div>
    </header>
    <main className="flex-1 overflow-y-auto px-5 pb-44 pt-4">
      {tab === 'dashboard' && <PadDashboard room={room} tick={cards.length + reqs.length} />}
      {tab === 'jobs' && binNight && <button data-testid="pad-bin-night-banner" onClick={() => setTab('bin')} className="mb-4 flex min-h-[44px] w-full items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-950/40 px-4 text-left text-sm text-amber-100"><Archive size={16} /> End of day — JV bin is still out ({bin?.inBin.length} inside). Open the Bin tab: {bin?.safeCode} then {bin?.code}, one count confirm.</button>}
      {tab === 'jobs' && <PadJobs cards={cards} hit={hit} say={say} reload={() => void load()} />}
      {tab === 'bin' && hasBin && <PadBin say={say} />}
      {tab === 'parts' && <PadParts ctx={ctx} onCtx={(c) => { setCtx(c); if (c) setAlert(api.clientRequestAlert(c.job.id)); }} say={say} requests={reqs} reload={() => void load()} isManager={!!isManager} />}
      {tab === 'review' && !isManager && <div data-testid="pad-concierge-open-question" className="mb-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><b>Open question for MH (Q91):</b> what should a Concierge card see on the Supervisor Pad — anything at all? This read-only Parts Request History is a placeholder, not a ruling.</div>}
      {tab === 'review' && <PadReview q={queue} say={say} reload={() => void load()} isManager={!!isManager} />}
      {tab === 'team' && <PadTeam room={room} onChanged={() => void load()} />}
      {tab === 'comms' && <PadComms say={say} />}
      {tab === 'audit' && <div data-testid="pad-audit"><AuditPanel big scope={room === 'band' ? 'band' : api.auditScopeFor(user)} onFinished={(s) => say(s.missing.length ? `${s.locationLabel}: ${s.missing.length} MISSING — pinned to the manager hit list` : `${s.locationLabel} audited clean`, s.missing.length ? 'err' : 'ok')} /></div>}
    </main>
    <nav data-testid="pad-tabbar" className="fixed inset-x-0 bottom-16 z-40 border-t border-white/10 bg-[#0b0f14]/95 px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-4xl gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length + (isManager ? 2 : 1)}, minmax(0, 1fr))` }}>
        {tabs.map(([k, l, Icon]) => <button key={k} data-testid={`pad-tab-${k}`} onClick={() => setTab(k)} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold ${tab === k ? 'text-accent' : 'text-slate-400'}`}><span className="relative"><Icon size={26} />{counts[k] > 0 && <span data-testid={`pad-tab-count-${k}`} className={`absolute -right-3 -top-1.5 rounded-full px-1.5 font-mono text-[10px] ${k === 'bin' && binNight ? 'bg-amber-400 text-[#161b22]' : tab === k ? 'bg-accent text-[#161b22]' : 'bg-white/15 text-slate-100'}`}>{counts[k]}</span>}</span>{l}</button>)}
        {isManager && <Link to="/rw/floor" data-testid="pad-tab-floor" className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-slate-400"><Map size={26} />Shop Floor</Link>}
        <Link to="/rw/picking" data-testid="pad-tab-picking" className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-slate-400"><span className="relative"><ClipboardList size={26} />{(sum?.picksRemaining ?? 0) > 0 && <span className="absolute -right-3 -top-1.5 rounded-full bg-white/15 px-1.5 font-mono text-[10px] text-slate-100">{sum?.picksRemaining}</span>}</span>Picking</Link>
      </div>
    </nav>
    {toast && <Toast text={toast.text} tone={toast.tone} />}
    {alert && <ClientRequestModal alert={alert} via="pad_scan" onClose={() => setAlert(null)} />}
  </div>;
}
