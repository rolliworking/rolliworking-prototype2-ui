import clsx from 'clsx';
import { Camera, CheckCircle2, ClipboardList, Circle } from 'lucide-react';
import { Fragment, useState } from 'react';
import * as api from '@/api/client';
import type { JobWithRefs } from '@/api/client';
import { Provisional } from '@/components/jobs/JobBits';
import { Button } from '@/components/ui/Button';
import { fmtDate, fmtTime } from '@/lib/format';

type Refresh = (fn: () => Promise<unknown>, msg: string) => Promise<void>;

// Review checklist: photos for every kind (mandatory), report only for kinds with inspectionReport (MH ruling)
export const ReviewGate = ({ job: j }: { job: JobWithRefs }) => {
  if (j.status !== 'in_review') return null;
  const cfg = api.JOB_KIND_CONFIG[j.kind];
  const Item = ({ ok, label, testId }: { ok: boolean; label: string; testId: string }) => (
    <span data-testid={testId} data-ok={ok} className={clsx('inline-flex items-center gap-1 text-xs', ok ? 'text-moss-700' : 'text-rose-700')}>{ok ? <CheckCircle2 size={12} /> : <Circle size={12} />} {label}</span>
  );
  return (
    <div data-testid="review-gate" className="flex flex-wrap items-center gap-4 rounded-sm bg-canvas px-3 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Review gate · {cfg.label}</span>
      <Item ok={j.photos.length > 0} label={`Inspection photos (${j.photos.length}) — required for every kind`} testId="gate-photos" />
      {cfg.inspectionReport ? <Item ok={!!j.inspection} label="Inspection report (multiple-choice)" testId="gate-report" /> : <span data-testid="gate-report-skipped" className="inline-flex items-center gap-1 text-xs text-ink-500"><ClipboardList size={12} /> No inspection report for {cfg.label} — MH ruling</span>}
    </div>
  );
};

export const InspectionPanel = ({ job: j, run }: { job: JobWithRefs; run: Refresh }) => {
  const cfg = api.JOB_KIND_CONFIG[j.kind];
  const [answers, setAnswers] = useState<Record<string, string>>(j.inspection?.answers ?? {});
  const editable = j.status === 'in_review' && cfg.inspectionReport;

  if (!cfg.inspectionReport) {
    return <p data-testid="inspection-none" className="inline-flex items-center gap-1.5 text-xs text-ink-500"><Camera size={12} /> {cfg.label} jobs skip the inspection report step; inspection photos stay mandatory (attach them in Photos below).</p>;
  }
  if (!editable && j.inspection) {
    return (
      <dl data-testid="inspection-summary" className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1 text-xs">
        {api.INSPECTION_QUESTIONS.map((q) => <Fragment key={q.key}><dt className="text-ink-500">{q.label}</dt><dd className="text-ink">{j.inspection!.answers[q.key] ?? '—'}</dd></Fragment>)}
        <dt className="text-ink-500">Recorded</dt><dd className="text-ink-400">{fmtDate(j.inspection.at)} {fmtTime(j.inspection.at)} · {j.inspection.by} · {j.inspection.station}</dd>
      </dl>
    );
  }
  if (!editable) return <p data-testid="inspection-pending" className="text-xs text-ink-400">Report is completed during review.</p>;

  return (
    <div data-testid="inspection-form" className="space-y-2">
      {api.INSPECTION_QUESTIONS.map((q) => (
        <div key={q.key} className="grid grid-cols-[130px_1fr] items-center gap-3 text-xs">
          <span className="text-ink-500">{q.label}</span>
          <div className="flex flex-wrap gap-1">
            {q.options.map((o) => <button key={o} type="button" data-testid={`insp-${q.key}-${o.replace(/\s+/g, '-')}`} aria-pressed={answers[q.key] === o} onClick={() => setAnswers({ ...answers, [q.key]: o })} className={clsx('h-7 rounded-sm border px-2 text-xs transition-colors', answers[q.key] === o ? 'border-ink bg-ink text-white' : 'border-line text-ink-700 hover:border-ink-300')}>{o}</button>)}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-ink-400">{j.inspection ? `Saved ${fmtDate(j.inspection.at)} by ${j.inspection.by} — re-save to update` : 'Answer every question, then save'}</span>
        <Button size="sm" variant="primary" data-testid="insp-save" onClick={() => run(() => api.saveInspectionReport(j.id, answers), 'Inspection report saved')}><ClipboardList size={12} /> Save report</Button>
      </div>
      <Provisional note="Question set is a placeholder lookup table — confirm the real inspection form" />
    </div>
  );
};
