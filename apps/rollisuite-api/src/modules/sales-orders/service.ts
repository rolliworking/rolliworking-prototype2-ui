// Sales Orders Service Layer
import { prisma } from '../../db/client';
import { Prisma, SoStatus } from '@prisma/client';

interface CreateSalesOrderInput {
  customerId: string;
  jobId?: string;
  notes?: string;
  lineItems: Array<{
    partId: string;
    qtyOrdered: number;
    unitPrice: number;
    unitCost?: number;
    notes?: string;
  }>;
}

interface UpdateSalesOrderInput {
  status?: SoStatus;
  shipDate?: Date;
  notes?: string;
  isPaid?: boolean;
  balanceDue?: number;
  tcAgreed?: boolean;
  lineItems?: Array<{
    id?: string;
    partId: string;
    qtyOrdered: number;
    unitPrice: number;
    unitCost?: number;
    notes?: string;
  }>;
}

/**
 * Get next sales order number
 */
async function getNextSoNumber(): Promise<string> {
  const latest = await prisma.salesOrder.findFirst({
    orderBy: { soNumber: 'desc' },
    select: { soNumber: true },
  });

  let nextNumber = 1;
  if (latest) {
    const match = latest.soNumber.match(/SO-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `SO-${String(nextNumber).padStart(5, '0')}`;
}

/**
 * Create sales order
 */
export async function createSalesOrder(data: CreateSalesOrderInput) {
  const soNumber = await getNextSoNumber();

  // Calculate totals
  const subtotal = data.lineItems.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitPrice,
    0
  );

  const salesOrder = await prisma.salesOrder.create({
    data: {
      soNumber,
      customerId: data.customerId,
      jobId: data.jobId,
      status: 'draft',
      subtotal,
      totalAmount: subtotal,
      notes: data.notes,
      lineItems: {
        create: data.lineItems.map((item, index) => ({
          partId: item.partId,
          qtyOrdered: item.qtyOrdered,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          extendedPrice: item.qtyOrdered * item.unitPrice,
          notes: item.notes,
          sortOrder: index,
        })),
      },
    },
    include: {
      customer: true,
      job: true,
      lineItems: {
        include: { part: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  console.log('[Sales Order] Created:', salesOrder.soNumber);
  return salesOrder;
}

/**
 * Get sales order by ID
 */
export async function getSalesOrder(id: string) {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: {
        include: { addresses: true },
      },
      job: {
        include: {
          watch: true,
        },
      },
      lineItems: {
        include: { part: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!salesOrder) {
    throw new Error('Sales order not found');
  }

  return salesOrder;
}

/**
 * Update sales order
 */
export async function updateSalesOrder(
  id: string,
  data: UpdateSalesOrderInput
) {
  // If line items updated, recalculate totals
  let updateData: any = {
    status: data.status,
    shipDate: data.shipDate,
    notes: data.notes,
    isPaid: data.isPaid,
    balanceDue: data.balanceDue,
    tcAgreed: data.tcAgreed,
  };

  if (data.tcAgreed === true && data.status === undefined) {
    updateData.tcAgreedAt = new Date();
  }

  if (data.lineItems) {
    // Recalculate totals
    const subtotal = data.lineItems.reduce(
      (sum, item) => sum + item.qtyOrdered * item.unitPrice,
      0
    );

    updateData.subtotal = subtotal;
    updateData.totalAmount = subtotal;

    // Delete existing line items and recreate
    await prisma.soLine.deleteMany({ where: { soId: id } });
  }

  const salesOrder = await prisma.salesOrder.update({
    where: { id },
    data: {
      ...updateData,
      lineItems: data.lineItems
        ? {
            create: data.lineItems.map((item, index) => ({
              partId: item.partId,
              qtyOrdered: item.qtyOrdered,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              extendedPrice: item.qtyOrdered * item.unitPrice,
              notes: item.notes,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: {
      customer: true,
      lineItems: {
        include: { part: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  console.log('[Sales Order] Updated:', salesOrder.soNumber);
  return salesOrder;
}

/**
 * Delete sales order
 */
export async function deleteSalesOrder(id: string) {
  await prisma.salesOrder.delete({ where: { id } });
  console.log('[Sales Order] Deleted:', id);
}

/**
 * Search sales orders
 */
export async function searchSalesOrders(filters: {
  customerId?: string;
  status?: SoStatus;
  isPaid?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const { customerId, status, isPaid, search, page = 1, perPage = 50 } = filters;

  const where: Prisma.SalesOrderWhereInput = {};

  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  if (isPaid !== undefined) where.isPaid = isPaid;

  if (search) {
    where.OR = [
      { soNumber: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [salesOrders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: {
        customer: true,
        job: true,
        lineItems: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return {
    salesOrders,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Mark sales order as fulfilled
 */
export async function fulfillSalesOrder(id: string, shipDate?: Date) {
  const salesOrder = await prisma.salesOrder.update({
    where: { id },
    data: {
      status: 'fulfilled',
      shipDate: shipDate || new Date(),
    },
    include: { customer: true, lineItems: true },
  });

  console.log('[Sales Order] Fulfilled:', salesOrder.soNumber);
  return salesOrder;
}
