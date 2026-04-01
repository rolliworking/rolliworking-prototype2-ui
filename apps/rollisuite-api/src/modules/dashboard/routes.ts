import { FastifyInstance } from 'fastify';
import { dashboardService } from './service';
import { authenticate } from '../../middleware/auth';

export async function dashboardRoutes(server: FastifyInstance) {
  // GET /api/v1/dashboard/stats - Get dashboard statistics
  server.get(
    '/stats',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const stats = await dashboardService.getStats();
        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        server.log.error('Error fetching dashboard stats:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch dashboard statistics',
        });
      }
    }
  );
}
