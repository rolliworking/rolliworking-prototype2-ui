import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface DashboardStats {
  activeJobs: number;
  pendingEstimates: number;
  openSalesOrders: number;
}

interface DailyHitListItem {
  jobId: string;
  estimateNumber: string;
  priority: string;
  reason: string;
  dueDate?: string;
}

interface DailyHitList {
  date: string;
  items: DailyHitListItem[];
  metadata: {
    totalJobs: number;
    urgentCount: number;
    overdueCount: number;
  };
  generatedAt?: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: DashboardStats }>(
        '/api/v1/dashboard/stats'
      );
      return data.data;
    },
  });
}

export function useDailyHitList() {
  return useQuery({
    queryKey: ['daily-hit-list', 'today'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: DailyHitList }>(
        '/api/v1/daily-hit-list'
      );
      return data.data;
    },
  });
}
