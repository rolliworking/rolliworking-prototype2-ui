import { FastifyInstance } from 'fastify';
import rolliWorkingWebhooks from './rolliworking';

export default async function webhookRoutes(server: FastifyInstance) {
  // External webhook endpoints (authenticated via API keys or signatures)
  
  server.post('/test', async (request, reply) => {
    return { message: 'Webhook routes working', timestamp: new Date().toISOString() };
  });
  
  // RolliWorking webhooks (8 event types)
  await server.register(rolliWorkingWebhooks, { prefix: '/rw' });
  
  // TODO: Register additional webhook handlers
  // await server.register(wixWebhooks, { prefix: '/wix' });
  // await server.register(partsWebhooks, { prefix: '/parts' });
}
