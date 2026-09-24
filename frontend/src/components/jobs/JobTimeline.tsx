import clsx from 'clsx';
import { ArrowRight, Mail, PauseCircle, PlayCircle } from 'lucide-react';
import type { JobWithRefs } from '@/api/client';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtTime } from '@/lib/format';

const ACTION_LABEL: Record<string, string> = { create: 'Created', start_review: 'Review started', request_approval: 'Sent for customer approval', approve: 'Customer approved', approve_direct: 'Marked approved', back_to_review: 'Back to review', start_service: 'Service started', to_testing: 'Sent to testing', qc_pass: 'QC passed', qc_fail: 'QC failed', close: 'Closed', update_status: 'Status updated' };

type Row = { id: string; at: string; by: string; station: string; kind: 'transition' | 'hold' | 'release'; body: React.ReactNode; tone?: string };

export const JobTimeline = ({ job: j }: { job: JobWithRefs }) => {
  const rows: Row[] = [
    ...j.timeline.map((t) => ({
      id: t.id, at: t.at, by: t.by, station: t.station, kind: 'transition' as const,
      tone: t.action === 'qc_fail' || t.action === 'back_to_review' ? 'text-rose-700' : undefined,
      body: (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{ACTION_LABEL[t.action] ?? t.action}</span>
          {t.from && <><StatusPill status={t.from} /><ArrowRight size={10} className="text-ink-400" /></>}<StatusPill status={t.to} />
          {t.reason && <span className="text-ink-500">— {t.reason}</span>}
          {t.emailQueued && <span className="inline-flex items-center gap-0.5 text-[10px] text-brand" title="Client email queued to Outbox"><Mail size={10} /> emailed</span>}
        </span>
      ),
    })),
    ...j.holds.flatMap((h) => {
      const out: Row[] = [{ id: `${h.id}-p`, at: h.placedAt, by: h.placedBy, station: h.station, kind: 'hold', tone: 'text-rose-700', body: <span className="inline-flex flex-wrap items-center gap-1.5"><PauseCircle size={11} /><span className="font-medium">{h.type === 'parts' ? 'Parts hold' : 'Outsource hold'} placed</span><span className="text-ink-500">— {h.reason}</span><span className="text-ink-400">(parked from {h.priorStatus.replace(/_/g, ' ')})</span></span> }];
      if (h.releasedAt) out.push({ id: `${h.id}-r`, at: h.releasedAt, by: h.releasedBy ?? '', station: h.station, kind: 'release', tone: 'text-moss-700', body: <span className="inline-flex flex-wrap items-center gap-1.5"><PlayCircle size={11} /><span className="font-medium">Hold released</span><ArrowRight size={10} className="text-ink-400" /><StatusPill status={h.priorStatus} />{h.releaseNote && <span className="text-ink-500">— {h.releaseNote}</span>}</span> });
      return out;
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <ol data-testid="job-timeline" className="relative ml-1.5 border-l border-line">
      {rows.map((r, i) => (
        <li key={r.id} data-testid={`timeline-${r.kind}-${r.id}`} className="relative pl-4 pb-3 last:pb-0">
          <span className={clsx('absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface', i === 0 ? 'bg-ink' : r.kind === 'hold' ? 'bg-rose-400' : 'bg-ink-300')} />
          <div className={clsx('text-xs text-ink', r.tone)}>{r.body}</div>
          <div className="mt-0.5 text-[11px] text-ink-400">{fmtDate(r.at)} {fmtTime(r.at)} · {r.by} · {r.station}</div>
        </li>
      ))}
    </ol>
  );
};
