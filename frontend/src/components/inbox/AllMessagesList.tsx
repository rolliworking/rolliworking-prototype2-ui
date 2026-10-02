import clsx from 'clsx';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as hl from '@/api/hitlist';
import { StatusChip } from '@/components/layout/MessageComposer';
import { MessageText } from '@/components/layout/MessageText';
import { OwnerChip } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

// Super-admin list (MH): read-only rows — from → to · status · when · station · job · text · photo
export const AllMessagesList = ({ staff, tick, rows: given, dark }: { staff?: string; tick: number; rows?: hl.AllMessageRow[]; dark?: boolean }) => {
  const rows = useMemo(() => given ?? hl.allMessagesSync(staff), [staff, tick, given]); // eslint-disable-line react-hooks/exhaustive-deps
  const muted = dark ? 'text-slate-400' : 'text-ink-400';
  return <ul data-testid="internal-all-list" data-count={rows.length} className={`divide-y ${dark ? 'divide-white/10' : 'divide-line/70'}`}>
    {rows.map((r) => <li key={r.id} data-testid={`internal-msg-${r.id}`} data-status={r.status} className={clsx('flex gap-2 py-2 text-xs', r.status === 'done' && 'opacity-60')}>
      {r.photo && <img src={r.photo.dataUrl} alt="" className={`h-12 w-16 shrink-0 rounded-sm object-cover ring-1 ${dark ? 'ring-white/20' : 'ring-line'}`} />}
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-x-1.5 text-[10px] ${muted}`}><OwnerChip owner={r.from} /><span>→</span><b className={dark ? 'text-slate-200' : 'text-ink-700'}>{r.toLabel}</b><span>· {fmtDate(r.createdAt)} {fmtTime(r.createdAt)} · {r.station}</span>{r.replyToId && <span className={dark ? 'text-emerald-300' : 'text-moss-700'}>reply</span>}{r.doneBy && <span>· done by {r.doneBy}</span>}</div>
        <div className={`mt-0.5 text-[13px] leading-snug ${dark ? 'text-slate-100' : 'text-ink-800'}`}>{r.text ? <MessageText text={r.text} dark={dark} /> : 'Photo'}</div>
        <div className="mt-1 flex items-center gap-1.5">{r.jobId && <Link to={`/jobs/${r.jobId}`} data-testid={`internal-msg-job-${r.id}`} className={`font-mono text-[11px] font-semibold hover:underline ${dark ? 'text-accent' : 'text-brand'}`}>{r.jobNumber}</Link>}{r.jobLabel && <span className={`text-[10px] ${muted}`}>{r.jobLabel}</span>}<StatusChip status={r.status} dark={dark} /></div>
      </div>
    </li>)}
    {!rows.length && <li className={`py-6 text-center text-xs ${muted}`}>No messages in this folder</li>}
  </ul>;
};
