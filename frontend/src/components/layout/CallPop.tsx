import clsx from 'clsx';
import { ChevronDown, Megaphone, Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, StickyNote, UserPlus, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallDisposition, Client, Job, WbpLeg } from '@/api/client';
import * as calls from '@/api/calls';
import type { LiveCall, PopView } from '@/api/calls';
import { pageAll } from '@/api/intercom';
import * as tel from '@/api/telephony';
import { useAuth } from '@/auth/AuthContext';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { WbpDots } from '@/components/shared/WbpDots';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { estDigits, fullName } from '@/lib/format';

const LEG_KEY: Record<WbpLeg, string> = { W: 'head', B: 'band', P: 'case' };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const elapsed = (c: LiveCall) => Math.max(0, Math.round((Date.now() - new Date(c.answeredAt ?? c.startedAt).getTime()) / 1000));

// Dev menu: 📞 Simulate incoming call (MOCK of the Vonage webhook → src/api/telephony.ts)
export const SimulateCallMenu = () => {
  const [open, setOpen] = useState(false);
  const fire = (fn: () => void) => { setOpen(false); try { fn(); } catch (e) { window.alert(e instanceof Error ? e.message : 'Failed'); } };
  return <div className="relative">
    <button data-testid="dev-simulate-call" onClick={() => setOpen((v) => !v)} title="Simulate incoming call (Vonage mock)" className="grid h-8 w-8 place-items-center rounded-sm text-ink-500 hover:bg-canvas hover:text-ink"><Phone size={15} /></button>
    {open && <div data-testid="dev-simulate-call-menu" className="absolute right-0 top-9 z-40 w-80 rounded-md border border-line bg-surface p-1 text-xs shadow-pop">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-ink-400">Dev · Vonage mock · rings, then the handset is picked up here after 3 s</div>
      <button data-testid="dev-call-two-jobs" onClick={() => fire(() => tel.simulateIncoming('two_active_band_blocked'))} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Matched — two active jobs, one band blocked</button>
      <button data-testid="dev-call-known" onClick={() => fire(() => tel.simulateIncoming('one_active_green'))} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Matched — one active, all green</button>
      <button data-testid="dev-call-unknown" onClick={() => fire(() => tel.simulateIncoming('unknown'))} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Unmatched number</button>
      <button data-testid="dev-call-missed" onClick={() => fire(() => tel.simulateIncoming('missed'))} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📵 Missed — known client, nobody picks up (→ front-desk queue)</button>
      <button data-testid="dev-call-missed-unknown" onClick={() => fire(() => tel.simulateVoicemailUnknown())} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📵 Voicemail — unknown number (→ front-desk queue)</button>
      <button data-testid="dev-call-elsewhere" onClick={() => fire(() => tel.simulateIncoming('answered_elsewhere'))} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas">📞 Answered at another station (Vienna · Front Desk 2)</button>
    </div>}
  </div>;
};

// Screen-pop host: one card (or chip) per live session, newest on top. Mounted on desktop RS stations in front-desk / sales / manager tiers only.
export const CallPopHost = () => {
  const [sessions, setSessions] = useState<LiveCall[]>(() => calls.liveCallsSync()); const [, setTick] = useState(0);
  useEffect(() => { calls.seedCalls(); return calls.subscribeCalls(() => setSessions(calls.liveCallsSync())); }, []);
  useEffect(() => { if (!sessions.some((s) => s.phase === 'live' || s.phase === 'ringing')) return; const t = window.setInterval(() => setTick((n) => n + 1), 1000); return () => window.clearInterval(t); }, [sessions]);
  if (!sessions.length) return null;
  return <div data-testid="call-pop-host" className="pointer-events-none fixed right-4 top-20 z-50 flex w-[460px] flex-col items-end gap-2">{sessions.map((s) => <CallSession key={s.callId} call={s} />)}</div>;
};

const CallSession = ({ call }: { call: LiveCall }) => {
  const [collapsed, setCollapsed] = useState(false); const [disposed, setDisposed] = useState(false);
  const fade = (ms: number) => { const t = window.setTimeout(() => calls.clearLive(call.callId), ms); return () => window.clearTimeout(t); };
  // chips fade after 10 s (answered elsewhere / missed); X kills them now
  useEffect(() => { if (call.phase === 'answered_elsewhere' || call.phase === 'missed') return fade(10_000); return undefined; }, [call.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (call.phase === 'ended' && (disposed || call.dismissed || !call.here)) return fade(10_000); return undefined; }, [call.phase, disposed, call.dismissed, call.here]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (call.dismissed || collapsed) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (call.phase === 'ringing' || call.phase === 'live')) calls.dismissLive(call.callId); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [call.callId, call.phase, call.dismissed, collapsed]);
  const view = calls.popViewSync(call);
  if (call.phase === 'answered_elsewhere') return <Chip testId="call-pop-chip" kind="elsewhere" text={`Answered by ${initials(call.answeredBy)} · ${view.client ? fullName(view.client) : call.number}`} onClose={() => calls.clearLive(call.callId)} />;
  if (call.phase === 'missed') return <Chip testId="call-pop-chip" kind="missed" text={`${call.voicemail ? 'Voicemail' : 'Missed'} · ${view.client ? fullName(view.client) : `Unknown ${call.number}`} · filed to the front-desk queue`} onClose={() => calls.clearLive(call.callId)} />;
  if (call.phase === 'ended') return <>
    <Chip testId="call-pop-chip" kind="ended" text={`Call ended · ${mmss(call.durationSec ?? 0)} · ${view.client ? fullName(view.client) : call.number}`} onClose={() => calls.clearLive(call.callId)} />
    {!disposed && !call.dismissed && call.here && createPortal(<DispositionDialog call={call} view={view} onDone={() => { setDisposed(true); calls.clearLive(call.callId); }} />, document.body)}
  </>;
  if (call.dismissed) return call.phase === 'live' ? <Chip testId="call-pop-chip" kind="live" text={`● ${view.client ? fullName(view.client) : call.number} · ${mmss(elapsed(call))}`} onExpand={() => { setCollapsed(false); calls.undismissLive(call.callId); }} onClose={() => { /* dismissed stays dismissed; hang-up still files the call */ }} /> : null;
  if (collapsed) return <Chip testId="call-pop-chip" kind="live" text={`${call.phase === 'ringing' ? '◌ ringing' : '●'} ${view.client ? fullName(view.client) : call.number}${call.phase === 'live' ? ` · ${mmss(elapsed(call))}` : ''}`} onExpand={() => setCollapsed(false)} onClose={() => calls.dismissLive(call.callId)} />;
  return <PopCard call={call} view={view} onCollapse={() => setCollapsed(true)} />;
};

const initials = (s?: string) => (s === 'Vienna' ? 'VC' : s === 'Chyna' ? 'CM' : s ?? '—');
const Chip = ({ text, kind, onClose, onExpand, testId }: { text: string; kind: 'live' | 'ended' | 'missed' | 'elsewhere'; onClose: () => void; onExpand?: () => void; testId: string }) => (
  <div data-testid={testId} data-kind={kind} className={clsx('pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-pop animate-rise', kind === 'live' ? 'border-ink bg-ink text-white' : kind === 'ended' ? 'border-line bg-surface text-ink' : kind === 'missed' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-line bg-canvas text-ink-700')}>
    {kind === 'missed' ? <PhoneMissed size={13} /> : kind === 'live' ? <PhoneCall size={13} /> : <Phone size={13} />}<span className="max-w-[300px] truncate">{text}</span>
    {onExpand && <button data-testid={`${testId}-expand`} onClick={onExpand} title="Expand" className="rounded-full p-0.5 hover:bg-white/15"><ChevronDown size={13} /></button>}
    <button data-testid={`${testId}-close`} onClick={onClose} title="Close" className="rounded-full p-0.5 hover:bg-white/15"><X size={13} /></button>
  </div>
);

// THE CARD — a link first, a dashboard second. Click anywhere → client record; the call stays live and the card collapses to a chip.
const PopCard = ({ call, view, onCollapse }: { call: LiveCall; view: PopView; onCollapse: () => void }) => {
  const nav = useNavigate(); const { user } = useAuth(); const [menu, setMenu] = useState<'job' | 'page' | 'note' | 'attach' | null>(null); const [note, setNote] = useState(call.note ?? ''); const [q, setQ] = useState(''); const [hits, setHits] = useState<Client[]>([]); const [paged, setPaged] = useState<string | null>(null);
  const ringing = call.phase === 'ringing'; const matched = !!view.client;
  const go = (path: string) => { nav(path); onCollapse(); };
  const staff = user ? api.getDivisionStaff(user.division === 'both' ? 'rolliworks' : user.division).filter((u) => u.id !== user.id) : [];
  useEffect(() => { if (menu !== 'attach' || q.trim().length < 2) { setHits([]); return; } void api.searchClients(q).then((r) => setHits(r.slice(0, 6))); }, [q, menu]);
  const openLeg = (leg: WbpLeg, row: { jobId: string; legs: Record<WbpLeg, { state: string }> }) => go(row.legs[leg].state === 'none' ? `/jobs/${row.jobId}` : `/jobs/${row.jobId}?leg=${LEG_KEY[leg]}`);
  return (
    <div data-testid="call-pop" data-phase={call.phase} data-kind={matched ? 'known' : 'unknown'} data-direction={call.direction} role="link" tabIndex={0} onClick={() => (matched ? go(`/clients/${view.client!.id}`) : undefined)} onKeyDown={(e) => { if (e.key === 'Enter' && matched) go(`/clients/${view.client!.id}`); }}
      className={clsx('pointer-events-auto w-full rounded-lg border bg-ink text-white shadow-pop animate-rise', matched ? 'cursor-pointer border-white/15 hover:border-accent/70' : 'border-white/15', ringing && 'ring-2 ring-accent/60')}>
      <div className="flex items-center gap-2 px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {call.direction === 'out' ? <PhoneOutgoing size={13} className="text-accent" /> : ringing ? <PhoneIncoming size={13} className="animate-pulse text-accent" /> : <PhoneCall size={13} className="text-emerald-400" />}
        <span data-testid="call-pop-phase">{call.direction === 'out' ? `Outbound · ${mmss(elapsed(call))}` : ringing ? 'Incoming call' : `Live · ${mmss(elapsed(call))} · answered by ${initials(call.answeredBy)}`}</span>
        <button data-testid="call-pop-dismiss" onClick={(e) => { e.stopPropagation(); calls.dismissLive(call.callId); }} title="Dismiss (Esc) — the call keeps going" className="ml-auto rounded-sm p-1 text-white/50 hover:bg-white/10 hover:text-white"><X size={15} /></button>
      </div>
      <div className="px-4 pb-1 pt-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span data-testid="call-pop-name" className="text-[22px] font-bold uppercase leading-none tracking-tight">{matched ? view.name : 'Unknown'}</span>
          <span className="text-white/40">·</span><span data-testid="call-pop-number" className="font-mono text-[16px] leading-none text-white/85">{call.number}</span>
          <span className="text-white/40">·</span>{matched ? <span data-testid="call-pop-rating" title={view.rating?.tooltip} className={clsx('rounded-sm px-2 py-0.5 font-mono text-[16px] font-bold leading-none', view.rating?.badge === 'New' ? 'bg-white/15 text-white' : 'bg-white text-ink')}>{view.rating?.badge}</span> : <span data-testid="call-pop-rating" className="rounded-sm bg-white/15 px-2 py-0.5 font-mono text-[16px] font-bold leading-none">New</span>}
        </div>
        {matched && <div data-testid="call-pop-wbp" data-count={view.rows.length} className="mt-3 space-y-1.5">
          {view.rows.length === 0 && <div className="text-xs text-white/50">No active jobs — {view.rating?.items ?? 0} in history</div>}
          {view.rows.slice(0, 4).map((r) => <div key={r.jobId} className="flex items-center gap-3"><WbpDots row={r} dark number size="xl" testId={`call-pop-wbp-${r.jobId}`} onLeg={(leg, row) => openLeg(leg, row)} /><span className="truncate text-xs text-white/55">{r.watchLabel}</span></div>)}
          {view.rows.length > 4 && <div className="text-[11px] text-white/50">+{view.rows.length - 4} more active</div>}
        </div>}
        {matched && <div data-testid="call-pop-last-contact" className="mt-2.5 truncate text-[12px] text-white/60">{view.lastContact ? `last contact · ${view.lastContact}` : 'no contact on record yet'}</div>}
        {!matched && <div className="mt-2 text-xs text-white/60">Not in the client list — create a record or attach this call to an existing client.</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        {matched ? <>
          <Act testId="call-pop-open" onClick={() => go(`/clients/${view.client!.id}`)}>Open client</Act>
          <div className="relative"><Act testId="call-pop-job-menu" onClick={() => setMenu(menu === 'job' ? null : 'job')} disabled={!view.jobs.length}>Open job <ChevronDown size={12} /></Act>
            {menu === 'job' && <ul data-testid="call-pop-job-list" className="absolute left-0 top-8 z-10 w-64 rounded-md border border-line bg-surface p-1 text-xs text-ink shadow-pop">{view.jobs.map((j: Job) => <li key={j.id}><button data-testid={`call-pop-job-${j.id}`} onClick={() => go(`/jobs/${j.id}`)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-canvas"><span className="font-mono font-semibold">{estDigits(j.number)}</span><span className="truncate text-ink-500">{api.wbpForJobSync(j.id)?.watchLabel}</span><span className="ml-auto text-[10px] text-ink-400">{j.status.replace(/_/g, ' ')}</span></button></li>)}</ul>}
          </div>
          <Act testId="call-pop-note" onClick={() => setMenu(menu === 'note' ? null : 'note')} active={menu === 'note' || !!note.trim()}><StickyNote size={12} /> Note{note.trim() ? ' ·' : ''}</Act>
          <div className="relative"><Act testId="call-pop-page" onClick={() => setMenu(menu === 'page' ? null : 'page')}><Megaphone size={12} /> Page</Act>
            {menu === 'page' && <ul data-testid="call-pop-page-list" className="absolute left-0 top-8 z-10 w-60 rounded-md border border-line bg-surface p-1 text-xs text-ink shadow-pop">{staff.map((u) => <li key={u.id}><button data-testid={`call-pop-page-${u.shortName}`} onClick={() => { pageAll(user?.shortName ?? 'Front desk', `${u.shortName}, ${view.name} on line 1`, 'all'); setPaged(u.shortName); setMenu(null); window.setTimeout(() => setPaged(null), 4000); }} className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-canvas"><span className="font-semibold">{u.shortName}</span> <span className="text-ink-500">· {u.dutyLabel}</span></button></li>)}</ul>}
          </div>
          {paged && <span data-testid="call-pop-paged" className="text-[11px] text-emerald-300">Paged “{paged}, {view.name} on line 1”</span>}
        </> : <>
          <Act testId="call-pop-new-client" onClick={() => go(`/clients?new=1&phone=${encodeURIComponent(call.number)}&call=${call.callId}`)}><UserPlus size={12} /> Create client</Act>
          <Act testId="call-pop-attach" onClick={() => setMenu(menu === 'attach' ? null : 'attach')} active={menu === 'attach'}>Attach to client…</Act>
        </>}
        <span className="ml-auto" />
        {ringing && <button data-testid="call-pop-answer" onClick={() => tel.answerHere(call.callId)} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-emerald-500 px-3 text-[13px] font-semibold text-white hover:bg-emerald-400"><PhoneCall size={13} /> Answer</button>}
        {call.phase === 'live' && <button data-testid="call-pop-hangup" onClick={() => tel.hangUp(call.callId)} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-rose-600 px-3 text-[13px] font-semibold text-white hover:bg-rose-500"><PhoneOff size={13} /> Hang up</button>}
      </div>
      {menu === 'note' && <div className="border-t border-white/10 px-3 py-2" onClick={(e) => e.stopPropagation()}><textarea data-testid="call-pop-note-text" autoFocus rows={2} value={note} onChange={(e) => { setNote(e.target.value); calls.setLiveNote(call.callId, e.target.value); }} placeholder="Saved to the call log on hang-up…" className="w-full rounded-sm border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/40" /></div>}
      {menu === 'attach' && <div className="border-t border-white/10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input data-testid="call-pop-attach-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name or email…" className="w-full rounded-sm border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/40" />
        {hits.length > 0 && <ul data-testid="call-pop-attach-hits" className="mt-1 divide-y divide-white/10 rounded-sm bg-white/5 text-xs">{hits.map((c) => <li key={c.id}><button data-testid={`call-pop-attach-${c.id}`} onClick={() => { calls.attachCallToClient(call.callId, c.id); setMenu(null); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/10"><span className="font-semibold">{fullName(c)}</span><span className="text-white/50">{c.phone}</span><span className="ml-auto"><RatingBadge clientId={c.id} /></span></button></li>)}</ul>}
      </div>}
    </div>
  );
};
const Act = ({ children, onClick, testId, active, disabled }: { children: ReactNode; onClick: () => void; testId: string; active?: boolean; disabled?: boolean }) => (
  <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className={clsx('inline-flex h-8 items-center gap-1 rounded-sm border px-2.5 text-[12px] font-semibold disabled:opacity-40', active ? 'border-accent bg-accent/15 text-white' : 'border-white/15 text-white/85 hover:bg-white/10')}>{children}</button>
);

// One-tap disposition after hang-up. "Approval given" needs what + amount → PENDING add-on (channel phone) until the client confirms by portal / email.
const DispositionDialog = ({ call, view, onDone }: { call: LiveCall; view: PopView; onDone: () => void }) => {
  const [d, setD] = useState<CallDisposition | null>(null); const [jobId, setJobId] = useState(call.jobId ?? view.jobs[0]?.id ?? ''); const [what, setWhat] = useState(''); const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null); const saving = useRef(false);
  const save = async () => { if (!d || saving.current) return; saving.current = true; try { await calls.setDisposition(call.callId, d, { jobId: jobId || undefined, note, approval: d === 'approval_given' ? { description: what, amount: Number(amount || 0) } : undefined }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); saving.current = false; } };
  return <Modal onClose={onDone} testId="call-disposition" width="w-[520px]">
    <div className="space-y-3 p-5">
      <div><div className="text-[14px] font-semibold text-ink">Call ended — what was it about?</div><div className="text-xs text-ink-500">{view.client ? fullName(view.client) : call.number} · {mmss(call.durationSec ?? 0)} · one tap, saved to the call log{view.client ? ' and the client record' : ''}</div></div>
      <div data-testid="call-disposition-options" className="grid grid-cols-2 gap-1.5">{calls.DISPOSITIONS.filter((x) => x.key !== 'missed' && x.key !== 'voicemail').map((x) => <button key={x.key} data-testid={`call-disposition-${x.key}`} aria-pressed={d === x.key} onClick={() => setD(x.key)} className={clsx('h-10 rounded-sm border text-[13px] font-semibold', d === x.key ? 'border-ink bg-ink text-white' : 'border-line hover:bg-canvas')}>{x.label}</button>)}</div>
      {view.jobs.length > 0 && <label className="block text-xs text-ink-600">Job{d === 'approval_given' ? ' (required)' : ''}<select data-testid="call-disposition-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1 h-8 w-full rounded-sm border border-line bg-canvas px-2"><option value="">— none —</option>{view.jobs.map((j) => <option key={j.id} value={j.id}>{j.number} · {api.wbpForJobSync(j.id)?.watchLabel}</option>)}</select></label>}
      {d === 'approval_given' && <div data-testid="call-approval-fields" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
        <div className="font-semibold text-amber-900">Approval by phone — stays <span className="uppercase">pending</span> until the client confirms by portal / email (confirmation request goes out now)</div>
        <input data-testid="call-approval-what" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What was approved — e.g. crown + tube replacement" className="h-8 w-full rounded-sm border border-line bg-surface px-2" />
        <input data-testid="call-approval-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount $" className="h-8 w-40 rounded-sm border border-line bg-surface px-2" />
      </div>}
      <textarea data-testid="call-disposition-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — appended to the call, stamped with your name" className="w-full rounded-sm border border-line bg-canvas px-2 py-1.5 text-xs" />
      {err && <div data-testid="call-disposition-error" className="text-xs text-rose-700">{err}</div>}
      <div className="flex items-center justify-end gap-2"><button data-testid="call-disposition-skip" onClick={onDone} className="text-xs text-ink-500 hover:text-ink">Skip</button><Button data-testid="call-disposition-save" variant="primary" disabled={!d} onClick={() => void save()}>Save</Button></div>
    </div>
  </Modal>;
};
