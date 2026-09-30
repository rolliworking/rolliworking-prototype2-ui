import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

// Card that starts folded: header row = chevron · title · optional count pill · subtitle; body mounts only when open (heavy panels stay cheap)
export const CollapsedCard = ({ title, subtitle, count, defaultOpen, action, testId, className, children }: { title: ReactNode; subtitle?: ReactNode; count?: number; defaultOpen?: boolean; action?: ReactNode; testId: string; className?: string; children: ReactNode }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section data-testid={testId} data-open={open} className={`rounded-md bg-surface shadow-card ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-3 py-2">
        <button type="button" data-testid={`${testId}-toggle`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight size={13} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="text-[13px] font-semibold tracking-tight text-ink">{title}</span>
          {count !== undefined && <span data-testid={`${testId}-count`} className="rounded-full bg-canvas px-1.5 text-[10px] font-semibold tabular text-ink-600 ring-1 ring-line">{count}</span>}
          {subtitle && <span className="truncate text-xs text-ink-500">{subtitle}</span>}
        </button>
        {action}
      </header>
      {open && <div data-testid={`${testId}-body`} className="border-t border-line p-4">{children}</div>}
    </section>
  );
};
