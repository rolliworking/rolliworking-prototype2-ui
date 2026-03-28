import { FastifyInstance } from 'fastify';

export default async function webhookRoutes(server: FastifyInstance) {
  // External webhook endpoints (authenticated via API keys)
  
  server.post('/test', async (request, reply) => {
    return { message: 'Webhook routes working' };
  });
  
  // TODO: Register all webhook route modules
  // await server.register(qboWebhooks, { prefix: '/qbo' });
  // await server.register(rwWebhooks, { prefix: '/rw' });
  // await server.register(wixWebhooks, { prefix: '/wix' });
  // await server.register(partsWebhooks, { prefix: '/parts' });
}
