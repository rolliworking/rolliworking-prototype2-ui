import clsx from 'clsx';
import { ArrowLeft, Eye, Lock, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import * as api from '@/api/client';
import type { ConversationWithRefs, User } from '@/api/client';
import * as hl from '@/api/hitlist';
import { ThreadList, type ActionsFor } from '@/components/inbox/ThreadList';
import { StatusChip } from '@/components/layout/MessageComposer';
import { MessageText } from '@/components/layout/MessageText';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

// VIEWS (MH only, 2026-10-02): one row per staff member → that person's inbox exactly as they see it — their tag filter over Portal (pinned on top, snoozed marked) + their Team messages.
// Read-only in spirit: MH acts as HIMSELF from inside it (reply / tag / archive are his own actions, logged as MH). Back returns to the list.
interface StaffSummary { user: User; tag?: ReturnType<typeof api.tagOfUser>; open: number; owed: number; unread: number }
const summarise = (rows: ConversationWithRefs[], u: User): StaffSummary => { const tag = api.tagOfUser(u); const mine = tag ? rows.filter((r) => r.tags?.includes(tag) && r.status !== 'closed') : []; return { user: u, tag, open: mine.length, owed: mine.filter((r) => r.needsReply).length, unread: hl.unreadCount(u.id) }; };

export const ViewsSection = ({ viewUser, rows, threadId, onPick, onBack, onOpen, actionsFor, pane }: { viewUser?: User; rows: ConversationWithRefs[]; threadId?: string; onPick: (short: string) => void; onBack: () => void; onOpen: (id: string) => void; actionsFor: ActionsFor; pane: ReactNode }) => {
  // Exit UX (MH 2026-10-02): ✕ Exit view here, Esc anywhere on the page, Portal / Team / Calls tabs leave the view first, browser Back steps thread → list → Views (handled in InboxPage)
  const [all, setAll] = useState<ConversationWithRefs[]>([]);
  useEffect(() => { void api.getInboxThreads({}).then(setAll); }, [rows]);
  if (!viewUser) {
    const staff = hl.staffFolders().map((s) => hl.userBySlug(s.name)).filter((u): u is User => !!u && u.id !== api.OWNER_USER_ID);
    return <section data-testid="inbox-views" className="min-h-0 flex-1 overflow-y-auto rounded-md border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><Eye size={12} /> Views · a staff member’s inbox as they see it · MH only</div>
      <ul className="divide-y divide-line/70">{staff.map((u) => { const s = summarise(all, u); return <li key={u.id}><button type="button" data-testid={`inbox-view-${u.shortName}`} onClick={() => onPick(u.shortName)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-canvas">
        <OwnerChip owner={u.shortName} /><span className="font-semibold text-ink">{u.shortName}</span><span className="text-ink-500">{u.dutyLabel}</span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[10px] tabular-nums text-ink-500">{s.tag ? <><span>{s.open} open</span><span className={clsx(s.owed && 'font-bold text-rose-700')}>{s.owed} reply owed</span></> : <span className="inline-flex items-center gap-1 text-ink-400"><Lock size={9} /> no Portal</span>}<span className={clsx(s.unread && 'font-bold text-ink')}>{s.unread} unread</span></span>
      </button></li>; })}</ul>
    </section>;
  }
  const s = summarise(all, viewUser);
  return <div data-testid="inbox-view-as" data-user={viewUser.shortName} className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-950">
      <button type="button" data-testid="inbox-view-back" onClick={onBack} className="inline-flex items-center gap-1 font-medium hover:underline"><ArrowLeft size={12} /> Views</button><span className="text-amber-700">·</span>
      <span data-testid="inbox-view-title" className="font-semibold">Viewing as {viewUser.shortName}{s.tag ? ` · ${s.open} open · ${s.owed} reply owed` : ' · no Portal access'} · {s.unread} unread message{s.unread === 1 ? '' : 's'}</span>
      <span className="ml-auto text-[10px] text-amber-800">read-only view · anything you do here is logged as you (MH)</span>
      <button type="button" data-testid="inbox-view-exit" onClick={onBack} title="Exit this view (Esc)" className="inline-flex h-6 items-center gap-1 rounded-sm border border-amber-400 bg-surface px-2 text-[11px] font-semibold text-amber-950 hover:bg-amber-100"><X size={12} /> Exit view <kbd className="ml-0.5 rounded-sm border border-amber-300 bg-amber-50 px-1 font-mono text-[9px] font-normal text-amber-800">Esc</kbd></button>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr] gap-3">
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        <div data-testid="inbox-view-portal" className="flex min-h-0 flex-col gap-1"><div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Portal · {s.tag ? `${viewUser.shortName}’s tag` : 'not a comms role'}</div>
          {s.tag ? <ThreadList rows={rows} grouped={false} lane={undefined} threadId={threadId} onOpen={onOpen} actionsFor={actionsFor} /> : <div className="rounded-md border border-line bg-canvas px-3 py-4 text-xs text-ink-500"><Lock size={11} className="mr-1 inline" /> {viewUser.shortName} sees no client threads — only quotes shared into Team.</div>}</div>
        <div data-testid="inbox-view-team" className="rounded-md border border-line bg-surface p-2"><div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">Team · to {viewUser.shortName}</div><TheirMessages user={viewUser} /></div>
      </div>
      {pane}
    </div>
  </div>;
};

// Read-only copy of what the person's bubble shows them (open + done rows, newest first)
const TheirMessages = ({ user }: { user: User }) => {
  const [rows, setRows] = useState<hl.InboxRow[]>([]);
  useEffect(() => { void hl.getInbox(user.id).then(setRows); }, [user.id]);
  return <ul data-testid="inbox-view-messages" data-count={rows.length} className="divide-y divide-line/70">
    {rows.map((r) => <li key={r.id} data-testid={`inbox-view-msg-${r.id}`} data-status={r.status} className={clsx('py-1.5 text-xs', r.status === 'done' && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-400"><OwnerChip owner={r.from} /><span>{fmtDate(r.createdAt)} {fmtTime(r.createdAt)} · {r.station}</span>{r.unread && <span className="font-semibold text-ink">unread</span>}<StatusChip status={r.status} /></div>
      <div className={clsx('mt-0.5 text-[12px] leading-snug', r.unread ? 'font-semibold text-ink' : 'text-ink-700')}>{r.text ? <MessageText text={r.text} /> : 'Photo'}{r.jobNumber && <span className="ml-1 font-mono text-[10px] text-brand">{r.jobNumber}</span>}</div>
    </li>)}
    {!rows.length && <li className="py-3 text-center text-[11px] text-ink-400">Nothing sent to {user.shortName} yet</li>}
  </ul>;
};
