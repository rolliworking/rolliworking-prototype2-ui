import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sendEmail } from './email';
import {
  sendSMS,
  sendPickupReadySMS,
  sendEstimateSMS,
  sendWatchIntakeSMS,
  sendCustomerSMS,
} from './sms';

// Request schemas
const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().min(1),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
});

const SendSMSSchema = z.object({
  to: z.string().min(10), // Phone number
  message: z.string().min(1).max(1600), // SMS character limit
});

const SendPickupSMSSchema = z.object({
  salesOrderId: z.string(),
  customerPhone: z.string().min(10),
});

const SendEstimateSMSSchema = z.object({
  estimateId: z.string(),
  customerPhone: z.string().min(10),
});

const SendWatchIntakeSMSSchema = z.object({
  watchId: z.string(),
  customerPhone: z.string().min(10),
});

const SendCustomerSMSSchema = z.object({
  customerId: z.string(),
  message: z.string().min(1).max(1600),
});

export async function notificationsRoutes(server: FastifyInstance) {
  /**
   * POST /api/v1/notifications/email
   * Send a custom email
   */
  server.post('/email', async (request, reply) => {
    const body = SendEmailSchema.parse(request.body);

    try {
      const emailId = await sendEmail({
        to: body.to,
        subject: body.subject,
        html: body.html,
        bcc: body.bcc,
      });

      return reply.status(200).send({
        success: true,
        emailId,
        message: 'Email sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send email',
      });
    }
  });

  /**
   * POST /api/v1/notifications/sms
   * Send a custom SMS
   */
  server.post('/sms', async (request, reply) => {
    const body = SendSMSSchema.parse(request.body);

    try {
      const smsId = await sendSMS({
        to: body.to,
        message: body.message,
      });

      return reply.status(200).send({
        success: true,
        smsId,
        message: 'SMS sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send SMS',
      });
    }
  });

  /**
   * POST /api/v1/notifications/sms/pickup-ready
   * Send pickup ready SMS notification
   */
  server.post('/sms/pickup-ready', async (request, reply) => {
    const body = SendPickupSMSSchema.parse(request.body);

    try {
      const smsId = await sendPickupReadySMS(
        body.salesOrderId,
        body.customerPhone
      );

      return reply.status(200).send({
        success: true,
        smsId,
        message: 'Pickup ready SMS sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send pickup SMS',
      });
    }
  });

  /**
   * POST /api/v1/notifications/sms/estimate
   * Send estimate ready SMS notification
   */
  server.post('/sms/estimate', async (request, reply) => {
    const body = SendEstimateSMSSchema.parse(request.body);

    try {
      const smsId = await sendEstimateSMS(
        body.estimateId,
        body.customerPhone
      );

      return reply.status(200).send({
        success: true,
        smsId,
        message: 'Estimate SMS sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send estimate SMS',
      });
    }
  });

  /**
   * POST /api/v1/notifications/sms/watch-intake
   * Send watch intake confirmation SMS
   */
  server.post('/sms/watch-intake', async (request, reply) => {
    const body = SendWatchIntakeSMSSchema.parse(request.body);

    try {
      const smsId = await sendWatchIntakeSMS(
        body.watchId,
        body.customerPhone
      );

      return reply.status(200).send({
        success: true,
        smsId,
        message: 'Watch intake SMS sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send watch intake SMS',
      });
    }
  });

  /**
   * POST /api/v1/notifications/sms/customer
   * Send custom SMS to a customer
   */
  server.post('/sms/customer', async (request, reply) => {
    const body = SendCustomerSMSSchema.parse(request.body);

    try {
      const smsId = await sendCustomerSMS(
        body.customerId,
        body.message
      );

      return reply.status(200).send({
        success: true,
        smsId,
        message: 'Customer SMS sent successfully',
      });
    } catch (error: any) {
      server.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send customer SMS',
      });
    }
  });

  /**
   * GET /api/v1/notifications/status
   * Check notification services status
   */
  server.get('/status', async (request, reply) => {
    const emailConfigured = !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder';
    const smsConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;

    return reply.status(200).send({
      email: {
        configured: emailConfigured,
        provider: 'Resend',
      },
      sms: {
        configured: smsConfigured,
        provider: 'Twilio',
      },
    });
  });
}
