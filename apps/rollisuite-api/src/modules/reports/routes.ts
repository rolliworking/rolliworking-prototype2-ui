import { FastifyInstance } from 'fastify';
import { prisma } from '../../db/client';

export async function reportsRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/reports/dashboard
   * Get dashboard overview statistics
   */
  server.get('/dashboard', async (request, reply) => {
    try {
      // Get date ranges
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Parallel queries for all stats
      const [
        // Customers
        totalCustomers,
        newCustomersThisMonth,
        newCustomersLastMonth,

        // Jobs
        totalJobs,
        activeJobs,
        completedJobs,
        jobsThisMonth,
        jobsLastMonth,

        // Sales Orders
        totalSalesOrders,
        salesThisMonth,
        salesLastMonth,
        revenueThisMonth,
        revenueLastMonth,

        // Estimates
        totalEstimates,
        pendingEstimates,
        convertedEstimates,

        // Waitlist
        totalWaitlist,
        waitlistWaiting,
        waitlistConverted,

        // Watches
        totalWatches,

        // Parts
        totalParts,
      ] = await Promise.all([
        // Customers
        prisma.customer.count(),
        prisma.customer.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.customer.count({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
        }),

        // Jobs
        prisma.job.count(),
        prisma.job.count({
          where: {
            status: { in: ['intake', 'in_review', 'approved', 'in_service', 'testing'] },
          },
        }),
        prisma.job.count({
          where: { status: 'closed' },
        }),
        prisma.job.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.job.count({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
        }),

        // Sales Orders
        prisma.salesOrder.count(),
        prisma.salesOrder.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
        prisma.salesOrder.count({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
        }),
        prisma.salesOrder.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { totalAmount: true },
        }),
        prisma.salesOrder.aggregate({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          },
          _sum: { totalAmount: true },
        }),

        // Estimates
        prisma.estimate.count(),
        prisma.estimate.count({
          where: { status: { in: ['draft', 'sent'] } },
        }),
        prisma.estimate.count({
          where: { status: 'converted' },
        }),

        // Waitlist
        prisma.waitlist.count(),
        prisma.waitlist.count({
          where: { status: 'waiting' },
        }),
        prisma.waitlist.count({
          where: { status: 'converted' },
        }),

        // Watches
        prisma.watch.count(),

        // Parts
        prisma.part.count(),
      ]);

      // Calculate growth rates
      const customerGrowth =
        newCustomersLastMonth > 0
          ? ((newCustomersThisMonth - newCustomersLastMonth) /
              newCustomersLastMonth) *
            100
          : 0;

      const jobGrowth =
        jobsLastMonth > 0
          ? ((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100
          : 0;

      const salesGrowth =
        salesLastMonth > 0
          ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100
          : 0;

      const revenueGrowthRate =
        revenueLastMonth._sum.totalAmount &&
        Number(revenueLastMonth._sum.totalAmount) > 0
          ? ((Number(revenueThisMonth._sum.totalAmount || 0) -
              Number(revenueLastMonth._sum.totalAmount)) /
              Number(revenueLastMonth._sum.totalAmount)) *
            100
          : 0;

      // Get recent activity
      const recentJobs = await prisma.job.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const recentSalesOrders = await prisma.salesOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reply.status(200).send({
        success: true,
        data: {
          overview: {
            customers: {
              total: totalCustomers,
              newThisMonth: newCustomersThisMonth,
              growth: Math.round(customerGrowth * 10) / 10,
            },
            jobs: {
              total: totalJobs,
              active: activeJobs,
              completed: completedJobs,
              thisMonth: jobsThisMonth,
              growth: Math.round(jobGrowth * 10) / 10,
            },
            sales: {
              total: totalSalesOrders,
              thisMonth: salesThisMonth,
              growth: Math.round(salesGrowth * 10) / 10,
            },
            revenue: {
              thisMonth: Number(revenueThisMonth._sum.totalAmount || 0),
              lastMonth: Number(revenueLastMonth._sum.totalAmount || 0),
              growth: Math.round(revenueGrowthRate * 10) / 10,
            },
            estimates: {
              total: totalEstimates,
              pending: pendingEstimates,
              converted: convertedEstimates,
              conversionRate:
                totalEstimates > 0
                  ? Math.round((convertedEstimates / totalEstimates) * 1000) /
                    10
                  : 0,
            },
            waitlist: {
              total: totalWaitlist,
              waiting: waitlistWaiting,
              converted: waitlistConverted,
              conversionRate:
                totalWaitlist > 0
                  ? Math.round((waitlistConverted / totalWaitlist) * 1000) / 10
                  : 0,
            },
            inventory: {
              watches: totalWatches,
              parts: totalParts,
            },
          },
          recentActivity: {
            jobs: recentJobs.map((job) => ({
              id: job.id,
              jobId: job.jobId,
              customerName: job.customer
                ? `${job.customer.firstName} ${job.customer.lastName}`
                : 'Unknown',
              status: job.status,
              createdAt: job.createdAt,
            })),
            salesOrders: recentSalesOrders.map((so) => ({
              id: so.id,
              orderNumber: so.orderNumber,
              customerName: so.customer
                ? `${so.customer.firstName} ${so.customer.lastName}`
                : 'Unknown',
              totalAmount: so.totalAmount,
              createdAt: so.createdAt,
            })),
          },
        },
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch dashboard stats',
      });
    }
  });

  /**
   * GET /api/v1/reports/jobs-by-status
   * Get job counts grouped by status
   */
  server.get('/jobs-by-status', async (request, reply) => {
    try {
      const jobsByStatus = await prisma.job.groupBy({
        by: ['status'],
        _count: true,
      });

      return reply.status(200).send({
        success: true,
        data: jobsByStatus.map((item) => ({
          status: item.status,
          count: item._count,
        })),
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch jobs by status',
      });
    }
  });
}
