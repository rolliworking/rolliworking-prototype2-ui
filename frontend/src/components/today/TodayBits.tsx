import clsx from 'clsx';
import { AlertTriangle, ArrowRight, Check, Clock, Inbox, PauseCircle, Pin, Send, UserCog, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { Task, TodayRow, TodaySource } from '@/api/client';
import { OwnerChip } from '@/components/ui/Pills';
import { dueLabel, fmtDate } from '@/lib/format';

const SOURCE: Record<TodaySource, { label: string; icon: typeof Wrench; tone: string }> = {
  owner: { label: 'Owner action', icon: UserCog, tone: 'bg-amber-50 text-amber-900' },
  assignee: { label: 'Bench', icon: Wrench, tone: 'bg-brand-50 text-brand' },
  hold: { label: 'Hold', icon: PauseCircle, tone: 'bg-rose-50 text-rose-700' },
  discrepancy: { label: 'Discrepancy', icon: Inbox, tone: 'bg-rose-50 text-rose-700' },
  task: { label: 'Task', icon: Check, tone: 'bg-moss-50 text-moss-700' },
};

export const SourcePill = ({ source }: { source: TodaySource }) => {
  const s = SOURCE[source];
  const Icon = s.icon;
  return <span className={clsx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', s.tone)}><Icon size={9} /> {s.label}</span>;
};

export const TodayRowItem = ({ row: r, onDone, onPin, dense }: { row: TodayRow; onDone?: (taskId: string) => void; onPin?: (row: TodayRow) => void; dense?: boolean }) => {
  const href = r.jobId ? `/jobs/${r.jobId}` : r.packageId ? `/intake/inspection/${r.packageId}` : undefined;
  return (
    <li data-testid={`today-row-${r.id}`} className={clsx('group flex items-center gap-3 px-4 transition-colors hover:bg-canvas/70', dense ? 'py-1.5' : 'py-2.5')}>
      {r.source === 'task' && r.taskId && onDone ? (
        <label className="relative flex cursor-pointer items-center">
          <input type="checkbox" data-testid={`today-task-done-${r.taskId}`} onChange={() => onDone(r.taskId!)} className="peer sr-only" aria-label={`Complete "${r.title}"`} />
          <span className="grid h-4 w-4 place-items-center rounded-[3px] border border-ink-300 bg-surface peer-checked:border-moss peer-checked:bg-moss peer-focus-visible:ring-2 peer-focus-visible:ring-moss/40"><Check size={11} strokeWidth={3} className="text-white opacity-0 peer-checked:opacity-100" /></span>
        </label>
      ) : (
        <span className="grid h-4 w-4 place-items-center text-ink-300" title="Derived — opens the record"><ArrowRight size={12} /></span>
      )}
      <SourcePill source={r.source} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[13px] text-ink">
          {href ? <Link to={href} data-testid={`today-open-${r.id}`} className="truncate hover:underline">{r.title}</Link> : <span className="truncate">{r.title}</span>}
          {r.urgent && <AlertTriangle size={11} className="shrink-0 text-rose-600" />}
        </div>
        {!dense && <div className="truncate text-[11px] text-ink-400">{r.detail} · <span className="text-ink-500">{r.via}</span></div>}
      </div>
      {r.sentBy && <span className="inline-flex items-center gap-1 text-[11px] text-ink-400" title={`Sent by ${r.sentBy}`}><Send size={10} /> from <OwnerChip owner={r.sentBy} /></span>}
      {r.dueAt && <span className={clsx('tabular shrink-0 inline-flex items-center gap-1 text-[11px]', r.overdue ? 'font-semibold text-rose-700' : 'text-ink-400')}><Clock size={10} /> {dueLabel(r.dueAt)}</span>}
      {onPin && <button type="button" data-testid={`today-pin-${r.id}`} onClick={() => onPin(r)} title="Add to a hit list" className="rounded-sm p-1 text-ink-300 opacity-0 transition-opacity hover:bg-surface hover:text-amber-700 group-hover:opacity-100 focus:opacity-100"><Pin size={12} /></button>}
    </li>
  );
};

export const WaitingOnList = ({ tasks }: { tasks: Task[] }) => (
  <ul data-testid="waiting-on-list" className="divide-y divide-line/70">
    {tasks.map((t) => (
      <li key={t.id} data-testid={`waiting-on-${t.id}`} className="flex items-center gap-3 px-4 py-2 text-xs">
        <span className="flex-1 truncate text-ink">{t.title}</span>
        <span className="text-ink-400">→ {api.assigneeLabel(t.assignedTo).split(' →')[0]}</span>
        {t.dueAt && <span className={clsx('tabular', new Date(t.dueAt) < new Date() ? 'font-semibold text-rose-700' : 'text-ink-400')}>{fmtDate(t.dueAt)}</span>}
        {t.jobId && <Link to={`/jobs/${t.jobId}`} className="font-mono text-ink-500 hover:underline">job</Link>}
      </li>
    ))}
    {tasks.length === 0 && <li className="px-4 py-2 text-xs text-ink-400">Nothing outstanding that you sent to others.</li>}
  </ul>
);
