// Parts & Inventory Service Layer
import { prisma } from '../../db/client';
import { Prisma } from '@prisma/client';

interface CreatePartInput {
  partNumber: string;
  description: string;
  itemType?: 'part' | 'labor' | 'service' | 'other';
  uom?: 'each' | 'hour' | 'ft' | 'lb' | 'kg' | 'gram' | 'oz';
  defaultSellPrice?: number;
  averageCost?: number;
  reorderPoint?: number;
  reorderQty?: number;
}

interface UpdatePartInput extends Partial<CreatePartInput> {
  isActive?: boolean;
}

interface PartSearchFilters {
  search?: string;
  itemType?: string;
  isActive?: boolean;
  page?: number;
  perPage?: number;
}

/**
 * Create a new part
 */
export async function createPart(data: CreatePartInput) {
  const part = await prisma.part.create({
    data: {
      partNumber: data.partNumber,
      description: data.description,
      itemType: data.itemType || 'part',
      uom: data.uom || 'each',
      defaultSellPrice: data.defaultSellPrice,
      averageCost: data.averageCost,
      reorderPoint: data.reorderPoint,
      reorderQty: data.reorderQty,
    },
  });

  console.log('[Part] Created:', part.partNumber);
  return part;
}

/**
 * Get part by ID with stock levels
 */
export async function getPart(id: string) {
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      stock: {
        include: {
          bin: {
            include: {
              location: true,
            },
          },
        },
      },
      aliases: true,
      vendorParts: {
        include: {
          vendor: true,
        },
      },
    },
  });

  if (!part) {
    throw new Error('Part not found');
  }

  // Calculate total stock
  const totalQtyOnHand = part.stock.reduce(
    (sum, s) => sum + Number(s.qtyOnHand),
    0
  );
  const totalQtyOnOrder = part.stock.reduce(
    (sum, s) => sum + Number(s.qtyOnOrder),
    0
  );
  const totalQtyAllocated = part.stock.reduce(
    (sum, s) => sum + Number(s.qtyAllocated),
    0
  );
  const qtyAvailable = totalQtyOnHand - totalQtyAllocated;

  return {
    ...part,
    totalQtyOnHand,
    totalQtyOnOrder,
    totalQtyAllocated,
    qtyAvailable,
  };
}

/**
 * Update part
 */
export async function updatePart(id: string, data: UpdatePartInput) {
  const part = await prisma.part.update({
    where: { id },
    data,
  });

  console.log('[Part] Updated:', id);
  return part;
}

/**
 * Delete part (soft delete by setting isActive = false)
 */
export async function deletePart(id: string) {
  await prisma.part.update({
    where: { id },
    data: { isActive: false },
  });

  console.log('[Part] Deactivated:', id);
}

/**
 * Search parts with filters
 */
export async function searchParts(filters: PartSearchFilters = {}) {
  const {
    search = '',
    itemType,
    isActive = true,
    page = 1,
    perPage = 20,
  } = filters;

  const skip = (page - 1) * perPage;

  // Build where clause
  const where: Prisma.PartWhereInput = {
    isActive,
  };

  if (search) {
    where.OR = [
      { partNumber: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (itemType) {
    where.itemType = itemType as any;
  }

  const [parts, total] = await Promise.all([
    prisma.part.findMany({
      where,
      include: {
        stock: {
          select: {
            qtyOnHand: true,
            qtyAllocated: true,
          },
        },
      },
      orderBy: { partNumber: 'asc' },
      skip,
      take: perPage,
    }),
    prisma.part.count({ where }),
  ]);

  // Calculate stock levels for each part
  const partsWithStock = parts.map((part) => {
    const totalQtyOnHand = part.stock.reduce(
      (sum, s) => sum + Number(s.qtyOnHand),
      0
    );
    const totalQtyAllocated = part.stock.reduce(
      (sum, s) => sum + Number(s.qtyAllocated),
      0
    );
    const qtyAvailable = totalQtyOnHand - totalQtyAllocated;

    return {
      ...part,
      totalQtyOnHand,
      qtyAvailable,
    };
  });

  return {
    parts: partsWithStock,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Get low stock parts (below reorder point)
 */
export async function getLowStockParts() {
  const parts = await prisma.part.findMany({
    where: {
      isActive: true,
      reorderPoint: { not: null },
    },
    include: {
      stock: {
        select: {
          qtyOnHand: true,
          qtyAllocated: true,
        },
      },
    },
  });

  const lowStockParts = parts
    .map((part) => {
      const totalQtyOnHand = part.stock.reduce(
        (sum, s) => sum + Number(s.qtyOnHand),
        0
      );
      const totalQtyAllocated = part.stock.reduce(
        (sum, s) => sum + Number(s.qtyAllocated),
        0
      );
      const qtyAvailable = totalQtyOnHand - totalQtyAllocated;

      return {
        ...part,
        totalQtyOnHand,
        qtyAvailable,
      };
    })
    .filter((part) => part.qtyAvailable <= (part.reorderPoint || 0));

  return lowStockParts;
}

/**
 * Adjust inventory stock
 */
export async function adjustInventory(
  partId: string,
  binId: string,
  adjustment: number,
  reason: string,
  userId: string
) {
  // Get or create stock record
  let stock = await prisma.inventoryStock.findUnique({
    where: {
      partId_binId: { partId, binId },
    },
  });

  if (!stock) {
    stock = await prisma.inventoryStock.create({
      data: {
        partId,
        binId,
        qtyOnHand: 0,
      },
    });
  }

  // Update stock quantity
  const newQty = Number(stock.qtyOnHand) + adjustment;

  await prisma.inventoryStock.update({
    where: { id: stock.id },
    data: { qtyOnHand: newQty },
  });

  // Log the adjustment
  await prisma.inventoryAdjustment.create({
    data: {
      partId,
      binId,
      adjustmentType: adjustment > 0 ? 'increase' : 'decrease',
      qtyAdjustment: adjustment,
      reason,
      createdBy: userId,
    },
  });

  console.log(`[Inventory] Adjusted ${adjustment} for part ${partId}`);

  return await getPart(partId);
}
