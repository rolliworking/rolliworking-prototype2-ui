// SMS Service using Twilio
import twilio from 'twilio';
import { config } from '../../config';
import { prisma } from '../../db/client';

// Initialize Twilio client (only if credentials are provided)
let twilioClient: twilio.Twilio | null = null;

if (config.sms.accountSid && config.sms.authToken) {
  twilioClient = twilio(config.sms.accountSid, config.sms.authToken);
}

interface SMSOptions {
  to: string; // Phone number in E.164 format (e.g., +14155552671)
  message: string;
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<string> {
  if (!twilioClient) {
    console.warn('[SMS] Twilio not configured - SMS not sent');
    return 'mock-sms-id';
  }

  try {
    const message = await twilioClient.messages.create({
      from: config.sms.phoneNumber,
      to: options.to,
      body: options.message,
    });

    console.log('[SMS] Sent successfully:', message.sid);
    return message.sid;
  } catch (error: any) {
    console.error('[SMS] Send failed:', error);
    throw new Error(`SMS send failed: ${error.message}`);
  }
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');

  // If already starts with +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Assume US number if 10 digits
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Assume already has country code if 11+ digits
  if (digits.length >= 11) {
    return `+${digits}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Send order pickup ready notification
 */
export async function sendPickupReadySMS(
  salesOrderId: string,
  customerPhone: string
): Promise<string> {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: { customer: true },
  });

  if (!salesOrder) {
    throw new Error('Sales order not found');
  }

  const customerName = salesOrder.customer
    ? `${salesOrder.customer.firstName} ${salesOrder.customer.lastName}`.trim()
    : 'Customer';

  const message = `Hi ${customerName}! Your order ${salesOrder.orderNumber} is ready for pickup at Rolliworks. Please bring your ID. Questions? Call us at (408) 800-3244.`;

  const phone = formatPhoneNumber(customerPhone);
  return await sendSMS({ to: phone, message });
}

/**
 * Send estimate notification
 */
export async function sendEstimateSMS(
  estimateId: string,
  customerPhone: string
): Promise<string> {
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { customer: true },
  });

  if (!estimate) {
    throw new Error('Estimate not found');
  }

  const customerName = estimate.customer
    ? `${estimate.customer.firstName} ${estimate.customer.lastName}`.trim()
    : 'Customer';

  const message = `Hi ${customerName}! Your watch repair estimate ${estimate.estimateNumber} is ready. Total: $${(estimate.totalAmount || 0).toFixed(2)}. Check your email for details.`;

  const phone = formatPhoneNumber(customerPhone);
  return await sendSMS({ to: phone, message });
}

/**
 * Send watch intake confirmation
 */
export async function sendWatchIntakeSMS(
  watchId: string,
  customerPhone: string
): Promise<string> {
  const watch = await prisma.watch.findUnique({
    where: { id: watchId },
    include: { customer: true },
  });

  if (!watch) {
    throw new Error('Watch not found');
  }

  const customerName = watch.customer
    ? `${watch.customer.firstName} ${watch.customer.lastName}`.trim()
    : 'Customer';

  const watchName = `${watch.brand || 'Watch'} ${watch.model || ''}`.trim();

  const message = `Hi ${customerName}! We've received your ${watchName}. You'll receive an estimate within 2-3 business days. Questions? Call (408) 800-3244.`;

  const phone = formatPhoneNumber(customerPhone);
  return await sendSMS({ to: phone, message });
}

/**
 * Send custom SMS to customer
 */
export async function sendCustomerSMS(
  customerId: string,
  message: string
): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  if (!customer.phone) {
    throw new Error('Customer has no phone number');
  }

  const phone = formatPhoneNumber(customer.phone);
  return await sendSMS({ to: phone, message });
}
