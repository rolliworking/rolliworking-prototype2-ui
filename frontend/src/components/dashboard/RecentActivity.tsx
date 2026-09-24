import {
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Package,
  PackageCheck,
  Play,
  ShieldCheck,
  ShoppingBag,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import * as api from '@/api/client';
import type { ActivityType } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { useAsync } from '@/hooks/useAsync';
import { relativeTime, fmtTime } from '@/lib/format';

const ICON: Record<ActivityType, [LucideIcon, string]> = {
  package_received: [Package, 'text-brand'],
  estimate_sent: [FileText, 'text-brand'],
  estimate_viewed: [Eye, 'text-ink-400'],
  estimate_declined: [XCircle, 'text-rose-600'],
  job_started: [Play, 'text-brand'],
  job_completed: [CheckCircle2, 'text-moss'],
  photo_uploaded: [Camera, 'text-ink-500'],
  pickup: [PackageCheck, 'text-teal-700'],
  parts_ordered: [ShoppingBag, 'text-orange-700'],
  qc_passed: [ShieldCheck, 'text-violet-700'],
};

export const RecentActivity = () => {
  const { data } = useAsync(() => api.getRecentActivity(10));

  return (
    <Card testId="recent-activity" title="Recent activity" subtitle="Last 48 hours" bodyClassName="py-1">
      <ul className="-mx-4 divide-y divide-line/70">
        {(data ?? []).map((ev) => {
          const [Icon, tone] = ICON[ev.type];
          return (
            <li key={ev.id} data-testid={`activity-${ev.id}`} className="flex items-start gap-3 px-4 py-2">
              <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-5 text-ink">{ev.message}</div>
                <div className="text-[11px] text-ink-400">
                  {ev.actor} · {fmtTime(ev.timestamp)}
                </div>
              </div>
              <span className="tabular shrink-0 text-[11px] text-ink-400" title={new Date(ev.timestamp).toLocaleString()}>
                {relativeTime(ev.timestamp)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
