// Email Service using Resend
import { Resend } from 'resend';
import { config } from '../../config';
import { prisma } from '../../db/client';

const resend = new Resend(config.email.apiKey);

interface EmailOptions {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
  }>;
}

/**
 * Send email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<string> {
  try {
    const response = await resend.emails.send({
      from: `Rolliworks <${config.email.from}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    if (response.error) {
      throw new Error(`Resend error: ${response.error.message}`);
    }

    console.log('[Email] Sent successfully:', response.data?.id);
    return response.data?.id || '';
  } catch (error: any) {
    console.error('[Email] Send failed:', error);
    throw error;
  }
}

/**
 * Generate barcode SVG (CODE128B) for estimate numbers
 */
function generateBarcodeSVG(text: string): string {
  const CODE128_PATTERNS: Record<string, string> = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '10011100110', '2': '11001110010', '3': '11001011100',
    '4': '11001001110', '5': '11011100100', '6': '11001110100', '7': '11101101110',
    '8': '11101001100', '9': '11100101100', ':': '11100100110', ';': '11101100100',
    '<': '11100110100', '=': '11100110010', '>': '11011011000', '?': '11011000110',
    'A': '10100011000', 'B': '10001011000', 'C': '10001000110', 'D': '10110001000',
    'E': '10001101000', 'F': '10001100010', 'G': '11010001000', 'H': '11000101000',
    'I': '11000100010', 'J': '10110111000', 'K': '10110001110', 'L': '10001101110',
    'M': '10111011000', 'N': '10111000110', 'O': '10001110110', 'P': '11101110110',
    'Q': '11010001110', 'R': '11000101110', 'S': '11011101000', 'T': '11011100010',
    'U': '11011101110', 'V': '11101011000', 'W': '11101000110', 'X': '11100010110',
    'Y': '11101101000', 'Z': '11101100010',
  };

  const START_B = '11010010000';
  const STOP = '1100011101011';

  let checksum = 104;
  let pattern = START_B;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const value = char.charCodeAt(0) - 32;
    checksum += value * (i + 1);
    pattern += CODE128_PATTERNS[char] || CODE128_PATTERNS[' '];
  }

  checksum = checksum % 103;
  const checksumChar = String.fromCharCode(checksum < 95 ? checksum + 32 : checksum + 105);
  pattern += CODE128_PATTERNS[checksumChar] || CODE128_PATTERNS[' '];
  pattern += STOP;

  const barWidth = 1.5;
  const height = 40;
  let x = 0;
  let bars = '';

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      bars += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`;
    }
    x += barWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height + 15}" viewBox="0 0 ${x} ${height + 15}">
    <rect width="100%" height="100%" fill="white"/>
    ${bars}
    <text x="${x / 2}" y="${height + 12}" text-anchor="middle" font-family="monospace" font-size="10">${text}</text>
  </svg>`;
}

/**
 * Generate estimate PDF HTML
 */
export function generateEstimatePDF(
  estimate: any,
  customer: any,
  watch: any,
  lineItems: any[]
): string {
  const barcodeSVG = generateBarcodeSVG(estimate.estimateNumber);
  const barcodeBase64 = Buffer.from(barcodeSVG).toString('base64');

  const formatDate = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    return (amount || 0).toFixed(2);
  };

  const customerName = customer 
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : '';

  const addressLines: string[] = [];
  if (customer?.companyName) addressLines.push(customer.companyName);
  if (customerName) addressLines.push(customerName);
  if (customer?.address) addressLines.push(customer.address);
  if (customer?.city || customer?.state || customer?.zip) {
    addressLines.push(`${customer?.city || ''}, ${customer?.state || ''} ${customer?.zip || ''}`.trim());
  }
  if (customer?.phone) addressLines.push(customer.phone);
  if (customer?.email) addressLines.push(customer.email);

  const estimateNum = estimate.estimateNumber.replace('EST-', '');

  const lineItemsHTML = lineItems.map(item => `
    <tr>
      <td style="padding: 12px 8px; vertical-align: top; font-weight: 500; color: #333;">${item.description.split(' - ')[0] || ''}</td>
      <td style="padding: 12px 8px; vertical-align: top; color: #555;">${item.description}</td>
      <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 8px; text-align: right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding: 12px 8px; text-align: right;">${formatCurrency(item.extendedPrice)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Estimate ${estimate.estimateNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #333; font-size: 13px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .estimate-title { font-size: 36px; color: #41b6e6; margin: 30px 0 20px 0; font-weight: 300; }
    table.line-items { width: 100%; border-collapse: collapse; margin-top: 20px; }
    table.line-items thead th { text-align: left; padding: 12px 8px; font-size: 12px; font-weight: bold; color: #41b6e6; border-bottom: 2px solid #ddd; text-transform: uppercase; }
    table.line-items tbody tr { border-bottom: 1px solid #eee; }
    .totals-section { margin-top: 30px; display: flex; justify-content: flex-end; }
    .totals-table tr.total td { font-size: 16px; font-weight: bold; padding-top: 12px; border-top: 1px solid #ddd; }
    .barcode-header { text-align: center; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="barcode-header">
    <img src="data:image/svg+xml;base64,${barcodeBase64}" alt="${estimate.estimateNumber}">
  </div>
  <div class="header">
    <div>
      <div style="font-weight: bold;">Rolliworks LLC</div>
      <div>14 NE 1st Ave Ste 403</div>
      <div>Miami, FL 33132</div>
      <div>+14088003244</div>
      <div>contact@rolliworks.com</div>
    </div>
  </div>
  <div class="estimate-title">Estimate</div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #ddd;">
    <div>
      <h3 style="font-size: 12px; font-weight: bold; margin: 0 0 8px 0;">ADDRESS</h3>
      <p>${addressLines.join('<br>') || 'Customer'}</p>
    </div>
    <div style="text-align: right;">
      <div><strong>ESTIMATE #</strong> ${estimateNum}</div>
      <div><strong>DATE</strong> ${formatDate(estimate.createdAt)}</div>
    </div>
  </div>
  ${watch ? `
  <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
    <h3 style="font-size: 12px; font-weight: bold; margin: 0 0 10px 0;">WATCH INFORMATION</h3>
    <div>
      <div>Brand: <strong>${watch.brand || '-'}</strong></div>
      ${watch.model ? `<div>Model: <strong>${watch.model}</strong></div>` : ''}
      ${watch.referenceNumber ? `<div>Reference: <strong>${watch.referenceNumber}</strong></div>` : ''}
      ${watch.serialNumber ? `<div>Serial: <strong>${watch.serialNumber}</strong></div>` : ''}
    </div>
  </div>
  ` : ''}
  <table class="line-items">
    <thead>
      <tr>
        <th>Activity</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsHTML}
    </tbody>
  </table>
  <div class="totals-section">
    <table>
      <tr><td style="text-align: right; padding-right: 20px;"><strong>Subtotal:</strong></td><td style="text-align: right;">${formatCurrency(estimate.subtotal)}</td></tr>
      <tr><td style="text-align: right; padding-right: 20px;"><strong>Tax:</strong></td><td style="text-align: right;">${formatCurrency(estimate.taxAmount)}</td></tr>
      ${(estimate.shippingAmount || 0) > 0 ? `<tr><td style="text-align: right; padding-right: 20px;"><strong>Shipping:</strong></td><td style="text-align: right;">${formatCurrency(estimate.shippingAmount)}</td></tr>` : ''}
      <tr class="total"><td style="text-align: right; padding-right: 20px;"><strong>Total:</strong></td><td style="text-align: right; font-size: 18px;">$${formatCurrency(estimate.totalAmount)}</td></tr>
    </table>
  </div>
  <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #41b6e6 0%, #2a8ab8 100%); border-radius: 8px; text-align: center;">
    <p style="color: white; margin: 0 0 12px 0;">Need a prepaid shipping label to send your watch?</p>
    <a href="${config.webUrl}/request-label/${estimate.id}" style="display: inline-block; background: white; color: #41b6e6; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold;">Request Shipping Label</a>
  </div>
</body>
</html>
  `;
}

/**
 * Send estimate email with PDF attachment
 */
export async function sendEstimateEmail(
  estimateId: string,
  toEmail: string,
  subject?: string,
  body?: string,
  sendCopy?: boolean
): Promise<string> {
  // Fetch estimate with relations
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      customer: true,
      lineItems: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!estimate) {
    throw new Error('Estimate not found');
  }

  // Fetch watch if exists (assuming watch relation)
  let watch = null;
  // TODO: Add watch lookup if needed

  // Generate PDF HTML
  const pdfHtml = generateEstimatePDF(
    estimate,
    estimate.customer,
    watch,
    estimate.lineItems
  );

  const pdfBase64 = Buffer.from(pdfHtml).toString('base64');

  // Format email body
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #0077c5;">
        <h1 style="margin: 0; font-size: 28px;">
          <span style="color: #333;">ROLLI</span><span style="color: #0077c5;">WORKS</span>
        </h1>
        <p style="color: #666; margin: 5px 0 0 0;">Rolliworks LLC</p>
      </div>
      <div style="padding: 30px 20px;">
        <p style="white-space: pre-wrap; line-height: 1.6;">${(body || '').replace(/\n/g, '<br>')}</p>
      </div>
      <div style="background: #f5f5f5; padding: 20px; text-align: center;">
        <p style="margin: 0 0 10px 0; color: #666;">Your estimate is attached as a PDF.</p>
        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #333;">
          Total: $${(estimate.totalAmount || 0).toFixed(2)}
        </p>
      </div>
      <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
        <p>Questions? Reply to this email or contact us at ${config.email.replyTo}</p>
      </div>
    </div>
  `;

  const bcc = sendCopy ? [config.email.replyTo] : undefined;

  const emailId = await sendEmail({
    to: toEmail,
    bcc,
    subject: subject || `Estimate ${estimate.estimateNumber}`,
    html: htmlBody,
    attachments: [
      {
        filename: `Estimate-${estimate.estimateNumber}.html`,
        content: pdfBase64,
      },
    ],
  });

  // Update estimate status
  await prisma.estimate.update({
    where: { id: estimateId },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });

  return emailId;
}
