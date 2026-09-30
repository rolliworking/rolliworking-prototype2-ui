import clsx from 'clsx';
import * as api from '@/api/client';
import type { WbpRow, WbpState } from '@/api/client';
import { estDigits } from '@/lib/format';

// W·B·P dot row — one glance per job. Empty ring = no such leg · green = on track · blue = that line Finished · red = blocker. Derived in client.ts (wbpRowSync) from the Job page flow.
const DOT: Record<WbpState, string> = { none: 'border border-ink-300 bg-transparent', ok: 'bg-emerald-500', finished: 'bg-sky-500', blocked: 'bg-rose-500 ring-2 ring-rose-200' };
const DOT_DARK: Record<WbpState, string> = { none: 'border border-white/30 bg-transparent', ok: 'bg-emerald-400', finished: 'bg-sky-400', blocked: 'bg-rose-500 ring-2 ring-rose-400/40' };

export const WbpDots = ({ row, outlined, dark, number, size = 'sm', testId }: { row: WbpRow; outlined?: boolean; dark?: boolean; number?: boolean; size?: 'sm' | 'lg'; testId?: string }) => {
  const id = testId ?? `wbp-${row.jobId}`; const dot = size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'; const letter = size === 'lg' ? 'text-[11px]' : 'text-[9px]';
  return <span data-testid={id} data-job={row.jobId} data-outlined={outlined || undefined} title={`${row.jobNumber}${row.watchLabel ? ` · ${row.watchLabel}` : ''}${outlined ? ' · this job' : ''}`} className={clsx('inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 align-middle', outlined && (dark ? 'bg-accent/10 ring-1 ring-accent' : 'bg-canvas ring-1 ring-ink'))}>
    {number && <span data-testid={`${id}-number`} className={clsx('font-mono font-semibold leading-none', letter, dark ? 'text-slate-200' : 'text-ink-700')}>{estDigits(row.jobNumber)}</span>}
    {api.WBP_LEGS.map((l) => { const d = row.legs[l.key]; return <span key={l.key} data-testid={`${id}-${l.key}`} data-state={d.state} title={d.title} className="inline-flex items-center gap-0.5"><span className={clsx('font-mono font-semibold leading-none', letter, dark ? 'text-slate-400' : 'text-ink-500')}>{l.key}</span><span aria-hidden className={clsx('inline-block rounded-full', dot, (dark ? DOT_DARK : DOT)[d.state])} /></span>; })}
  </span>;
};

// Every open job of the client under the name — the job in hand (currentJobId) leads and is outlined
export const WbpClientRows = ({ clientId, currentJobId, compact, dark, max, testId }: { clientId: string; currentJobId?: string; compact?: boolean; dark?: boolean; max?: number; testId?: string }) => {
  const rows = api.wbpForClientSync(clientId, currentJobId); if (!rows.length) return null;
  const shown = rows.slice(0, max ?? (compact ? 3 : 6));
  return <span data-testid={testId ?? `wbp-client-${clientId}`} data-count={rows.length} className={clsx('inline-flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2')}>
    {shown.map((r) => <WbpDots key={r.jobId} row={r} outlined={r.jobId === currentJobId} number={rows.length > 1} dark={dark} />)}
    {rows.length > shown.length && <span data-testid={`${testId ?? `wbp-client-${clientId}`}-more`} className={clsx('text-[10px]', dark ? 'text-slate-400' : 'text-ink-400')}>+{rows.length - shown.length}</span>}
  </span>;
};

export const WbpJobDots = ({ jobId, dark, testId }: { jobId: string; dark?: boolean; testId?: string }) => { const row = api.wbpForJobSync(jobId); return row ? <WbpDots row={row} dark={dark} testId={testId} /> : null; };

export const WbpLegend = ({ dark }: { dark?: boolean }) => <span data-testid="wbp-legend" className={clsx('inline-flex items-center gap-2 text-[10px]', dark ? 'text-slate-400' : 'text-ink-400')}>
  <span className="font-semibold uppercase tracking-wide">W·B·P</span>
  {([['ok', 'on track'], ['finished', 'finished'], ['blocked', 'blocker'], ['none', 'no leg']] as [WbpState, string][]).map(([s, l]) => <span key={s} className="inline-flex items-center gap-1"><span className={clsx('inline-block h-2 w-2 rounded-full', (dark ? DOT_DARK : DOT)[s])} />{l}</span>)}
</span>;
