import { FastifyInstance } from 'fastify';

export default async function publicRoutes(server: FastifyInstance) {
  // Public routes (no authentication)
  
  server.get('/test', async (request, reply) => {
    return { message: 'Public routes working' };
  });
  
  // TODO: Register all public route modules
  // await server.register(pickupPassRoutes, { prefix: '/pickup-pass' });
  // await server.register(appointmentRoutes, { prefix: '/appointments' });
  // await server.register(shippingLabelRequestRoutes, { prefix: '/shipping-label-request' });
  // await server.register(photoUploadRoutes, { prefix: '/photo-upload' });
  // await server.register(shortUrlRoutes, { prefix: '/go' });
}
