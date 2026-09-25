import { useAuth } from '@/auth/AuthContext';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '@/api/client';
import type { FloorMap } from '@/api/client';
import { Provisional } from '@/components/estimates/EstimateBits';
import { WorkflowBadges } from '@/components/jobs/JobBits';

const TONE: Record<string, string> = { holds: 'bg-rose-50/70 ring-rose-100', case_cleaning: 'bg-violet-50/60 ring-violet-100', qc: 'bg-amber-50/60 ring-amber-100', ready: 'bg-teal-50/60 ring-teal-100', out: 'bg-slate-100/70 ring-slate-200' };

export default function FloorMapPage() {
  const { user } = useAuth();
  const canOpenJobs = user?.accessTier === 'manager';
  const [m, setM] = useState<FloorMap | null>(null);
  useEffect(() => { api.getShopFloorMap().then(setM); }, []);
  return (
    <div data-testid="floor-page" className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Shop floor map</h1>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-500">Work flows left → right · holds park in their own lane · case cleaning splits off the bench for polish-only work <Provisional note="Case-cleaning lane = in-service jobs whose workflow is P/PM only — derivation is provisional" /></p>
      </div>
      <div className="relative rounded-md border border-line bg-[linear-gradient(90deg,transparent_0,transparent_calc(100%-1px),#e5e7eb_calc(100%-1px))] p-4">
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-ink-300/40" />
        <div data-testid="floor-lanes" className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${m?.lanes.length ?? 9}, minmax(0, 1fr))` }}>
          {m?.lanes.map((lane, i) => (
            <section key={lane.key} data-testid={`floor-lane-${lane.key}`} className={clsx('min-h-[360px] rounded-md p-2 ring-1 ring-inset', TONE[lane.key] ?? 'bg-canvas ring-line')}>
              <header className="mb-2 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{i + 1}. {lane.label}</span><span data-testid={`floor-count-${lane.key}`} className="rounded-full bg-surface px-1.5 font-mono text-[10px] text-ink-500 shadow-card">{lane.jobs.length}</span></header>
              <div className="flex flex-wrap gap-1">
                {lane.jobs.map((j) => (
                  <Link key={j.id} to={canOpenJobs ? `/jobs/${j.id}` : `/clients/${j.clientId}?hit=job-${j.id}`} data-testid={`floor-chip-${j.id}`} title={`${j.number} · ${j.client.lastName} · ${j.watch.model} · ${j.assignees.join(', ') || 'unassigned'}`} className={clsx('inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-[11px] shadow-card transition-transform hover:-translate-y-px', j.priority === 'urgent' ? 'border-rose-300' : j.priority === 'high' ? 'border-orange-200' : 'border-line')}>
                    <span className="font-mono font-semibold text-ink">{j.number.slice(-4)}</span><WorkflowBadges workflow={j.workflow} />{j.assignees[0] && <span className="text-ink-400">{j.assignees[0]}</span>}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
