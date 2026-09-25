import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  accent?: 'none' | 'moss';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  testId?: string;
}

export const Card = ({ title, subtitle, action, accent = 'none', className, bodyClassName, children, testId }: CardProps) => (
  <section
    data-testid={testId}
    className={clsx(
      'rounded-md bg-surface shadow-card',
      accent === 'moss' && 'border-l-[3px] border-moss',
      className,
    )}
  >
    {(title || action) && (
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5">
        <div>
          {title && <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>}
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    <div className={clsx(bodyClassName ?? 'p-4')}>{children}</div>
  </section>
);
