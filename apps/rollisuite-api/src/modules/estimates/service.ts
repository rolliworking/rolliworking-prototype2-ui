// Estimates Service Layer
import { prisma } from '../../db/client';
import { Prisma, EstimateStatus } from '@prisma/client';

interface CreateEstimateInput {
  customerId: string;
  serviceType?: string;
  notes?: string;
  internalNotes?: string;
  templateId?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    partId?: string;
    lineType: string;
    sortOrder?: number;
  }>;
}

interface UpdateEstimateInput {
  status?: EstimateStatus;
  serviceType?: string;
  notes?: string;
  internalNotes?: string;
  totalAmount?: number;
  lineItems?: Array<{
    id?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    partId?: string;
    lineType: string;
    sortOrder?: number;
  }>;
}

/**
 * Get next estimate number (increment by 5)
 */
async function getNextEstimateNumber(): Promise<string> {
  // Get the latest estimate
  const latest = await prisma.estimate.findFirst({
    orderBy: { estimateNumber: 'desc' },
    select: { estimateNumber: true },
  });

  let nextNumber = 5;
  if (latest) {
    // Extract number from EST-XXXXX format
    const match = latest.estimateNumber.match(/EST-(\d+)/);
    if (match) {
      const currentNumber = parseInt(match[1], 10);
      // Round up to next multiple of 5, then add 5
      nextNumber = Math.ceil(currentNumber / 5) * 5 + 5;
    }
  }

  return `EST-${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Create new estimate
 */
export async function createEstimate(data: CreateEstimateInput) {
  const estimateNumber = await getNextEstimateNumber();

  // Calculate totals from line items
  let subtotal = 0;
  if (data.lineItems) {
    subtotal = data.lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);
  }

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      customerId: data.customerId,
      serviceType: data.serviceType as any,
      notes: data.notes,
      internalNotes: data.internalNotes,
      templateId: data.templateId,
      totalAmount: subtotal,
      status: 'draft',
      lineItems: data.lineItems
        ? {
            create: data.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.quantity * item.unitPrice,
              partId: item.partId,
              lineType: item.lineType as any,
              sortOrder: item.sortOrder,
            })),
          }
        : undefined,
    },
    include: {
      customer: true,
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  console.log('[Estimate] Created:', estimate.estimateNumber);
  return estimate;
}

/**
 * Get estimate by ID
 */
export async function getEstimate(id: string) {
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: true,
        },
      },
      lineItems: {
        include: {
          part: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      template: true,
    },
  });

  if (!estimate) {
    throw new Error('Estimate not found');
  }

  return estimate;
}

/**
 * Update estimate
 */
export async function updateEstimate(id: string, data: UpdateEstimateInput) {
  // If line items are provided, recalculate totals
  let totalAmount = data.totalAmount;

  if (data.lineItems) {
    totalAmount = data.lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);

    // Delete existing line items and create new ones
    await prisma.estimateLineItem.deleteMany({
      where: { estimateId: id },
    });
  }

  const estimate = await prisma.estimate.update({
    where: { id },
    data: {
      status: data.status,
      serviceType: data.serviceType as any,
      notes: data.notes,
      internalNotes: data.internalNotes,
      totalAmount,
      lineItems: data.lineItems
        ? {
            create: data.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extendedPrice: item.quantity * item.unitPrice,
              partId: item.partId,
              lineType: item.lineType as any,
              sortOrder: item.sortOrder,
            })),
          }
        : undefined,
    },
    include: {
      customer: true,
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  console.log('[Estimate] Updated:', estimate.estimateNumber);
  return estimate;
}

/**
 * Delete estimate
 */
export async function deleteEstimate(id: string) {
  await prisma.estimate.delete({
    where: { id },
  });

  console.log('[Estimate] Deleted:', id);
}

/**
 * Search estimates
 */
export async function searchEstimates(filters: {
  customerId?: string;
  status?: EstimateStatus;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const { customerId, status, search, page = 1, perPage = 50 } = filters;

  const where: Prisma.EstimateWhereInput = {};

  if (customerId) {
    where.customerId = customerId;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { estimateNumber: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [estimates, total] = await Promise.all([
    prisma.estimate.findMany({
      where,
      include: {
        customer: true,
        lineItems: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.estimate.count({ where }),
  ]);

  return {
    estimates,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Convert estimate to sales order
 */
export async function convertEstimateToSalesOrder(estimateId: string) {
  const estimate = await getEstimate(estimateId);

  if (estimate.status === 'converted') {
    throw new Error('Estimate already converted');
  }

  // Get next SO number
  const latestSO = await prisma.salesOrder.findFirst({
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });

  let nextNumber = 1;
  if (latestSO) {
    const match = latestSO.soNumber.match(/SO-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const soNumber = `SO-${String(nextNumber).padStart(5, '0')}`;

  // Create sales order with line items
  const salesOrder = await prisma.salesOrder.create({
    data: {
      soNumber,
      customerId: estimate.customerId,
      status: 'pending',
      subtotal: estimate.totalAmount,
      totalAmount: estimate.totalAmount,
      notes: estimate.notes,
      lineItems: {
        create: estimate.lineItems.map((item, index) => ({
          partId: item.partId || '', // TODO: Handle non-part items
          qtyOrdered: item.quantity,
          unitPrice: item.unitPrice,
          extendedPrice: item.extendedPrice,
          notes: item.description,
          sortOrder: index,
        })),
      },
    },
    include: {
      customer: true,
      lineItems: true,
    },
  });

  // Update estimate status
  await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      status: 'converted',
      convertedAt: new Date(),
    },
  });

  console.log(
    `[Estimate] Converted ${estimate.estimateNumber} → ${salesOrder.soNumber}`
  );

  return salesOrder;
}
