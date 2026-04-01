// RolliWorking Webhook Handlers
// Receives events from RolliWorking using integration contracts

import { FastifyInstance } from 'fastify';
import {
  WebhookEvent,
  JobStatusUpdateEvent,
  WatchmakerAssignmentEvent,
  JobFinishedEvent,
  PartsApprovedEvent,
  TcAcceptanceEvent,
  DailyHitListEvent,
  InspectionEvent,
  TestResultsEvent,
  EVENT_TYPES,
} from '@rollisuite/integration-contracts';
import { prisma } from '../../db/client';
import { updateJobStatusFromWebhook } from '../../modules/jobs/service';

export default async function rolliWorkingWebhooks(server: FastifyInstance) {
  // Helper to log received webhooks
  async function logWebhook(eventType: string, payload: any) {
    await prisma.receivedWebhookEvent.create({
      data: {
        source: 'rolliworking',
        eventType,
        payload,
        status: 'pending',
      },
    });
  }

  // 1. Job Status Update
  server.post('/job-status', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<JobStatusUpdateEvent>;
      const { jobId, newStatus, updatedBy, notes } = event.payload;

      console.log('[RW Webhook] Job status:', jobId, '→', newStatus);

      await logWebhook(EVENT_TYPES.JOB_STATUS_UPDATE, event.payload);

      // Find job by jobId or estimate number
      const job = await prisma.job.findFirst({
        where: {
          OR: [
            { jobId },
            { estimateNumber: event.payload.estimateNumber },
          ],
        },
      });

      if (job) {
        await updateJobStatusFromWebhook(job.id, newStatus, updatedBy, notes);
      } else {
        console.warn('[RW Webhook] Job not found:', jobId);
      }

      return reply.send({ success: true, message: 'Status updated' });
    } catch (error: any) {
      console.error('[RW Webhook] Job status error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 2. Watchmaker Assignment
  server.post('/watchmaker-assignment', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<WatchmakerAssignmentEvent>;
      const { jobId, watchmakerId } = event.payload;

      console.log('[RW Webhook] Assignment:', jobId, '→', watchmakerId);

      await logWebhook(EVENT_TYPES.WATCHMAKER_ASSIGNED, event.payload);

      const job = await prisma.job.findFirst({
        where: {
          OR: [{ jobId }, { estimateNumber: event.payload.estimateNumber }],
        },
      });

      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { assignedTo: watchmakerId },
        });
      }

      return reply.send({ success: true, message: 'Assignment recorded' });
    } catch (error: any) {
      console.error('[RW Webhook] Assignment error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 3. Job Finished
  server.post('/job-finished', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<JobFinishedEvent>;
      const { jobId, completedBy, completionNotes } = event.payload;

      console.log('[RW Webhook] Job finished:', jobId);

      await logWebhook(EVENT_TYPES.JOB_FINISHED, event.payload);

      const job = await prisma.job.findFirst({
        where: {
          OR: [{ jobId }, { estimateNumber: event.payload.estimateNumber }],
        },
      });

      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'ready_to_ship' },
        });

        if (completionNotes) {
          await prisma.jobActivityLog.create({
            data: {
              jobId: job.id,
              userId: completedBy || 'system',
              action: 'completed',
              details: completionNotes,
            },
          });
        }
      }

      return reply.send({ success: true, message: 'Job marked as finished' });
    } catch (error: any) {
      console.error('[RW Webhook] Job finished error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 4. Parts Approved
  server.post('/parts-approved', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<PartsApprovedEvent>;
      const { eventId, estimateNumber, approvedParts } = event.payload;

      console.log('[RW Webhook] Parts approved:', estimateNumber);

      // Check idempotency
      const existing = await prisma.receivedWebhookEvent.findFirst({
        where: {
          source: 'rolliworking',
          eventType: EVENT_TYPES.PARTS_APPROVED,
          payload: { path: ['eventId'], equals: eventId },
        },
      });

      if (existing) {
        console.log('[RW Webhook] Duplicate event ignored:', eventId);
        return reply.send({ success: true, message: 'Already processed' });
      }

      await logWebhook(EVENT_TYPES.PARTS_APPROVED, event.payload);

      // Find estimate and update
      const estimate = await prisma.estimate.findFirst({
        where: {
          estimateNumber: {
            in: [estimateNumber, `EST-${estimateNumber}`, `E${estimateNumber}`],
          },
        },
      });

      if (estimate) {
        // TODO: Add approved parts as line items
        console.log('[RW Webhook] Estimate found, parts approved');
      }

      return reply.send({ success: true, message: 'Parts approval recorded' });
    } catch (error: any) {
      console.error('[RW Webhook] Parts approved error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 5. T&C Acceptance
  server.post('/tc-acceptance', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<TcAcceptanceEvent>;
      const { estimateNumber } = event.payload;

      console.log('[RW Webhook] T&C accepted:', estimateNumber);

      await logWebhook(EVENT_TYPES.TC_ACCEPTED, event.payload);

      // Update corresponding sales order
      const salesOrder = await prisma.salesOrder.findFirst({
        where: {
          customer: {
            estimates: {
              some: { estimateNumber },
            },
          },
        },
      });

      if (salesOrder) {
        await prisma.salesOrder.update({
          where: { id: salesOrder.id },
          data: {
            tcAgreed: true,
            tcAgreedAt: new Date(event.payload.acceptedAt),
          },
        });
      }

      return reply.send({ success: true, message: 'T&C acceptance recorded' });
    } catch (error: any) {
      console.error('[RW Webhook] T&C acceptance error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 6. Daily Hit List
  server.post('/hit-list', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<DailyHitListEvent>;
      const { items, metadata } = event.payload;

      console.log('[RW Webhook] Hit list updated:', items.length, 'items');

      await logWebhook(EVENT_TYPES.DAILY_HIT_LIST, event.payload);

      // Store in cache for quick retrieval
      await prisma.cacheStore.upsert({
        where: { key: 'daily-hit-list' },
        create: {
          key: 'daily-hit-list',
          value: event.payload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        update: {
          value: event.payload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return reply.send({
        success: true,
        message: 'Hit list cached',
        itemCount: items.length,
      });
    } catch (error: any) {
      console.error('[RW Webhook] Hit list error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 7. Inspection Completed
  server.post('/inspection', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<InspectionEvent>;
      const { jobId, inspectionType, notes } = event.payload;

      console.log('[RW Webhook] Inspection:', jobId, inspectionType);

      await logWebhook(EVENT_TYPES.INSPECTION_COMPLETED, event.payload);

      // Log inspection activity
      const job = await prisma.job.findFirst({
        where: { jobId },
      });

      if (job) {
        await prisma.jobActivityLog.create({
          data: {
            jobId: job.id,
            userId: event.payload.performedBy || 'system',
            action: `inspection_${inspectionType}`,
            details: notes,
          },
        });
      }

      return reply.send({ success: true, message: 'Inspection recorded' });
    } catch (error: any) {
      console.error('[RW Webhook] Inspection error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // 8. Test Completed
  server.post('/test', async (request, reply) => {
    try {
      const event = request.body as WebhookEvent<TestResultsEvent>;
      const { jobId, testType, passed, results } = event.payload;

      console.log('[RW Webhook] Test:', jobId, testType, passed ? 'PASS' : 'FAIL');

      await logWebhook(EVENT_TYPES.TEST_COMPLETED, event.payload);

      const job = await prisma.job.findFirst({
        where: { jobId },
      });

      if (job) {
        // Store test results
        if (testType === 'timing' && results.timing) {
          await prisma.timingTest.create({
            data: {
              jobId: job.id,
              position: results.timing.position,
              rate: results.timing.rate,
              beatError: results.timing.beatError,
              amplitude: results.timing.amplitude,
              performedBy: event.payload.performedBy || 'system',
            },
          });
        } else if (testType === 'pressure' && results.pressure) {
          await prisma.pressureTest.create({
            data: {
              jobId: job.id,
              pressure: results.pressure.pressure,
              result: results.pressure.result,
              performedBy: event.payload.performedBy || 'system',
            },
          });
        }
      }

      return reply.send({ success: true, message: 'Test results recorded' });
    } catch (error: any) {
      console.error('[RW Webhook] Test error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
