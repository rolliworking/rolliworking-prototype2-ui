import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface DashboardOverview {
  customers: {
    total: number;
    newThisMonth: number;
    growth: number;
  };
  jobs: {
    total: number;
    active: number;
    completed: number;
    thisMonth: number;
    growth: number;
  };
  sales: {
    total: number;
    thisMonth: number;
    growth: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  estimates: {
    total: number;
    pending: number;
    converted: number;
    conversionRate: number;
  };
  waitlist: {
    total: number;
    waiting: number;
    converted: number;
    conversionRate: number;
  };
  inventory: {
    watches: number;
    parts: number;
  };
}

interface RecentJob {
  id: string;
  jobId: string;
  customerName: string;
  status: string;
  createdAt: string;
}

interface RecentSalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
}

interface DashboardData {
  overview: DashboardOverview;
  recentActivity: {
    jobs: RecentJob[];
    salesOrders: RecentSalesOrder[];
  };
}

export function useDashboard() {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: DashboardData }>(
        '/v1/reports/dashboard'
      );
      return data.data;
    },
  });
}

export function useJobsByStatus() {
  return useQuery({
    queryKey: ['reports', 'jobs-by-status'],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: Array<{ status: string; count: number }>;
      }>('/v1/reports/jobs-by-status');
      return data.data;
    },
  });
}
