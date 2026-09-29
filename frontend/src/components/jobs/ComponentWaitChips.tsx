import { componentWaitsSync, jobAtRisk } from '@/api/concierge';

const TONE: Record<string, string> = { ok: 'bg-moss-50 text-moss-800 ring-moss-200', amber: 'bg-amber-50 text-amber-900 ring-amber-300', red: 'bg-rose-50 text-rose-800 ring-rose-300', dark: 'bg-rose-900 text-white ring-rose-900', muted: 'bg-canvas text-ink-500 ring-line' };
const DARK: Record<string, string> = { ok: 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30', amber: 'bg-amber-400/20 text-amber-200 ring-amber-400/40', red: 'bg-rose-500/20 text-rose-200 ring-rose-400/40', dark: 'bg-rose-800 text-white ring-rose-700', muted: 'bg-white/5 text-slate-300 ring-white/10' };
// COMPONENT WAIT — the outsourced portion is a component of the parent job (assembly-style). Shown wherever the parent job is: job card, click map, hitlist, pads, bench. Fulfilled clears it.
export const ComponentWaitChips = ({ jobId, dark, compact }: { jobId: string; dark?: boolean; compact?: boolean }) => {
  const waits = componentWaitsSync(jobId); if (!waits.length) return null;
  return <span data-testid={`component-wait-${jobId}`} className={`inline-flex flex-wrap gap-1 ${compact ? '' : 'mt-1'}`}>{waits.map((w) => <span key={w.swoId} data-testid={`component-wait-chip-${w.swoId}`} data-health={w.health} title={`${w.swoNumber} · point person ${w.pointPerson ?? '—'}`} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${(dark ? DARK : TONE)[w.tone]}`}><span aria-hidden>⧉</span>{w.label}</span>)}</span>;
};
export const AtRiskTag = ({ jobId, dark }: { jobId: string; dark?: boolean }) => jobAtRisk(jobId) ? <span data-testid={`job-at-risk-${jobId}`} className={`rounded-sm px-1 text-[10px] font-semibold uppercase ${dark ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-300'}`}>projected date at risk</span> : null;
