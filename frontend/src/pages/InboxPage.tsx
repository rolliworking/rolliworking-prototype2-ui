import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Eye, Folder as Folder_, Lock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallEvent, ConvLane, ConvTag, ConversationWithRefs, InboxFilter, ThreadView, User } from '@/api/client';
import * as calls from '@/api/calls';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { applyScroll, captureScroll, getInboxContext, rememberInboxScroll, setInboxContext } from '@/api/inboxContext';
import { useAuth } from '@/auth/AuthContext';
import { canClientComms } from '@/config/roles';
import { CallRow } from '@/components/clients/CallLedger';
import { Provisional } from '@/components/estimates/EstimateBits';
import { InboxJobCard } from '@/components/inbox/InboxJobCard';
import { ThreadList } from '@/components/inbox/ThreadList';
import { ThreadStack, type Run } from '@/components/inbox/ThreadView';
import { ViewsSection } from '@/components/inbox/ViewsSection';
import { MissedCallsPanel } from '@/components/layout/MissedCallsPanel';
import { BUBBLE_COMPOSE_EVENT, type BubbleComposeDetail } from '@/components/layout/MessageBubble';
import { SentList, StatusChip } from '@/components/layout/MessageComposer';
import { MessageInbox } from '@/components/layout/MessageInbox';
import { MessageText } from '@/components/layout/MessageText';
import { Flash, Head } from '@/components/rs/RsBits';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

type Section = 'threads' | 'staff' | 'calls' | 'views';
const WHO: { key: InboxFilter['who'] | undefined; label: string; tag?: ConvTag }[] = [{ key: undefined, label: 'ALL' }, { key: 'mike', label: 'MIKE', tag: 'mike' }, { key: 'vienna', label: 'VIENNA', tag: 'vienna' }, { key: 'chyna', label: 'CHYNA', tag: 'chyna' }];

// ONE GENERAL INBOX (MH 2026-10-01, flat layout kept 2026-10-02): every client thread lands in All, unowned. Tags, not assignment · color = client spoke last · archive fast · pin · Quoted / Answered lanes.
// Tabs: Portal (client threads, MH · VC · CM only) · Team (staff messages, same store as the bubble) · Calls · Views (MH only — any staff member's inbox as they see it).
export default function InboxPage() {
  const { user } = useAuth(); const comms = canClientComms(user); const owner = api.isOwnerSync();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') as Section | null; const section: Section = requested === 'views' && !owner ? 'threads' : requested || (comms ? 'threads' : 'staff');
  const viewAs = section === 'views' ? params.get('as') ?? undefined : undefined; const viewUser = viewAs ? hl.userBySlug(viewAs) : undefined;
  const who = (section === 'views' ? api.tagOfUser(viewUser) : (params.get('who') as InboxFilter['who'])) || undefined; const lane = (params.get('lane') as InboxFilter['lane']) || undefined; const clientId = params.get('client') ?? undefined; const threadId = params.get('thread') ?? undefined; const grouped = params.get('group') === '1'; const panelOpen = params.get('panel') === '1'; const cardId = params.get('card') ?? undefined;
  const threadsShown = section === 'threads' || (section === 'views' && !!viewUser);
  const [rows, setRows] = useState<ConversationWithRefs[]>([]); const [counts, setCounts] = useState<Awaited<ReturnType<typeof api.getInboxThreadCounts>> | null>(null); const [thread, setThread] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const threadPane = useRef<HTMLElement>(null); const quiet = useRef(false);
  const reload = async () => { if (section === 'views' && viewUser && !who) setRows([]); else setRows(clientId ? await api.getClientFolder(clientId) : await api.getInboxThreads({ who, lane })); setCounts(await api.getInboxThreadCounts()); if (threadId) { setThread(await api.getThread(threadId)); await api.markConversationRead(threadId); } else setThread(null); };
  useEffect(() => { if (comms) reload().catch((e) => setError(e.message)); }, [who, lane, clientId, threadId, comms, section, viewAs]); // eslint-disable-line react-hooks/exhaustive-deps
  // INBOX CONTEXT: an open message is the context everything opened from it carries (client card · job card · job page …). Same message → keep its place; different message → fresh context.
  const openThreadId = thread?.conversation.id;
  useEffect(() => { if (thread) setInboxContext({ threadId: thread.conversation.id, clientName: `${thread.conversation.client.firstName} ${thread.conversation.client.lastName}`, subject: thread.conversation.subject }); }, [openThreadId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Put the remembered message back in view: retried per frame until the anchor row exists (messages / dots render async); the pane stays "quiet" (no remembering) while we move it
  const restore = () => {
    const c = getInboxContext(); const el = threadPane.current; let raf = 0; let n = 0;
    if (!thread || !el || c?.threadId !== thread.conversation.id || (!c.scrollTop && !c.anchor)) { quiet.current = false; return () => undefined; }
    quiet.current = true; const tick = () => { if (applyScroll(el, c) || n > 90) { window.setTimeout(() => { quiet.current = false; }, 60); return; } n += 1; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); quiet.current = false; };
  };
  useEffect(restore, [openThreadId]); // eslint-disable-line react-hooks/exhaustive-deps
  // The job-card panel pads the page (200 ms transition) → the pane reflows; stay quiet through it, then put the same message back where it was
  useEffect(() => { if (!thread) return; quiet.current = true; let undo = () => undefined as void; const t = window.setTimeout(() => { undo = restore(); }, 260); return () => { window.clearTimeout(t); undo(); quiet.current = false; }; }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  // a share logged from the bubble while this thread is open → re-read so the "Shared with …" line appears
  useEffect(() => { const h = () => { if (comms && threadsShown) void reload().catch(() => undefined); }; window.addEventListener(hl.INBOX_REFRESH_EVENT, h); return () => window.removeEventListener(hl.INBOX_REFRESH_EVENT, h); }); // eslint-disable-line react-hooks/exhaustive-deps
  const run: Run = async (f, ok) => { try { setError(null); await f(); await reload(); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const go = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p); };
  const actionsFor = (r: ConversationWithRefs) => ({
    tag: (t: ConvTag, on: boolean) => void run(() => api.tagConversation(r.id, t, on), `${on ? 'Tagged' : 'Untagged'} ${api.CONV_TAGS.find((x) => x.key === t)!.label}`),
    pin: (on: boolean) => void run(() => api.pinConversation(r.id, on), on ? 'Pinned to top' : 'Unpinned'),
    move: (l: ConvLane | null) => void run(() => api.moveConversation(r.id, l), l ? `Moved to ${l === 'quoted' ? 'Quoted' : 'Answered'}` : 'Back in All'),
    archive: () => void run(() => api.archiveConversation(r.id), 'Archived — left All'),
    unarchive: () => void run(() => api.unarchiveConversation(r.id), 'Back in All'),
  });
  const tabs: [Section, string][] = [['threads', 'Portal'], ['staff', 'Team'], ['calls', 'Calls'], ...(owner ? [['views', 'Views'] as [Section, string]] : [])];
  const pane = <section ref={threadPane} data-testid="thread-pane" onScroll={(e) => { if (thread && !quiet.current) rememberInboxScroll(thread.conversation.id, captureScroll(e.currentTarget)); }} className="min-h-0 overflow-y-auto">{thread ? <ThreadStack t={thread} run={run} onFolder={() => go({ client: thread.conversation.clientId, thread: thread.conversation.id })} onPick={(id) => go({ thread: id, card: undefined })} panelOpen={panelOpen} onPanel={() => go({ panel: panelOpen ? undefined : '1', card: undefined })} actionsFor={actionsFor} /> : <div data-testid="thread-empty" className="grid h-full place-items-center text-xs text-ink-400">Select a thread</div>}</section>;
  return (
    <div data-testid="inbox-page" data-section={section} data-view-as={viewUser?.shortName} data-panel={panelOpen || undefined} className="flex h-full flex-col gap-3 transition-[padding] duration-200" style={{ paddingRight: panelOpen && threadsShown ? 'max(33.333vw, 520px)' : undefined }}>
      <Head title="Inbox" sub={<>One general inbox — every client thread lands in <b>All</b>, unowned. Tag, don’t assign · colored = the client spoke last · archive in one click <Provisional note="Email/kiosk/photo inbound are mocked; tokens are matched by a simulate button" /></>} />
      <div data-testid="inbox-sections" className="flex items-center gap-1 border-b border-line text-xs">
        {tabs.map(([k, l]) => <button key={k} type="button" data-testid={`inbox-section-${k}`} aria-selected={section === k} onClick={() => go({ section: k, as: undefined, who: undefined, lane: undefined, client: undefined, thread: undefined, panel: undefined, card: undefined, msg: undefined })} className={clsx('-mb-px inline-flex items-center border-b-2 px-3 py-1.5 font-semibold', section === k ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink')}>{k === 'views' && <Eye size={11} className="mr-1" />}{l}{k === 'threads' && !comms && <Lock size={10} className="ml-1 inline" />}{k === 'threads' && comms && counts && counts.needsReply > 0 && <span data-testid="inbox-section-threads-count" className="ml-1.5 text-[10px] font-bold text-rose-700">{counts.needsReply}</span>}</button>)}
      </div>
      <Flash error={error} msg={msg} />
      {section === 'threads' && !comms && <div data-testid="inbox-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600"><Lock size={14} className="mr-1 inline" /> Portal threads are handled by the front desk (MH · VC · CM). When they need you on one, you get the client’s message quoted in <b>Team</b>.</div>}
      {section === 'threads' && comms && <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr] gap-3">
        <div className="flex min-h-0 flex-col gap-1.5">
          <div data-testid="inbox-who" className="flex items-center gap-1 rounded-md bg-canvas p-1">{WHO.map((w) => { const n = w.tag ? counts?.byTag[w.tag] : counts?.all; const on = (who ?? undefined) === w.key && !clientId; const t = w.tag ? api.CONV_TAGS.find((x) => x.key === w.tag) : undefined; return <button key={w.label} type="button" data-testid={`inbox-who-${w.label.toLowerCase()}`} aria-pressed={on} title={t ? `${t.label}’s action items — tagged, still in All` : 'Every client thread'} onClick={() => go({ who: w.key, client: undefined, thread: undefined })} className={clsx('flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] font-bold tracking-wide', on ? 'bg-ink text-white' : 'text-ink-600 hover:bg-surface')}>{t && <span className={clsx('inline-block h-1.5 w-1.5 rounded-full', t.dot)} />}{w.label}{n !== undefined && <span className={clsx('font-mono text-[10px] font-semibold tabular-nums', on ? 'text-white/70' : 'text-ink-400')}>{n}</span>}</button>; })}</div>
          <div data-testid="inbox-lanes" className="flex flex-wrap items-center gap-1 px-0.5 text-[11px]">
            {([[undefined, 'All'], ['quoted', 'Quoted'], ['answered', 'Answered'], ['snoozed', 'Snoozed']] as [InboxFilter['lane'], string][]).map(([k, l]) => <button key={l} type="button" data-testid={`inbox-lane-${l.toLowerCase()}`} aria-pressed={(lane ?? undefined) === k} onClick={() => go({ lane: k, client: undefined, thread: undefined })} className={clsx('rounded-full border px-2 py-0.5 font-medium', (lane ?? undefined) === k ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas')}>{l}{counts && k && <span className="ml-1 opacity-70">{k === 'quoted' ? counts.quoted : k === 'answered' ? counts.answered : counts.snoozed}</span>}</button>)}
            <button type="button" data-testid="inbox-group-toggle" aria-pressed={grouped} onClick={() => go({ group: grouped ? undefined : '1' })} className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', grouped ? 'bg-ink text-white' : 'text-ink-400 hover:bg-canvas')}>{grouped ? 'Grouped by request / job' : 'Group by request / job'}</button>
            <button type="button" data-testid="inbox-lane-archived" aria-pressed={lane === 'archived'} onClick={() => go({ lane: lane === 'archived' ? undefined : 'archived', client: undefined, thread: undefined })} className={clsx('ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]', lane === 'archived' ? 'bg-ink text-white' : 'text-ink-400 hover:text-ink')}><Archive size={10} /> Archived{counts ? ` · ${counts.archived}` : ''}</button>
          </div>
          {clientId && <div data-testid="inbox-folder-chip" className="rounded-md border border-line px-2 py-1.5 text-[11px] text-ink-600">Folder: <b>{rows[0]?.client ? `${rows[0].client.firstName} ${rows[0].client.lastName}` : clientId}</b><button data-testid="inbox-folder-exit" onClick={() => go({ client: undefined, thread: undefined })} className="ml-1 text-brand hover:underline">× all</button></div>}
          <Legend rows={rows} who={who} lane={lane} />
          <ThreadList rows={rows} grouped={grouped && !lane && !who} lane={lane} threadId={threadId} onOpen={(id) => go({ thread: id, card: undefined })} actionsFor={actionsFor} />
        </div>
        {pane}
      </div>}
      {section === 'staff' && user && <StaffMessagesSection me={user} focusId={params.get('msg') ?? undefined} folder={params.get('staff') ?? 'me'} onFolder={(f) => go({ staff: f === 'me' ? undefined : f, msg: undefined })} />}
      {section === 'calls' && <CallsSectionInline />}
      {section === 'views' && owner && <ViewsSection viewUser={viewUser} rows={rows} threadId={threadId} onPick={(short) => go({ as: short, thread: undefined, panel: undefined, card: undefined })} onBack={() => go({ as: undefined, thread: undefined, panel: undefined, card: undefined })} onOpen={(id) => go({ thread: id, card: undefined })} actionsFor={actionsFor} pane={pane} />}
      {thread && panelOpen && threadsShown && <InboxJobCard thread={thread} onClose={() => go({ panel: undefined, card: undefined })} expandedId={cardId} onExpanded={(id) => go({ card: id })} />}
    </div>
  );
}

const Legend = ({ rows, who, lane }: { rows: ConversationWithRefs[]; who?: InboxFilter['who']; lane?: InboxFilter['lane'] }) => <div className="flex items-center justify-between px-1 text-[10px] text-ink-400"><span data-testid="inbox-list-count">{rows.length} thread{rows.length === 1 ? '' : 's'}{who ? ` · ${api.CONV_TAGS.find((t) => t.key === who)?.label}’s action items` : lane === 'archived' ? ' · archived' : ''}</span><span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-200 ring-1 ring-rose-300" /> client spoke last</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-surface ring-1 ring-line" /> we did</span></span></div>;

// TEAM section — the same store as the bubble (one-shot messages), laid out as one tree: To me · Sent by me · (MH only) a folder per staff name = everything they sent / received / claimed / completed.
// ?staff=<me|sent|all|Short> picks the folder (also reachable as /messages/all?staff=…). ?msg=<id> scrolls to and highlights a row.
const StaffMessagesSection = ({ me, focusId, folder, onFolder }: { me: User; focusId?: string; folder: string; onFolder: (f: string) => void }) => {
  const [tick, setTick] = useState(0); const bump = () => setTick((n) => n + 1); const done = useRef(false);
  const owner = api.isOwnerSync(); const f = !owner && folder !== 'me' && folder !== 'sent' ? 'me' : folder;
  useEffect(() => { const h = () => bump(); window.addEventListener(hl.MESSAGE_EVENT, h); return () => window.removeEventListener(hl.MESSAGE_EVENT, h); }, []);
  useEffect(() => { done.current = false; }, [focusId]);
  useEffect(() => { if (!focusId || done.current) return; const t = window.setTimeout(() => { const el = document.querySelector(`[data-testid='msg-inbox-${focusId}'], [data-testid='msg-sent-${focusId}'], [data-testid='internal-msg-${focusId}']`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ring-2', 'ring-accent'); done.current = true; } }, 400); return () => window.clearTimeout(t); }, [focusId, tick, f]);
  const reply = (r: InboxRow) => window.dispatchEvent(new CustomEvent<BubbleComposeDetail>(BUBBLE_COMPOSE_EVENT, { detail: { replyTo: r } }));
  const folders = owner ? hl.staffFolders() : [];
  const Folder = ({ k, label, count, tone }: { k: string; label: string; count?: number; tone?: 'unread' }) => <button type="button" data-testid={`internal-folder-${k}`} aria-selected={f === k} onClick={() => onFolder(k)} className={clsx('flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs', f === k ? 'bg-ink font-semibold text-white' : 'text-ink-700 hover:bg-canvas')}><Folder_ size={12} className={f === k ? 'text-white/70' : 'text-ink-400'} /><span className="truncate">{label}</span>{count !== undefined && count > 0 && <span className={clsx('ml-auto font-mono text-[10px] tabular-nums', tone === 'unread' ? 'font-bold text-rose-700' : f === k ? 'text-white/70' : 'text-ink-400')}>{count}</span>}</button>;
  const title = f === 'me' ? `To me · ${hl.unreadCount(me.id)} unread` : f === 'sent' ? 'Sent by me' : f === 'all' ? 'Everyone · every staff message' : `${f} · sent, received, claimed or completed`;
  return <div data-testid="inbox-staff-section" data-folder={f} className="grid min-h-0 flex-1 grid-cols-[220px_1fr] gap-3">
    <nav data-testid="internal-tree" className="min-h-0 space-y-0.5 overflow-y-auto rounded-md border border-line bg-surface p-2">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Team</div>
      <Folder k="me" label="To me" count={hl.unreadCount(me.id)} tone="unread" /><Folder k="sent" label="Sent by me" />
      {owner && <><div className="mt-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">All staff · MH only</div><Folder k="all" label="Everyone" count={hl.allMessagesSync().length} />{folders.map((x) => <Folder key={x.name} k={x.name} label={x.name} count={x.count} />)}</>}
    </nav>
    <section className="min-h-0 overflow-y-auto rounded-md border border-line bg-surface p-3">
      <div data-testid="internal-folder-title" className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</div>
      {f === 'me' && <MessageInbox me={me} pad={false} tick={tick} onChange={bump} onReply={reply} jobBase="/jobs" />}
      {f === 'sent' && <SentList tick={tick} testId="msg-sent" />}
      {f !== 'me' && f !== 'sent' && <AllMessagesList staff={f === 'all' ? undefined : f} tick={tick} />}
    </section>
  </div>;
};

// Super-admin list (MH): read-only rows — from → to · status · when · station · job · text · photo
export const AllMessagesList = ({ staff, tick, rows: given }: { staff?: string; tick: number; rows?: hl.AllMessageRow[] }) => {
  const rows = useMemo(() => given ?? hl.allMessagesSync(staff), [staff, tick, given]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ul data-testid="internal-all-list" data-count={rows.length} className="divide-y divide-line/70">
    {rows.map((r) => <li key={r.id} data-testid={`internal-msg-${r.id}`} data-status={r.status} className={clsx('flex gap-2 py-2 text-xs', r.status === 'done' && 'opacity-60')}>
      {r.photo && <img src={r.photo.dataUrl} alt="" className="h-12 w-16 shrink-0 rounded-sm object-cover ring-1 ring-line" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-400"><OwnerChip owner={r.from} /><span>→</span><b className="text-ink-700">{r.toLabel}</b><span>· {fmtDate(r.createdAt)} {fmtTime(r.createdAt)} · {r.station}</span>{r.replyToId && <span className="text-moss-700">reply</span>}{r.doneBy && <span>· done by {r.doneBy}</span>}</div>
        <div className="mt-0.5 text-[13px] leading-snug text-ink-800">{r.text ? <MessageText text={r.text} /> : 'Photo'}</div>
        <div className="mt-1 flex items-center gap-1.5">{r.jobId && <Link to={`/jobs/${r.jobId}`} data-testid={`internal-msg-job-${r.id}`} className="font-mono text-[11px] font-semibold text-brand hover:underline">{r.jobNumber}</Link>}{r.jobLabel && <span className="text-[10px] text-ink-400">{r.jobLabel}</span>}<StatusChip status={r.status} /></div>
      </div>
    </li>)}
    {!rows.length && <li className="py-6 text-center text-xs text-ink-400">No messages in this folder</li>}
  </ul>;
};

// CALLS section — missed queue + the latest calls (same ledger as /calls and the client record)
const CallsSectionInline = () => {
  const [rows, setRows] = useState<CallEvent[]>([]); const load = () => calls.getCallEvents({}).then((r) => setRows(r.slice(0, 25)));
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, []);
  return <div data-testid="inbox-calls-section" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
    <MissedCallsPanel />
    <section className="rounded-md border border-line bg-surface px-3"><div className="flex items-center justify-between py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span>Latest calls</span><Link to="/calls" data-testid="inbox-calls-all" className="text-brand hover:underline normal-case">Full call log →</Link></div><ul className="divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} showClient testId={`inbox-call-${c.id}`} />)}</ul></section>
  </div>;
};
