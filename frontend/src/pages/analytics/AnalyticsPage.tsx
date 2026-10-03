import { useAuth } from '@/auth/AuthContext';
import * as sf from '@/api/safes';
import { SafesCard } from '@/components/analytics/SafesCard';
import { PageHeader } from '@/components/ui/Button';
import BonusAnalyticsPage from '@/pages/analytics/BonusAnalyticsPage';

// /analytics (MH + Operations Manager) — Safes vs insurance on top, Bonuses below. /analytics/bonuses lands here too.
export default function AnalyticsPage() {
  const { user } = useAuth();
  if (!sf.canSeeSafes(user)) return <div data-testid="analytics-restricted" className="rounded-md border border-line bg-canvas p-6 text-sm text-ink-600">Analytics are for MH and the Operations Manager.</div>;
  return <div data-testid="analytics-page" className="space-y-6">
    <PageHeader title="Analytics" subtitle="Owner / Operations Manager view — what is on the premises against what is insured, and where every bonus plan stands" />
    <SafesCard />
    <div id="bonuses" className="border-t border-line pt-4"><BonusAnalyticsPage /></div>
  </div>;
}
