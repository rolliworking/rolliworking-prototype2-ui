// Jobs Routes
import { FastifyInstance } from 'fastify';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  searchJobs,
  assignJob,
} from './service';
import { z } from 'zod';

const createJobSchema = z.object({
  estimateNumber: z.string().optional(),
  customerId: z.string(),
  watchId: z.string(),
  status: z.enum(['intake', 'in_review', 'awaiting_customer_approval', 'approved', 'in_service', 'testing', 'ready_to_ship', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
  intakeNotes: z.string().optional(),
  conditionNotes: z.string().optional(),
  assignedTo: z.string().optional(),
});

const updateJobSchema = createJobSchema.partial();

export default async function jobsRoutes(server: FastifyInstance) {
  const authPreHandler = [
    authenticateJWT,
    requireRole(['admin', 'manager', 'office', 'staff']),
  ];

  // Create job
  server.post('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const data = createJobSchema.parse(request.body);
      const job = await createJob({
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });
      return reply.status(201).send({ success: true, job });
    } catch (error: any) {
      console.error('[Jobs] Create error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get job
  server.get('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await getJob(id);
      return reply.send({ success: true, job });
    } catch (error: any) {
      if (error.message === 'Job not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update job
  server.put('/:id', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateJobSchema.parse(request.body);
      const updatedBy = (request.user as any)?.userId;

      const job = await updateJob(
        id,
        {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
        updatedBy
      );

      return reply.send({ success: true, job });
    } catch (error: any) {
      console.error('[Jobs] Update error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Delete job
  server.delete(
    '/:id',
    { preHandler: [authenticateJWT, requireRole(['admin', 'manager'])] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await deleteJob(id);
        return reply.send({ success: true, message: 'Job deleted' });
      } catch (error: any) {
        console.error('[Jobs] Delete error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Search jobs
  server.get('/', { preHandler: authPreHandler }, async (request, reply) => {
    try {
      const query = request.query as any;
      const filters = {
        customerId: query.customerId,
        status: query.status,
        assignedTo: query.assignedTo,
        search: query.search,
        page: parseInt(query.page || '1'),
        perPage: parseInt(query.perPage || '50'),
      };

      const result = await searchJobs(filters);
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      console.error('[Jobs] Search error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Assign job to watchmaker
  server.post(
    '/:id/assign',
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { watchmakerId } = request.body as { watchmakerId: string };
        const assignedBy = (request.user as any)?.userId;

        const job = await assignJob(id, watchmakerId, assignedBy);

        return reply.send({
          success: true,
          job,
          message: 'Job assigned successfully',
        });
      } catch (error: any) {
        console.error('[Jobs] Assign error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
