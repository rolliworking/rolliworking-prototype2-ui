import clsx from 'clsx';
import { AlertTriangle, Check, GitBranch, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DeptCode, EstimateLine, WatchMatch } from '@/api/client';
import { DEPT_LABEL } from '@/api/client';
import { DeptBadge, StatusPill } from '@/components/ui/Pills';
import { fmtDate, fmtMoneyCents, fullName } from '@/lib/format';

const Check_ = ({ checked, onChange, testId, children, tone = 'ink' }: { checked: boolean; onChange: () => void; testId: string; children: React.ReactNode; tone?: 'ink' | 'moss' }) => (
  <label className={clsx('flex cursor-pointer items-center gap-2.5 rounded-sm border px-2.5 py-2 transition-colors', checked ? (tone === 'moss' ? 'border-moss/40 bg-moss-50/60' : 'border-ink/30 bg-canvas') : 'border-line hover:border-ink-300')}>
    <input type="checkbox" data-testid={testId} checked={checked} onChange={onChange} className="sr-only peer" />
    <span className={clsx('grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border transition-colors', checked ? (tone === 'moss' ? 'border-moss bg-moss' : 'border-ink bg-ink') : 'border-ink-300 bg-surface')}>
      <Check size={11} strokeWidth={3} className={clsx('text-white', checked ? 'opacity-100' : 'opacity-0')} />
    </span>
    <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-ink">{children}</span>
  </label>
);

export const LineChecklist = ({ lines, verified, onToggle }: { lines: EstimateLine[]; verified: number[]; onToggle: (i: number) => void }) => (
  <div className="grid gap-1.5" data-testid="line-checklist">
    {lines.map((l, i) => (
      <Check_ key={i} checked={verified.includes(i)} onChange={() => onToggle(i)} testId={`line-check-${i}`}>
        <DeptBadge code={l.dept} />
        <span className="truncate">{l.description}</span>
        <span className="tabular ml-auto text-xs text-ink-400">{fmtMoneyCents(l.unitPrice * l.qty)}</span>
      </Check_>
    ))}
  </div>
);

export const ComponentChecklist = ({ expected, received, onToggle }: { expected: string[]; received: string[]; onToggle: (c: string) => void }) => (
  <div className="grid grid-cols-2 gap-1.5" data-testid="component-checklist">
    {expected.map((c) => {
      const on = received.includes(c);
      return (
        <Check_ key={c} checked={on} onChange={() => onToggle(c)} testId={`component-${c.replace(/\s+/g, '-')}`} tone="moss">
          <span className="capitalize">{c}</span>
          {!on && <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-rose-700"><AlertTriangle size={11} /> missing</span>}
        </Check_>
      );
    })}
  </div>
);

const ALL_DEPTS: DeptCode[] = ['W', 'B', 'P', 'PM'];

export const WorkflowPicker = ({ value, onChange }: { value: DeptCode[]; onChange: (v: DeptCode[]) => void }) => (
  <div className="flex flex-wrap gap-1.5" data-testid="workflow-picker">
    {ALL_DEPTS.map((d) => {
      const on = value.includes(d);
      return (
        <button
          key={d}
          type="button"
          data-testid={`workflow-${d}`}
          aria-pressed={on}
          onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
          className={clsx('inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-[13px] font-medium transition-colors', on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-700 hover:border-ink-300')}
        >
          <span className={clsx('font-mono text-xs font-semibold', on ? 'text-white/80' : 'text-ink-400')}>{d}</span> {DEPT_LABEL[d]}
        </button>
      );
    })}
  </div>
);

interface ForkProps {
  match: WatchMatch;
  expectedClientId: string;
  decision: 'n/a' | 'returning' | 'conflict';
  onDecide: (d: 'returning' | 'conflict') => void;
}

export const SameWatchFork = ({ match, expectedClientId, decision, onDecide }: ForkProps) => {
  const otherClient = match.client.id !== expectedClientId;
  return (
    <div data-testid="same-watch-fork" className={clsx('animate-rise rounded-md border-l-[3px] p-3', otherClient ? 'border-rose-500 bg-rose-50/60' : 'border-amber-500 bg-amber-50/60')}>
      <div className="flex items-start gap-2">
        <GitBranch size={15} className={otherClient ? 'mt-0.5 text-rose-700' : 'mt-0.5 text-amber-800'} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">
            Same-watch check: <span className="font-mono">{match.watch.reference} / {match.watch.serial}</span> is already on file
          </div>
          <div className="text-xs text-ink-700">
            {match.watch.brand} {match.watch.model} · owner <span className="font-medium">{fullName(match.client)}</span>
            {otherClient && <span className="ml-1 font-semibold text-rose-700">— different client than this estimate</span>}
            {' · '}
            <StatusPill status={match.watch.status} />
          </div>
          <div className="mt-2 rounded-sm bg-surface/80 p-2 text-xs" data-testid="same-watch-history">
            <div className="mb-1 inline-flex items-center gap-1 font-semibold text-ink-500"><History size={11} /> History</div>
            {match.jobs.length === 0 && match.packages.length === 0 && <div className="text-ink-400">No prior jobs on record.</div>}
            <ul className="space-y-0.5">
              {match.jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-2 text-ink-700">
                  <span className="font-mono">{j.number}</span> {DEPT_LABEL[j.department === 'watchmaking' ? 'W' : j.department === 'band' ? 'B' : 'P']} · {j.technician} · <StatusPill status={j.status} /> <span className="tabular text-ink-400">{fmtDate(j.startedAt)}</span>
                </li>
              ))}
              {match.packages.map((p) => (
                <li key={p.id} className="text-ink-700"><span className="font-mono">{p.subNumber}</span> · <StatusPill status={p.status} /></li>
              ))}
            </ul>
            <Link to={`/clients/${match.client.id}`} data-testid="same-watch-history-link" className="mt-1 inline-block text-brand hover:underline">Open client history →</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="fork-returning"
              onClick={() => onDecide('returning')}
              className={clsx('h-9 rounded-sm border text-[13px] font-medium transition-colors', decision === 'returning' ? 'border-moss bg-moss text-white' : 'border-line bg-surface text-ink hover:border-ink-300')}
            >
              Same watch returning
            </button>
            <button
              type="button"
              data-testid="fork-conflict"
              onClick={() => onDecide('conflict')}
              className={clsx('h-9 rounded-sm border text-[13px] font-medium transition-colors', decision === 'conflict' ? 'border-rose-600 bg-rose-600 text-white' : 'border-line bg-surface text-ink hover:border-ink-300')}
            >
              Different watch / conflict
            </button>
          </div>
          {decision === 'n/a' && <p data-testid="fork-required" className="mt-1.5 text-[11px] font-medium text-amber-900">This decision is required before committing.</p>}
        </div>
      </div>
    </div>
  );
};
