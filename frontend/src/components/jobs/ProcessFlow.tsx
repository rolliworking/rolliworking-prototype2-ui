import { AlertTriangle, Check } from 'lucide-react';
import * as api from '@/api/client';
import type { FlowLine, FlowStage, JobWithRefs } from '@/api/client';
import { fmtDate } from '@/lib/format';

// Process flow — one horizontal line per component. Filled dot = where it is in the process (from status); the custody label at the end
// comes from the custody record, never from status. Disagreement = amber "status/custody mismatch" — a real signal, shown on purpose.
const Dot = ({ s, testId }: { s: FlowStage; testId: string }) => {
  const blocked = s.blocker; const ring = blocked ? (blocked.tone === 'red' ? 'ring-[3px] ring-rose-500' : 'ring-[3px] ring-amber-400') : '';
  const base = s.state === 'done' ? 'bg-ink border-ink text-white' : s.state === 'current' ? 'bg-accent border-accent-700 shadow-[0_0_0_4px_rgba(92,225,255,0.25)]' : 'bg-surface border-ink-300';
  return <span data-testid={testId} data-state={s.state} data-blocked={blocked?.tone} className={`relative z-10 grid h-4 w-4 place-items-center rounded-full border-2 ${s.vendor ? 'border-dashed' : ''} ${base} ${ring}`}>{s.state === 'done' && <Check size={10} strokeWidth={3} />}</span>;
};

const StageCol = ({ s, i, line }: { s: FlowStage; i: number; line: FlowLine }) => (
  <li data-testid={`flow-stage-${line.key}-${s.key}`} className="relative flex min-w-0 flex-1 flex-col items-center">
    {i > 0 && <span aria-hidden className={`absolute right-1/2 top-[7px] w-full ${s.vendor ? `border-t-2 border-dashed ${s.state === 'todo' ? 'border-violet-200' : 'border-violet-500'}` : `h-[2px] ${s.state === 'todo' ? 'bg-line' : 'bg-ink'}`}`} />}
    <Dot s={s} testId={`flow-dot-${line.key}-${s.key}`} />
    <span className={`mt-1.5 max-w-full truncate text-center text-[11px] leading-tight ${s.state === 'current' ? 'font-semibold text-ink' : s.state === 'done' ? 'text-ink-500' : 'text-ink-400'}`}>{s.label}</span>
    {s.vendor && <span className="max-w-full truncate text-center text-[10px] text-violet-700" title={s.vendor}>{s.vendor.replace(/\s*\(.*\)$/, '')}</span>}
    {s.note && <span className="max-w-[130px] text-center text-[10px] leading-tight text-ink-500">{s.note}</span>}
    {s.blocker && <span data-testid={`flow-blocker-${line.key}-${s.key}`} className={`mt-1 max-w-[210px] rounded-sm px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight ${s.blocker.tone === 'red' ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-300' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-300'}`} title={s.blocker.text}>{s.blocker.text}</span>}
  </li>
);

const Custody = ({ line }: { line: FlowLine }) => {
  const c = line.custody;
  return (
    <div data-testid={`flow-custody-${line.key}`} data-source={c.source} data-mismatch={!!line.mismatch} className="min-w-0 border-l border-line pl-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Custody</div>
      <div className={`truncate font-semibold ${c.source === 'derived' ? 'text-ink-500' : 'text-ink'}`} title={c.holder}>{c.holder}</div>
      <div className="truncate text-ink-500" title={c.where}>{c.where}{c.since ? ` · since ${fmtDate(c.since)}` : ''}</div>
      {c.source === 'derived' && <div className="text-[10px] italic text-ink-400">position derived from status — no custody scan yet</div>}
      {line.mismatch && <div data-testid={`flow-mismatch-${line.key}`} className="mt-1 inline-flex items-start gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-900 ring-1 ring-amber-300"><span aria-hidden className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" />status / custody mismatch · {line.mismatch}</div>}
    </div>
  );
};

const LineRow = ({ line, split }: { line: FlowLine; split: boolean }) => (
  <div data-testid={`flow-line-${line.key}`} data-finished={line.finished} className="grid grid-cols-[52px_1fr_230px] items-start gap-3">
    <div className="pt-0.5">
      <span data-testid={`flow-code-${line.key}`} className={`grid h-7 w-7 place-items-center rounded-sm font-mono text-[13px] font-bold ${line.finished ? 'bg-moss text-white' : 'bg-ink text-white'}`} title={line.label}>{line.code}</span>
      <div className="mt-0.5 text-[10px] leading-tight text-ink-500">{line.itemLabel ? <span data-testid={`flow-item-${line.key}`} className="font-mono font-semibold text-ink">{line.itemLabel} </span> : null}{split ? line.label : ''}</div>
    </div>
    <ol className="flex items-start pt-0.5">{line.stages.map((s, i) => <StageCol key={s.key} s={s} i={i} line={line} />)}</ol>
    <Custody line={line} />
  </div>
);

export const ProcessFlow = ({ job }: { job: JobWithRefs }) => {
  const flow = api.jobFlowSync(job);
  const blockers = flow.lines.flatMap((l) => l.stages.filter((s) => s.blocker?.tone === 'red')).length; const mismatches = flow.lines.filter((l) => l.mismatch).length;
  return (
    <div data-testid="process-flow" data-done={flow.done} data-total={flow.total} data-split={flow.split}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span data-testid="flow-fraction" className="rounded-sm bg-canvas px-2 py-0.5 font-semibold tabular text-ink ring-1 ring-line">{flow.done} / {flow.total} component{flow.total === 1 ? '' : 's'} finished</span>
        {blockers > 0 && <span data-testid="flow-blockers" className="inline-flex items-center gap-1 rounded-sm bg-rose-50 px-2 py-0.5 font-semibold text-rose-800 ring-1 ring-rose-300"><span aria-hidden className="inline-block h-2 w-2 rounded-full ring-2 ring-rose-500" />{blockers} blocker{blockers === 1 ? '' : 's'}</span>}
        {mismatches > 0 && <span data-testid="flow-mismatches" className="inline-flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-300"><AlertTriangle size={11} /> {mismatches} status / custody mismatch{mismatches === 1 ? '' : 'es'}</span>}
        <span className="ml-auto inline-flex items-center gap-3 text-[10px] text-ink-400"><span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" /> done</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" /> here now</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-rose-500" /> blocker</span><span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-violet-700" /> vendor leg</span></span>
      </div>
      <div className="space-y-5">{flow.lines.map((l) => <LineRow key={l.key} line={l} split={flow.split} />)}</div>
    </div>
  );
};
