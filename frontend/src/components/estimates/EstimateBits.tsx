import clsx from 'clsx';
import { FlaskConical } from 'lucide-react';
import type { EstimateStatus, EstimateWithRefs } from '@/api/client';
import { StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

// Marks anything the prompt pack lists as UNKNOWN — simplest version built, visibly flagged
export const Provisional = ({ note, className }: { note?: string; className?: string }) => (
  <span
    data-testid="provisional-tag"
    title={note ?? 'UNKNOWN in legacy — simplest version built, flagged for review'}
    className={clsx('inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200', className)}
  >
    <FlaskConical size={9} /> provisional
  </span>
);

// List shows converted as "Closed" per the pack
export const EstimateStatusPill = ({ status, testId }: { status: EstimateStatus; testId?: string }) =>
  status === 'converted' ? (
    <span data-testid={testId} className="inline-flex items-center whitespace-nowrap rounded-sm bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-slate-600">Closed</span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <StatusPill status={status} testId={testId} />
      {status === 'approved' && <Provisional note="Staff-recorded approval is not a legacy status — provisional" />}
    </span>
  );

export const QuoteContextStrip = ({ clientEstimates, watchEstimates, clientName }: { clientEstimates: EstimateWithRefs[]; watchEstimates: EstimateWithRefs[]; clientName: string }) => {
  const watchIds = new Set(watchEstimates.map((e) => e.id));
  const rows = [...watchEstimates, ...clientEstimates.filter((e) => !watchIds.has(e.id))];
  return (
    <div data-testid="quote-context-strip" className="rounded-md border border-line bg-canvas/60 p-3">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        <span>Quote context — {clientName}</span>
        <span className="font-normal normal-case tracking-normal text-ink-400">{watchEstimates.length} on this watch · {clientEstimates.length} for this client</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-ink-400">No prior estimates for this client.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
          {rows.slice(0, 8).map((e) => (
            <li key={e.id} data-testid={`context-row-${e.id}`} className="flex items-center gap-2 text-xs">
              <span className="font-mono font-medium text-ink">{e.number}</span>
              {watchIds.has(e.id) && <span className="rounded-sm bg-brand-50 px-1 text-[10px] font-semibold text-brand">same watch</span>}
              <span className="truncate text-ink-500">{e.watch ? `${e.watch.model} ${e.watch.reference}` : 'no watch'}</span>
              <span className="ml-auto tabular text-ink-700">{fmtMoneyCents(e.total)}</span>
              <EstimateStatusPill status={e.status} />
              <span className="tabular text-ink-400">{fmtDate(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const estimateTitle = (e: EstimateWithRefs) => `${e.number} · ${fullName(e.client)}`;
