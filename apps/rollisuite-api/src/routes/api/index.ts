import { FastifyInstance } from 'fastify';
import { authRoutes } from '../../modules/auth';
import { qboRoutes } from '../../modules/qbo';
import { customersRoutes } from '../../modules/customers';
import { estimatesRoutes } from '../../modules/estimates';
import { salesOrdersRoutes } from '../../modules/sales-orders';
import { jobsRoutes } from '../../modules/jobs';
import { dailyHitListRoutes } from '../../modules/daily-hit-list';
import { dashboardRoutes } from '../../modules/dashboard';
import watchesRoutes from '../../modules/watches';
import partsRoutes from '../../modules/parts';
import { notificationsRoutes } from '../../modules/notifications/routes';
import { waitlistRoutes } from '../../modules/waitlist';
import { emailTemplatesRoutes } from '../../modules/email-templates';
import { jobTemplatesRoutes } from '../../modules/job-templates';

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
  await server.register(watchesRoutes, { prefix: '/v1/watches' });
  await server.register(partsRoutes, { prefix: '/v1/parts' });
  await server.register(waitlistRoutes, { prefix: '/v1/waitlist' });
  await server.register(emailTemplatesRoutes, { prefix: '/v1/email-templates' });
  await server.register(jobTemplatesRoutes, { prefix: '/v1/job-templates' });
  
  // QuickBooks Online Integration (authenticated)
  await server.register(qboRoutes, { prefix: '/qbo' });
  
  // Notifications (Email/SMS)
  await server.register(notificationsRoutes, { prefix: '/v1/notifications' });
  
  // TODO: Register additional API route modules
  // await server.register(inventoryRoutes, { prefix: '/inventory' });
  // await server.register(purchasingRoutes, { prefix: '/purchasing' });
}
