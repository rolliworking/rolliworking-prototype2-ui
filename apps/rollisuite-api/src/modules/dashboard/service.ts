import { prisma } from '../../db/client';

export class DashboardService {
  /**
   * Get dashboard statistics
   */
  async getStats() {
    // Fetch counts in parallel
    const [activeJobsCount, pendingEstimatesCount, openSalesOrdersCount] =
      await Promise.all([
        // Active jobs (not closed)
        prisma.job.count({
          where: {
            status: {
              not: 'closed',
            },
          },
        }),

        // Pending estimates (draft, sent, on_hold)
        prisma.estimate.count({
          where: {
            status: {
              in: ['draft', 'sent', 'on_hold'],
            },
          },
        }),

        // Open sales orders (draft, pending, fulfilled)
        prisma.salesOrder.count({
          where: {
            status: {
              in: ['draft', 'pending', 'fulfilled'],
            },
          },
        }),
      ]);

    return {
      activeJobs: activeJobsCount,
      pendingEstimates: pendingEstimatesCount,
      openSalesOrders: openSalesOrdersCount,
    };
  }
}

export const dashboardService = new DashboardService();
