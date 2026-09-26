import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as api from '@/api/client';
import type { JobWithRefs, MessageInboxRow } from '@/api/client';
import { MentionText, MessagesPanel } from '@/components/jobs/JobMessages';
import { Sheet } from '@/components/rw/pad/PadBits';
import { fmtDate, fmtTime } from '@/lib/format';

// Bench-tier routing target: threads I'm mentioned in (or re-notified on), newest first, unread bold. Read state is per person.
export const BenchMessagesSection = ({ rows, onOpen }: { rows: MessageInboxRow[]; onOpen: (r: MessageInboxRow) => void }) => (
  <ul data-testid="bench-messages-list" className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03]">
    {rows.map((r) => <li key={r.thread.root.id}><button data-testid={`bench-msg-row-${r.thread.root.id}`} onClick={() => onOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.04]">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.unread ? 'bg-amber-400' : 'bg-transparent'}`} />
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-2 text-sm ${r.unread ? 'font-bold text-slate-100' : 'text-slate-300'}`}><span className="font-mono">{r.job.number}</span><span>{r.job.watch.brand} {r.job.watch.model}</span><span className="ml-auto text-xs font-normal text-slate-500">{fmtDate(r.latest.at)} {fmtTime(r.latest.at)}</span></div>
        <div data-testid={`bench-msg-preview-${r.thread.root.id}`} className={`mt-0.5 truncate text-sm ${r.unread ? 'font-semibold text-slate-100' : 'text-slate-400'}`}><span className="text-slate-500">{r.latest.by}:</span> <MentionText text={r.latest.text} /></div>
        {r.thread.replies.length > 0 && <div className="mt-0.5 text-xs text-slate-500">{r.thread.replies.length} repl{r.thread.replies.length === 1 ? 'y' : 'ies'} · {r.thread.participants.join(', ')}</div>}
      </div>
    </button></li>)}
    {!rows.length && <li className="px-4 py-4 text-sm text-slate-500">No one has mentioned you on a job yet.</li>}
  </ul>
);

// Job thread sheet — opens the job's message board at the thread (marks it read for me)
export const BenchThreadSheet = ({ job, rootId, onClose, onChanged }: { job: JobWithRefs; rootId?: string; onClose: () => void; onChanged: () => void }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => { if (rootId) window.history.replaceState(null, '', `#msg-${rootId}`); (rootId ? api.markJobThreadRead(rootId) : Promise.resolve()).then(() => { setReady(true); onChanged(); }); return () => { if (window.location.hash.startsWith('#msg-')) window.history.replaceState(null, '', window.location.pathname); }; }, [rootId]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet testId="bench-thread-sheet" wide title={<span className="inline-flex items-center gap-2"><MessageSquare size={22} className="text-amber-400" /> {job.number} · messages</span>} sub={<>{job.watch.brand} {job.watch.model} · {job.watch.reference} · internal only</>} onClose={onClose}>
    {ready && <MessagesPanel job={job} dark onChanged={onChanged} />}
  </Sheet>;
};
