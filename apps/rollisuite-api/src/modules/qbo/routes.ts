// QuickBooks Online Routes
import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  saveTokens,
} from './oauth';
import { pushCustomerToQbo } from './customers';
import { pushSalesOrderToQbo, syncInvoiceStatus } from './invoices';
import { config } from '../../config';
import { authenticateJWT, requireRole } from '../../middleware/auth';

/**
 * Verify QuickBooks webhook signature
 * QBO uses HMAC-SHA256 with the webhook verifier token
 */
function verifyQBOWebhookSignature(
  payload: string,
  signature: string,
  verifierToken: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', verifierToken);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('[QBO] Signature verification error:', error);
    return false;
  }
}

export default async function qboRoutes(server: FastifyInstance) {
  // OAuth2 Flow - Initiate
  server.get(
    '/connect',
    { preHandler: [authenticateJWT, requireRole(['admin'])] },
    async (request, reply) => {
      const state = Buffer.from(
        JSON.stringify({ userId: (request.user as any).id })
      ).toString('base64');

      const authUrl = getAuthorizationUrl(state);
      return reply.redirect(authUrl);
    }
  );

  // OAuth2 Callback
  server.get('/callback', async (request, reply) => {
    const { code, realmId, state } = request.query as {
      code?: string;
      realmId?: string;
      state?: string;
    };

    if (!code || !realmId) {
      return reply.status(400).send({ error: 'Missing code or realmId' });
    }

    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);

      // Save tokens
      await saveTokens(tokens, realmId, config.qbo.environment as any);

      return reply.send({
        success: true,
        message: 'QuickBooks connected successfully',
      });
    } catch (error: any) {
      console.error('[QBO OAuth] Callback error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Push Customer to QBO
  server.post(
    '/customer/push',
    {
      preHandler: [authenticateJWT, requireRole(['admin', 'manager', 'office'])],
      schema: {
        body: {
          type: 'object',
          required: ['customer_id'],
          properties: {
            customer_id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { customer_id } = request.body as { customer_id: string };

      try {
        const result = await pushCustomerToQbo(customer_id);
        return reply.send({
          success: true,
          qbo_customer_id: result.qboCustomerId,
          already_synced: result.alreadySynced,
          message: result.alreadySynced
            ? 'Customer already synced'
            : 'Customer pushed to QuickBooks',
        });
      } catch (error: any) {
        console.error('[QBO Customer] Push error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Push Sales Order to QBO (Create Invoice)
  server.post(
    '/sales-order/push',
    {
      preHandler: [authenticateJWT, requireRole(['admin', 'manager', 'office'])],
      schema: {
        body: {
          type: 'object',
          required: ['sales_order_id'],
          properties: {
            sales_order_id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sales_order_id } = request.body as { sales_order_id: string };

      try {
        const result = await pushSalesOrderToQbo(sales_order_id);
        return reply.send({
          success: true,
          qbo_invoice_id: result.qboInvoiceId,
          message: result.message,
        });
      } catch (error: any) {
        console.error('[QBO Invoice] Push error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Sync Invoice Status (called after payment webhook)
  server.post(
    '/invoice/sync-status',
    {
      preHandler: [authenticateJWT, requireRole(['admin', 'manager'])],
      schema: {
        body: {
          type: 'object',
          required: ['qbo_invoice_id'],
          properties: {
            qbo_invoice_id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { qbo_invoice_id } = request.body as { qbo_invoice_id: string };

      try {
        await syncInvoiceStatus(qbo_invoice_id);
        return reply.send({
          success: true,
          message: 'Invoice status synced',
        });
      } catch (error: any) {
        console.error('[QBO Invoice] Sync error:', error);
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // Payment Webhook (from QuickBooks)
  server.post('/webhook/payment', async (request, reply) => {
    try {
      // Verify webhook signature
      const signature = request.headers['intuit-signature'] as string;
      const rawPayload = JSON.stringify(request.body);
      
      if (!signature) {
        console.error('[QBO Webhook] Missing signature header');
        return reply.status(401).send({ error: 'Missing signature' });
      }
      
      const isValid = verifyQBOWebhookSignature(
        rawPayload,
        signature,
        config.qbo.webhookVerifierToken
      );
      
      if (!isValid) {
        console.error('[QBO Webhook] Invalid signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }
      
      const payload = request.body as any;

      console.log('[QBO Webhook] Payment received (verified):', payload);

      // Extract invoice IDs from webhook
      const invoiceIds = payload.eventNotifications?.map(
        (event: any) => event.dataChangeEvent?.entities?.find(
          (e: any) => e.name === 'Payment'
        )?.id
      ).filter(Boolean) || [];

      // Sync each affected invoice
      for (const invoiceId of invoiceIds) {
        try {
          await syncInvoiceStatus(invoiceId);
        } catch (error) {
          console.error(`[QBO Webhook] Failed to sync invoice ${invoiceId}:`, error);
        }
      }

      return reply.send({ success: true });
    } catch (error: any) {
      console.error('[QBO Webhook] Error:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
