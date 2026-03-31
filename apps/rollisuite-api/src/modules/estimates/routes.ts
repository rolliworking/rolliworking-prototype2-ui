// Estimates Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createEstimate,
  getEstimate,
  updateEstimate,
  deleteEstimate,
  searchEstimates,
  convertEstimateToSalesOrder,
} from './service';
import { sendEstimateEmail } from '../notifications/email';
import { z } from 'zod';

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  partId: z.string().optional(),
  lineType: z.string(),
  sortOrder: z.number().optional(),
});

const createEstimateSchema = z.object({
  customerId: z.string(),
  serviceType: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  templateId: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

const updateEstimateSchema = z.object({
  status: z.enum(['draft', 'sent', 'approved', 'converted', 'declined', 'expired', 'on_hold']).optional(),
  serviceType: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  totalAmount: z.number().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export default async function estimatesRoutes(server: FastifyInstance) {
  const authPreHandler = [authenticateJWT, requireRole(['admin', 'manager', 'office'])];

  // Create estimate
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createEstimateSchema.parse(request.body);
      const estimate = await createEstimate(data);
      return reply.status(201).send({ success: true, estimate });
    } catch (error: any) {
      console.error('[Estimates] Create error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get estimate
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const estimate = await getEstimate(id);
      return reply.send({ success: true, estimate });
    } catch (error: any) {
      if (error.message === 'Estimate not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update estimate
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateEstimateSchema.parse(request.body);
      const estimate = await updateEstimate(id, data);
      return reply.send({ success: true, estimate });
    } catch (error: any) {
      console.error('[Estimates] Update error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete estimate
  server.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireRole(['admin', 'manager'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await deleteEstimate(id);
        return reply.send({ success: true, message: 'Estimate deleted' });
      } catch (error: any) {
        console.error('[Estimates] Delete error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Search estimates
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const filters = {
        customerId: query.customerId,
        status: query.status,
        search: query.search,
        page: parseInt(query.page || '1'),
        perPage: parseInt(query.perPage || '50'),
      };

      const result = await searchEstimates(filters);
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      console.error('[Estimates] Search error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Convert estimate to sales order
  server.post(
    '/:id/convert',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const salesOrder = await convertEstimateToSalesOrder(id);
        return reply.send({
          success: true,
          salesOrder,
          message: 'Estimate converted to sales order',
        });
      } catch (error: any) {
        console.error('[Estimates] Convert error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Send estimate email
  server.post(
    '/:id/send',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { toEmail, subject, body, sendCopy } = request.body as {
          toEmail: string;
          subject?: string;
          body?: string;
          sendCopy?: boolean;
        };

        const emailId = await sendEstimateEmail(
          id,
          toEmail,
          subject,
          body,
          sendCopy
        );

        return reply.send({
          success: true,
          emailId,
          message: 'Estimate sent successfully',
        });
      } catch (error: any) {
        console.error('[Estimates] Send error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
