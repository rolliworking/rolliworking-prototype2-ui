import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-700 active:translate-y-px',
  secondary: 'bg-surface text-ink border border-line hover:border-ink-300 hover:bg-canvas active:translate-y-px',
  ghost: 'text-ink-500 hover:text-ink hover:bg-canvas',
};

export const Button = ({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonProps) => (
  <button
    {...rest}
    className={clsx(
      'inline-flex items-center gap-1.5 rounded-sm font-medium transition-[background-color,border-color,color,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50',
      size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
      VARIANT[variant],
      className,
    )}
  >
    {children}
  </button>
);

export const PageHeader = ({ title, subtitle, action, testId }: { title: string; subtitle?: string; action?: ReactNode; testId?: string }) => (
  <div className="mb-4 flex items-end justify-between gap-4" data-testid={testId}>
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const FilterChip = ({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: ReactNode; testId?: string }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className={clsx(
      'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150',
      active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-500 hover:border-ink-300 hover:text-ink',
    )}
  >
    {children}
  </button>
);
