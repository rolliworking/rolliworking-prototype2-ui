import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import type { PortalStatus } from '@/api/client';

export const rcDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: new Date(iso).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
export const rcMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const RcCard = ({ title, eyebrow, action, children, className, testId }: { title?: ReactNode; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) => (
  <section data-testid={testId} className={clsx('rounded-lg border border-rc-line bg-rc-paper px-6 py-5 shadow-[0_1px_0_rgba(43,38,33,0.04)]', className)}>
    {(title || eyebrow || action) && (
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">{eyebrow}</div>}
          {title && <h2 className="font-serif text-xl font-medium tracking-tight text-rc-ink">{title}</h2>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);

export const RcButton = ({ tone = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' | 'danger' }) => (
  <button
    {...rest}
    className={clsx(
      'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-[background-color,color,transform,opacity] duration-150 active:translate-y-px disabled:opacity-40',
      tone === 'primary' && 'bg-rc-ink text-rc-cream hover:bg-black',
      tone === 'quiet' && 'border border-rc-line bg-transparent text-rc-ink hover:bg-rc-accentSoft',
      tone === 'danger' && 'border border-rose-200 bg-transparent text-rose-800 hover:bg-rose-50',
      className,
    )}
  >
    {children}
  </button>
);

export const RcInput = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={clsx('h-11 w-full rounded-md border border-rc-line bg-white px-3 text-[15px] text-rc-ink placeholder:text-rc-muted/70 focus:border-rc-accent focus:outline-none focus:ring-2 focus:ring-rc-accent/20', className)} />
);

export const RcLabel = ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-rc-muted">{children}</label>
);

// Status words, never a percent bar
export const StatusWord = ({ status, size = 'md', testId }: { status: PortalStatus; size?: 'sm' | 'md' | 'lg'; testId?: string }) => (
  <span data-testid={testId} className={clsx('inline-flex items-center gap-2 font-serif italic', size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg', status.active ? 'text-rc-ink' : 'text-rc-muted')}>
    <span className={clsx('inline-block h-2 w-2 rounded-full', status.active ? 'bg-rc-accent' : 'bg-rc-line')} />
    {status.label}
  </span>
);

export const RcError = ({ text }: { text: string | null }) => (text ? <p data-testid="rc-error" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{text}</p> : null);
