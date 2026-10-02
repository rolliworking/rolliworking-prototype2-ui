import clsx from 'clsx';
import { Archive, CheckCheck, ClipboardList, Inbox, Lock, Phone, Pin, Quote, Reply, Send, User as UserIcon, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as api from '@/api/client';
import type { ConvTag } from '@/api/client';
import * as calls from '@/api/calls';
import * as hl from '@/api/hitlist';
import type { User } from '@/api/client';
import { FOLDER_LABEL, type FolderKey } from './inboxFolders';

type Counts = Awaited<ReturnType<typeof api.getInboxThreadCounts>>;
type Icon = LucideIcon;
// Dot = the 6px tag colour (person / status folders); counts are plain numbers — no circles (MH 2026-10-02)
const TagDot = ({ tag }: { tag: ConvTag }) => <span className={clsx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', api.CONV_TAGS.find((t) => t.key === tag)!.dot)} />;

const Row = ({ k, label, icon: Ic, tag, count, strong, active, disabled, onSelect }: { k: FolderKey; label: string; icon?: Icon; tag?: ConvTag; count?: number; strong?: boolean; active: boolean; disabled?: boolean; onSelect: (k: FolderKey) => void }) => (
  <button type="button" data-testid={`inbox-folder-${k}`} aria-selected={active} disabled={disabled} onClick={() => onSelect(k)} className={clsx('flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left text-xs transition-colors', active ? 'bg-ink font-semibold text-white' : disabled ? 'text-ink-300' : 'text-ink-700 hover:bg-canvas')}>
    <span className="grid w-3.5 shrink-0 place-items-center">{tag ? <TagDot tag={tag} /> : Ic ? <Ic size={13} className={active ? 'text-white/70' : 'text-ink-400'} /> : null}</span>
    <span className="truncate">{label}</span>
    {count !== undefined && count > 0 && <span data-testid={`inbox-folder-count-${k}`} className={clsx('ml-auto font-mono text-[10px] tabular-nums', strong ? (active ? 'font-bold text-white' : 'font-bold text-ink') : active ? 'text-white/70' : 'text-ink-400')}>{count}</span>}
  </button>
);
const Header = ({ children, testId }: { children: string; testId: string }) => <div data-testid={testId} className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 first:pt-0">{children}</div>;

// PORTAL ▸ All · Mike · Vienna · Chyna · Update work order · Quoted · Answered · Pinned · Calls · Sent · Archive
// INTERNAL ▸ All (to me) · Sent · Archive (done) · MH only: Everyone + one read-only folder per staff name
export const InboxTree = ({ folder, onSelect, comms, me, counts, pinned, sent }: { folder: FolderKey; onSelect: (k: FolderKey) => void; comms: boolean; me: User; counts: Counts | null; pinned: number; sent: number }) => {
  const owner = api.isOwnerSync(); const missed = calls.openMissedCountSync(); const unread = hl.unreadCount(me.id);
  const P = (k: FolderKey, label: string, extra: Partial<Parameters<typeof Row>[0]> = {}) => <Row key={k} k={k} label={label} active={folder === k} disabled={!comms} onSelect={onSelect} {...extra} />;
  return <nav data-testid="inbox-tree" aria-label="Inbox folders" className="min-h-0 space-y-px overflow-y-auto rounded-md border border-line bg-surface p-1.5">
    <Header testId="inbox-tree-portal">Portal</Header>
    {!comms && <div data-testid="inbox-tree-portal-locked" className="flex items-center gap-1.5 px-2 pb-1 text-[10px] text-ink-400"><Lock size={10} /> MH · VC · CM only</div>}
    {P('all', FOLDER_LABEL.all, { icon: Inbox, count: counts?.needsReply, strong: true })}
    {P('mike', FOLDER_LABEL.mike, { tag: 'mike', count: counts?.byTag.mike })}
    {P('vienna', FOLDER_LABEL.vienna, { tag: 'vienna', count: counts?.byTag.vienna })}
    {P('chyna', FOLDER_LABEL.chyna, { tag: 'chyna', count: counts?.byTag.chyna })}
    {P('update_wo', FOLDER_LABEL.update_wo, { tag: 'update_wo', count: counts?.byTag.update_wo })}
    {P('quoted', FOLDER_LABEL.quoted, { icon: Quote, count: counts?.quoted })}
    {P('answered', FOLDER_LABEL.answered, { icon: Reply, count: counts?.answered })}
    {P('pinned', FOLDER_LABEL.pinned, { icon: Pin, count: pinned })}
    {P('calls', FOLDER_LABEL.calls, { icon: Phone, count: missed, strong: true })}
    {P('sent', FOLDER_LABEL.sent, { icon: Send, count: sent })}
    {P('archive', FOLDER_LABEL.archive, { icon: Archive, count: counts?.archived })}
    <Header testId="inbox-tree-internal">Internal</Header>
    <Row k="in-all" label={FOLDER_LABEL['in-all']} icon={Inbox} count={unread} strong active={folder === 'in-all'} onSelect={onSelect} />
    <Row k="in-sent" label={FOLDER_LABEL['in-sent']} icon={Send} active={folder === 'in-sent'} onSelect={onSelect} />
    <Row k="in-archive" label={FOLDER_LABEL['in-archive']} icon={CheckCheck} active={folder === 'in-archive'} onSelect={onSelect} />
    {owner && <>
      <div data-testid="inbox-tree-staff" className="flex items-center gap-1 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Users size={10} /> Staff · read-only · MH</div>
      <Row k="in-everyone" label={FOLDER_LABEL['in-everyone']} icon={Users} count={hl.allMessagesSync().length} active={folder === 'in-everyone'} onSelect={onSelect} />
      {hl.staffFolders().map((s) => <Row key={s.name} k={`in-staff-${s.name}`} label={s.name} icon={UserIcon} count={s.count} active={folder === `in-staff-${s.name}`} onSelect={onSelect} />)}
    </>}
    <div className="px-2 pt-2 text-[9px] leading-snug text-ink-300"><ClipboardList size={9} className="mr-0.5 inline" /> Tag folders are views over All — tagging never moves a thread.</div>
  </nav>;
};
