// Watches Service Layer
import { prisma } from '../../db/client';
import { Prisma } from '@prisma/client';

interface CreateWatchInput {
  customerId: string;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  serialNumber?: string;
  movementType?: string;
  caseMaterial?: string;
  bandMaterial?: string;
  notes?: string;
}

interface UpdateWatchInput extends Partial<CreateWatchInput> {}

interface WatchSearchFilters {
  search?: string;
  customerId?: string;
  brand?: string;
  page?: number;
  perPage?: number;
}

/**
 * Create a new watch
 */
export async function createWatch(data: CreateWatchInput) {
  const watch = await prisma.watch.create({
    data,
    include: {
      customer: true,
    },
  });

  console.log('[Watch] Created:', watch.id);
  return watch;
}

/**
 * Get watch by ID
 */
export async function getWatch(id: string) {
  const watch = await prisma.watch.findUnique({
    where: { id },
    include: {
      customer: true,
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!watch) {
    throw new Error('Watch not found');
  }

  return watch;
}

/**
 * Update watch
 */
export async function updateWatch(id: string, data: UpdateWatchInput) {
  const watch = await prisma.watch.update({
    where: { id },
    data,
    include: {
      customer: true,
    },
  });

  console.log('[Watch] Updated:', id);
  return watch;
}

/**
 * Delete watch
 */
export async function deleteWatch(id: string) {
  await prisma.watch.delete({
    where: { id },
  });

  console.log('[Watch] Deleted:', id);
}

/**
 * Search watches with filters
 */
export async function searchWatches(filters: WatchSearchFilters = {}) {
  const {
    search = '',
    customerId,
    brand,
    page = 1,
    perPage = 20,
  } = filters;

  const skip = (page - 1) * perPage;

  // Build where clause
  const where: Prisma.WatchWhereInput = {};

  if (search) {
    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { referenceNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (brand) {
    where.brand = { contains: brand, mode: 'insensitive' };
  }

  const [watches, total] = await Promise.all([
    prisma.watch.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
    }),
    prisma.watch.count({ where }),
  ]);

  return {
    watches,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Get watches by customer ID
 */
export async function getWatchesByCustomer(customerId: string) {
  return await prisma.watch.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
}
