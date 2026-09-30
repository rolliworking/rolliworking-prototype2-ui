import clsx from 'clsx';
import { CheckCheck, Hand, Inbox, Reply, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import type { InboxRow } from '@/api/hitlist';
import type { User } from '@/api/client';
import { StatusChip } from './MessageComposer';
import { MessageText } from './MessageText';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtTime } from '@/lib/format';

// INBOX — compact rows for the bubble: unread dot, photo, from · when, text, job chip, status; Claim (role queue) · Done · Reply (= a new message back)
export const MessageInbox = ({ me, dark, pad, tick, onChange, onReply, jobBase }: { me: User; dark?: boolean; pad: boolean; tick: number; onChange: () => void; onReply: (row: InboxRow) => void; jobBase: string }) => {
  const [rows, setRows] = useState<InboxRow[]>([]); const [open, setOpen] = useState<InboxRow | null>(null);
  useEffect(() => { void hl.getInbox(me.id).then(setRows); }, [me.id, tick]);
  const read = async (r: InboxRow) => { if (r.unread) { await hl.markInboxRead(r.id, me.shortName, true); onChange(); } };
  const muted = dark ? 'text-slate-400' : 'text-ink-400'; const btn = pad ? 'min-h-[40px] px-3 text-xs' : 'h-6 px-1.5 text-[11px]';
  return <>
    <ul data-testid="msg-inbox-list" className={`divide-y ${dark ? 'divide-white/10' : 'divide-line/70'}`}>
      {rows.map((r) => <li key={r.id} data-testid={`msg-inbox-${r.id}`} data-unread={r.unread} data-status={r.status} onClick={() => void read(r)} className={clsx('flex gap-2 py-2', r.status === 'done' && 'opacity-60', r.unread && (dark ? 'bg-accent/5' : 'bg-sky-50/50'))}>
        <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.unread ? (dark ? 'bg-accent' : 'bg-sky-600') : 'bg-transparent ring-1 ring-current opacity-30')} aria-label={r.unread ? 'unread' : 'read'} />
        {r.photo && <button type="button" data-testid={`msg-inbox-photo-${r.id}`} onClick={(e) => { e.stopPropagation(); setOpen(r); void read(r); }} className="shrink-0"><img src={r.photo.dataUrl} alt="" className={`h-12 w-16 rounded-sm object-cover ring-1 ${dark ? 'ring-white/20' : 'ring-line'}`} /></button>}
        <div className="min-w-0 flex-1">
          <div className={`flex flex-wrap items-center gap-x-1.5 text-[10px] ${muted}`}><OwnerChip owner={r.from} /><span>{fmtTime(r.createdAt)} · {r.station}</span>{r.to.type === 'role' && <span className="font-mono">#{r.to.role}{r.claimedBy ? ` · ${r.claimedBy}` : ' · unclaimed'}</span>}{r.to.type === 'station' && <span data-testid={`msg-inbox-station-${r.id}`}>to this station</span>}{r.replyToId && <span className={dark ? 'text-emerald-300' : 'text-moss-700'}>reply</span>}</div>
          <div data-testid={`msg-inbox-text-${r.id}`} className={clsx('mt-0.5 text-[13px] leading-snug', r.unread ? (dark ? 'font-semibold text-white' : 'font-semibold text-ink') : dark ? 'text-slate-200' : 'text-ink-700')}>{r.text ? <MessageText text={r.text} pad={pad} dark={dark} /> : r.photo ? 'Photo' : ''}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {r.jobId && <Link to={`${jobBase}/${r.jobId}`} data-testid={`msg-inbox-job-${r.id}`} onClick={(e) => e.stopPropagation()} className={`font-mono text-[11px] font-semibold hover:underline ${dark ? 'text-accent' : 'text-brand'}`}>{r.jobNumber}</Link>}
            <StatusChip status={r.status} dark={dark} />
            <span className="ml-auto flex items-center gap-1">
              {r.claimable && <button type="button" data-testid={`msg-inbox-claim-${r.id}`} onClick={async (e) => { e.stopPropagation(); await hl.claimMessage(r.id, me.shortName); onChange(); }} className={`inline-flex items-center gap-1 rounded-md bg-amber-500 font-semibold text-white ${btn}`}><Hand size={11} /> Claim</button>}
              {r.from !== me.shortName && <button type="button" data-testid={`msg-inbox-reply-${r.id}`} onClick={(e) => { e.stopPropagation(); void read(r); onReply(r); }} className={`inline-flex items-center gap-1 rounded-md font-medium ${btn} ${dark ? 'text-accent hover:bg-white/10' : 'text-brand hover:bg-canvas'}`}><Reply size={11} /> Reply</button>}
              {r.status !== 'done' ? <button type="button" data-testid={`msg-inbox-done-${r.id}`} onClick={async (e) => { e.stopPropagation(); await hl.markMessageDone(r.id, me.shortName); onChange(); }} className={`inline-flex items-center gap-1 rounded-md font-semibold ${btn} ${dark ? 'bg-white/15 text-white' : 'bg-ink text-white'}`}><CheckCheck size={11} /> Done</button>
                : <button type="button" data-testid={`msg-inbox-reopen-${r.id}`} onClick={async (e) => { e.stopPropagation(); await hl.markMessageDone(r.id, me.shortName, false); onChange(); }} className={`rounded-md ${btn} ${muted} hover:opacity-80`}>Reopen</button>}
            </span>
          </div>
        </div>
      </li>)}
      {!rows.length && <li data-testid="msg-inbox-empty" className={`flex items-center gap-2 py-6 text-xs ${muted}`}><Inbox size={13} /> Nothing sent to you yet.</li>}
    </ul>
    {open?.photo && <div data-testid="msg-inbox-lightbox" className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-6" onClick={() => setOpen(null)}>
      <button type="button" data-testid="msg-inbox-lightbox-close" onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X size={16} /></button>
      <img src={open.photo.dataUrl} alt="" className="max-h-[80vh] max-w-[92vw] rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="mt-3 text-xs text-white/80">from {open.from} · {fmtTime(open.createdAt)}{open.jobNumber && <> · <span className="font-mono">{open.jobNumber}</span></>}{open.text && <> · {open.text}</>}</div>
    </div>}
  </>;
};
