import { Check } from 'lucide-react';
import type { PortalSplit } from '@/api/client';

// Two-track progress in plain client language: done track = green check + "ready and waiting"; active track = its current stage; merge point below
export const RcSplitStrip = ({ split, compact, testId = 'rc-split' }: { split: PortalSplit; compact?: boolean; testId?: string }) => (
  <div data-testid={testId} className={compact ? 'mt-3 rounded-md border border-rc-line bg-rc-cream/40 px-4 py-3' : 'rounded-lg border border-rc-line bg-rc-paper px-6 py-5'}>
    {!compact && <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-rc-muted">Two parts of this service are moving separately</div>}
    <ul className={compact ? 'space-y-1.5' : 'space-y-3'}>
      {split.tracks.map((t) => <li key={t.key} data-testid={`${testId}-track-${t.key}`} data-done={t.done} className={`flex items-center gap-3 ${compact ? 'text-sm' : 'text-[15px]'}`}>
        <span className={`${compact ? 'w-24' : 'w-28'} shrink-0 font-medium text-rc-ink`}>{t.label}</span>
        <span className={`h-px flex-1 ${t.done ? 'bg-emerald-500/50' : 'bg-rc-line'}`} />
        {t.done ? <span className="inline-flex items-center gap-1.5 text-emerald-700"><Check size={compact ? 14 : 16} strokeWidth={2.5} /> {t.text}</span> : <span className="inline-flex items-center gap-1.5 text-rc-ink"><span className="inline-block h-2 w-2 rounded-full bg-rc-accent" /> {t.text}</span>}
      </li>)}
    </ul>
    <div data-testid={`${testId}-merge`} className={`flex items-center gap-3 ${compact ? 'mt-2 text-xs' : 'mt-4 text-sm'} text-rc-muted`}><span className={`${compact ? 'w-24' : 'w-28'} shrink-0`} /><span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] border border-rc-muted/60" /><span>{split.mergeLabel}</span></div>
  </div>
);
