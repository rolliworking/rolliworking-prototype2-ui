import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client';

// Validation schemas
const CreateWaitlistSchema = z.object({
  customerId: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serviceType: z.enum(['repair', 'restoration', 'appraisal', 'consignment']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  estimatedValue: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateWaitlistSchema = z.object({
  customerId: z.string().uuid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serviceType: z.enum(['repair', 'restoration', 'appraisal', 'consignment']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['waiting', 'contacted', 'scheduled', 'converted', 'declined', 'cancelled']).optional(),
  estimatedValue: z.number().optional(),
  notes: z.string().optional(),
  contactedAt: z.string().datetime().optional(),
  convertedAt: z.string().datetime().optional(),
  convertedToId: z.string().optional(),
});

const QuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
});

export async function waitlistRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/waitlist
   * Get all waitlist entries with pagination and filters
   */
  server.get('/', async (request, reply) => {
    const query = QuerySchema.parse(request.query);
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;

    // Build filters
    const where: any = {};
    
    if (query.status) {
      where.status = query.status;
    }
    
    if (query.priority) {
      where.priority = query.priority;
    }
    
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [entries, total] = await Promise.all([
        prisma.waitlist.findMany({
          where,
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        prisma.waitlist.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        data: entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch waitlist entries',
      });
    }
  });

  /**
   * GET /api/v1/waitlist/:id
   * Get a single waitlist entry by ID
   */
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const entry = await prisma.waitlist.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              state: true,
              zip: true,
            },
          },
        },
      });

      if (!entry) {
        return reply.status(404).send({
          success: false,
          error: 'Waitlist entry not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: entry,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch waitlist entry',
      });
    }
  });

  /**
   * POST /api/v1/waitlist
   * Create a new waitlist entry
   */
  server.post('/', async (request, reply) => {
    const body = CreateWaitlistSchema.parse(request.body);

    try {
      const entry = await prisma.waitlist.create({
        data: {
          customerId: body.customerId,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
          brand: body.brand,
          model: body.model,
          serviceType: body.serviceType,
          priority: body.priority || 'normal',
          estimatedValue: body.estimatedValue,
          notes: body.notes,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return reply.status(201).send({
        success: true,
        data: entry,
        message: 'Waitlist entry created successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to create waitlist entry',
      });
    }
  });

  /**
   * PATCH /api/v1/waitlist/:id
   * Update a waitlist entry
   */
  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateWaitlistSchema.parse(request.body);

    try {
      const entry = await prisma.waitlist.update({
        where: { id },
        data: {
          customerId: body.customerId,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
          brand: body.brand,
          model: body.model,
          serviceType: body.serviceType,
          priority: body.priority,
          status: body.status,
          estimatedValue: body.estimatedValue,
          notes: body.notes,
          contactedAt: body.contactedAt ? new Date(body.contactedAt) : undefined,
          convertedAt: body.convertedAt ? new Date(body.convertedAt) : undefined,
          convertedToId: body.convertedToId,
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      return reply.status(200).send({
        success: true,
        data: entry,
        message: 'Waitlist entry updated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to update waitlist entry',
      });
    }
  });

  /**
   * DELETE /api/v1/waitlist/:id
   * Delete a waitlist entry
   */
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.waitlist.delete({
        where: { id },
      });

      return reply.status(200).send({
        success: true,
        message: 'Waitlist entry deleted successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to delete waitlist entry',
      });
    }
  });

  /**
   * POST /api/v1/waitlist/:id/contact
   * Mark entry as contacted
   */
  server.post('/:id/contact', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const entry = await prisma.waitlist.update({
        where: { id },
        data: {
          status: 'contacted',
          contactedAt: new Date(),
        },
      });

      return reply.status(200).send({
        success: true,
        data: entry,
        message: 'Waitlist entry marked as contacted',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to mark as contacted',
      });
    }
  });

  /**
   * POST /api/v1/waitlist/:id/convert
   * Convert waitlist entry to job/estimate
   */
  server.post('/:id/convert', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { convertedToId, convertedToType } = request.body as { 
      convertedToId: string;
      convertedToType?: string;
    };

    try {
      const entry = await prisma.waitlist.update({
        where: { id },
        data: {
          status: 'converted',
          convertedAt: new Date(),
          convertedToId,
        },
      });

      return reply.status(200).send({
        success: true,
        data: entry,
        message: `Waitlist entry converted to ${convertedToType || 'record'}`,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to convert waitlist entry',
      });
    }
  });

  /**
   * GET /api/v1/waitlist/stats
   * Get waitlist statistics
   */
  server.get('/stats', async (request, reply) => {
    try {
      const [
        totalWaiting,
        totalContacted,
        totalConverted,
        highPriority,
        urgentPriority,
      ] = await Promise.all([
        prisma.waitlist.count({ where: { status: 'waiting' } }),
        prisma.waitlist.count({ where: { status: 'contacted' } }),
        prisma.waitlist.count({ where: { status: 'converted' } }),
        prisma.waitlist.count({ where: { priority: 'high' } }),
        prisma.waitlist.count({ where: { priority: 'urgent' } }),
      ]);

      return reply.status(200).send({
        success: true,
        data: {
          totalWaiting,
          totalContacted,
          totalConverted,
          highPriority,
          urgentPriority,
        },
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch waitlist stats',
      });
    }
  });
}
