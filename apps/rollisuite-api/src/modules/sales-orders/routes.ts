// Sales Orders Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createSalesOrder,
  getSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  searchSalesOrders,
  fulfillSalesOrder,
} from './service';
import { pushSalesOrderToQbo } from '../qbo/invoices';
import { z } from 'zod';

const lineItemSchema = z.object({
  partId: z.string(),
  qtyOrdered: z.number(),
  unitPrice: z.number(),
  unitCost: z.number().optional(),
  notes: z.string().optional(),
});

const createSalesOrderSchema = z.object({
  customerId: z.string(),
  jobId: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema),
});

const updateSalesOrderSchema = z.object({
  status: z
    .enum(['draft', 'pending', 'fulfilled', 'shipped', 'picked_up', 'closed'])
    .optional(),
  shipDate: z.string().optional(),
  notes: z.string().optional(),
  isPaid: z.boolean().optional(),
  balanceDue: z.number().optional(),
  tcAgreed: z.boolean().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export default async function salesOrdersRoutes(server: FastifyInstance) {
  const authPreHandler = [
    authenticateJWT,
    requireRole(['admin', 'manager', 'office']),
  ];

  // Create sales order
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createSalesOrderSchema.parse(request.body);
      const salesOrder = await createSalesOrder(data);
      return reply.status(201).send({ success: true, salesOrder });
    } catch (error: any) {
      console.error('[Sales Orders] Create error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get sales order
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const salesOrder = await getSalesOrder(id);
      return reply.send({ success: true, salesOrder });
    } catch (error: any) {
      if (error.message === 'Sales order not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update sales order
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateSalesOrderSchema.parse(request.body);

      const salesOrder = await updateSalesOrder(id, {
        ...data,
        shipDate: data.shipDate ? new Date(data.shipDate) : undefined,
      });

      return reply.send({ success: true, salesOrder });
    } catch (error: any) {
      console.error('[Sales Orders] Update error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete sales order
  server.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireRole(['admin', 'manager'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await deleteSalesOrder(id);
        return reply.send({ success: true, message: 'Sales order deleted' });
      } catch (error: any) {
        console.error('[Sales Orders] Delete error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Search sales orders
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const filters = {
        customerId: query.customerId,
        status: query.status,
        isPaid: query.isPaid === 'true',
        search: query.search,
        page: parseInt(query.page || '1'),
        perPage: parseInt(query.perPage || '50'),
      };

      const result = await searchSalesOrders(filters);
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      console.error('[Sales Orders] Search error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Fulfill sales order
  server.post(
    '/:id/fulfill',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { shipDate } = request.body as { shipDate?: string };

        const salesOrder = await fulfillSalesOrder(
          id,
          shipDate ? new Date(shipDate) : undefined
        );

        return reply.send({
          success: true,
          salesOrder,
          message: 'Sales order fulfilled',
        });
      } catch (error: any) {
        console.error('[Sales Orders] Fulfill error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Push to QuickBooks (create invoice)
  server.post(
    '/:id/push-to-qbo',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await pushSalesOrderToQbo(id);

        return reply.send({
          success: true,
          qboInvoiceId: result.qboInvoiceId,
          message: result.message,
        });
      } catch (error: any) {
        console.error('[Sales Orders] QBO push error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
