import { Phone, PhoneIncoming, PhoneMissed, UserPlus, X } from 'lucide-react';
import * as api from '@/api/client';
import type { Job } from '@/api/client';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScreenPop } from '@/api/client';
import * as tel from '@/api/telephony';
import { useCompanion } from '@/components/companion/CompanionPanel';
import { fullName } from '@/lib/format';

// Dev menu: 📞 Simulate incoming call (MOCK of the Vonage VIP webhook → src/api/telephony.ts)
export const SimulateCallMenu = () => {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button data-testid="dev-simulate-call" onClick={() => setOpen((v) => !v)} title="Simulate incoming call (mock)" className="grid h-8 w-8 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><Phone size={15} /></button>
    {open && <div data-testid="dev-simulate-call-menu" className="absolute right-0 top-9 z-40 w-64 rounded-md border border-line bg-surface p-1 text-xs shadow-pop">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-400">Dev · telephony mock</div>
      <button data-testid="dev-call-known" onClick={() => { setOpen(false); void tel.simulateKnownCall(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Incoming — known client (Robert Calloway)</button>
      <button data-testid="dev-call-unknown" onClick={() => { setOpen(false); void tel.simulateUnknownCall(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Incoming — unknown number</button>
      <button data-testid="dev-call-missed" onClick={() => { setOpen(false); void tel.simulateMissedCall(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📵 Missed call — known client (→ Inbox)</button>
      <button data-testid="dev-call-missed-unknown" onClick={() => { setOpen(false); void tel.simulateMissedUnknown(); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📵 Voicemail — unknown number (→ Inbox)</button>
    </div>}
  </div>;
};

// Screen-pop toast on RS screens; click → Client 360 + Companion (Job Lookup) pre-loaded with that client
export const CallPopToast = () => {
  const [pop, setPop] = useState<ScreenPop | null>(null); const [after, setAfter] = useState<{ callId: string; clientId: string } | null>(null); const nav = useNavigate(); const { setOpen } = useCompanion();
  useEffect(() => tel.onScreenPop((p) => { setPop(p); window.setTimeout(() => setPop((cur) => (cur?.callId === p.callId ? null : cur)), 15000); }), []);
  const end = () => { if (pop?.kind === 'known') setAfter({ callId: pop.callId, clientId: pop.client.id }); setPop(null); };
  if (!pop) return after ? <CallNotePrompt callId={after.callId} clientId={after.clientId} onDone={() => setAfter(null)} /> : null;
  if (pop.kind === 'missed') return <div data-testid="call-pop" data-kind="missed" className="fixed bottom-5 right-5 z-50 flex w-[380px] items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-ink shadow-pop animate-rise"><PhoneMissed size={18} className="mt-0.5 text-rose-700" /><div className="flex-1 text-[13px]"><div className="font-semibold">Missed call — {pop.client ? fullName(pop.client) : `Unknown (${pop.number})`}</div><div className="text-[11px] text-ink-500">Filed under Inbox → Needs reply until someone clears it. <button data-testid="call-pop-inbox" onClick={() => { setPop(null); nav('/inbox'); }} className="underline">Open Inbox</button></div></div><button data-testid="call-pop-dismiss" onClick={() => setPop(null)} className="p-1 text-ink-400 hover:text-ink"><X size={14} /></button></div>;
  return <div data-testid="call-pop" data-kind={pop.kind} className="fixed bottom-5 right-5 z-50 w-[380px] rounded-md border border-line bg-ink text-white shadow-pop animate-rise">
    <div className="flex items-start gap-3 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-moss text-white"><PhoneIncoming size={16} /></span>
      {pop.kind === 'known' ? <button data-testid="call-pop-open" onClick={() => { nav(`/clients/${pop.client.id}`); setOpen(true); end(); }} className="min-w-0 flex-1 text-left">
        <div className="text-[13px] font-semibold">Incoming: {fullName(pop.client)} <span data-testid="call-pop-rating" title={pop.rating.tooltip} className="ml-1 rounded-sm bg-white/15 px-1.5 font-mono text-[11px]">{pop.rating.badge}</span></div>
        <div className="text-[11px] text-white/70">{pop.inService} in service · {pop.needsReply} needs reply · {pop.client.phone} — tap to open Job Lookup</div>
      </button> : <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Unknown caller ({pop.number})</div>
        <button data-testid="call-pop-new-client" onClick={() => { setPop(null); nav(`/clients?new=1&phone=${encodeURIComponent(pop.number)}`); }} className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-white px-2 py-1 text-[11px] font-semibold text-ink"><UserPlus size={12} /> New client / new request</button>
      </div>}
      <button data-testid="call-pop-dismiss" onClick={end} className="p-1 text-white/60 hover:text-white"><X size={14} /></button>
    </div>
  </div>;
};

// After the call: "add a note?" + one-tap "which job was this about?" chips — appended to the call record (never overwrites)
const CallNotePrompt = ({ callId, clientId, onDone }: { callId: string; clientId: string; onDone: () => void }) => {
  const [jobs, setJobs] = useState<Job[]>([]); const [note, setNote] = useState(''); const [jobId, setJobId] = useState<string | undefined>();
  useEffect(() => { void api.getJobsForClient(clientId).then((js) => setJobs(js.filter((j) => j.status !== 'closed'))); }, [clientId]);
  const save = async () => { if (jobId) await api.linkCallToJob(callId, jobId); if (note.trim()) await api.addCallNote(callId, note); onDone(); };
  return <div data-testid="call-note-prompt" className="fixed bottom-5 right-5 z-50 w-[380px] space-y-2 rounded-md border border-line bg-surface p-3 text-xs shadow-pop animate-rise">
    <div className="flex items-center justify-between"><span className="font-semibold text-ink">Call ended — add a note?</span><button data-testid="call-note-skip" onClick={onDone} className="text-ink-400 hover:text-ink">skip</button></div>
    {jobs.length > 0 && <div className="flex flex-wrap items-center gap-1"><span className="text-ink-500">Which job was this about?</span>{jobs.map((j) => <button key={j.id} data-testid={`call-note-job-${j.id}`} aria-pressed={jobId === j.id} onClick={() => setJobId(jobId === j.id ? undefined : j.id)} className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${jobId === j.id ? 'border-ink bg-ink text-white' : 'border-line hover:bg-canvas'}`}>{j.number}</button>)}</div>}
    <textarea data-testid="call-note-text" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="asked about Thursday, traveling in Nov, wants the bracelet un-polished…" className="w-full rounded-sm border border-line bg-canvas px-2 py-1.5" />
    <div className="flex justify-end"><button data-testid="call-note-save" onClick={() => void save()} className="rounded-sm bg-ink px-3 py-1 font-semibold text-white">Save note</button></div>
  </div>;
};
