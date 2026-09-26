import { ClipboardCheck, ClipboardList, Package, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ClientRequestAlert, PadCard, PadPartsContext, PartsRequestWithRefs, RoomSummary } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ClientRequestModal } from '@/components/jobs/ClientRequests';
import { Toast } from '@/components/rw/pad/PadBits';
import { PadJobs } from '@/components/rw/pad/PadJobs';
import { PadParts } from '@/components/rw/pad/PadParts';
import { PadReview } from '@/components/rw/pad/PadReview';
import { Clock, PinSwitch, ScanInput } from '@/components/rw/RwBits';

type Tab = 'jobs' | 'parts' | 'review';
type Queue = Awaited<ReturnType<typeof api.getReviewQueue>>;
const TITLE: Record<Tab, string> = { jobs: 'Jobs', parts: 'Parts', review: 'Review' };

// Supervisor Pad v2 — one user (the watchmaker-room supervisor), one device (iPad). Tablet-native shell: large title, bottom tabs, sheets.
export default function RwPadPage() {
  const { user } = useAuth(); const isManager = user?.accessTier === 'manager';
  const [tab, setTab] = useState<Tab>('jobs'); const [cards, setCards] = useState<PadCard[]>([]); const [sum, setSum] = useState<RoomSummary | null>(null); const [reqs, setReqs] = useState<PartsRequestWithRefs[]>([]); const [queue, setQueue] = useState<Queue | null>(null);
  const [ctx, setCtx] = useState<PadPartsContext | null>(null); const [hit, setHit] = useState<string | null>(null); const [alert, setAlert] = useState<ClientRequestAlert | null>(null); const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'learn' | 'err' } | null>(null);
  const load = useCallback(() => Promise.all([api.getPadBoard().then(setCards), api.getRoomSummary().then(setSum), api.getPadRequests().then(setReqs), api.getReviewQueue().then(setQueue)]).then(() => undefined), []);
  useEffect(() => { void load(); }, [load]);
  const say = (text: string, tone: 'ok' | 'learn' | 'err' = 'ok') => { setToast({ text, tone }); window.setTimeout(() => setToast(null), tone === 'learn' ? 4500 : 3000); void load(); };
  const globalScan = async (code: string) => {
    const c = await api.getPadPartsContext(code); setAlert(api.clientRequestAlert(c.job.id));
    if (tab === 'parts') setCtx(c); else { setHit(c.job.id); setTab('jobs'); window.setTimeout(() => document.querySelector(`[data-testid="pad-card-${c.job.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }
  };
  const counts: Record<Tab, number> = { jobs: cards.length, parts: reqs.filter((r) => r.status === 'pending_review' || r.status === 'awaiting_client').length, review: (queue?.review.length ?? 0) + (queue?.toAllocate.length ?? 0) + (queue?.bench.filter((b) => b.status === 'pending').length ?? 0) };
  return <div data-testid="rw-pad-page" className="flex h-full flex-col bg-[#0b0f14] text-slate-100" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif' }}>
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0f14]/95 px-5 pb-3 pt-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {sum && <div data-testid="pad-summary" className="flex flex-wrap gap-2 text-sm">{[['in room', sum.jobsInRoom, 'pad-sum-jobs'], ['waiting on parts', sum.waitingOnParts, 'pad-sum-parts'], ['awaiting approval', sum.waitingOnApproval, 'pad-sum-approval'], ['picks', sum.picksRemaining, 'pad-sum-picks']].map(([l, v, t]) => <span key={String(t)} data-testid={String(t)} className="rounded-full bg-white/5 px-3 py-1.5"><span className="font-mono text-lg font-bold text-white">{v}</span> <span className="text-slate-400">{l}</span></span>)}</div>}
        <div className="ml-auto flex items-center gap-3"><Clock /><PinSwitch big /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-4"><h1 data-testid="pad-title" className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{TITLE[tab]}</h1><div className="min-w-[280px] flex-1 max-w-xl"><ScanInput big testId="pad-scan" placeholder={tab === 'parts' ? 'Scan watch → job · ref · caliber' : 'Scan watch label → its card'} onScan={globalScan} /></div></div>
    </header>
    <main className="flex-1 overflow-y-auto px-5 pb-28 pt-4">
      {tab === 'jobs' && <PadJobs cards={cards} hit={hit} say={say} reload={() => void load()} />}
      {tab === 'parts' && <PadParts ctx={ctx} onCtx={(c) => { setCtx(c); if (c) setAlert(api.clientRequestAlert(c.job.id)); }} say={say} requests={reqs} reload={() => void load()} />}
      {tab === 'review' && <PadReview q={queue} say={say} reload={() => void load()} isManager={!!isManager} />}
    </main>
    <nav data-testid="pad-tabbar" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0f14]/95 px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
        {([['jobs', 'Jobs', Wrench], ['parts', 'Parts', Package], ['review', 'Review', ClipboardCheck]] as const).map(([k, l, Icon]) => <button key={k} data-testid={`pad-tab-${k}`} onClick={() => setTab(k)} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold ${tab === k ? 'text-amber-400' : 'text-slate-400'}`}><span className="relative"><Icon size={26} />{counts[k] > 0 && <span data-testid={`pad-tab-count-${k}`} className={`absolute -right-3 -top-1.5 rounded-full px-1.5 font-mono text-[10px] ${tab === k ? 'bg-amber-400 text-[#161b22]' : 'bg-white/15 text-slate-100'}`}>{counts[k]}</span>}</span>{l}</button>)}
        <Link to="/rw/picking" data-testid="pad-tab-picking" className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold text-slate-400"><span className="relative"><ClipboardList size={26} />{(sum?.picksRemaining ?? 0) > 0 && <span className="absolute -right-3 -top-1.5 rounded-full bg-white/15 px-1.5 font-mono text-[10px] text-slate-100">{sum?.picksRemaining}</span>}</span>Picking</Link>
      </div>
    </nav>
    {toast && <Toast text={toast.text} tone={toast.tone} />}
    {alert && <ClientRequestModal alert={alert} via="pad_scan" onClose={() => setAlert(null)} />}
  </div>;
}
