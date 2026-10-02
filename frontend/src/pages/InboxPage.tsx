import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Lock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallEvent, ConvLane, ConvTag, ConversationWithRefs, InboxSentRow, ThreadView } from '@/api/client';
import * as calls from '@/api/calls';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { clearInboxContext, getInboxContext, rememberInboxScroll, setInboxContext } from '@/api/inboxContext';
import { useAuth } from '@/auth/AuthContext';
import { canClientComms } from '@/config/roles';
import { CallRow } from '@/components/clients/CallLedger';
import { Provisional } from '@/components/estimates/EstimateBits';
import { InboxJobCard } from '@/components/inbox/InboxJobCard';
import { InboxTree } from '@/components/inbox/InboxTree';
import { filterForFolder, folderLabel, isInternal, resolveFolder, sectionOf, staffOfFolder, type FolderKey } from '@/components/inbox/inboxFolders';
import { SentThreadList, ThreadList } from '@/components/inbox/ThreadList';
import { ThreadStack, type Run } from '@/components/inbox/ThreadView';
import { MissedCallsPanel } from '@/components/layout/MissedCallsPanel';
import { BUBBLE_COMPOSE_EVENT, type BubbleComposeDetail } from '@/components/layout/MessageBubble';
import { SentList, StatusChip } from '@/components/layout/MessageComposer';
import { MessageInbox } from '@/components/layout/MessageInbox';
import { MessageText } from '@/components/layout/MessageText';
import { Flash, Head } from '@/components/rs/RsBits';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

// OUTLOOK-STYLE INBOX (MH 2026-10-02): folder tree on the left (PORTAL · INTERNAL), list in the middle, the open message on the right.
// Rules kept: every client thread lands in All, unowned · tag, don't assign (tag folders are views) · archive in one click · pin to top · share-with-staff via the bubble. Requests never live here.
export default function InboxPage() {
  const { user } = useAuth(); const comms = canClientComms(user);
  const [params, setParams] = useSearchParams();
  const folder = resolveFolder(params, comms); const section = sectionOf(folder);
  const clientId = params.get('client') ?? undefined; const threadId = params.get('thread') ?? undefined; const grouped = params.get('group') === '1'; const panelOpen = params.get('panel') === '1'; const cardId = params.get('card') ?? undefined;
  const [rows, setRows] = useState<ConversationWithRefs[]>([]); const [sent, setSent] = useState<InboxSentRow[]>([]); const [counts, setCounts] = useState<Awaited<ReturnType<typeof api.getInboxThreadCounts>> | null>(null); const [thread, setThread] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const threadPane = useRef<HTMLElement>(null); const restoring = useRef<number | null>(null);
  const filter = filterForFolder(folder); const lane = filter.lane;
  const reload = async () => {
    if (comms) { const list = clientId ? await api.getClientFolder(clientId) : await api.getInboxThreads(filter); setRows(folder === 'pinned' ? list.filter((r) => r.pinned) : list); setCounts(await api.getInboxThreadCounts()); if (folder === 'sent') setSent(await api.getInboxSent()); }
    if (threadId && comms) { setThread(await api.getThread(threadId)); await api.markConversationRead(threadId); } else setThread(null);
  };
  useEffect(() => { reload().catch((e) => setError(e.message)); }, [folder, clientId, threadId, comms]); // eslint-disable-line react-hooks/exhaustive-deps
  // INBOX CONTEXT: an open message is the context everything opened from it carries (client card · job card · job page …). Same message → keep its scroll; different message → fresh context.
  const openThreadId = thread?.conversation.id;
  useEffect(() => { if (thread) setInboxContext({ threadId: thread.conversation.id, clientName: `${thread.conversation.client.firstName} ${thread.conversation.client.lastName}`, subject: thread.conversation.subject }); }, [openThreadId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Scroll restore waits until the pane is tall enough for the remembered offset (messages / dots render async) — a clamped early restore must never overwrite the remembered value
  useEffect(() => {
    const c = getInboxContext(); const el = threadPane.current; if (!thread || !el || c?.threadId !== thread.conversation.id || !c.scrollTop) return;
    const target = c.scrollTop; restoring.current = target; let n = 0; let raf = 0;
    const tick = () => { const max = el.scrollHeight - el.clientHeight; if (max >= target || n > 90) { el.scrollTop = Math.min(target, Math.max(0, max)); restoring.current = null; return; } n += 1; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => { cancelAnimationFrame(raf); restoring.current = null; };
  }, [openThreadId]); // eslint-disable-line react-hooks/exhaustive-deps
  // a share logged from the bubble while this thread is open → re-read so the "Shared with …" line appears
  useEffect(() => { const h = () => { if (comms && section === 'threads') void reload().catch(() => undefined); }; window.addEventListener(hl.INBOX_REFRESH_EVENT, h); return () => window.removeEventListener(hl.INBOX_REFRESH_EVENT, h); }); // eslint-disable-line react-hooks/exhaustive-deps
  const run: Run = async (f, ok) => { try { setError(null); await f(); await reload(); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const go = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(params); ['section', 'staff', 'who', 'lane', 'view'].forEach((k) => p.delete(k)); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p); };
  // Switching folders keeps the open message only when it still belongs to the new folder's section; the job-card panel follows the message; dropping the message ends its context (deliberate navigation, like the sidebar)
  const selectFolder = (k: FolderKey) => { const keep = sectionOf(k) === 'threads' && !isInternal(k); if (!keep && threadId) clearInboxContext(); go({ folder: k, client: undefined, thread: keep ? threadId : undefined, panel: keep ? (panelOpen ? '1' : undefined) : undefined, card: keep ? cardId : undefined, msg: undefined }); };
  const actionsFor = (r: ConversationWithRefs) => ({
    tag: (t: ConvTag, on: boolean) => void run(() => api.tagConversation(r.id, t, on), `${on ? 'Tagged' : 'Untagged'} ${api.CONV_TAGS.find((x) => x.key === t)!.label}`),
    pin: (on: boolean) => void run(() => api.pinConversation(r.id, on), on ? 'Pinned to top' : 'Unpinned'),
    move: (l: ConvLane | null) => void run(() => api.moveConversation(r.id, l), l ? `Moved to ${l === 'quoted' ? 'Quoted' : 'Answered'}` : 'Back in All'),
    archive: () => void run(() => api.archiveConversation(r.id), 'Archived — left All'),
    unarchive: () => void run(() => api.unarchiveConversation(r.id), 'Back in All'),
  });
  const pinnedCount = useMemo(() => (folder === 'all' ? rows.filter((r) => r.pinned).length : counts?.pinned ?? 0), [rows, counts, folder]);
  const listTitle = clientId ? undefined : folder === 'all' ? 'All · every client thread, unowned' : folder === 'mike' || folder === 'vienna' || folder === 'chyna' ? `${folderLabel(folder)}’s action items · tagged, still in All` : folder === 'update_wo' ? 'Update work order · tagged, still in All' : folder === 'pinned' ? 'Pinned to top' : folder === 'archive' ? 'Archive · left All' : folderLabel(folder);
  return (
    <div data-testid="inbox-page" data-folder={folder} data-section={section} data-panel={panelOpen || undefined} className="flex h-full flex-col gap-3 transition-[padding] duration-200" style={{ paddingRight: panelOpen && section === 'threads' ? 'max(33.333vw, 520px)' : undefined }}>
      <Head title="Inbox" sub={<>Portal threads land in <b>All</b>, unowned — tag, don’t assign · colored = the client spoke last · archive in one click · Internal = staff messages <Provisional note="Email/kiosk/photo inbound are mocked; tokens are matched by a simulate button" /></>} />
      <Flash error={error} msg={msg} />
      <div className="grid min-h-0 flex-1 grid-cols-[196px_1fr] gap-3">
        <InboxTree folder={folder} onSelect={selectFolder} comms={comms} me={user!} counts={counts} pinned={pinnedCount} sent={sent.length} />
        <div className="min-h-0">
          {section === 'threads' && !comms && <div data-testid="inbox-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600"><Lock size={14} className="mr-1 inline" /> Portal threads are handled by the front desk (MH · VC · CM). When they need you on one, you get the client’s message quoted in <b>Internal</b>.</div>}
          {section === 'threads' && comms && <div className="grid h-full min-h-0 grid-cols-[380px_1fr] gap-3">
            <div className="flex min-h-0 flex-col gap-1.5">
              <div data-testid="inbox-list-head" className="flex items-center justify-between gap-2 px-1 text-[11px]">
                <span data-testid="inbox-list-title" className="truncate font-semibold text-ink">{clientId ? <>Folder: <b>{rows[0]?.client ? `${rows[0].client.firstName} ${rows[0].client.lastName}` : clientId}</b> <button data-testid="inbox-folder-exit" onClick={() => go({ client: undefined, thread: undefined })} className="ml-1 font-normal text-brand hover:underline">× back to {folderLabel(folder)}</button></> : listTitle}</span>
                {folder !== 'sent' && !clientId && folder === 'all' && <button type="button" data-testid="inbox-group-toggle" aria-pressed={grouped} onClick={() => go({ group: grouped ? undefined : '1' })} className={clsx('shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium', grouped ? 'bg-ink text-white' : 'text-ink-400 hover:bg-canvas')}>{grouped ? 'Grouped by request / job' : 'Group by request / job'}</button>}
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] text-ink-400"><span data-testid="inbox-list-count">{folder === 'sent' ? `${sent.length} sent` : `${rows.length} thread${rows.length === 1 ? '' : 's'}`}</span>{folder !== 'sent' && <span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-200 ring-1 ring-rose-300" /> client spoke last</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-surface ring-1 ring-line" /> we did</span></span>}{folder === 'archive' && <span className="inline-flex items-center gap-1"><Archive size={10} /> un-archive on hover</span>}</div>
              {folder === 'sent' && !clientId ? <SentThreadList rows={sent} threadId={threadId} onOpen={(id) => go({ thread: id, card: undefined })} /> : <ThreadList rows={rows} grouped={grouped && folder === 'all' && !clientId} lane={lane} flat={folder !== 'all' && folder !== 'archive' && !clientId} threadId={threadId} onOpen={(id) => go({ thread: id, card: undefined })} actionsFor={actionsFor} />}
            </div>
            <section ref={threadPane} data-testid="thread-pane" onScroll={(e) => { if (thread && restoring.current === null) rememberInboxScroll(thread.conversation.id, e.currentTarget.scrollTop); }} className="min-h-0 overflow-y-auto">{thread ? <ThreadStack t={thread} run={run} onFolder={() => go({ client: thread.conversation.clientId, thread: thread.conversation.id })} onPick={(id) => go({ thread: id, card: undefined })} panelOpen={panelOpen} onPanel={() => go({ panel: panelOpen ? undefined : '1', card: undefined })} actionsFor={actionsFor} /> : <div data-testid="thread-empty" className="grid h-full place-items-center text-xs text-ink-400">Select a message</div>}</section>
          </div>}
          {section === 'staff' && user && <InternalFolder me={user} folder={folder} focusId={params.get('msg') ?? undefined} />}
          {section === 'calls' && <CallsSectionInline />}
        </div>
      </div>
      {thread && panelOpen && section === 'threads' && <InboxJobCard thread={thread} onClose={() => go({ panel: undefined, card: undefined })} expandedId={cardId} onExpanded={(id) => go({ card: id })} />}
    </div>
  );
}

// INTERNAL folder body — the same store as the bubble (one-shot messages). All = to me (open) · Sent = by me · Archive = done · MH only: Everyone / per-staff read-only lists. ?msg=<id> scrolls to and highlights a row.
const InternalFolder = ({ me, folder, focusId }: { me: NonNullable<ReturnType<typeof useAuth>['user']>; folder: FolderKey; focusId?: string }) => {
  const [tick, setTick] = useState(0); const bump = () => setTick((n) => n + 1); const done = useRef(false);
  const owner = api.isOwnerSync(); const staff = staffOfFolder(folder); const f = !owner && (staff || folder === 'in-everyone') ? 'in-all' : folder;
  useEffect(() => { const h = () => bump(); window.addEventListener(hl.MESSAGE_EVENT, h); return () => window.removeEventListener(hl.MESSAGE_EVENT, h); }, []);
  useEffect(() => { done.current = false; }, [focusId]);
  useEffect(() => { if (!focusId || done.current) return; const t = window.setTimeout(() => { const el = document.querySelector(`[data-testid='msg-inbox-${focusId}'], [data-testid='msg-sent-${focusId}'], [data-testid='internal-msg-${focusId}']`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ring-2', 'ring-accent'); done.current = true; } }, 400); return () => window.clearTimeout(t); }, [focusId, tick, f]);
  const reply = (r: InboxRow) => window.dispatchEvent(new CustomEvent<BubbleComposeDetail>(BUBBLE_COMPOSE_EVENT, { detail: { replyTo: r } }));
  const title = f === 'in-all' ? `All · to me · ${hl.unreadCount(me.id)} unread` : f === 'in-sent' ? 'Sent by me' : f === 'in-archive' ? 'Archive · done' : f === 'in-everyone' ? 'Everyone · every staff message · read-only' : `${staff} · sent, received, claimed or completed · read-only`;
  return <section data-testid="inbox-staff-section" data-folder={f} className="h-full min-h-0 overflow-y-auto rounded-md border border-line bg-surface p-3">
    <div data-testid="internal-folder-title" className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{title}</div>
    {f === 'in-all' && <MessageInbox me={me} pad={false} tick={tick} onChange={bump} onReply={reply} jobBase="/jobs" show="open" />}
    {f === 'in-archive' && <MessageInbox me={me} pad={false} tick={tick} onChange={bump} onReply={reply} jobBase="/jobs" show="done" />}
    {f === 'in-sent' && <SentList tick={tick} testId="msg-sent" />}
    {(f === 'in-everyone' || staff) && <AllMessagesList staff={staff} tick={tick} />}
  </section>;
};

// Super-admin list (MH): read-only rows — from → to · status · when · station · job · text · photo
const AllMessagesList = ({ staff, tick }: { staff?: string; tick: number }) => {
  const rows = useMemo(() => hl.allMessagesSync(staff), [staff, tick]); // eslint-disable-line react-hooks/exhaustive-deps
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

// CALLS folder — missed queue + the latest calls (same ledger as /calls and the client record)
const CallsSectionInline = () => {
  const [rows, setRows] = useState<CallEvent[]>([]); const load = () => calls.getCallEvents({}).then((r) => setRows(r.slice(0, 25)));
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, []);
  return <div data-testid="inbox-calls-section" className="h-full min-h-0 space-y-3 overflow-y-auto">
    <MissedCallsPanel />
    <section className="rounded-md border border-line bg-surface px-3"><div className="flex items-center justify-between py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span>Latest calls</span><Link to="/calls" data-testid="inbox-calls-all" className="text-brand hover:underline normal-case">Full call log →</Link></div><ul className="divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} showClient testId={`inbox-call-${c.id}`} />)}</ul></section>
  </div>;
};
