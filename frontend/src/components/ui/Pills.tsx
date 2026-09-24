import clsx from 'clsx';
import { humanize } from '@/lib/format';

const TONE: Record<string, string> = {
  // estimates
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-brand-50 text-brand',
  awaiting_approval: 'bg-amber-50 text-amber-800',
  approved: 'bg-moss-50 text-moss-700',
  declined: 'bg-rose-50 text-rose-700',
  expired: 'bg-slate-100 text-slate-500',
  // jobs & watches
  intake: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-50 text-amber-800',
  awaiting_customer_approval: 'bg-orange-50 text-orange-800',
  in_service: 'bg-brand-50 text-brand',
  testing: 'bg-violet-50 text-violet-700',
  ready_to_ship: 'bg-teal-50 text-teal-800',
  closed: 'bg-slate-100 text-slate-500',
  on_hand: 'bg-moss-50 text-moss-700',
  open: 'bg-brand-50 text-brand',
  partial_fulfilled: 'bg-amber-50 text-amber-800',
  fulfilled: 'bg-teal-50 text-teal-800',
  picked_up: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-50 text-rose-700',
  paid: 'bg-moss-50 text-moss-700',
  unpaid: 'bg-rose-50 text-rose-700',
  awaiting_invoice: 'bg-amber-50 text-amber-800',
  awaiting_payment: 'bg-orange-50 text-orange-800',
  ready_for_pickup: 'bg-teal-50 text-teal-800',
  estimate: 'bg-slate-100 text-slate-600',
  finished: 'bg-slate-100 text-slate-500',
  queued: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-brand-50 text-brand',
  awaiting_parts: 'bg-orange-50 text-orange-800',
  qc: 'bg-violet-50 text-violet-700',
  complete: 'bg-moss-50 text-moss-700',
  awaiting_pickup: 'bg-teal-50 text-teal-800',
  shipped: 'bg-slate-100 text-slate-600',
  released: 'bg-slate-100 text-slate-500',
  expected: 'bg-slate-100 text-slate-500',
  closed_by_client: 'bg-slate-100 text-slate-500',
  quoted: 'bg-brand-50 text-brand',
  new: 'bg-amber-50 text-amber-800',
  // packages
  arrived: 'bg-amber-50 text-amber-800',
  processed: 'bg-brand-50 text-brand',
  awaiting_inspection: 'bg-violet-50 text-violet-700',
  received: 'bg-moss-50 text-moss-700',
  discrepancy_hold: 'bg-rose-50 text-rose-700',
};

const LABEL: Record<string, string> = {
  closed_by_client: 'Closed by client',
  qc: 'QC',
  testing: 'Testing / QC',
  ready_to_ship: 'Ready to ship',
  awaiting_customer_approval: 'Awaiting customer approval',
  on_hand: 'On hand',
  arrived: 'Arrived — awaiting processing',
  processed: 'Processed — awaiting work order',
  awaiting_inspection: 'Awaiting inspection',
  received: 'Received — awaiting approval',
  discrepancy_hold: 'Discrepancy hold',
};

export const StatusPill = ({ status, testId }: { status: string; testId?: string }) => (
  <span
    data-testid={testId}
    className={clsx(
      'inline-flex items-center whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-4',
      TONE[status] ?? 'bg-slate-100 text-slate-700',
    )}
  >
    {LABEL[status] ?? humanize(status)}
  </span>
);

const DEPT_TONE: Record<string, string> = {
  W: 'bg-brand-50 text-brand ring-brand-100',
  B: 'bg-violet-50 text-violet-700 ring-violet-100',
  P: 'bg-teal-50 text-teal-800 ring-teal-100',
  PM: 'bg-amber-50 text-amber-800 ring-amber-100',
};

export const DeptBadge = ({ code, className }: { code: string; className?: string }) => (
  <span className={clsx('inline-flex h-5 min-w-[22px] items-center justify-center rounded-sm px-1 font-mono text-[10px] font-semibold ring-1 ring-inset', DEPT_TONE[code] ?? 'bg-slate-100 text-slate-700 ring-slate-200', className)} title={code}>
    {code}
  </span>
);

const OWNER_TONE: Record<string, string> = {
  MH: 'bg-brand-100 text-brand-600',
  Walter: 'bg-violet-100 text-violet-800',
  Vienna: 'bg-amber-100 text-amber-900',
  MM: 'bg-moss-100 text-moss-700',
};

export const OwnerChip = ({ owner, className }: { owner: string; className?: string }) => (
  <span
    data-testid={`owner-chip-${owner.toLowerCase()}`}
    className={clsx(
      'inline-flex h-5 min-w-[28px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none',
      OWNER_TONE[owner] ?? 'bg-slate-100 text-slate-700',
      className,
    )}
    title={owner}
  >
    {owner}
  </span>
);

export const DeptTag = ({ dept }: { dept: string }) => (
  <span className="text-xs text-ink-500">{humanize(dept)}</span>
);
