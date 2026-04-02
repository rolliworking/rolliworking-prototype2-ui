import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client';

// Validation schemas
const CreateJobTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  serviceType: z.enum(['repair', 'restoration', 'appraisal', 'consignment']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  estimatedDays: z.number().int().positive().optional(),
  defaultPrice: z.number().positive().optional(),
  intakeNotes: z.string().optional(),
  conditionNotes: z.string().optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpdateJobTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  serviceType: z.enum(['repair', 'restoration', 'appraisal', 'consignment']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  estimatedDays: z.number().int().positive().optional(),
  defaultPrice: z.number().positive().optional(),
  intakeNotes: z.string().optional(),
  conditionNotes: z.string().optional(),
  instructions: z.string().optional(),
  isActive: z.boolean().optional(),
});

const QuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  serviceType: z.string().optional(),
  isActive: z.string().optional(),
});

export async function jobTemplatesRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/job-templates
   * Get all job templates with pagination
   */
  server.get('/', async (request, reply) => {
    const query = QuerySchema.parse(request.query);
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;

    // Build filters
    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    if (query.serviceType) {
      where.serviceType = query.serviceType;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { instructions: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [templates, total] = await Promise.all([
        prisma.jobTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.jobTemplate.count({ where }),
      ]);

      return reply.status(200).send({
        success: true,
        data: templates,
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
        error: error.message || 'Failed to fetch job templates',
      });
    }
  });

  /**
   * GET /api/v1/job-templates/:id
   * Get a single job template by ID
   */
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await prisma.jobTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Job template not found',
        });
      }

      return reply.status(200).send({
        success: true,
        data: template,
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to fetch job template',
      });
    }
  });

  /**
   * POST /api/v1/job-templates
   * Create a new job template
   */
  server.post('/', async (request, reply) => {
    const body = CreateJobTemplateSchema.parse(request.body);

    try {
      // Check for duplicate name
      const existing = await prisma.jobTemplate.findUnique({
        where: { name: body.name },
      });

      if (existing) {
        return reply.status(400).send({
          success: false,
          error: 'A template with this name already exists',
        });
      }

      const template = await prisma.jobTemplate.create({
        data: {
          name: body.name,
          description: body.description,
          serviceType: body.serviceType,
          priority: body.priority || 'normal',
          estimatedDays: body.estimatedDays,
          defaultPrice: body.defaultPrice,
          intakeNotes: body.intakeNotes,
          conditionNotes: body.conditionNotes,
          instructions: body.instructions,
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: template,
        message: 'Job template created successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to create job template',
      });
    }
  });

  /**
   * PATCH /api/v1/job-templates/:id
   * Update a job template
   */
  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateJobTemplateSchema.parse(request.body);

    try {
      // Check for duplicate name if name is being changed
      if (body.name) {
        const existing = await prisma.jobTemplate.findFirst({
          where: {
            name: body.name,
            NOT: { id },
          },
        });

        if (existing) {
          return reply.status(400).send({
            success: false,
            error: 'A template with this name already exists',
          });
        }
      }

      const template = await prisma.jobTemplate.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          serviceType: body.serviceType,
          priority: body.priority,
          estimatedDays: body.estimatedDays,
          defaultPrice: body.defaultPrice,
          intakeNotes: body.intakeNotes,
          conditionNotes: body.conditionNotes,
          instructions: body.instructions,
          isActive: body.isActive,
        },
      });

      return reply.status(200).send({
        success: true,
        data: template,
        message: 'Job template updated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to update job template',
      });
    }
  });

  /**
   * DELETE /api/v1/job-templates/:id
   * Delete a job template
   */
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.jobTemplate.delete({
        where: { id },
      });

      return reply.status(200).send({
        success: true,
        message: 'Job template deleted successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to delete job template',
      });
    }
  });

  /**
   * POST /api/v1/job-templates/:id/duplicate
   * Duplicate a job template
   */
  server.post('/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const original = await prisma.jobTemplate.findUnique({
        where: { id },
      });

      if (!original) {
        return reply.status(404).send({
          success: false,
          error: 'Job template not found',
        });
      }

      // Create copy with unique name
      const copyNumber = await prisma.jobTemplate.count({
        where: {
          name: {
            startsWith: `${original.name} (Copy`,
          },
        },
      });

      const newName = copyNumber > 0 
        ? `${original.name} (Copy ${copyNumber + 1})`
        : `${original.name} (Copy)`;

      const template = await prisma.jobTemplate.create({
        data: {
          name: newName,
          description: original.description,
          serviceType: original.serviceType,
          priority: original.priority,
          estimatedDays: original.estimatedDays,
          defaultPrice: original.defaultPrice,
          intakeNotes: original.intakeNotes,
          conditionNotes: original.conditionNotes,
          instructions: original.instructions,
          isActive: false, // New copies start as inactive
        },
      });

      return reply.status(201).send({
        success: true,
        data: template,
        message: 'Job template duplicated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to duplicate job template',
      });
    }
  });
}
