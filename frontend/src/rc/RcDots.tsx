import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PortalDot, PortalDotRow, PortalDotState } from '@/api/client';

// Client-facing W·B·P — same three positions as the staff dots, client words only. Red tap: approval → the approval page · anything else → "Ask about this" (pre-addressed portal message).
const DOT: Record<PortalDotState, string> = { none: 'border border-rc-line bg-transparent', moving: 'bg-emerald-600', stuck: 'bg-rose-600 ring-2 ring-rose-200', done: 'bg-sky-600' };
const LEGEND: { state: PortalDotState; title: string; text: string }[] = [
  { state: 'none', title: 'Empty ring', text: 'not part of this service' },
  { state: 'moving', title: 'Green', text: 'moving — in progress, on track' },
  { state: 'stuck', title: 'Red', text: 'not moving — something is holding this part up (tap to ask us)' },
  { state: 'done', title: 'Blue', text: 'done, ready for pickup' },
];
const SEEN_KEY = 'rollisuite.rc.dotsLegendSeen';

export const askPath = (row: PortalDotRow, d: PortalDot) => `/rc/messages?watch=${row.watchId}&job=${row.jobId}&component=${d.leg}`;

export const RcDots = ({ row, size = 'md', testId }: { row: PortalDotRow; size?: 'md' | 'lg'; testId?: string }) => {
  const nav = useNavigate(); const [hint, setHint] = useState<PortalDot | null>(null);
  const id = testId ?? `rc-dots-${row.jobId}`; const dot = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'; const letter = size === 'lg' ? 'text-xs' : 'text-[10px]';
  const tap = (e: React.MouseEvent, d: PortalDot) => {
    e.preventDefault(); e.stopPropagation();
    if (d.action?.kind === 'approve') { nav(d.action.path); return; }
    if (d.action?.kind === 'ask') { nav(askPath(row, d)); return; }
    setHint(hint?.leg === d.leg ? null : d);
  };
  return <span data-testid={id} data-job={row.jobId} className="relative inline-flex flex-wrap items-center gap-3">
    {row.dots.map((d) => <button key={d.leg} type="button" data-testid={`${id}-${d.leg}`} data-state={d.state} data-action={d.action?.kind} onClick={(e) => tap(e, d)} title={`${d.label} — ${d.text}`} className="inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 hover:bg-rc-accentSoft">
      <span className={clsx('font-medium text-rc-muted', letter)}>{d.leg}</span><span aria-hidden className={clsx('inline-block rounded-full', dot, DOT[d.state])} />
      {d.action?.kind === 'ask' && <span data-testid={`${id}-${d.leg}-ask`} className="text-xs text-rose-700 underline decoration-rose-300 underline-offset-2">Ask about this</span>}
      {d.action?.kind === 'approve' && <span data-testid={`${id}-${d.leg}-approve`} className="text-xs text-rc-accent underline decoration-rc-accent/50 underline-offset-2">{d.action.label}</span>}
    </button>)}
    {hint && <span data-testid={`${id}-hint`} className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-rc-line bg-rc-paper px-3 py-1.5 text-xs text-rc-ink shadow-sm">{hint.label} — {hint.text}</span>}
  </span>;
};

// Legend: open the first time a client sees the dots, then tucked under "what do these mean?"
export const RcDotsLegend = ({ testId = 'rc-dots-legend' }: { testId?: string }) => {
  const [open, setOpen] = useState(() => localStorage.getItem(SEEN_KEY) !== '1');
  const dismiss = () => { localStorage.setItem(SEEN_KEY, '1'); setOpen(false); };
  if (!open) return <button type="button" data-testid={`${testId}-toggle`} onClick={() => setOpen(true)} className="text-xs text-rc-muted underline decoration-rc-line underline-offset-4 hover:text-rc-ink">What do these dots mean?</button>;
  return <div data-testid={testId} className="rounded-md border border-rc-line bg-rc-cream/50 px-4 py-3 text-sm">
    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">W · B · P — watch · bracelet · case / polish</div>
    <ul className="grid gap-1 sm:grid-cols-2">{LEGEND.map((l) => <li key={l.state} data-testid={`${testId}-${l.state}`} className="flex items-center gap-2 text-rc-ink"><span aria-hidden className={clsx('inline-block h-3 w-3 rounded-full', DOT[l.state])} /><span><b className="font-medium">{l.title}</b> = {l.text}</span></li>)}</ul>
    <button type="button" data-testid={`${testId}-dismiss`} onClick={dismiss} className="mt-2 text-xs text-rc-accent underline underline-offset-4">Got it</button>
  </div>;
};
