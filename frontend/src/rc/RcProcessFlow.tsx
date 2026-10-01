import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { PortalFlowLine } from '@/api/client';
import { rcDate } from '@/rc/RcBits';

// Client-safe process line per component — Received · In queue · In progress · Quality check · Ready — with the projected date. No internal stages, no custody.
const Line = ({ l, testId }: { l: PortalFlowLine; testId: string }) => <li data-testid={testId} data-stuck={l.stuck} data-done={l.done} className="grid grid-cols-[96px_1fr] items-start gap-4 sm:grid-cols-[120px_1fr]">
  <div className="pt-0.5 text-[15px] font-medium text-rc-ink">{l.label}{l.stuck && <span data-testid={`${testId}-stuck`} className="ml-2 inline-block h-2 w-2 rounded-full bg-rose-600 align-middle" />}</div>
  <ol className="flex items-start">{l.stops.map((s, i) => <li key={s.key} data-testid={`${testId}-${s.key}`} data-state={s.state} className="relative flex min-w-0 flex-1 flex-col items-center">
    {i > 0 && <span aria-hidden className={clsx('absolute right-1/2 top-[7px] h-px w-full', s.state === 'todo' ? 'bg-rc-line' : 'bg-rc-ink')} />}
    <span className={clsx('relative z-10 grid h-4 w-4 place-items-center rounded-full border', s.state === 'done' ? 'border-rc-ink bg-rc-ink text-rc-cream' : s.state === 'current' ? (l.stuck ? 'border-rose-600 bg-rose-600 ring-4 ring-rose-100' : 'border-rc-accent bg-rc-accent ring-4 ring-rc-accentSoft') : 'border-rc-line bg-rc-paper')}>{s.state === 'done' && <Check size={10} strokeWidth={3} />}</span>
    <span className={clsx('mt-1.5 max-w-full truncate text-center text-[11px] leading-tight', s.state === 'current' ? 'font-medium text-rc-ink' : 'text-rc-muted')}>{s.label}</span>
  </li>)}</ol>
</li>;

export const RcProcessFlow = ({ flow, testId = 'rc-flow' }: { flow: PortalFlowLine[]; testId?: string }) => {
  const projected = flow.find((l) => l.projected)?.projected; const allDone = flow.every((l) => l.done);
  return <div data-testid={testId} className="rounded-lg border border-rc-line bg-rc-paper px-6 py-5">
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Where each part is in the process</div>{projected && !allDone && <div data-testid={`${testId}-projected`} className="text-sm text-rc-muted">Projected ready <span className="text-rc-ink">{rcDate(projected)}</span></div>}</div>
    <ul className="space-y-5">{flow.map((l) => <Line key={l.key} l={l} testId={`${testId}-${l.key}`} />)}</ul>
  </div>;
};
