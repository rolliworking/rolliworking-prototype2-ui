import { FastifyInstance } from 'fastify';
import { authRoutes } from '../../modules/auth';
import { qboRoutes } from '../../modules/qbo';
import { customersRoutes } from '../../modules/customers';
import { estimatesRoutes } from '../../modules/estimates';
import { salesOrdersRoutes } from '../../modules/sales-orders';
import { jobsRoutes } from '../../modules/jobs';
import { dailyHitListRoutes } from '../../modules/daily-hit-list';
import { dashboardRoutes } from '../../modules/dashboard';

export default async function apiRoutes(server: FastifyInstance) {
  // Internal API routes (authenticated)
  
  server.get('/test', async (request, reply) => {
    return { message: 'API routes working', timestamp: new Date().toISOString() };
  });
  
  // Authentication (public routes)
  await server.register(authRoutes, { prefix: '/auth' });
  
  // Dashboard & Daily Hit List
  await server.register(dashboardRoutes, { prefix: '/v1/dashboard' });
  await server.register(dailyHitListRoutes, { prefix: '/v1/daily-hit-list' });
  
  // Core CRUD APIs (authenticated)
  await server.register(customersRoutes, { prefix: '/customers' });
  await server.register(estimatesRoutes, { prefix: '/estimates' });
  await server.register(salesOrdersRoutes, { prefix: '/sales-orders' });
  await server.register(jobsRoutes, { prefix: '/jobs' });
  
  // QuickBooks Online Integration (authenticated)
  await server.register(qboRoutes, { prefix: '/qbo' });
  
  // TODO: Register additional API route modules
  // await server.register(inventoryRoutes, { prefix: '/inventory' });
  // await server.register(purchasingRoutes, { prefix: '/purchasing' });
}
