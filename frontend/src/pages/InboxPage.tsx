import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RatingBadge } from '@/components/clients/RatingBadge';
import { MissedCallsPanel } from '@/components/layout/MissedCallsPanel';
import { Archive, ArchiveRestore, Check, ChevronDown, ChevronUp, Copy, Folder as Folder_, Lock, PanelRight, Pin, Share2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import type { CallEvent, ConvLane, ConvMessage, ConvTag, ConversationWithRefs, InboxFilter, PackagePhoto, RenderedTemplate, TemplateKey, ThreadView } from '@/api/client';
import * as calls from '@/api/calls';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import { useAuth } from '@/auth/AuthContext';
import { canClientComms } from '@/config/roles';
import { CallRow } from '@/components/clients/CallLedger';
import { Provisional } from '@/components/estimates/EstimateBits';
import { PhotoCapture } from '@/components/intake/ReceiveBits';
import { field, Flash, Head } from '@/components/rs/RsBits';
import { TrackButton } from '@/components/shipping/ShippingBits';
import { TemplateSourceBadge } from '@/components/comms/TemplateEdit';
import { AskDraftCard } from '@/components/comms/AskDraftCard';
import { ViewAsClientButton } from '@/components/clients/ViewAsClientButton';
import { INBOX_DRAFT_EVENT, InboxJobCard } from '@/components/inbox/InboxJobCard';
import { TagDots, ThreadContextMenu, useRowMenu } from '@/components/inbox/ThreadContextMenu';
import { BUBBLE_COMPOSE_EVENT, type BubbleComposeDetail } from '@/components/layout/MessageBubble';
import { SentList, StatusChip } from '@/components/layout/MessageComposer';
import { MessageInbox } from '@/components/layout/MessageInbox';
import { MessageText } from '@/components/layout/MessageText';
import { OwnerChip } from '@/components/ui/Pills';
import { WbpClientRows } from '@/components/shared/WbpDots';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

type Section = 'threads' | 'staff' | 'calls';
type Run = (f: () => Promise<unknown>, ok?: string) => Promise<void>;
const WHO: { key: InboxFilter['who'] | undefined; label: string; tag?: ConvTag }[] = [{ key: undefined, label: 'ALL' }, { key: 'mike', label: 'MIKE', tag: 'mike' }, { key: 'vienna', label: 'VIENNA', tag: 'vienna' }, { key: 'chyna', label: 'CHYNA', tag: 'chyna' }];
const SOURCE_TONE: Record<ConvMessage['source'], string> = { portal: 'bg-sky-50 text-sky-700', email: 'bg-teal-50 text-teal-800', kiosk: 'bg-slate-100 text-slate-700', web: 'bg-indigo-50 text-indigo-700', approval: 'bg-moss-50 text-moss-700', photo: 'bg-violet-50 text-violet-700', parts: 'bg-amber-50 text-amber-800', pickup: 'bg-moss-50 text-moss-700', staff: 'bg-canvas text-ink-600', note: 'bg-yellow-50 text-yellow-800', system: 'bg-canvas text-ink-500' };
const age = (h: number) => (h < 1 ? 'just now' : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`);
// Threading by anchor (grouped view): request / job / estimate number becomes the group header
const groupRows = (rows: ConversationWithRefs[]) => { const m = new Map<string, { key: string; label: string; rows: ConversationWithRefs[] }>(); rows.forEach((r) => { const key = r.anchor ? `${r.anchor.kind}-${r.anchor.id}` : 'general'; const label = r.anchor ? `${r.anchor.kind} · ${r.anchorLabel ?? r.anchor.id}` : 'General · no request / job'; (m.get(key) ?? m.set(key, { key, label, rows: [] }).get(key)!).rows.push(r); }); return [...m.values()].sort((a, b) => (a.key === 'general' ? 1 : b.key === 'general' ? -1 : b.rows.length - a.rows.length)); };

// ONE GENERAL INBOX (MH 2026-10-01): every client thread lands in All, unowned. Tags, not assignment · color = client spoke last · archive fast · pin · Quoted / Answered lanes.
// Sections: Portal (client threads, MH · VC · CM only) · Team (staff messages, same store as the bubble) · Calls.
export default function InboxPage() {
  const { user } = useAuth(); const comms = canClientComms(user);
  const [params, setParams] = useSearchParams();
  const section: Section = (params.get('section') as Section) || (comms ? 'threads' : 'staff');
  const who = (params.get('who') as InboxFilter['who']) || undefined; const lane = (params.get('lane') as InboxFilter['lane']) || undefined; const clientId = params.get('client') ?? undefined; const threadId = params.get('thread') ?? undefined; const grouped = params.get('group') === '1'; const panelOpen = params.get('panel') === '1';
  const [rows, setRows] = useState<ConversationWithRefs[]>([]); const [counts, setCounts] = useState<Awaited<ReturnType<typeof api.getInboxThreadCounts>> | null>(null); const [thread, setThread] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const reload = async () => { setRows(clientId ? await api.getClientFolder(clientId) : await api.getInboxThreads({ who, lane })); setCounts(await api.getInboxThreadCounts()); if (threadId) { setThread(await api.getThread(threadId)); await api.markConversationRead(threadId); } else setThread(null); };
  useEffect(() => { if (comms) reload().catch((e) => setError(e.message)); }, [who, lane, clientId, threadId, comms]); // eslint-disable-line react-hooks/exhaustive-deps
  // a share logged from the bubble while this thread is open → re-read so the "Shared with …" line appears
  useEffect(() => { const h = () => { if (comms && section === 'threads') void reload().catch(() => undefined); }; window.addEventListener(hl.INBOX_REFRESH_EVENT, h); return () => window.removeEventListener(hl.INBOX_REFRESH_EVENT, h); }); // eslint-disable-line react-hooks/exhaustive-deps
  const run: Run = async (f, ok) => { try { setError(null); await f(); await reload(); if (ok) { setMsg(ok); setTimeout(() => setMsg(null), 2500); } } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } };
  const go = (patch: Record<string, string | undefined>) => { const p = new URLSearchParams(params); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p); };
  const actionsFor = (r: ConversationWithRefs) => ({
    tag: (t: ConvTag, on: boolean) => void run(() => api.tagConversation(r.id, t, on), `${on ? 'Tagged' : 'Untagged'} ${api.CONV_TAGS.find((x) => x.key === t)!.label}`),
    pin: (on: boolean) => void run(() => api.pinConversation(r.id, on), on ? 'Pinned to top' : 'Unpinned'),
    move: (l: ConvLane | null) => void run(() => api.moveConversation(r.id, l), l ? `Moved to ${l === 'quoted' ? 'Quoted' : 'Answered'}` : 'Back in All'),
    archive: () => void run(() => api.archiveConversation(r.id), 'Archived — left All'),
    unarchive: () => void run(() => api.unarchiveConversation(r.id), 'Back in All'),
  });
  return (
    <div data-testid="inbox-page" data-section={section} data-panel={panelOpen || undefined} className="flex h-full flex-col gap-3 transition-[padding] duration-200" style={{ paddingRight: panelOpen && section === 'threads' ? 'max(33.333vw, 520px)' : undefined }}>
      <Head title="Inbox" sub={<>One general inbox — every client thread lands in <b>All</b>, unowned. Tag, don’t assign · colored = the client spoke last · archive in one click <Provisional note="Email/kiosk/photo inbound are mocked; tokens are matched by a simulate button" /></>} />
      <div data-testid="inbox-sections" className="flex items-center gap-1 border-b border-line text-xs">
        {([['threads', 'Portal'], ['staff', 'Team'], ['calls', 'Calls']] as [Section, string][]).map(([k, l]) => <button key={k} type="button" data-testid={`inbox-section-${k}`} aria-selected={section === k} onClick={() => go({ section: k })} className={clsx('-mb-px border-b-2 px-3 py-1.5 font-semibold', section === k ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink')}>{l}{k === 'threads' && !comms && <Lock size={10} className="ml-1 inline" />}{k === 'threads' && comms && counts && counts.needsReply > 0 && <span data-testid="inbox-section-threads-count" className="ml-1.5 rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{counts.needsReply}</span>}</button>)}
      </div>
      <Flash error={error} msg={msg} />
      {section === 'threads' && !comms && <div data-testid="inbox-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600"><Lock size={14} className="mr-1 inline" /> Portal threads are handled by the front desk (MH · VC · CM). When they need you on one, you get the client’s message quoted in <b>Team</b>.</div>}
      {section === 'threads' && comms && <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr] gap-3">
        <div className="flex min-h-0 flex-col gap-1.5">
          <div data-testid="inbox-who" className="flex items-center gap-1 rounded-md bg-canvas p-1">{WHO.map((w) => { const n = w.tag ? counts?.byTag[w.tag] : counts?.all; const on = (who ?? undefined) === w.key && !clientId; const t = w.tag ? api.CONV_TAGS.find((x) => x.key === w.tag) : undefined; return <button key={w.label} type="button" data-testid={`inbox-who-${w.label.toLowerCase()}`} aria-pressed={on} onClick={() => go({ who: w.key, client: undefined, thread: undefined })} className={clsx('flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] font-bold tracking-wide', on ? 'bg-ink text-white' : 'text-ink-600 hover:bg-surface')}>{t && <span className={clsx('inline-block h-2 w-2 rounded-full', t.dot)} />}{w.label}{n !== undefined && <span className={clsx('rounded-full px-1.5 text-[10px] font-semibold', on ? 'bg-white/20' : 'bg-surface text-ink-500')}>{n}</span>}</button>; })}</div>
          <div data-testid="inbox-lanes" className="flex flex-wrap items-center gap-1 px-0.5 text-[11px]">
            {([[undefined, 'All'], ['quoted', 'Quoted'], ['answered', 'Answered'], ['snoozed', 'Snoozed']] as [InboxFilter['lane'], string][]).map(([k, l]) => <button key={l} type="button" data-testid={`inbox-lane-${l.toLowerCase()}`} aria-pressed={(lane ?? undefined) === k} onClick={() => go({ lane: k, client: undefined, thread: undefined })} className={clsx('rounded-full border px-2 py-0.5 font-medium', (lane ?? undefined) === k ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas')}>{l}{counts && k && <span className="ml-1 opacity-70">{k === 'quoted' ? counts.quoted : k === 'answered' ? counts.answered : counts.snoozed}</span>}</button>)}
            <button type="button" data-testid="inbox-group-toggle" aria-pressed={grouped} onClick={() => go({ group: grouped ? undefined : '1' })} className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-medium', grouped ? 'bg-ink text-white' : 'text-ink-400 hover:bg-canvas')}>{grouped ? 'Grouped by request / job' : 'Group by request / job'}</button>
            <button type="button" data-testid="inbox-lane-archived" aria-pressed={lane === 'archived'} onClick={() => go({ lane: lane === 'archived' ? undefined : 'archived', client: undefined, thread: undefined })} className={clsx('ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]', lane === 'archived' ? 'bg-ink text-white' : 'text-ink-400 hover:text-ink')}><Archive size={10} /> Archived{counts ? ` · ${counts.archived}` : ''}</button>
          </div>
          {clientId && <div data-testid="inbox-folder-chip" className="rounded-md border border-line px-2 py-1.5 text-[11px] text-ink-600">Folder: <b>{rows[0]?.client ? `${rows[0].client.firstName} ${rows[0].client.lastName}` : clientId}</b><button data-testid="inbox-folder-exit" onClick={() => go({ client: undefined, thread: undefined })} className="ml-1 text-brand hover:underline">× all</button></div>}
          <div className="flex items-center justify-between px-1 text-[10px] text-ink-400"><span data-testid="inbox-list-count">{rows.length} thread{rows.length === 1 ? '' : 's'}{who ? ` · ${who === 'mike' ? 'Mike' : who === 'vienna' ? 'Vienna' : 'Chyna'}’s action items` : lane === 'archived' ? ' · archived' : ''}</span><span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-200 ring-1 ring-rose-300" /> client spoke last</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-surface ring-1 ring-line" /> we did</span></span></div>
          <ThreadList rows={rows} grouped={grouped && !lane && !who} lane={lane} threadId={threadId} onOpen={(id) => go({ thread: id })} actionsFor={actionsFor} />
        </div>
        <section className="min-h-0 overflow-y-auto">{thread ? <ThreadStack t={thread} run={run} onFolder={() => go({ client: thread.conversation.clientId, thread: thread.conversation.id })} onPick={(id) => go({ thread: id })} panelOpen={panelOpen} onPanel={() => go({ panel: panelOpen ? undefined : '1' })} actionsFor={actionsFor} /> : <div data-testid="thread-empty" className="grid h-full place-items-center text-xs text-ink-400">Select a thread</div>}</section>
      </div>}
      {section === 'staff' && user && <StaffMessagesSection me={user} focusId={params.get('msg') ?? undefined} folder={params.get('staff') ?? 'me'} onFolder={(f) => go({ staff: f === 'me' ? undefined : f, msg: undefined })} />}
      {section === 'calls' && <CallsSectionInline />}
      {thread && panelOpen && section === 'threads' && <InboxJobCard thread={thread} onClose={() => go({ panel: undefined })} />}
    </div>
  );
}

type ActionsFor = (r: ConversationWithRefs) => { tag: (t: ConvTag, on: boolean) => void; pin: (on: boolean) => void; move: (l: ConvLane | null) => void; archive: () => void; unarchive: () => void };
// The list: pinned on top (pin icon) → rows; in All, Quoted / Answered sit as sections beneath the live rows. Row = colored when the CLIENT spoke last. Hover → one-click Archive. Right-click → menu.
const ThreadList = ({ rows, grouped, lane, threadId, onOpen, actionsFor }: { rows: ConversationWithRefs[]; grouped: boolean; lane: InboxFilter['lane']; threadId?: string; onOpen: (id: string) => void; actionsFor: ActionsFor }) => {
  const { menu, close, rowProps } = useRowMenu(); const menuRow = menu ? rows.find((r) => r.id === menu.id) : undefined;
  const Row = ({ r }: { r: ConversationWithRefs }) => <li data-testid={`thread-item-${r.id}`} className="group relative" {...rowProps(r.id)}>
    <button type="button" data-testid={`thread-row-${r.id}`} data-client-last={r.needsReply || undefined} data-pinned={r.pinned || undefined} data-lane={r.lane} onClick={() => onOpen(r.id)} className={clsx('w-full rounded-md border p-2 text-left text-xs transition-colors', threadId === r.id ? 'border-ink' : 'border-line', r.needsReply ? 'border-l-[3px] border-l-rose-400 bg-rose-50/70 hover:bg-rose-50' : 'bg-surface hover:bg-canvas/60', r.status === 'closed' && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 font-medium text-ink">{r.pinned && <Pin size={11} data-testid={`thread-pin-${r.id}`} className="shrink-0 text-ink-500" />}<span className="truncate">{r.client.firstName} {r.client.lastName}</span>{r.unreplied > 0 && <span data-testid={`thread-row-unreplied-${r.id}`} title="unreplied client messages" className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{r.unreplied}</span>}{r.unread > 0 && <span data-testid={`thread-unread-${r.id}`} className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">{r.unread}</span>}<TagDots tags={r.tags} testId={`thread-tags-${r.id}`} /></span><span className="shrink-0 text-[10px] text-ink-400">{r.needsReply ? <span data-testid={`thread-age-${r.id}`} className="font-semibold text-rose-700">reply owed · {age(r.ageHours)}</span> : r.status === 'snoozed' ? `snoozed → ${fmtDate(r.snoozedUntil!)}` : r.status === 'closed' ? 'archived' : r.lane ?? 'we spoke last'}</span></div>
      <div className="truncate text-ink-700">{r.subject}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-ink-400"><WbpClientRows clientId={r.clientId} currentJobId={r.anchor?.kind === 'job' ? r.anchor.id : undefined} compact testId={`thread-row-wbp-${r.id}`} />{r.anchorLabel && <span className="rounded bg-canvas px-1 font-mono">{r.anchorLabel}</span>}{r.last?.component && <span data-testid={`thread-row-component-${r.id}`} className="rounded bg-sky-600 px-1 font-semibold text-white">{r.last.ask ? 'ask · ' : ''}{api.PART_LABELS[r.last.component].toLowerCase()}</span>}{r.last && <span className={`rounded px-1 ${SOURCE_TONE[r.last.source]}`}>{r.last.source}</span>}{r.last && <span>· {r.last.direction === 'in' ? r.client.firstName : r.last.by} spoke last</span>}</div>
    </button>
    {r.status !== 'closed' ? <button type="button" data-testid={`thread-archive-${r.id}`} title="Archive — leaves All immediately" onClick={(e) => { e.stopPropagation(); actionsFor(r).archive(); }} className="absolute right-1.5 top-7 rounded-sm border border-line bg-surface p-1 text-ink-500 opacity-0 shadow-sm transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"><Archive size={12} /></button>
      : <button type="button" data-testid={`thread-unarchive-${r.id}`} title="Un-archive → All" onClick={(e) => { e.stopPropagation(); actionsFor(r).unarchive(); }} className="absolute right-1.5 top-7 rounded-sm border border-line bg-surface p-1 text-ink-500 opacity-0 shadow-sm transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"><ArchiveRestore size={12} /></button>}
  </li>;
  const Sec = ({ label, testId, list }: { label: string; testId: string; list: ConversationWithRefs[] }) => (list.length ? <li data-testid={testId} data-count={list.length}><div className="mt-1 flex items-center justify-between rounded-sm bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><span>{label}</span><span className="font-mono">{list.length}</span></div><ul className="mt-1 space-y-1">{list.map((r) => <Row key={r.id} r={r} />)}</ul></li> : null);
  const pinned = rows.filter((r) => r.pinned); const rest = rows.filter((r) => !r.pinned);
  const sections = !lane ? [{ label: 'Inbox', testId: 'inbox-sec-live', list: rest.filter((r) => !r.lane) }, { label: 'Quoted', testId: 'inbox-sec-quoted', list: rest.filter((r) => r.lane === 'quoted') }, { label: 'Answered', testId: 'inbox-sec-answered', list: rest.filter((r) => r.lane === 'answered') }] : [{ label: lane, testId: `inbox-sec-${lane}`, list: rest }];
  return <>
    <ul data-testid="inbox-list" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
      {pinned.length > 0 && <Sec label="Pinned" testId="inbox-sec-pinned" list={pinned} />}
      {grouped ? groupRows(rest).map((g) => <li key={g.key} data-testid={`inbox-group-${g.key}`}><div className="flex items-center justify-between rounded-sm bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><span>{g.label}</span><span data-testid={`inbox-group-count-${g.key}`} className="font-mono">{g.rows.length}</span></div><ul className="mt-1 space-y-1 pl-2">{g.rows.map((r) => <Row key={r.id} r={r} />)}</ul></li>)
        : sections.map((s) => (!lane && s.testId === 'inbox-sec-live' && !pinned.length ? <li key={s.testId} data-testid={s.testId} data-count={s.list.length}><ul className="space-y-1">{s.list.map((r) => <Row key={r.id} r={r} />)}</ul></li> : <Sec key={s.testId} {...s} />))}
      {!rows.length && <li className="px-2 py-6 text-center text-xs text-ink-400">Nothing here</li>}
    </ul>
    {menu && menuRow && <ThreadContextMenu pos={menu.pos} conv={menuRow} actions={actionsFor(menuRow)} onClose={close} />}
  </>;
};

// One collapsible card per thread for this client (threads per request / job / estimate). Collapsed = identity + badges + unreplied count; expanded = full history + composer inside the same card.
function ThreadStack({ t, run, onFolder, onPick, panelOpen, onPanel, actionsFor }: { t: ThreadView; run: Run; onFolder: () => void; onPick: (id: string) => void; panelOpen: boolean; onPanel: () => void; actionsFor: ActionsFor }) {
  const cards = [...t.folder].sort((a, b) => b.lastAt.localeCompare(a.lastAt)); const [open, setOpen] = useState<Set<string>>(new Set([t.conversation.id])); const [views, setViews] = useState<Record<string, ThreadView>>({});
  useEffect(() => { setOpen(new Set([t.conversation.id])); setViews((v) => ({ ...v, [t.conversation.id]: t })); }, [t]);
  const toggle = async (id: string) => { const n = new Set(open); if (n.has(id)) n.delete(id); else { n.add(id); if (!views[id]) setViews((v) => ({ ...v, [id]: undefined as unknown as ThreadView })); const tv = await api.getThread(id); setViews((v) => ({ ...v, [id]: tv })); } setOpen(n); };
  return <div data-testid="thread-stack" className="space-y-2">{cards.map((c) => { const isOpen = open.has(c.id); const tv = c.id === t.conversation.id ? t : views[c.id]; return <div key={c.id} data-testid={`thread-card-${c.id}`} data-expanded={isOpen} className={`rounded-md border bg-surface ${c.id === t.conversation.id ? 'border-ink' : 'border-line'}`}>
    <button data-testid={`thread-card-toggle-${c.id}`} onClick={() => { void toggle(c.id); if (!isOpen && c.id !== t.conversation.id) onPick(c.id); }} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs"><span className="text-sm font-semibold text-ink">{c.subject}</span>{c.anchorLabel && <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink-700">{c.anchorLabel}</span>}<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.status === 'open' ? 'bg-moss-50 text-moss-700' : c.status === 'snoozed' ? 'bg-amber-50 text-amber-800' : 'bg-canvas text-ink-500'}`}>{c.status === 'closed' ? 'archived' : c.status}</span>{c.needsReply && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">reply owed · {age(c.ageHours)}</span>}<span className="text-[10px] text-ink-400">last {fmtDate(c.lastAt)} {fmtTime(c.lastAt)}</span>
      <span data-testid={`thread-unreplied-${c.id}`} title="Client messages not yet replied to or cleared" className={`ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-bold ${c.unreplied ? 'bg-rose-600 text-white' : 'bg-canvas text-ink-400'}`}>{c.unreplied}</span>{isOpen ? <ChevronUp size={14} className="text-ink-400" /> : <ChevronDown size={14} className="text-ink-400" />}</button>
    {isOpen && (tv ? <div className="border-t border-line p-2"><Thread t={tv} run={run} onFolder={onFolder} panelOpen={panelOpen} onPanel={onPanel} actions={actionsFor(tv.conversation)} /></div> : <div className="border-t border-line p-3 text-xs text-ink-400">Loading…</div>)}
  </div>; })}</div>;
}

function Thread({ t, run, onFolder, panelOpen, onPanel, actions }: { t: ThreadView; run: Run; onFolder: () => void; panelOpen: boolean; onPanel: () => void; actions: ReturnType<ActionsFor> }) {
  const c = t.conversation; const { user } = useAuth();
  const [text, setText] = useState(''); const [subject, setSubject] = useState(''); const [tpl, setTpl] = useState<TemplateKey | ''>(''); const [preview, setPreview] = useState<RenderedTemplate | null>(null); const [photos, setPhotos] = useState<PackagePhoto[]>([]); const [note, setNote] = useState(''); const [snooze, setSnooze] = useState(''); const [sim, setSim] = useState(''); const [copied, setCopied] = useState<string | null>(null);
  const { menu, close, rowProps } = useRowMenu();
  useEffect(() => { setText(''); setPreview(null); setTpl(''); setPhotos([]); }, [c.id]);
  // "Generate summary" in the job-card panel drops its draft straight into this reply box
  useEffect(() => { const h = (e: Event) => { const d = (e as CustomEvent<{ threadId: string; text: string }>).detail; if (d.threadId === c.id) { setText(d.text); setSubject((s) => s || `Re: ${c.subject}`); } }; window.addEventListener(INBOX_DRAFT_EVENT, h); return () => window.removeEventListener(INBOX_DRAFT_EVENT, h); }, [c.id, c.subject]);
  const pickTemplate = async (k: TemplateKey | '') => { setTpl(k); if (!k) { setPreview(null); return; } const r = await api.renderTemplate(c.id, k); setPreview(r); setText(r.body); setSubject(r.subject); };
  const copy = async (m: ConvMessage) => { const plain = `${m.by} · ${fmtDate(m.at)} ${fmtTime(m.at)}\n${m.text}`; try { await navigator.clipboard.writeText(plain); } catch { /* clipboard blocked */ } setCopied(m.id); window.setTimeout(() => setCopied(null), 1500); };
  // Share with staff → the bubble's one-shot composer opens with the client's message QUOTED + thread link; recipients picked there; logged on the thread after send
  const share = (m: ConvMessage) => window.dispatchEvent(new CustomEvent<BubbleComposeDetail>(BUBBLE_COMPOSE_EVENT, { detail: { share: { conversationId: c.id, messageId: m.id, quote: hl.quoteClientMessage(m, c.id), photo: m.photos?.[0], jobId: c.anchor?.kind === 'job' ? c.anchor.id : undefined, clientName: m.by } } }));
  const signature = `— ${user?.shortName ?? 'Front desk'}, ${c.division === 'rollishop' ? 'Rollishop' : 'Rolliworks'}`;
  return <div data-testid="thread-view" className="flex h-full flex-col gap-2">
    <div className="rounded-md border border-line bg-surface p-3" {...rowProps(c.id)}>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-sm font-semibold text-ink">{c.pinned && <Pin size={12} data-testid="thread-pinned" className="mr-1 inline text-ink-500" />}{c.subject}</span><TagDots tags={c.tags} testId="thread-tags" size="md" /><RatingBadge clientId={c.clientId} testId="thread-rating" /><WbpClientRows clientId={c.clientId} currentJobId={c.anchor?.kind === 'job' ? c.anchor.id : undefined} testId="thread-wbp" />{c.anchorLabel && <Link data-testid="thread-anchor" to={c.anchorPath ?? '#'} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-brand hover:underline">{c.anchorLabel} →</Link>}{c.linkedEstimate && <Link data-testid="thread-estimate-chip" to={`/estimates/${c.linkedEstimate.id}`} className="rounded bg-moss-50 px-1.5 py-0.5 font-mono text-[11px] text-moss-700 hover:underline">{c.linkedEstimate.number} →</Link>}<span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.needsReply ? 'bg-rose-50 text-rose-700' : 'bg-canvas text-ink-500'}`} data-testid="thread-status">{c.needsReply ? `reply owed · ${age(c.ageHours)}` : c.status === 'closed' ? 'archived' : c.lane ? c.lane : 'we spoke last'}</span><button data-testid="thread-folder" onClick={onFolder} className="text-[11px] text-brand hover:underline">{c.client.firstName} {c.client.lastName}’s folder ({t.folder.length})</button><Link to={`/clients/${c.clientId}`} className="text-[11px] text-ink-400 hover:underline">Client 360</Link><button type="button" data-testid="thread-job-card" aria-pressed={panelOpen} onClick={onPanel} className={`inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-[11px] font-semibold ${panelOpen ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:bg-canvas'}`}><PanelRight size={12} /> Job card</button><TrackButton clientId={c.clientId} estimateId={c.anchor?.kind === 'estimate' ? c.anchor.id : undefined} testId="thread-track" /><ViewAsClientButton clientId={c.clientId} testId="thread-view-as-client" /></div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-ink-500">Tags:{api.CONV_TAGS.map((tg) => { const on = c.tags?.includes(tg.key); return <button key={tg.key} type="button" data-testid={`thread-tag-${tg.key}`} aria-pressed={!!on} title={`${on ? 'Untag' : 'Tag'} ${tg.label}`} onClick={() => actions.tag(tg.key, !on)} className={clsx('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5', on ? 'border-ink bg-ink text-white' : 'border-line text-ink-600 hover:bg-canvas')}><span className={clsx('inline-block h-2 w-2 rounded-full', tg.dot)} />{tg.label}</button>; })}</span>
        {c.status !== 'snoozed' && c.status !== 'closed' && <><input data-testid="thread-snooze-date" type="date" value={snooze} onChange={(e) => setSnooze(e.target.value)} className={field} /><Button size="sm" data-testid="thread-snooze" onClick={() => run(() => api.snoozeConversation(c.id, snooze ? `${snooze}T09:00:00.000Z` : ''), 'Snoozed')}>Snooze</Button></>}
        {c.status === 'snoozed' && <Button size="sm" data-testid="thread-wake" onClick={() => run(() => api.wakeConversation(c.id), 'Woken')}>Wake now</Button>}
        {c.anchor?.kind === 'request' && (c.linkedEstimate ? <Link to={`/estimates/${c.linkedEstimate.id}`}><Button size="sm" data-testid="thread-open-estimate">Open estimate</Button></Link> : <Link to={`/estimates/new?request=${c.anchor.id}`}><Button size="sm" variant="primary" data-testid="thread-create-estimate">Create estimate</Button></Link>)}
        <span className="ml-auto" />
        {c.status !== 'closed' && <Button size="sm" data-testid="thread-pin" onClick={() => actions.pin(!c.pinned)}><Pin size={12} /> {c.pinned ? 'Unpin' : 'Pin'}</Button>}
        {c.status !== 'closed' ? <Button size="sm" data-testid="thread-close" onClick={actions.archive}><Archive size={12} /> Archive</Button> : <Button size="sm" data-testid="thread-reopen" onClick={actions.unarchive}><ArchiveRestore size={12} /> Un-archive</Button>}
      </div>
    </div>
    {menu && <ThreadContextMenu pos={menu.pos} conv={c} actions={actions} onClose={close} testId="thread-header-menu" />}
    <ol data-testid="thread-messages" className="space-y-2">{t.messages.map((m) => <li key={m.id} data-testid={`msg-${m.id}`} className={`rounded-md border p-2 text-xs ${m.direction === 'internal' ? 'border-yellow-200 bg-yellow-50/60' : m.direction === 'out' ? 'ml-10 border-line bg-canvas/50' : 'mr-10 border-rose-100 bg-rose-50/40'}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-500"><span className={`rounded px-1 font-semibold ${SOURCE_TONE[m.source]}`} data-testid={`msg-source-${m.id}`}>{m.direction === 'internal' ? (m.event?.kind === 'shared' ? 'shared with staff · logged' : 'internal note · never sent') : m.source}</span><b className="text-ink-700">{m.by}</b>{m.station && <span>· {m.station}</span>}<span>· {fmtDate(m.at)} {fmtTime(m.at)}</span>{m.token && <span data-testid={`msg-token-${m.id}`} className="rounded bg-ink px-1 font-mono text-white">{m.token}</span>}{m.matchedToken && <span data-testid={`msg-matched-${m.id}`} className="rounded bg-moss-50 px-1 font-mono text-moss-700">↩ matched {m.matchedToken}</span>}{m.event && m.event.kind !== 'shared' && <span data-testid={`msg-event-${m.id}`} className="rounded bg-moss-100 px-1 text-moss-800">{m.event.label}</span>}{m.templateKey && <span className="rounded bg-canvas px-1">template {m.templateKey}</span>}{m.emailId && <Link to="/intake/sent" className="text-brand hover:underline">Sent</Link>}{m.direction === 'in' && !m.readByStaff && <span className="rounded bg-brand px-1 text-white">new</span>}
        {m.direction === 'in' && <span className="ml-auto inline-flex items-center gap-1"><button type="button" data-testid={`msg-share-${m.id}`} onClick={() => share(m)} title="Share with staff — quoted, with a link only MH · VC · CM can open" className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-1.5 py-0.5 font-medium text-ink-700 hover:bg-canvas"><Share2 size={10} /> Share with staff</button><button type="button" data-testid={`msg-copy-${m.id}`} onClick={() => void copy(m)} title="Copy message (plain text)" className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface px-1.5 py-0.5 font-medium text-ink-700 hover:bg-canvas"><Copy size={10} /> {copied === m.id ? 'Copied' : 'Copy message'}</button></span>}</div>
      <div className="whitespace-pre-line text-ink-800">{m.text}</div>
      {m.ask && <AskDraftCard m={m} onDone={(ok) => void run(async () => undefined, ok)} />}
      {m.direction === 'in' && (m.cleared ? <div data-testid={`msg-cleared-${m.id}`} className="mt-1 text-[10px] text-ink-400">Cleared · no reply needed · {m.cleared.by} · {fmtDate(m.cleared.at)} {fmtTime(m.cleared.at)}</div> : m.at > (c.lastOutboundAt ?? '') && <button data-testid={`msg-clear-${m.id}`} onClick={() => run(() => api.clearMessage(c.id, m.id), 'Cleared — no reply sent')} className="mt-1 inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-600 hover:bg-canvas"><Check size={10} /> Clear · no reply needed</button>)}
      {m.photos?.length ? <div className="mt-1 flex gap-1">{m.photos.map((p) => <img key={p.id} src={p.dataUrl} alt="" className="h-12 rounded border border-line" />)}</div> : null}
    </li>)}</ol>
    <div data-testid="composer" className="rounded-md border border-line bg-surface p-3">
      <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-ink">Reply</span><select data-testid="composer-template" value={tpl} onChange={(e) => pickTemplate(e.target.value as TemplateKey | '')} className={field}><option value="">Template…</option>{['intake_confirmation', 'estimate_sent', 'inspection_ready', 'job_in_progress', 'back_in_progress', 'evidence_available', 'invoice_ready', 'ready_for_pickup', 'shipped'].map((k) => <option key={k} value={k}>{k}</option>)}</select>{c.linkedEstimate && tpl !== 'estimate_sent' && <button data-testid="composer-quote-template" onClick={() => void pickTemplate('estimate_sent')} className="rounded-sm border border-moss-200 bg-moss-50 px-2 py-0.5 text-[11px] font-medium text-moss-700 hover:bg-moss-100">Reply with the quote · {c.linkedEstimate.number} (estimate_sent + portal link)</button>}<span data-testid="composer-signature" className="ml-auto text-[10px] text-ink-400">signs as <b>{signature}</b></span></div>
      {preview && <div data-testid="composer-preview" className="mt-2 rounded border border-line bg-canvas/60 p-2 text-[11px]"><div className="font-semibold text-ink">Preview · {preview.subject}</div><pre className="mt-1 whitespace-pre-wrap font-sans text-ink-700">{preview.body}</pre>{preview.missing.length > 0 && <div data-testid="composer-missing" className="mt-1 text-amber-800">Unfilled: {preview.missing.join(' ')}</div>}</div>}
      <input data-testid="composer-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`Re: ${c.subject}`} className={`${field} mt-2 block w-full`} />
      <textarea data-testid="composer-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write to the client…" className={`${field} mt-1 block w-full`} />
      <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2">{photos.length > 0 && <span data-testid="composer-photos" className="text-[11px] text-ink-500">{photos.length} photo{photos.length === 1 ? '' : 's'} attached</span>}<details className="text-[11px]"><summary className="cursor-pointer text-brand">Attach photos</summary><div className="mt-1"><PhotoCapture onAdd={(p) => setPhotos([...photos, ...p])} /></div></details></div>{tpl && preview && <InboxTemplateTools tkey={tpl} preview={preview} text={text} subject={subject} conversationId={c.id} onReload={async (shopDefault) => { const r = await api.renderTemplate(c.id, tpl, shopDefault); setPreview(r); setText(r.body); setSubject(r.subject); }} />}<Button variant="primary" data-testid="composer-send" onClick={() => run(async () => { await api.replyInThread(c.id, { text, subject, templateKey: tpl || undefined, photos }); setText(''); setPhotos([]); setPreview(null); setTpl(''); }, 'Queued to Sent · thread updated')}>Queue to Sent</Button></div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2"><input data-testid="note-text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note — never sent, audited" className={`${field} flex-1 bg-yellow-50/50`} /><Button size="sm" data-testid="note-save" onClick={() => run(async () => { await api.addThreadNote(c.id, note); setNote(''); }, 'Note added')}>Add note</Button></div>
      <div className="mt-2 flex items-center gap-2 text-[11px]"><Provisional note="Mock: emulates a client email reply routed back by the last outbound reply token" /><input data-testid="simulate-text" value={sim} onChange={(e) => setSim(e.target.value)} placeholder="simulate client reply…" className={`${field} flex-1`} /><Button size="sm" data-testid="simulate-inbound" onClick={() => run(async () => { await api.simulateInboundReply(c.id, sim); setSim(''); }, 'Inbound matched by token')}>Simulate inbound</Button></div>
    </div>
  </div>;
}

// Point-of-use template tools in the reply composer: the textarea IS the inline editor ("just this send" = edit and queue); save it as my template or flip to the shop default
const InboxTemplateTools = ({ tkey, preview, text, subject, conversationId, onReload }: { tkey: TemplateKey; preview: RenderedTemplate; text: string; subject: string; conversationId: string; onReload: (shopDefault?: boolean) => Promise<void> }) => {
  const [note, setNote] = useState<string | null>(null);
  const edited = text !== preview.body || subject !== preview.subject; const mode = edited ? 'one_off' : preview.source;
  const saveMine = async () => { const vals = await api.mergeValuesForConversation(conversationId); const p = await api.savePersonalTemplate(tkey, api.unrenderTemplate(subject, vals), api.unrenderTemplate(text, vals)); setNote(`Saved as ${p.owner}’s template`); await onReload(); };
  return <span className="flex flex-wrap items-center gap-1.5">
    <TemplateSourceBadge mode={mode} owner={preview.owner} testId="composer-tpl-source" />
    {edited && <button type="button" data-testid="composer-tpl-save-mine" onClick={() => void saveMine()} className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100">Save as my template</button>}
    {!edited && preview.source === 'personal' && <button type="button" data-testid="composer-tpl-use-shop" onClick={() => void onReload(true)} className="text-[11px] text-ink-500 hover:text-ink">Use shop default</button>}
    {!edited && preview.source === 'shop' && api.personalTemplateFor(tkey) && <button type="button" data-testid="composer-tpl-use-mine" onClick={() => void onReload(false)} className="text-[11px] text-amber-800 hover:underline">Use my template</button>}
    {note && <span data-testid="composer-tpl-note" className="text-[11px] text-emerald-700">{note}</span>}
  </span>;
};

// INTERNAL section — the same store as the bubble (one-shot messages), laid out as one Outlook-style tree: To me · Sent by me · (MH only) a folder per staff name = everything they sent / received / claimed / completed.
// ?staff=<me|sent|all|Short> picks the folder (also reachable as /messages/all?staff=…). ?msg=<id> scrolls to and highlights a row.
const StaffMessagesSection = ({ me, focusId, folder, onFolder }: { me: NonNullable<ReturnType<typeof useAuth>['user']>; focusId?: string; folder: string; onFolder: (f: string) => void }) => {
  const [tick, setTick] = useState(0); const bump = () => setTick((n) => n + 1); const done = useRef(false);
  const owner = api.isOwnerSync(); const f = !owner && folder !== 'me' && folder !== 'sent' ? 'me' : folder;
  useEffect(() => { const h = () => bump(); window.addEventListener(hl.MESSAGE_EVENT, h); return () => window.removeEventListener(hl.MESSAGE_EVENT, h); }, []);
  useEffect(() => { done.current = false; }, [focusId]);
  useEffect(() => { if (!focusId || done.current) return; const t = window.setTimeout(() => { const el = document.querySelector(`[data-testid='msg-inbox-${focusId}'], [data-testid='msg-sent-${focusId}'], [data-testid='internal-msg-${focusId}']`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('ring-2', 'ring-accent'); done.current = true; } }, 400); return () => window.clearTimeout(t); }, [focusId, tick, f]);
  const reply = (r: InboxRow) => window.dispatchEvent(new CustomEvent<BubbleComposeDetail>(BUBBLE_COMPOSE_EVENT, { detail: { replyTo: r } }));
  const folders = owner ? hl.staffFolders() : [];
  const Folder = ({ k, label, count, tone }: { k: string; label: string; count?: number; tone?: 'unread' }) => <button type="button" data-testid={`internal-folder-${k}`} aria-selected={f === k} onClick={() => onFolder(k)} className={clsx('flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs', f === k ? 'bg-ink font-semibold text-white' : 'text-ink-700 hover:bg-canvas')}><Folder_ size={12} className={f === k ? 'text-white/70' : 'text-ink-400'} /><span className="truncate">{label}</span>{count !== undefined && count > 0 && <span className={clsx('ml-auto rounded-full px-1.5 font-mono text-[10px]', tone === 'unread' ? 'bg-rose-600 text-white' : f === k ? 'bg-white/20' : 'bg-canvas text-ink-500')}>{count}</span>}</button>;
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

// CALLS section — missed queue + the latest calls (same ledger as /calls and the client record)
const CallsSectionInline = () => {
  const [rows, setRows] = useState<CallEvent[]>([]); const load = () => calls.getCallEvents({}).then((r) => setRows(r.slice(0, 25)));
  useEffect(() => { void load(); return calls.subscribeCalls(() => void load()); }, []);
  return <div data-testid="inbox-calls-section" className="min-h-0 flex-1 space-y-3 overflow-y-auto">
    <MissedCallsPanel />
    <section className="rounded-md border border-line bg-surface px-3"><div className="flex items-center justify-between py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span>Latest calls</span><Link to="/calls" data-testid="inbox-calls-all" className="text-brand hover:underline normal-case">Full call log →</Link></div><ul className="divide-y divide-line">{rows.map((c) => <CallRow key={c.id} c={c} onChange={() => void load()} showClient testId={`inbox-call-${c.id}`} />)}</ul></section>
  </div>;
};
