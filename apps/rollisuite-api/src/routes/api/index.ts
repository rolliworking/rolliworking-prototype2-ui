import { FastifyInstance } from 'fastify';
import { qboRoutes } from '../../modules/qbo';

export default async function apiRoutes(server: FastifyInstance) {
  // Internal API routes (authenticated)
  
  server.get('/test', async (request, reply) => {
    return { message: 'API routes working' };
  });
  
  // QuickBooks Online Integration
  await server.register(qboRoutes, { prefix: '/qbo' });
  
  // TODO: Register additional API route modules
  // await server.register(customersRoutes, { prefix: '/customers' });
  // await server.register(estimatesRoutes, { prefix: '/estimates' });
  // await server.register(jobsRoutes, { prefix: '/jobs' });
  // await server.register(salesOrdersRoutes, { prefix: '/sales-orders' });
  // await server.register(inventoryRoutes, { prefix: '/inventory' });
  // await server.register(purchasingRoutes, { prefix: '/purchasing' });
}
