// Watches Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createWatch,
  getWatch,
  updateWatch,
  deleteWatch,
  searchWatches,
  getWatchesByCustomer,
} from './service';
import { z } from 'zod';

const createWatchSchema = z.object({
  customerId: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  referenceNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  movementType: z.string().optional(),
  caseMaterial: z.string().optional(),
  bandMaterial: z.string().optional(),
  notes: z.string().optional(),
});

const updateWatchSchema = createWatchSchema.partial();

export default async function watchesRoutes(server: FastifyInstance) {
  // All routes require authentication
  const authPreHandler = [authenticateJWT, requireRole(['admin', 'manager', 'office', 'front_desk', 'staff'])];

  // Create watch
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createWatchSchema.parse(request.body);
      const watch = await createWatch(data);
      return reply.code(201).send(watch);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Get all watches (with filters)
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const result = await searchWatches({
        search: query.search,
        customerId: query.customerId,
        brand: query.brand,
        page: query.page ? parseInt(query.page) : 1,
        perPage: query.perPage ? parseInt(query.perPage) : 20,
      });
      return reply.send(result);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get watches by customer
  server.get('/customer/:customerId', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { customerId } = request.params as { customerId: string };
      const watches = await getWatchesByCustomer(customerId);
      return reply.send(watches);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get single watch
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const watch = await getWatch(id);
      return reply.send(watch);
    } catch (error: any) {
      if (error.message === 'Watch not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update watch
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateWatchSchema.parse(request.body);
      const watch = await updateWatch(id, data);
      return reply.send(watch);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Delete watch
  server.delete('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await deleteWatch(id);
      return reply.code(204).send();
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
