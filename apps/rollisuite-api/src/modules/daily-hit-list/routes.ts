import { FastifyInstance } from 'fastify';
import { dailyHitListService } from './service';
import { authenticate } from '../../middleware/auth';

export async function dailyHitListRoutes(server: FastifyInstance) {
  // GET /api/v1/daily-hit-list - Get today's hit list
  server.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const hitList = await dailyHitListService.getTodayHitList();
        return reply.send({
          success: true,
          data: hitList,
        });
      } catch (error) {
        server.log.error('Error fetching daily hit list:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch daily hit list',
        });
      }
    }
  );

  // GET /api/v1/daily-hit-list/:date - Get hit list for specific date
  server.get(
    '/:date',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const { date } = request.params as { date: string };
        const targetDate = new Date(date);

        if (isNaN(targetDate.getTime())) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid date format',
          });
        }

        const hitList = await dailyHitListService.getHitListByDate(targetDate);

        if (!hitList) {
          return reply.status(404).send({
            success: false,
            error: 'No hit list found for this date',
          });
        }

        return reply.send({
          success: true,
          data: hitList,
        });
      } catch (error) {
        server.log.error('Error fetching hit list by date:', error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch hit list',
        });
      }
    }
  );
}
