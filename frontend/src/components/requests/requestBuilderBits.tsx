import clsx from 'clsx';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BuilderMode, RateMatch, RequestLine } from '@/api/client';
import { rateLabel } from '@/api/requestBuilder';

// Shared builder atoms. `roomy` = portal (bigger tap targets, warm tone); default = staff density.
export const Chip = ({ on, onClick, children, testId, roomy, hint }: { on: boolean; onClick: () => void; children: ReactNode; testId: string; roomy?: boolean; hint?: string }) => (
  <button type="button" data-testid={testId} aria-pressed={on} title={hint} onClick={onClick} className={clsx('inline-flex items-center gap-1 rounded-full border font-medium transition-colors', roomy ? 'min-h-10 px-4 text-sm' : 'h-7 px-2.5 text-xs', on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700 hover:bg-canvas')}>{children}</button>
);
export const Field = ({ label, hint, children, testId }: { label: string; hint?: string; children: ReactNode; testId?: string }) => (
  <div data-testid={testId}><div className="mb-1 flex items-baseline gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">{label}</span>{hint && <span className="text-[10px] text-ink-400">{hint}</span>}</div>{children}</div>
);
export const AddBtn = ({ onClick, children, testId }: { onClick: () => void; children: ReactNode; testId: string }) => (
  <button type="button" data-testid={testId} onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-sm border border-dashed border-ink-300 px-3 text-xs font-medium text-ink-700 hover:border-ink hover:bg-canvas"><Plus size={12} /> {children}</button>
);
export const QuoteKey = ({ k, testId }: { k: string; testId: string }) => <span data-testid={testId} className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-white">{k}</span>;

// What the rate line says depends on who is looking: staff → key + rate (or the one-tap "Add rate"); trade auto-quote → price · days, or "confirmed by estimate";
// trade without auto-quote → "estimate queued"; regular client → a typical range only, never a promise.
export const RateLine = ({ line, mode, autoQuote, rate, testId }: { line: RequestLine; mode: BuilderMode; autoQuote: boolean; rate?: RateMatch; testId: string }) => {
  const staff = mode === 'staff';
  if (!line.legs.length) return <div data-testid={testId} data-state="blank" className="min-h-5 text-xs text-ink-400">Pick a job type to see the rate</div>;
  if (staff) return <div data-testid={testId} data-state={rate ? 'rate' : 'none'} className="flex flex-wrap items-center gap-2 text-xs">{rate ? <><b className="text-ink">{rateLabel(rate)}</b><span className="text-ink-500">· about {rate.days} days · rate card {rate.key}</span></> : <><span className="text-amber-800">No rate for this key</span><Link data-testid={`${testId}-add`} to={`/setup/rate-card?key=${encodeURIComponent(line.quoteKey)}`} className="rounded-sm border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-900 hover:bg-amber-100">Add rate for this key →</Link></>}</div>;
  if (autoQuote) return <div data-testid={testId} data-state={rate ? 'quote' : 'estimate'} className="text-sm">{rate ? <><b>{rateLabel(rate)}</b> <span className="text-ink-500">· about {rate.days} days · quoted now</span></> : <span className="text-ink-500">Confirmed by estimate within one business day</span>}</div>;
  if (mode === 'trade') return <div data-testid={testId} data-state="queued" className="text-sm text-ink-500">Estimate queued — priced by a person within one business day</div>;
  return <div data-testid={testId} data-state={rate ? 'typical' : 'blank'} className="min-h-5 text-sm text-ink-500">{rate && <>Typical {rate.price !== undefined ? `$${Math.round(rate.price * 0.9).toLocaleString()}–$${Math.round(rate.price * 1.15).toLocaleString()}` : rateLabel(rate)} · about {rate.days} days <span className="text-xs">· a range, not a quote</span></>}</div>;
};
