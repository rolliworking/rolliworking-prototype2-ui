import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client';

// Validation schemas
const CreateEmailTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  isActive: z.boolean().optional(),
});

const UpdateEmailTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  subject: z.string().min(1).optional(),
  htmlBody: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const QuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  isActive: z.string().optional(),
});

export async function emailTemplatesRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/email-templates
   * Get all email templates with pagination
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

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { subject: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    try {
      const [templates, total] = await Promise.all([
        prisma.emailTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.emailTemplate.count({ where }),
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
        error: error.message || 'Failed to fetch email templates',
      });
    }
  });

  /**
   * GET /api/v1/email-templates/:id
   * Get a single email template by ID
   */
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const template = await prisma.emailTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Email template not found',
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
        error: error.message || 'Failed to fetch email template',
      });
    }
  });

  /**
   * POST /api/v1/email-templates
   * Create a new email template
   */
  server.post('/', async (request, reply) => {
    const body = CreateEmailTemplateSchema.parse(request.body);

    try {
      // Check for duplicate name
      const existing = await prisma.emailTemplate.findUnique({
        where: { name: body.name },
      });

      if (existing) {
        return reply.status(400).send({
          success: false,
          error: 'A template with this name already exists',
        });
      }

      const template = await prisma.emailTemplate.create({
        data: {
          name: body.name,
          description: body.description,
          subject: body.subject,
          htmlBody: body.htmlBody,
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: template,
        message: 'Email template created successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to create email template',
      });
    }
  });

  /**
   * PATCH /api/v1/email-templates/:id
   * Update an email template
   */
  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateEmailTemplateSchema.parse(request.body);

    try {
      // Check for duplicate name if name is being changed
      if (body.name) {
        const existing = await prisma.emailTemplate.findFirst({
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

      const template = await prisma.emailTemplate.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          subject: body.subject,
          htmlBody: body.htmlBody,
          isActive: body.isActive,
        },
      });

      return reply.status(200).send({
        success: true,
        data: template,
        message: 'Email template updated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to update email template',
      });
    }
  });

  /**
   * DELETE /api/v1/email-templates/:id
   * Delete an email template
   */
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.emailTemplate.delete({
        where: { id },
      });

      return reply.status(200).send({
        success: true,
        message: 'Email template deleted successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to delete email template',
      });
    }
  });

  /**
   * POST /api/v1/email-templates/:id/duplicate
   * Duplicate an email template
   */
  server.post('/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const original = await prisma.emailTemplate.findUnique({
        where: { id },
      });

      if (!original) {
        return reply.status(404).send({
          success: false,
          error: 'Email template not found',
        });
      }

      // Create copy with unique name
      const copyNumber = await prisma.emailTemplate.count({
        where: {
          name: {
            startsWith: `${original.name} (Copy`,
          },
        },
      });

      const newName = copyNumber > 0 
        ? `${original.name} (Copy ${copyNumber + 1})`
        : `${original.name} (Copy)`;

      const template = await prisma.emailTemplate.create({
        data: {
          name: newName,
          description: original.description,
          subject: original.subject,
          htmlBody: original.htmlBody,
          isActive: false, // New copies start as inactive
        },
      });

      return reply.status(201).send({
        success: true,
        data: template,
        message: 'Email template duplicated successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to duplicate email template',
      });
    }
  });

  /**
   * GET /api/v1/email-templates/variables
   * Get available template variables
   */
  server.get('/variables', async (request, reply) => {
    const variables = {
      customer: [
        { key: '{{customerFirstName}}', description: 'Customer first name' },
        { key: '{{customerLastName}}', description: 'Customer last name' },
        { key: '{{customerFullName}}', description: 'Customer full name' },
        { key: '{{customerEmail}}', description: 'Customer email address' },
        { key: '{{customerPhone}}', description: 'Customer phone number' },
      ],
      estimate: [
        { key: '{{estimateNumber}}', description: 'Estimate number' },
        { key: '{{estimateDate}}', description: 'Estimate creation date' },
        { key: '{{estimateTotal}}', description: 'Total estimate amount' },
        { key: '{{estimateSubtotal}}', description: 'Subtotal before tax' },
      ],
      job: [
        { key: '{{jobNumber}}', description: 'Job number' },
        { key: '{{jobStatus}}', description: 'Current job status' },
        { key: '{{jobPriority}}', description: 'Job priority level' },
      ],
      salesOrder: [
        { key: '{{orderNumber}}', description: 'Sales order number' },
        { key: '{{orderDate}}', description: 'Order date' },
        { key: '{{orderTotal}}', description: 'Total order amount' },
      ],
      watch: [
        { key: '{{watchBrand}}', description: 'Watch brand' },
        { key: '{{watchModel}}', description: 'Watch model' },
        { key: '{{watchSerial}}', description: 'Watch serial number' },
      ],
      company: [
        { key: '{{companyName}}', description: 'Company name (Rolliworks)' },
        { key: '{{companyEmail}}', description: 'Company email' },
        { key: '{{companyPhone}}', description: 'Company phone' },
        { key: '{{companyAddress}}', description: 'Company address' },
      ],
      system: [
        { key: '{{currentDate}}', description: 'Current date' },
        { key: '{{currentYear}}', description: 'Current year' },
      ],
    };

    return reply.status(200).send({
      success: true,
      data: variables,
    });
  });
}
