// Parts & Inventory Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createPart,
  getPart,
  updatePart,
  deletePart,
  searchParts,
  getLowStockParts,
  adjustInventory,
} from './service';
import { z } from 'zod';

const createPartSchema = z.object({
  partNumber: z.string().min(1),
  description: z.string().min(1),
  itemType: z.enum(['part', 'labor', 'service', 'other']).optional(),
  uom: z.enum(['each', 'hour', 'ft', 'lb', 'kg', 'gram', 'oz']).optional(),
  defaultSellPrice: z.number().optional(),
  averageCost: z.number().optional(),
  reorderPoint: z.number().int().optional(),
  reorderQty: z.number().int().optional(),
});

const updatePartSchema = createPartSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const adjustInventorySchema = z.object({
  partId: z.string(),
  binId: z.string(),
  adjustment: z.number(),
  reason: z.string(),
});

export default async function partsRoutes(server: FastifyInstance) {
  // All routes require authentication
  const authPreHandler = [
    authenticateJWT,
    requireRole(['admin', 'manager', 'office', 'staff']),
  ];

  // Create part
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createPartSchema.parse(request.body);
      const part = await createPart(data);
      return reply.code(201).send(part);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Part number already exists' });
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  // Get all parts (with filters)
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const result = await searchParts({
        search: query.search,
        itemType: query.itemType,
        isActive: query.isActive !== 'false',
        page: query.page ? parseInt(query.page) : 1,
        perPage: query.perPage ? parseInt(query.perPage) : 20,
      });
      return reply.send(result);
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get low stock parts
  server.get(
    '/low-stock',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const parts = await getLowStockParts();
        return reply.send(parts);
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get single part
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const part = await getPart(id);
      return reply.send(part);
    } catch (error: any) {
      if (error.message === 'Part not found') {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message });
    }
  });

  // Update part
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updatePartSchema.parse(request.body);
      const part = await updatePart(id, data);
      return reply.send(part);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Delete part (soft delete)
  server.delete(
    '/:id',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await deletePart(id);
        return reply.code(204).send();
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    }
  );

  // Adjust inventory
  server.post(
    '/adjust',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const data = adjustInventorySchema.parse(request.body);
        const user = (request as any).user;
        const part = await adjustInventory(
          data.partId,
          data.binId,
          data.adjustment,
          data.reason,
          user.userId
        );
        return reply.send(part);
      } catch (error: any) {
        return reply.code(400).send({ error: error.message });
      }
    }
  );
}
