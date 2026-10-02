import clsx from 'clsx';
import { Archive, ArchiveRestore, Paperclip, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { ConvLane, ConvTag, ConversationWithRefs, InboxFilter, InboxSentRow } from '@/api/client';
import { TagDots, ThreadContextMenu, useRowMenu } from '@/components/inbox/ThreadContextMenu';
import { WbpClientRows } from '@/components/shared/WbpDots';
import { fmtDate, fmtTime } from '@/lib/format';
import { age, SOURCE_TONE } from './inboxBits';

export type ActionsFor = (r: ConversationWithRefs) => { tag: (t: ConvTag, on: boolean) => void; pin: (on: boolean) => void; move: (l: ConvLane | null) => void; archive: () => void; unarchive: () => void };
// Threading by anchor (grouped view): request / job / estimate number becomes the group header
const groupRows = (rows: ConversationWithRefs[]) => { const m = new Map<string, { key: string; label: string; rows: ConversationWithRefs[] }>(); rows.forEach((r) => { const key = r.anchor ? `${r.anchor.kind}-${r.anchor.id}` : 'general'; const label = r.anchor ? `${r.anchor.kind} · ${r.anchorLabel ?? r.anchor.id}` : 'General · no request / job'; (m.get(key) ?? m.set(key, { key, label, rows: [] }).get(key)!).rows.push(r); }); return [...m.values()].sort((a, b) => (a.key === 'general' ? 1 : b.key === 'general' ? -1 : b.rows.length - a.rows.length)); };

// The list: pinned on top (pin icon) → rows; in All, Quoted / Answered sit as sections beneath the live rows. Row = colored when the CLIENT spoke last. Hover → one-click Archive. Right-click → menu.
// No numbered badges (MH 2026-10-02): unread = bold subject + the rose accent bar; attachments = paperclip + n at the end of the meta line; the only circles are the W·B·P dots and the 6px tag dots.
export const ThreadList = ({ rows, grouped, lane, threadId, onOpen, actionsFor, flat }: { rows: ConversationWithRefs[]; grouped: boolean; lane: InboxFilter['lane']; threadId?: string; onOpen: (id: string) => void; actionsFor: ActionsFor; flat?: boolean }) => {
  const { menu, close, rowProps } = useRowMenu(); const menuRow = menu ? rows.find((r) => r.id === menu.id) : undefined;
  const Row = ({ r }: { r: ConversationWithRefs }) => <li data-testid={`thread-item-${r.id}`} className="group relative" {...rowProps(r.id)}>
    <button type="button" data-testid={`thread-row-${r.id}`} data-client-last={r.needsReply || undefined} data-pinned={r.pinned || undefined} data-lane={r.lane} data-unread={r.unread > 0 || undefined} onClick={() => onOpen(r.id)} className={clsx('w-full rounded-md border p-2 text-left text-xs transition-colors', threadId === r.id ? 'border-ink' : 'border-line', r.needsReply ? 'border-l-[3px] border-l-rose-400 bg-rose-50/70 hover:bg-rose-50' : 'bg-surface hover:bg-canvas/60', r.status === 'closed' && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 text-ink">{r.pinned && <Pin size={11} data-testid={`thread-pin-${r.id}`} className="shrink-0 text-ink-500" />}<span className={clsx('truncate', r.unread > 0 ? 'font-semibold' : 'font-medium')}>{r.client.firstName} {r.client.lastName}</span><TagDots tags={r.tags} testId={`thread-tags-${r.id}`} /></span><span className="shrink-0 text-[10px] text-ink-400">{r.needsReply ? <span data-testid={`thread-age-${r.id}`} className="font-semibold text-rose-700">reply owed · {age(r.ageHours)}</span> : r.status === 'snoozed' ? `snoozed → ${fmtDate(r.snoozedUntil!)}` : r.status === 'closed' ? 'archived' : r.lane ?? 'we spoke last'}</span></div>
      <div data-testid={`thread-subject-${r.id}`} className={clsx('truncate', r.unread > 0 ? 'font-semibold text-ink' : 'text-ink-700')}>{r.subject}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-ink-400"><WbpClientRows clientId={r.clientId} currentJobId={r.anchor?.kind === 'job' ? r.anchor.id : undefined} compact testId={`thread-wbp-row-${r.id}`} />{r.anchorLabel && <span className="rounded bg-canvas px-1 font-mono">{r.anchorLabel}</span>}{r.linkedEstimate && r.anchor?.kind !== 'estimate' && <span className="rounded bg-canvas px-1 font-mono">Estimate {r.linkedEstimate.number}</span>}{r.last?.component && <span data-testid={`thread-row-component-${r.id}`} className="rounded bg-sky-600 px-1 font-semibold text-white">{r.last.ask ? 'ask · ' : ''}{api.PART_LABELS[r.last.component].toLowerCase()}</span>}{r.last && <span className={`rounded px-1 ${SOURCE_TONE[r.last.source]}`}>{r.last.source}</span>}{r.last && <span>· {r.last.direction === 'in' ? r.client.firstName : r.last.by} spoke last</span>}{r.attachments > 0 && <span data-testid={`thread-attachments-${r.id}`} data-count={r.attachments} title={`${r.attachments} attachment${r.attachments === 1 ? '' : 's'}`} className="ml-auto inline-flex items-center gap-0.5 text-ink-500"><Paperclip size={10} /> {r.attachments}</span>}</div>
    </button>
    {r.status !== 'closed' ? <button type="button" data-testid={`thread-archive-${r.id}`} title="Archive — leaves All immediately" onClick={(e) => { e.stopPropagation(); actionsFor(r).archive(); }} className="absolute right-1.5 top-7 rounded-sm border border-line bg-surface p-1 text-ink-500 opacity-0 shadow-sm transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"><Archive size={12} /></button>
      : <button type="button" data-testid={`thread-unarchive-${r.id}`} title="Un-archive → All" onClick={(e) => { e.stopPropagation(); actionsFor(r).unarchive(); }} className="absolute right-1.5 top-7 rounded-sm border border-line bg-surface p-1 text-ink-500 opacity-0 shadow-sm transition-opacity hover:bg-canvas hover:text-ink focus:opacity-100 group-hover:opacity-100"><ArchiveRestore size={12} /></button>}
  </li>;
  const Sec = ({ label, testId, list }: { label: string; testId: string; list: ConversationWithRefs[] }) => (list.length ? <li data-testid={testId} data-count={list.length}><div className="mt-1 flex items-center justify-between rounded-sm bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><span>{label}</span><span className="font-mono">{list.length}</span></div><ul className="mt-1 space-y-1">{list.map((r) => <Row key={r.id} r={r} />)}</ul></li> : null);
  const pinned = rows.filter((r) => r.pinned); const rest = rows.filter((r) => !r.pinned);
  const sections = flat ? [{ label: '', testId: 'inbox-sec-live', list: rest }] : !lane ? [{ label: 'Inbox', testId: 'inbox-sec-live', list: rest.filter((r) => !r.lane) }, { label: 'Quoted', testId: 'inbox-sec-quoted', list: rest.filter((r) => r.lane === 'quoted') }, { label: 'Answered', testId: 'inbox-sec-answered', list: rest.filter((r) => r.lane === 'answered') }] : [{ label: lane, testId: `inbox-sec-${lane}`, list: rest }];
  return <>
    <ul data-testid="inbox-list" className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
      {pinned.length > 0 && <Sec label="Pinned" testId="inbox-sec-pinned" list={pinned} />}
      {grouped ? groupRows(rest).map((g) => <li key={g.key} data-testid={`inbox-group-${g.key}`}><div className="flex items-center justify-between rounded-sm bg-canvas px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"><span>{g.label}</span><span data-testid={`inbox-group-count-${g.key}`} className="font-mono">{g.rows.length}</span></div><ul className="mt-1 space-y-1 pl-2">{g.rows.map((r) => <Row key={r.id} r={r} />)}</ul></li>)
        : sections.map((s) => ((flat || (!lane && s.testId === 'inbox-sec-live')) && !pinned.length ? <li key={s.testId} data-testid={s.testId} data-count={s.list.length}><ul className="space-y-1">{s.list.map((r) => <Row key={r.id} r={r} />)}</ul></li> : <Sec key={s.testId} {...s} />))}
      {!rows.length && <li className="px-2 py-6 text-center text-xs text-ink-400">Nothing here</li>}
    </ul>
    {menu && menuRow && <ThreadContextMenu pos={menu.pos} conv={menuRow} actions={actionsFor(menuRow)} onClose={close} />}
  </>;
};

// SENT folder — every outbound client message in this division, newest first; click → the thread it belongs to
export const SentThreadList = ({ rows, threadId, onOpen }: { rows: InboxSentRow[]; threadId?: string; onOpen: (id: string) => void }) => (
  <ul data-testid="inbox-sent-list" data-count={rows.length} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
    {rows.map((s) => <li key={s.message.id}><button type="button" data-testid={`sent-row-${s.message.id}`} onClick={() => onOpen(s.conversation.id)} className={clsx('w-full rounded-md border bg-surface p-2 text-left text-xs hover:bg-canvas/60', threadId === s.conversation.id ? 'border-ink' : 'border-line')}>
      <div className="flex items-center justify-between gap-2"><span className="truncate font-medium text-ink">To {s.conversation.client.firstName} {s.conversation.client.lastName}</span><span className="shrink-0 text-[10px] text-ink-400">{fmtDate(s.message.at)} {fmtTime(s.message.at)}</span></div>
      <div className="truncate text-ink-700">{s.conversation.subject}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-400"><span className={`rounded px-1 ${SOURCE_TONE[s.message.source]}`}>{s.message.source}</span><span>· {s.message.by}</span>{s.message.emailId && <Link to="/intake/sent" onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">Outbox</Link>}<span className="ml-auto truncate">{s.message.text.slice(0, 70)}</span></div>
    </button></li>)}
    {!rows.length && <li className="px-2 py-6 text-center text-xs text-ink-400">Nothing sent yet</li>}
  </ul>
);
