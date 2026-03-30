// QuickBooks Online Sales Order → Invoice Push
import { prisma } from '../../db/client';
import { config } from '../../config';
import { getValidAccessToken } from './oauth';

interface QboInvoiceLine {
  Id: string;
  LineNum: number;
  Description: string;
  Amount: number;
  DetailType: string;
  SalesItemLineDetail: {
    ItemRef?: { value: string };
    Qty: number;
    UnitPrice: number;
  };
}

interface QboInvoicePayload {
  CustomerRef: { value: string };
  Line: QboInvoiceLine[];
  PrivateNote?: string;
  DocNumber: string;
}

/**
 * Push Sales Order to QuickBooks as Invoice
 * CRITICAL: Contains save-before-push guard logic
 */
export async function pushSalesOrderToQbo(
  salesOrderId: string
): Promise<{ qboInvoiceId: string; message: string }> {
  // Get sales order with customer and lines
  const order = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      customer: true,
      lineItems: {
        include: {
          part: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  });

  if (!order) {
    throw new Error('Sales order not found');
  }

  // CRITICAL: Re-fetch customer to get latest qbo_customer_id
  // This handles the case where customer was just created in QBO
  const freshCustomer = await prisma.customer.findUnique({
    where: { id: order.customerId },
    select: { qboCustomerId: true },
  });

  if (!freshCustomer) {
    throw new Error('Failed to fetch customer data');
  }

  const qboCustomerId = freshCustomer.qboCustomerId;

  // Validate customer is synced
  if (!qboCustomerId) {
    throw new Error(
      'Customer is not synced with QuickBooks. Please sync the customer first.'
    );
  }

  // Get valid access token
  const accessToken = await getValidAccessToken();

  // Build invoice lines
  const invoiceLines: QboInvoiceLine[] = order.lineItems.map((line, index) => {
    const lineBase = {
      Id: String(index + 1),
      LineNum: index + 1,
      Description:
        line.part?.description ||
        `Part: ${line.part?.partNumber || 'Unknown'}`,
      Amount: Number(line.extendedPrice) || 0,
      DetailType: 'SalesItemLineDetail' as const,
    };

    // If part has QBO Item ID, reference it
    if (line.part?.qboItemId) {
      return {
        ...lineBase,
        SalesItemLineDetail: {
          ItemRef: { value: line.part.qboItemId },
          Qty: Number(line.qtyOrdered),
          UnitPrice: Number(line.unitPrice),
        },
      };
    }

    // Fallback to description-only
    return {
      ...lineBase,
      SalesItemLineDetail: {
        Qty: Number(line.qtyOrdered),
        UnitPrice: Number(line.unitPrice),
      },
    };
  });

  // Add shipping line if applicable
  if (order.shippingAmount && Number(order.shippingAmount) > 0) {
    invoiceLines.push({
      Id: String(invoiceLines.length + 1),
      LineNum: invoiceLines.length + 1,
      Description: 'Shipping',
      Amount: Number(order.shippingAmount),
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        Qty: 1,
        UnitPrice: Number(order.shippingAmount),
      },
    });
  }

  // Build invoice payload
  const invoicePayload: QboInvoicePayload = {
    CustomerRef: {
      value: qboCustomerId,
    },
    Line: invoiceLines,
    PrivateNote: order.notes || undefined,
    DocNumber: order.soNumber,
  };

  console.log(
    '[QBO Invoice] Creating invoice:',
    JSON.stringify(invoicePayload, null, 2)
  );

  // Create invoice in QBO
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${config.qbo.realmId}/invoice?minorversion=65`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[QBO Invoice] QBO API Error:', errorText);
    throw new Error(`QuickBooks API error: ${errorText}`);
  }

  const result = await response.json();
  const qboInvoiceId = result.Invoice?.Id;

  if (!qboInvoiceId) {
    throw new Error('QBO Invoice ID not returned');
  }

  console.log('[QBO Invoice] Invoice created:', qboInvoiceId);

  // Update sales order with QBO invoice ID
  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: { qboInvoiceId },
  });

  // Log sync
  await prisma.qboSyncLog.create({
    data: {
      entityType: 'sales_order',
      entityId: salesOrderId,
      qboId: qboInvoiceId,
      action: 'push_invoice',
      status: 'success',
    },
  });

  return {
    qboInvoiceId,
    message: 'Successfully pushed to QuickBooks',
  };
}

/**
 * Sync invoice status from QBO (e.g., after payment webhook)
 */
export async function syncInvoiceStatus(qboInvoiceId: string): Promise<void> {
  const accessToken = await getValidAccessToken();

  // Fetch invoice from QBO
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${config.qbo.realmId}/invoice/${qboInvoiceId}?minorversion=65`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch QBO invoice: ${errorText}`);
  }

  const result = await response.json();
  const invoice = result.Invoice;

  // Find local sales order
  const salesOrder = await prisma.salesOrder.findFirst({
    where: { qboInvoiceId },
  });

  if (!salesOrder) {
    console.warn(`[QBO Invoice] No local SO found for QBO invoice ${qboInvoiceId}`);
    return;
  }

  // Update payment status
  const isPaid = invoice.Balance === 0 || invoice.Balance === '0';
  const balanceDue = parseFloat(invoice.Balance || '0');

  await prisma.salesOrder.update({
    where: { id: salesOrder.id },
    data: {
      isPaid,
      balanceDue,
      updatedAt: new Date(),
    },
  });

  console.log(
    `[QBO Invoice] Updated SO ${salesOrder.soNumber}: isPaid=${isPaid}, balance=${balanceDue}`
  );
}
