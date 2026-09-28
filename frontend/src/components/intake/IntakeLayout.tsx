import clsx from 'clsx';
import { Briefcase, History, Mail, Tags } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import * as api from '@/api/client';
import type { IntakeCountKey } from '@/api/client';

const STAGES = [
  { key: 'arrival', label: '1 · Arrival', path: '/intake', end: true, count: 'arrived' as IntakeCountKey },
  { key: 'receive', label: '2 · Receive Package', path: '/intake/receive', end: false, count: 'processed' as IntakeCountKey },
  { key: 'work-order', label: '3 · Work Order', path: '/intake/work-order', end: false, count: 'awaiting_inspection' as IntakeCountKey },
  { key: 'inspection', label: '4 · Receive Watch', path: '/intake/inspection', end: false, count: 'received' as IntakeCountKey },
  { key: 'photos', label: '5 · Photos', path: '/intake/photos', end: false, count: 'photos' as IntakeCountKey },
  { key: 'inspect', label: '6 · Inspection', path: '/intake/inspect', end: false, count: 'inspection' as IntakeCountKey },
  { key: 'awaiting', label: '7 · Awaiting Approval', path: '/intake/awaiting-approval', end: false, count: 'awaiting_approval' as IntakeCountKey },
];

interface IntakeCtx {
  counts: Record<IntakeCountKey, number> | null;
  refreshCounts: () => void;
}
const Ctx = createContext<IntakeCtx>({ counts: null, refreshCounts: () => undefined });
export const useIntakeCounts = () => useContext(Ctx);

export default function IntakeLayout() {
  const [counts, setCounts] = useState<Record<IntakeCountKey, number> | null>(null);
  const refreshCounts = useCallback(() => {
    api.getIntakeCounts().then(setCounts);
  }, []);
  useEffect(refreshCounts, [refreshCounts]);

  return (
    <Ctx.Provider value={{ counts, refreshCounts }}>
      <div data-testid="intake-layout" className="flex h-full flex-col">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">Intake</h1>
            <p className="mt-0.5 text-xs text-ink-500">Four stages · packages move left to right · every action is stamped who / station / when</p>
          </div>
          <div className="flex items-center gap-1">
            <NavLink to="/intake/outbox" data-testid="intake-tab-outbox" className={({ isActive }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink')}>
              <Mail size={13} /> Outbox
            </NavLink>
            <NavLink to="/intake/trade" data-testid="intake-tab-trade" className={({ isActive }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink')}>
              <Briefcase size={13} /> Trade scan-in
            </NavLink>
            <NavLink to="/intake/history" data-testid="intake-tab-history" className={({ isActive }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink')}>
              <History size={13} /> Intake History
            </NavLink>
            <NavLink to="/intake/labels" data-testid="intake-tab-labels" className={({ isActive }) => clsx('inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors', isActive ? 'bg-ink text-white' : 'text-ink-500 hover:bg-surface hover:text-ink')}>
              <Tags size={13} /> Label Queue
            </NavLink>
          </div>
        </div>

        <nav className="mb-4 flex gap-1 border-b border-line" aria-label="Intake stages" data-testid="intake-stage-tabs">
          {STAGES.map((s) => (
            <NavLink
              key={s.key}
              to={s.path}
              end={s.end}
              data-testid={`intake-tab-${s.key}`}
              className={({ isActive }) =>
                clsx(
                  '-mb-px inline-flex h-9 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors',
                  isActive ? 'border-ink text-ink' : 'border-transparent text-ink-500 hover:text-ink',
                )
              }
            >
              {s.label}
              {counts && (
                <span data-testid={`intake-count-${s.count}`} className="tabular rounded-full bg-canvas px-1.5 text-[11px] text-ink-500 ring-1 ring-line">
                  {counts[s.count]}
                </span>
              )}
            </NavLink>
          ))}
          {counts && counts.discrepancy_hold > 0 && (
            <span className="ml-auto self-center rounded-sm bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700" data-testid="intake-hold-count">
              {counts.discrepancy_hold} on discrepancy hold
            </span>
          )}
        </nav>

        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </div>
    </Ctx.Provider>
  );
}
