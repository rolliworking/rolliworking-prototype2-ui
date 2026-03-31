// Customers Service Layer
import { prisma } from '../../db/client';
import { Prisma } from '@prisma/client';

interface CreateCustomerInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  isShipDirect?: boolean;
  isTradePricing?: boolean;
  skipShippingInfo?: boolean;
}

interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}

interface CustomerSearchFilters {
  search?: string;
  isShipDirect?: boolean;
  isTradePricing?: boolean;
  page?: number;
  perPage?: number;
}

/**
 * Create a new customer
 */
export async function createCustomer(data: CreateCustomerInput) {
  // Normalize email and phone for searching
  const emailNormalized = data.email?.toLowerCase().trim();
  const phoneNormalized = data.phone?.replace(/\D/g, ''); // Remove non-digits

  const customer = await prisma.customer.create({
    data: {
      ...data,
      emailNormalized,
      phoneNormalized,
    },
    include: {
      addresses: true,
    },
  });

  console.log('[Customer] Created:', customer.id);
  return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: true,
      watches: true,
      estimates: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      salesOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      communicationPermission: true,
    },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  return customer;
}

/**
 * Update customer
 */
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
) {
  // Normalize if email or phone changed
  const updateData: any = { ...data };

  if (data.email !== undefined) {
    updateData.emailNormalized = data.email?.toLowerCase().trim();
  }

  if (data.phone !== undefined) {
    updateData.phoneNormalized = data.phone?.replace(/\D/g, '');
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: updateData,
    include: {
      addresses: true,
    },
  });

  console.log('[Customer] Updated:', customer.id);
  return customer;
}

/**
 * Delete customer
 */
export async function deleteCustomer(id: string) {
  await prisma.customer.delete({
    where: { id },
  });

  console.log('[Customer] Deleted:', id);
}

/**
 * Search customers with filters and pagination
 */
export async function searchCustomers(filters: CustomerSearchFilters) {
  const { search, isShipDirect, isTradePricing, page = 1, perPage = 50 } = filters;

  const where: Prisma.CustomerWhereInput = {};

  // Search by name, email, or phone
  if (search) {
    const searchLower = search.toLowerCase();
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { displayName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { emailNormalized: { contains: searchLower } },
      { phoneNormalized: { contains: search.replace(/\D/g, '') } },
    ];
  }

  if (isShipDirect !== undefined) {
    where.isShipDirect = isShipDirect;
  }

  if (isTradePricing !== undefined) {
    where.isTradePricing = isTradePricing;
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        addresses: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Check for duplicate customers by email or phone
 */
export async function findDuplicateCustomers(email?: string, phone?: string) {
  const where: Prisma.CustomerWhereInput = { OR: [] };

  if (email) {
    where.OR!.push({ emailNormalized: email.toLowerCase().trim() });
  }

  if (phone) {
    where.OR!.push({ phoneNormalized: phone.replace(/\D/g, '') });
  }

  if (!where.OR!.length) {
    return [];
  }

  return await prisma.customer.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
    },
  });
}
