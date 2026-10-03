import clsx from 'clsx';
import type { ReactNode } from 'react';

export const field = 'mt-1 h-9 w-full rounded-sm border border-line bg-canvas px-2 text-[13px] focus:border-ink focus:bg-surface focus:outline-none';
export const Lbl = ({ children, className }: { children: ReactNode; className?: string }) => <label className={clsx('block text-xs text-ink-500', className)}>{children}</label>;
export const Toggle = ({ on, onChange, testId, label }: { on: boolean; onChange: (v: boolean) => void; testId: string; label?: string }) => (
  <button type="button" role="switch" aria-checked={on} data-testid={testId} onClick={() => onChange(!on)} className="inline-flex items-center gap-2 text-xs text-ink-700">
    <span className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-moss-600' : 'bg-ink-300')}><span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', on ? 'left-[18px]' : 'left-0.5')} /></span>{label}
  </button>
);
export const StatusDot = ({ status }: { status: 'active' | 'invited' | 'expired' | 'disabled' | 'inactive' }) => {
  const cls = { active: 'bg-moss-50 text-moss-700', invited: 'bg-sky-50 text-sky-800', expired: 'bg-amber-50 text-amber-800', disabled: 'bg-rose-50 text-rose-700', inactive: 'bg-canvas text-ink-400' }[status];
  return <span data-status={status} className={clsx('rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase', cls)}>{status}</span>;
};
export const useFlash = () => {
  return (set: (m: string | null) => void) => (m: string) => { set(m); window.setTimeout(() => set(null), 2600); };
};
