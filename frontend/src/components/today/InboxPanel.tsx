import { Camera, Check, CheckCheck, Hand, Image as ImageIcon, Inbox, Mail, MailOpen, Reply, X } from 'lucide-react';
import { StatusChip } from '@/components/layout/MessageComposer';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import type { User } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

// Messages and photos other staff sent to this person (or one of their roles) — newest first, read/unread, photo → lightbox, message → linked job
export const InboxPanel = ({ me, items, onChange, jobBase = '/jobs' }: { me: User; items: InboxRow[]; onChange: () => void; jobBase?: string }) => {
  const [open, setOpen] = useState<InboxRow | null>(null); const [replying, setReplying] = useState<string | null>(null); const [reply, setReply] = useState('');
  const unread = items.filter((i) => i.unread).length;
  const toggle = async (i: InboxRow) => { await hl.markInboxRead(i.id, me.shortName, i.unread); onChange(); };
  const sendReply = async (i: InboxRow) => { await hl.replyToInbox(i.id, reply); setReply(''); setReplying(null); if (i.unread) await hl.markInboxRead(i.id, me.shortName, true); onChange(); };
  return <Card title={<span className="inline-flex items-center gap-2">Inbox {unread > 0 && <span data-testid="inbox-unread-count" className="rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">{unread}</span>}</span>} subtitle="Messages and photos sent to you — tap a photo to view full-size, a message opens the linked job" testId="hitlist-inbox-card" bodyClassName="p-0" className="border-l-[3px] border-sky-500">
    <ul data-testid="inbox-list" className="divide-y divide-line/70">
      {items.map((i) => <li key={i.id} data-testid={`inbox-${i.id}`} data-unread={i.unread} className={`flex items-start gap-3 px-4 py-2.5 ${i.unread ? 'bg-sky-50/40' : ''} ${i.status === 'done' ? 'opacity-60' : ''}`} data-status={i.status}>
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.unread ? 'bg-sky-600' : 'bg-transparent ring-1 ring-line'}`} aria-label={i.unread ? 'unread' : 'read'} />
        {i.photo ? <button type="button" data-testid={`inbox-photo-${i.id}`} onClick={() => { setOpen(i); if (i.unread) void toggle(i); }} className="relative shrink-0"><img src={i.photo.dataUrl} alt="" className="h-14 w-20 rounded-sm object-cover ring-1 ring-line" /><span className="absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 rounded-sm bg-ink/70 px-1 text-[9px] font-medium uppercase text-white"><Camera size={9} /> photo</span></button> : <span className="grid h-14 w-20 shrink-0 place-items-center rounded-sm bg-canvas text-ink-300"><Mail size={16} /></span>}
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] ${i.unread ? 'font-semibold text-ink' : 'text-ink-700'}`} data-testid={`inbox-text-${i.id}`}>{i.text ?? (i.photo ? 'Photo' : '')}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">from <OwnerChip owner={i.from} /><span>{i.station} · {fmtDate(i.createdAt)} {fmtTime(i.createdAt)}</span>{i.to.type === 'role' && <span className="rounded-sm bg-canvas px-1 font-mono text-[10px]">#{i.to.role}{i.claimedBy ? ` · claimed by ${i.claimedBy}` : ' · unclaimed'}</span>}{i.to.type === 'station' && <span data-testid={`inbox-station-${i.id}`} className="rounded-sm bg-canvas px-1 text-[10px]">to this station</span>}<StatusChip status={i.status} />
            {i.jobId && <Link to={`${jobBase}/${i.jobId}`} data-testid={`inbox-job-${i.id}`} onClick={() => { if (i.unread) void toggle(i); }} className="font-mono font-semibold text-brand hover:underline">{i.jobNumber}</Link>}{i.jobLabel && <span className="truncate">{i.jobLabel}</span>}{i.replyToId && <span data-testid={`inbox-reply-tag-${i.id}`} className="rounded-sm bg-moss-50 px-1 font-semibold text-moss-700">reply</span>}
            {i.from !== me.shortName && <button type="button" data-testid={`inbox-reply-${i.id}`} onClick={() => { setReplying(replying === i.id ? null : i.id); setReply(''); }} className="inline-flex items-center gap-1 font-medium text-brand hover:underline"><Reply size={11} /> Reply</button>}</div>
          {replying === i.id && <div data-testid={`inbox-reply-form-${i.id}`} className="mt-1.5 flex items-center gap-1.5"><input autoFocus data-testid={`inbox-reply-input-${i.id}`} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && reply.trim()) void sendReply(i); }} placeholder={`Reply to ${i.from} — lands on their hitlist / bench iPad`} className="h-8 flex-1 rounded-sm border border-line bg-canvas px-2 text-xs focus:border-ink focus:outline-none" /><button type="button" data-testid={`inbox-reply-send-${i.id}`} disabled={!reply.trim()} onClick={() => void sendReply(i)} className="h-8 rounded-sm bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40">Send</button></div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {i.claimable && <button type="button" data-testid={`inbox-claim-${i.id}`} onClick={async () => { await hl.claimMessage(i.id, me.shortName); onChange(); }} className="inline-flex h-6 items-center gap-1 rounded-sm bg-amber-500 px-1.5 text-[11px] font-semibold text-white"><Hand size={11} /> Claim</button>}
          {i.status !== 'done' ? <button type="button" data-testid={`inbox-done-${i.id}`} onClick={async () => { await hl.markMessageDone(i.id, me.shortName); onChange(); }} className="inline-flex h-6 items-center gap-1 rounded-sm bg-ink px-1.5 text-[11px] font-semibold text-white"><CheckCheck size={11} /> Done</button>
            : <button type="button" data-testid={`inbox-undone-${i.id}`} onClick={async () => { await hl.markMessageDone(i.id, me.shortName, false); onChange(); }} className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-500 hover:bg-surface">Reopen</button>}
        <button type="button" data-testid={`inbox-toggle-${i.id}`} onClick={() => void toggle(i)} title={i.unread ? 'Mark read' : 'Mark unread'} className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-[11px] text-ink-500 hover:bg-surface hover:text-ink">{i.unread ? <><Check size={11} /> Read</> : <><MailOpen size={11} /> Unread</>}</button>
        </div>
      </li>)}
      {!items.length && <li data-testid="inbox-empty" className="flex items-center gap-2 px-4 py-4 text-xs text-ink-400"><Inbox size={13} /> Nothing sent to you yet.</li>}
    </ul>
    {open?.photo && <div data-testid="inbox-lightbox" className="fixed inset-0 z-[80] grid place-items-center bg-ink/90 p-8" onClick={() => setOpen(null)}>
      <button data-testid="inbox-lightbox-close" onClick={() => setOpen(null)} className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X size={16} /></button>
      <img src={open.photo.dataUrl} alt="" className="max-h-[80vh] max-w-[90vw] rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="mt-3 flex items-center gap-2 text-xs text-white/80"><ImageIcon size={12} /> from {open.from} · {fmtDate(open.createdAt)} {fmtTime(open.createdAt)}{open.jobNumber && <> · <span className="font-mono">{open.jobNumber}</span></>}{open.text && <> · {open.text}</>}</div>
    </div>}
  </Card>;
};
