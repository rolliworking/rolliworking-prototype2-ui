// Customers Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  findDuplicateCustomers,
} from './service';
import { z } from 'zod';

const createCustomerSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
  isShipDirect: z.boolean().optional(),
  isTradePricing: z.boolean().optional(),
  skipShippingInfo: z.boolean().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

export default async function customersRoutes(server: FastifyInstance) {
  // All routes require authentication
  const authPreHandler = [authenticateJWT, requireRole(['admin', 'manager', 'office', 'front_desk'])];

  // Create customer
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createCustomerSchema.parse(request.body);

      // Check for duplicates
      if (data.email || data.phone) {
        const duplicates = await findDuplicateCustomers(data.email, data.phone);
        if (duplicates.length > 0) {
          return reply.status(409).send({
            error: 'Duplicate customer found',
            duplicates,
          });
        }
      }

      const customer = await createCustomer(data);
      return reply.status(201).send({ success: true, customer });
    } catch (error: any) {
      console.error('[Customers] Create error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get customer by ID
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const customer = await getCustomer(id);
      return reply.send({ success: true, customer });
    } catch (error: any) {
      if (error.message === 'Customer not found') {
        return reply.status(404).send({ error: error.message });
      }
      console.error('[Customers] Get error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update customer
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateCustomerSchema.parse(request.body);

      const customer = await updateCustomer(id, data);
      return reply.send({ success: true, customer });
    } catch (error: any) {
      console.error('[Customers] Update error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete customer
  server.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireRole(['admin', 'manager'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await deleteCustomer(id);
        return reply.send({ success: true, message: 'Customer deleted' });
      } catch (error: any) {
        console.error('[Customers] Delete error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Search customers
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const filters = {
        search: query.search,
        isShipDirect: query.isShipDirect === 'true' ? true : query.isShipDirect === 'false' ? false : undefined,
        isTradePricing: query.isTradePricing === 'true' ? true : query.isTradePricing === 'false' ? false : undefined,
        page: parseInt(query.page || '1'),
        perPage: parseInt(query.perPage || '50'),
      };

      const result = await searchCustomers(filters);
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      console.error('[Customers] Search error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Check for duplicates
  server.post('/check-duplicates', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { email, phone } = request.body as { email?: string; phone?: string };
      const duplicates = await findDuplicateCustomers(email, phone);
      return reply.send({ success: true, duplicates });
    } catch (error: any) {
      console.error('[Customers] Check duplicates error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
