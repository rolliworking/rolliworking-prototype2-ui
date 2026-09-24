import * as api from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DeptPnlStrip, KpiRow } from '@/components/dashboard/KpiCards';
import { HitListPanel } from '@/components/dashboard/HitListPanel';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PageHeader } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { fmtLongDate } from '@/lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = useAsync(() => api.getDashboardStats());

  return (
    <div data-testid="dashboard-page" className="space-y-4">
      <PageHeader title="Dashboard" subtitle={`${fmtLongDate(new Date())} · Good day, ${user!.shortName}`} testId="dashboard-header" />

      {stats && (
        <>
          <KpiRow stats={stats} />
          <DeptPnlStrip stats={stats} />
        </>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <HitListPanel />
        </div>
        <div className="col-span-2">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
