import { useNavigate } from 'react-router-dom';
import type { DashboardStats } from '@/api/client';
import { fmtMoney } from '@/lib/format';

interface Kpi {
  key: string;
  label: string;
  value: number | string;
  hint: string;
  to?: string;
}

export const KpiRow = ({ stats }: { stats: DashboardStats }) => {
  const navigate = useNavigate();
  const kpis: Kpi[] = [
    { key: 'watches-in-house', label: 'Watches in house', value: stats.watchesInHouse, hint: 'received, not yet released' },
    { key: 'open-estimates', label: 'Open estimates', value: stats.openEstimates, hint: 'draft, sent or pending', to: '/estimates' },
    { key: 'awaiting-approval', label: 'Awaiting approval', value: stats.awaitingApproval, hint: 'client response needed', to: '/estimates?status=sent' },
    { key: 'in-progress', label: 'In progress', value: stats.inProgress, hint: 'on the bench or in QC', to: '/jobs' },
    { key: 'awaiting-pickup', label: 'Awaiting pickup', value: stats.awaitingPickup, hint: 'ready for release', to: '/jobs?status=awaiting_pickup' },
    { key: 'revenue-mtd', label: 'Revenue this month', value: fmtMoney(stats.revenueThisMonth), hint: 'completed jobs, MTD' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 xl:grid-cols-6" data-testid="kpi-row">
      {kpis.map((k, i) => (
        <button
          key={k.key}
          type="button"
          data-testid={`kpi-${k.key}`}
          onClick={() => k.to && navigate(k.to)}
          disabled={!k.to}
          style={{ animationDelay: `${i * 40}ms` }}
          className="animate-rise rounded-md bg-surface p-3.5 text-left shadow-card transition-[transform,box-shadow] duration-150 enabled:hover:-translate-y-px enabled:hover:shadow-pop disabled:cursor-default"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{k.label}</div>
          <div className="tabular mt-1.5 text-2xl font-semibold leading-none tracking-tight text-ink" data-testid={`kpi-${k.key}-value`}>
            {k.value}
          </div>
          <div className="mt-1.5 text-[11px] text-ink-400">{k.hint}</div>
        </button>
      ))}
    </div>
  );
};

export const DeptPnlStrip = ({ stats }: { stats: DashboardStats }) => (
  <div className="grid grid-cols-3 gap-3" data-testid="dept-pnl-strip">
    {stats.departments.map((d) => (
      <div key={d.key} data-testid={`dept-${d.key}`} className="flex items-center justify-between rounded-md bg-surface px-4 py-3 shadow-card">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{d.name}</div>
          <div className="mt-0.5 text-[11px] text-ink-400">
            {d.jobCount} {d.jobCount === 1 ? 'job' : 'jobs'} this month
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-lg font-semibold leading-none tracking-tight text-ink" data-testid={`dept-${d.key}-revenue`}>
            {fmtMoney(d.mtdRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-ink-400">MTD revenue</div>
        </div>
      </div>
    ))}
  </div>
);
