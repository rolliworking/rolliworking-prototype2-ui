// QuickBooks Online Customer Sync
import { prisma } from '../../db/client';
import { config } from '../../config';
import { getValidAccessToken } from './oauth';

interface QboCustomerPayload {
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  Mobile?: { FreeFormNumber: string };
  WebAddr?: { URI: string };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Notes?: string;
}

/**
 * Push local customer to QuickBooks
 * Creates new customer in QBO and updates local record with QBO ID
 */
export async function pushCustomerToQbo(
  customerId: string
): Promise<{ qboCustomerId: string; alreadySynced: boolean }> {
  // Get customer with addresses
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: true,
    },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Check if already synced
  if (customer.qboCustomerId) {
    console.log(
      `[QBO Customer] Customer already synced: ${customer.qboCustomerId}`
    );
    return {
      qboCustomerId: customer.qboCustomerId,
      alreadySynced: true,
    };
  }

  // Get access token
  const accessToken = await getValidAccessToken();

  // Find billing and shipping addresses
  const billingAddr = customer.addresses.find(
    (a) => a.addressType === 'billing'
  );
  const shippingAddr = customer.addresses.find(
    (a) => a.addressType === 'shipping'
  );

  // Build QBO payload
  const displayName =
    customer.displayName ||
    `${customer.firstName} ${customer.lastName}`.trim() ||
    customer.companyName ||
    'Unknown Customer';

  const payload: QboCustomerPayload = {
    DisplayName: displayName,
    GivenName: customer.firstName || undefined,
    FamilyName: customer.lastName || undefined,
  };

  if (customer.companyName) {
    payload.CompanyName = customer.companyName;
  }

  if (customer.email) {
    payload.PrimaryEmailAddr = { Address: customer.email };
  }

  if (customer.phone) {
    payload.PrimaryPhone = { FreeFormNumber: customer.phone };
  }

  // Add billing address
  if (billingAddr?.street1 || customer.address) {
    payload.BillAddr = {
      Line1: billingAddr?.street1 || customer.address || undefined,
      Line2: billingAddr?.street2 || undefined,
      City: billingAddr?.city || customer.city || undefined,
      CountrySubDivisionCode: billingAddr?.state || customer.state || undefined,
      PostalCode: billingAddr?.zip || customer.zip || undefined,
      Country: 'US',
    };
  }

  // Add shipping address if different
  if (shippingAddr?.street1) {
    payload.ShipAddr = {
      Line1: shippingAddr.street1,
      Line2: shippingAddr.street2 || undefined,
      City: shippingAddr.city || undefined,
      CountrySubDivisionCode: shippingAddr.state || undefined,
      PostalCode: shippingAddr.zip || undefined,
      Country: 'US',
    };
  }

  if (customer.notes) {
    payload.Notes = customer.notes;
  }

  console.log(
    '[QBO Customer] Creating customer in QBO:',
    JSON.stringify(payload, null, 2)
  );

  // Create customer in QBO
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${config.qbo.realmId}/customer?minorversion=65`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[QBO Customer] QBO API Error:', errorText);

    // Check for duplicate
    if (errorText.includes('Duplicate Name Exists')) {
      throw new Error(
        'A customer with this name already exists in QuickBooks. Please check for duplicates.'
      );
    }

    throw new Error(`QuickBooks API error: ${errorText}`);
  }

  const result = await response.json();
  const qboCustomerId = result.Customer?.Id;

  if (!qboCustomerId) {
    throw new Error('QBO Customer ID not returned');
  }

  console.log('[QBO Customer] Customer created:', qboCustomerId);

  // Update local customer
  await prisma.customer.update({
    where: { id: customerId },
    data: { qboCustomerId },
  });

  // Log sync
  await prisma.qboSyncLog.create({
    data: {
      entityType: 'customer',
      entityId: customerId,
      qboId: qboCustomerId,
      action: 'push',
      status: 'success',
    },
  });

  return {
    qboCustomerId,
    alreadySynced: false,
  };
}
