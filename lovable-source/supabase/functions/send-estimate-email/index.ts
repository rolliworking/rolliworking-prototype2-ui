import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EstimateEmailRequest {
  estimateId?: string;
  toEmail?: string;
  subject?: string;
  body?: string;
  sendCopy?: boolean;
  // For test emails
  to?: string;
  isTestEmail?: boolean;
  // For intake emails
  isIntakeEmail?: boolean;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  extended_price: number;
  taxable: boolean;
}

// Generate CODE128 barcode SVG
function generateBarcodeSVG(text: string): string {
  // CODE128B encoding patterns (including start, stop, checksum)
  const CODE128_PATTERNS: Record<string, string> = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '10011100110', '2': '11001110010', '3': '11001011100',
    '4': '11001001110', '5': '11011100100', '6': '11001110100', '7': '11101101110',
    '8': '11101001100', '9': '11100101100', ':': '11100100110', ';': '11101100100',
    '<': '11100110100', '=': '11100110010', '>': '11011011000', '?': '11011000110',
    '@': '11000110110', 'A': '10100011000', 'B': '10001011000', 'C': '10001000110',
    'D': '10110001000', 'E': '10001101000', 'F': '10001100010', 'G': '11010001000',
    'H': '11000101000', 'I': '11000100010', 'J': '10110111000', 'K': '10110001110',
    'L': '10001101110', 'M': '10111011000', 'N': '10111000110', 'O': '10001110110',
    'P': '11101110110', 'Q': '11010001110', 'R': '11000101110', 'S': '11011101000',
    'T': '11011100010', 'U': '11011101110', 'V': '11101011000', 'W': '11101000110',
    'X': '11100010110', 'Y': '11101101000', 'Z': '11101100010', '[': '11100011010',
    '\\': '11101111010', ']': '11001000010', '^': '11110001010', '_': '10100110000',
    '`': '10100001100', 'a': '10010110000', 'b': '10010000110', 'c': '10000101100',
    'd': '10000100110', 'e': '10110010000', 'f': '10110000100', 'g': '10011010000',
    'h': '10011000010', 'i': '10000110100', 'j': '10000110010', 'k': '11000010010',
    'l': '11001010000', 'm': '11110111010', 'n': '11000010100', 'o': '10001111010',
    'p': '10100111100', 'q': '10010111100', 'r': '10010011110', 's': '10111100100',
    't': '10011110100', 'u': '10011110010', 'v': '11110100100', 'w': '11110010100',
    'x': '11110010010', 'y': '11011011110', 'z': '11011110110', '{': '11110110110',
    '|': '10101111000', '}': '10100011110', '~': '10001011110',
  };

  const START_B = '11010010000';
  const STOP = '1100011101011';

  // Calculate checksum
  let checksum = 104; // Start B value
  const values: number[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const value = char.charCodeAt(0) - 32;
    values.push(value);
    checksum += value * (i + 1);
  }
  
  checksum = checksum % 103;
  
  // Build barcode pattern
  let pattern = START_B;
  for (const char of text) {
    pattern += CODE128_PATTERNS[char] || CODE128_PATTERNS[' '];
  }
  
  // Add checksum character
  const checksumChar = String.fromCharCode(checksum < 95 ? checksum + 32 : checksum + 105);
  pattern += CODE128_PATTERNS[checksumChar] || CODE128_PATTERNS[' '];
  pattern += STOP;

  // Generate SVG
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

// Generate PDF HTML for the estimate
function generateEstimatePDF(
  estimate: {
    id: string;
    estimate_number: string;
    created_at: string;
    valid_until?: string | null;
    subtotal?: number | null;
    tax_amount?: number | null;
    shipping_amount?: number | null;
    total_amount?: number | null;
    notes?: string | null;
  },
  customer: {
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null,
  watch: {
    brand: string;
    model?: string | null;
    serial_number?: string | null;
    reference_number?: string | null;
  } | null,
  lineItems: LineItem[],
  appBaseUrl: string = "https://rollisuite.com"
): string {
  const barcodeSVG = generateBarcodeSVG(estimate.estimate_number);
  const barcodeBase64 = btoa(barcodeSVG);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    return (amount || 0).toFixed(2);
  };

  const customerName = customer 
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : '';

  // Build address lines
  const addressLines: string[] = [];
  if (customer?.company_name) addressLines.push(customer.company_name);
  if (customerName) addressLines.push(customerName);
  if (customer?.address) addressLines.push(customer.address);
  if (customer?.city || customer?.state || customer?.zip) {
    addressLines.push(`${customer?.city || ''}, ${customer?.state || ''} ${customer?.zip || ''}`.trim());
  }
  if (customer?.phone) addressLines.push(customer.phone);
  if (customer?.email) addressLines.push(customer.email);

  // Extract estimate number without prefix for display
  const estimateNum = estimate.estimate_number.replace('EST-', '');

  const lineItemsHTML = lineItems.map(item => `
    <tr>
      <td style="padding: 12px 8px; vertical-align: top; font-weight: 500; color: #333; width: 120px;">${item.description.split(' - ')[0] || ''}</td>
      <td style="padding: 12px 8px; vertical-align: top; color: #555; line-height: 1.5;">${item.description}</td>
      <td style="padding: 12px 8px; vertical-align: top; text-align: center; width: 50px;">${item.quantity}</td>
      <td style="padding: 12px 8px; vertical-align: top; text-align: right; width: 80px;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px 8px; vertical-align: top; text-align: right; width: 80px;">${formatCurrency(item.extended_price)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Estimate ${estimate.estimate_number}</title>
  <style>
    @page { margin: 40px; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
      margin: 0; 
      padding: 40px; 
      color: #333; 
      font-size: 13px;
      line-height: 1.4;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 20px; 
    }
    .company-info { 
      font-size: 13px; 
      line-height: 1.6; 
    }
    .company-name { 
      font-weight: bold; 
      font-size: 14px; 
      margin-bottom: 4px; 
    }
    .logo {
      font-size: 42px;
      font-weight: bold;
      letter-spacing: -1px;
    }
    .logo-rolli { color: #333; }
    .logo-w { color: #41b6e6; }
    .logo-orks { color: #333; }
    .estimate-title {
      font-size: 36px;
      color: #41b6e6;
      margin: 30px 0 20px 0;
      font-weight: 300;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ddd;
    }
    .address-section h3 {
      font-size: 12px;
      font-weight: bold;
      color: #333;
      margin: 0 0 8px 0;
      text-transform: uppercase;
    }
    .address-section p {
      margin: 0;
      line-height: 1.6;
    }
    .meta-section {
      text-align: right;
    }
    .meta-row {
      margin-bottom: 4px;
    }
    .meta-label {
      font-weight: bold;
      color: #333;
    }
    table.line-items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    table.line-items thead th {
      text-align: left;
      padding: 12px 8px;
      font-size: 12px;
      font-weight: bold;
      color: #41b6e6;
      border-bottom: 2px solid #ddd;
      text-transform: uppercase;
    }
    table.line-items thead th:nth-child(3),
    table.line-items thead th:nth-child(4),
    table.line-items thead th:nth-child(5) {
      text-align: right;
    }
    table.line-items thead th:nth-child(3) {
      text-align: center;
    }
    table.line-items tbody tr {
      border-bottom: 1px solid #eee;
    }
    .totals-section {
      margin-top: 30px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 250px;
    }
    .totals-table tr td {
      padding: 6px 0;
    }
    .totals-table tr td:first-child {
      text-align: right;
      padding-right: 20px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 12px;
    }
    .totals-table tr td:last-child {
      text-align: right;
      font-size: 14px;
    }
    .totals-table tr.total td {
      font-size: 16px;
      font-weight: bold;
      padding-top: 12px;
      border-top: 1px solid #ddd;
    }
    .totals-table tr.total td:last-child {
      font-size: 18px;
    }
    .barcode-header {
      text-align: center;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="barcode-header">
    <img src="data:image/svg+xml;base64,${barcodeBase64}" alt="${estimate.estimate_number}">
  </div>

  <div class="header">
    <div class="company-info">
      <div class="company-name">Rolliworks LLC</div>
      <div>14 NE 1st Ave Ste 403</div>
      <div>Miami, FL 33132</div>
      <div>+14088003244</div>
      <div>contact@rolliworks.com</div>
      <div>www.rolliworks.com</div>
    </div>
    <div class="logo">
      <img src="https://djbjwcoddddywkgljuja.supabase.co/storage/v1/object/public/assets/rw-logo.jpg" alt="Rolliworks" style="max-height: 50px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span style="display:none; font-size: 32px; font-weight: bold;"><span style="color:#888;">ROLLI</span><span style="color:#41b6e6;">W</span><span style="color:#333;">ORKS</span></span>
    </div>
  </div>

  <div class="estimate-title">Estimate</div>

  <div class="info-row">
    <div class="address-section">
      <h3>Address</h3>
      <p>${addressLines.join('<br>') || 'Customer'}</p>
    </div>
    <div class="meta-section">
      <div class="meta-row"><span class="meta-label">ESTIMATE #</span> ${estimateNum}</div>
      <div class="meta-row"><span class="meta-label">DATE</span> ${formatDate(estimate.created_at)}</div>
    </div>
  </div>

  ${watch ? `
  <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #41b6e6;">
    <h3 style="font-size: 12px; font-weight: bold; color: #333; margin: 0 0 10px 0; text-transform: uppercase;">Watch Information</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
      <div><span style="color: #666;">Brand:</span> <strong>${watch.brand || '-'}</strong></div>
      ${watch.model ? `<div><span style="color: #666;">Model:</span> <strong>${watch.model}</strong></div>` : ''}
      ${watch.reference_number ? `<div><span style="color: #666;">Reference:</span> <strong>${watch.reference_number}</strong></div>` : ''}
      ${watch.serial_number ? `<div><span style="color: #666;">Serial:</span> <strong>${watch.serial_number}</strong></div>` : ''}
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
    <table class="totals-table">
      <tr>
        <td>Subtotal:</td>
        <td>${formatCurrency(estimate.subtotal)}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td>${formatCurrency(estimate.tax_amount)}</td>
      </tr>
      ${(estimate.shipping_amount || 0) > 0 ? `
      <tr>
        <td>Shipping:</td>
        <td>${formatCurrency(estimate.shipping_amount)}</td>
      </tr>
      ` : ''}
      <tr class="total">
        <td>Total:</td>
        <td>$${formatCurrency(estimate.total_amount)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #41b6e6 0%, #2a8ab8 100%); border-radius: 8px; text-align: center;">
    <p style="color: white; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">Need a prepaid shipping label to send your watch?</p>
    <a href="${appBaseUrl}/request-label/${estimate.id}" 
       style="display: inline-block; background: white; color: #41b6e6; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      Request Shipping Label
    </a>
    <p style="color: rgba(255,255,255,0.85); font-size: 11px; margin: 12px 0 0 0;">Click above to request a prepaid shipping label.<br/>The cost of the insured label will be added to your working estimate.</p>
  </div>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: EstimateEmailRequest = await req.json();
    const { estimateId, toEmail, subject, body, sendCopy, to, isTestEmail, isIntakeEmail } = requestBody;

    // Handle test email - simple send without estimate data
    if (isTestEmail && to) {
      console.log(`Sending test email to ${to}`);
      
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #0077c5;">
            <h1 style="margin: 0; font-size: 28px;">
              <span style="color: #333;">ROLLI</span><span style="color: #0077c5;">WORKS</span>
            </h1>
            <p style="color: #666; margin: 5px 0 0 0;">Template Preview</p>
          </div>
          <div style="padding: 30px 20px;">
            <p style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; color: #856404; font-size: 12px;">
              <strong>Test Email:</strong> This is a preview of the template. Variables like {{first_name}} will be replaced with actual values when sent to customers.
            </p>
            <p style="white-space: pre-wrap; line-height: 1.6; margin-top: 20px;">${(body || '').replace(/\n/g, '<br>')}</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>This is a test email from your email templates.</p>
          </div>
        </div>
      `;

      const emailResponse = await resend.emails.send({
        from: "Rolliworks Estimates <send@quotes.rolliworks.com>",
        to: [to],
        subject: subject || '[Test] Email Template Preview',
        html: htmlBody,
      });

      console.log("Test email sent successfully:", emailResponse);

      return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Handle intake email - simple send without PDF attachment
    if (isIntakeEmail && toEmail) {
      console.log(`Sending intake email to ${toEmail}`);
      
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
          <div style="padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee;">
            <p>Questions? Reply to this email or contact us at contact@rolliworks.com</p>
            <p style="margin-top: 10px;">Rolliworks LLC · 14 NE 1st Ave #403 · Miami, FL 33132</p>
          </div>
        </div>
      `;

      // Prepare recipients
      const recipients = [toEmail];
      if (sendCopy) {
        recipients.push('rolliworks2@gmail.com');
      }

      const emailResponse = await resend.emails.send({
        from: "Rolliworks <send@quotes.rolliworks.com>",
        to: recipients,
        subject: subject || 'Package Received - Rolliworks',
        html: htmlBody,
      });

      console.log("Intake email sent successfully:", emailResponse);

      return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Regular estimate email flow
    if (!estimateId || !toEmail) {
      throw new Error('estimateId and toEmail are required for estimate emails');
    }

    console.log(`Sending estimate email for ${estimateId} to ${toEmail}, sendCopy: ${sendCopy}`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve the requesting user's email (so "Send me a copy" actually sends to the logged-in user)
    // Note: we keep the internal copy address as well.
    let requesterEmail: string | null = null;
    if (sendCopy) {
      const authHeader = req.headers.get("Authorization");
      const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

      if (jwt && anonKey) {
        const authSupabase = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        const { data: userData, error: userError } = await authSupabase.auth.getUser();
        if (userError) {
          console.warn("Unable to resolve requester email for sendCopy:", userError);
        } else {
          requesterEmail = userData.user?.email ?? null;
        }
      } else if (!jwt) {
        console.warn("sendCopy requested but missing Authorization header");
      } else {
        console.warn("sendCopy requested but SUPABASE_ANON_KEY is not set");
      }
    }

    // Fetch estimate with customer and watch data
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select(`
        *,
        customer:customers(*),
        watch:watches(*)
      `)
      .eq('id', estimateId)
      .single();

    if (estimateError || !estimate) {
      console.error('Error fetching estimate:', estimateError);
      throw new Error('Estimate not found');
    }

    // Fetch line items with retry logic
    let lineItems = [];
    let lineItemsError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order');

      if (!result.error) {
        lineItems = result.data || [];
        lineItemsError = null;
        break;
      }

      console.log(`Line items fetch attempt ${attempt + 1} failed:`, result.error);
      lineItemsError = result.error;

      // Wait before retry (exponential backoff)
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    if (lineItemsError) {
      console.error('Error fetching line items after retries:', lineItemsError);
      // Continue with empty line items rather than failing
      console.log('Proceeding with empty line items');
    }

    // Generate PDF HTML
    const pdfHtml = generateEstimatePDF(
      estimate,
      estimate.customer,
      estimate.watch,
      lineItems || []
    );

    // Convert HTML to base64 for attachment
    const pdfBase64 = btoa(unescape(encodeURIComponent(pdfHtml)));

    // Format email body with HTML
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
            Total: $${(estimate.total_amount || 0).toFixed(2)}
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          <p>Questions? Reply to this email or contact us at help@rolliworks.com</p>
        </div>
      </div>
    `;

    // Recipients: customer is always the only "to" recipient; copies are bcc'd.
    const toRecipients = [toEmail];
    const bccSet = new Set<string>();

    if (sendCopy) {
      bccSet.add('help@rolliworks.com');
      if (requesterEmail) bccSet.add(requesterEmail);
    }

    const bccRecipients = Array.from(bccSet);
    console.log("Estimate email recipients:", { to: toRecipients, bcc: bccRecipients });

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "Rolliworks Estimates <send@quotes.rolliworks.com>",
      to: toRecipients,
      ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
      subject: subject || `Estimate ${estimate.estimate_number}`,
      html: htmlBody,
      attachments: [
        {
          filename: `Estimate-${estimate.estimate_number}.html`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    // Update estimate status to sent
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', estimateId);

    if (updateError) {
      console.error('Error updating estimate status:', updateError);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-estimate-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
