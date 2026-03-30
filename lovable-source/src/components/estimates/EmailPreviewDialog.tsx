import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Printer, FileDown, Loader2, Plus, ArrowLeft, Mail, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimate: {
    id: string;
    estimate_number: string;
    customer?: {
      first_name: string;
      last_name: string;
      email?: string | null;
      company_name?: string | null;
    } | null;
    watch?: {
      brand: string;
      model?: string | null;
    } | null;
    total_amount?: number | null;
    valid_until?: string | null;
  } | null;
  onSend: () => void;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  category: string | null;
}

const TEMPLATE_CATEGORIES = [
  { value: 'estimate', label: 'Estimate' },
  { value: 'intake', label: 'Intake' },
  { value: 'status_update', label: 'Status Update' },
  { value: 'completion', label: 'Completion' },
  { value: 'general', label: 'General' },
];

export function EmailPreviewDialog({ open, onOpenChange, estimate, onSend }: EmailPreviewDialogProps) {
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendMeCopy, setSendMeCopy] = useState(false);
  const [bccEmail, setBccEmail] = useState('');
  const [showBcc, setShowBcc] = useState(false);
  const [defaultTemplateApplied, setDefaultTemplateApplied] = useState(false);

  // Fetch email templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates-estimate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: open,
  });

  // Fetch full line items for preview display
  const { data: lineItems } = useQuery({
    queryKey: ['estimate-line-items-preview', estimate?.id],
    queryFn: async () => {
      if (!estimate?.id) return [];
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('id, description, quantity, unit_price, extended_price, line_type, part_id, parts:part_id(category, part_number)')
        .eq('estimate_id', estimate.id)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!estimate?.id,
  });

  // Use lineItems for category detection as well
  const lineItemCategories = lineItems;

  // Fetch full estimate details for preview (subtotal, tax, shipping)
  const { data: fullEstimateData } = useQuery({
    queryKey: ['estimate-full-preview', estimate?.id],
    queryFn: async () => {
      if (!estimate?.id) return null;
      const { data, error } = await supabase
        .from('estimates')
        .select('subtotal, tax_amount, shipping_amount, total_amount')
        .eq('id', estimate.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!estimate?.id,
  });
  const groupedTemplates = templates?.reduce((acc, template) => {
    const category = template.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, MessageTemplate[]>);

  const sortedCategories = Object.keys(groupedTemplates || {}).sort((a, b) => {
    if (a === 'estimate') return -1;
    if (b === 'estimate') return 1;
    return a.localeCompare(b);
  });

  // Determine default template based on line item categories or descriptions
  const getDefaultTemplateName = (): string | null => {
    if (!lineItemCategories || lineItemCategories.length === 0) return null;
    
    // Get categories from linked parts
    const categories = lineItemCategories
      .map((item: any) => item.parts?.category?.toLowerCase())
      .filter(Boolean);
    
    // Get descriptions for fallback keyword matching
    const descriptions = lineItemCategories
      .map((item: any) => item.description?.toLowerCase() || '')
      .filter(Boolean);
    
    // Check for watch or watch_case categories
    const hasWatchCategory = categories.some(
      (cat: string) => cat === 'watch' || cat === 'watch_case'
    );
    
    // Fallback: check descriptions for watch-related keywords
    const hasWatchKeyword = descriptions.some(
      (desc: string) => desc.includes('watch') && !desc.includes('bracelet') && !desc.includes('band')
    );
    
    if (hasWatchCategory || hasWatchKeyword) {
      return 'W or P';
    }
    
    // Check for bracelet category (no watch/watch_case)
    const hasBraceletCategory = categories.some((cat: string) => cat === 'bracelet');
    
    // Fallback: check descriptions for band/bracelet keywords
    const hasBandKeyword = descriptions.some(
      (desc: string) => desc.includes('bracelet') || desc.includes('band') || desc.includes('jubilee')
    );
    
    if (hasBraceletCategory || hasBandKeyword) {
      return 'B- Band Quote';
    }
    
    return null;
  };

  // Initialize email fields when dialog opens
  useEffect(() => {
    if (open && estimate) {
      setToEmail(estimate.customer?.email || '');
      setSubject(`ESTIMATE # ${estimate.estimate_number.replace(/^EST-/, 'E')} from Rolliworks`);
      setDefaultTemplateApplied(false);

      const customerName = estimate.customer?.first_name
        ? `${estimate.customer.first_name}`
        : estimate.customer?.company_name || 'Valued Customer';

      const watchInfo = estimate.watch
        ? `${estimate.watch.brand}${estimate.watch.model ? ` ${estimate.watch.model}` : ''}`
        : 'your timepiece';

      const defaultBody = `Dear ${customerName},

Thank you for reaching out to us. Here is your estimate for time and cost.

***Please don't use the "REVIEW AND APPROVE" button ****

NEXT STEPS?

1. Review the estimate. Reach out to us if you need anything added or removed.
2. Print a copy of the estimate. Please include a printed copy of this estimate in the package.
3. Ship your ${watchInfo} to us via an insured service.

Best regards,
The Rolliworks Team`;

      setBody(defaultBody);
    }
  }, [open, estimate]);

  // Helper to apply template with variable substitution
  const applyTemplate = (template: MessageTemplate) => {
    if (!estimate) return;
    
    const customerName = estimate.customer?.first_name
      ? `${estimate.customer.first_name} ${estimate.customer.last_name}`.trim()
      : estimate.customer?.company_name || 'Valued Customer';

    const watchInfo = estimate.watch
      ? `${estimate.watch.brand}${estimate.watch.model ? ` ${estimate.watch.model}` : ''}`
      : 'your timepiece';

    let processedSubject = template.subject || `ESTIMATE # ${estimate.estimate_number.replace(/^EST-/, 'E')} from Rolliworks`;
    let processedBody = template.body;

    const replacements: Record<string, string> = {
      '{{customer_name}}': customerName,
      '{{first_name}}': estimate.customer?.first_name || '',
      '{{watch_brand}}': estimate.watch?.brand || '',
      '{{watch_model}}': estimate.watch?.model || '',
      '{{estimate_number}}': estimate.estimate_number.replace(/^EST-/, 'E'),
      '{{total_amount}}': `$${(estimate.total_amount || 0).toFixed(2)}`,
      '{{valid_until}}': estimate.valid_until ? format(new Date(estimate.valid_until), 'MMMM d, yyyy') : '',
    };

    Object.entries(replacements).forEach(([key, value]) => {
      processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
      processedBody = processedBody.replace(new RegExp(key, 'g'), value);
    });

    setSelectedTemplateId(template.id);
    if (template.subject) setSubject(processedSubject);
    setBody(processedBody);
  };

  // Auto-select template based on line item categories
  useEffect(() => {
    if (open && templates && lineItemCategories && !defaultTemplateApplied) {
      const defaultTemplateName = getDefaultTemplateName();
      if (defaultTemplateName) {
        const matchingTemplate = templates.find(t => t.name === defaultTemplateName);
        if (matchingTemplate) {
          applyTemplate(matchingTemplate);
          setDefaultTemplateApplied(true);
        }
      }
    }
  }, [open, templates, lineItemCategories, defaultTemplateApplied, estimate]);

  // Apply template when selected by user
  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      applyTemplate(template);
    }
  };


    // Generate CODE128 barcode SVG
    const generateBarcodeSVG = (text: string): string => {
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
        'X': '11100010110', 'Y': '11101101000', 'Z': '11101100010',
      };

      const START_B = '11010010000';
      const STOP = '1100011101011';

      let checksum = 104;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const value = char.charCodeAt(0) - 32;
        checksum += value * (i + 1);
      }
      checksum = checksum % 103;

      let pattern = START_B;
      for (const char of text) {
        pattern += CODE128_PATTERNS[char] || CODE128_PATTERNS[' '];
      }
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
    };

    const handleSaveAsPDF = async () => {
      if (!estimate) return;

      // Fetch full estimate data for PDF
      const { data: fullEstimate } = await supabase
        .from('estimates')
        .select(`*, customer:customers(*), watch:watches(*)`)
        .eq('id', estimate.id)
        .single();

      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimate.id)
        .order('sort_order');

      const customerData = fullEstimate?.customer;

      // Generate barcode
      const barcodeSVG = generateBarcodeSVG(estimate.estimate_number);
      const barcodeDataUrl = `data:image/svg+xml;base64,${btoa(barcodeSVG)}`;

      // Build address lines
      const addressLines: string[] = [];
      if (customerData?.company_name) addressLines.push(customerData.company_name);
      const customerName = customerData 
        ? `${customerData.first_name} ${customerData.last_name}`.trim()
        : '';
      if (customerName) addressLines.push(customerName);
      if (customerData?.address) addressLines.push(customerData.address);
      if (customerData?.city || customerData?.state || customerData?.zip) {
        addressLines.push(`${customerData?.city || ''}, ${customerData?.state || ''} ${customerData?.zip || ''}`.trim());
      }
      if (customerData?.phone) addressLines.push(customerData.phone);
      if (customerData?.email) addressLines.push(customerData.email);

      // Extract estimate number with E-prefix for display
      const estimateNum = estimate.estimate_number.replace(/^EST-/, 'E');

      const formatCurrency = (amount: number | null | undefined) => (amount || 0).toFixed(2);

      const lineItemsHTML = (lineItems || []).map((item: any) => `
        <tr>
          <td style="padding: 12px 8px; vertical-align: top; font-weight: 500; color: #333; width: 120px;">${item.description.split(' - ')[0] || ''}</td>
          <td style="padding: 12px 8px; vertical-align: top; color: #555; line-height: 1.5;">${item.description}</td>
          <td style="padding: 12px 8px; vertical-align: top; text-align: center; width: 50px;">${item.quantity}</td>
          <td style="padding: 12px 8px; vertical-align: top; text-align: right; width: 80px;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 12px 8px; vertical-align: top; text-align: right; width: 80px;">${formatCurrency(item.extended_price)}</td>
        </tr>
      `).join('');

      const pdfHtml = `
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
    @media print { body { margin: 20px; padding: 20px; } }
  </style>
</head>
<body>
  <div class="barcode-header">
    <img src="${barcodeDataUrl}" alt="${estimate.estimate_number}">
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
      <img src="${window.location.origin}/images/rw-logo.jpg" alt="Rolliworks" style="max-height: 50px; width: auto;">
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
      <div class="meta-row"><span class="meta-label">DATE</span> ${format(new Date(fullEstimate?.created_at || new Date()), 'MM/dd/yyyy')}</div>
    </div>
  </div>

  ${fullEstimate?.watch ? `
  <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #41b6e6;">
    <h3 style="font-size: 12px; font-weight: bold; color: #333; margin: 0 0 10px 0; text-transform: uppercase;">Watch Information</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
      <div><span style="color: #666;">Brand:</span> <strong>${fullEstimate.watch.brand || '-'}</strong></div>
      ${fullEstimate.watch.model ? `<div><span style="color: #666;">Model:</span> <strong>${fullEstimate.watch.model}</strong></div>` : ''}
      ${fullEstimate.watch.reference_number ? `<div><span style="color: #666;">Reference:</span> <strong>${fullEstimate.watch.reference_number}</strong></div>` : ''}
      ${fullEstimate.watch.serial_number ? `<div><span style="color: #666;">Serial:</span> <strong>${fullEstimate.watch.serial_number}</strong></div>` : ''}
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
        <td>${formatCurrency(fullEstimate?.subtotal)}</td>
      </tr>
      <tr>
        <td>Tax:</td>
        <td>${formatCurrency(fullEstimate?.tax_amount)}</td>
      </tr>
      ${(fullEstimate?.shipping_amount || 0) > 0 ? `
      <tr>
        <td>Shipping:</td>
        <td>${formatCurrency(fullEstimate?.shipping_amount)}</td>
      </tr>
      ` : ''}
      <tr class="total">
        <td>Total:</td>
        <td>$${formatCurrency(fullEstimate?.total_amount)}</td>
      </tr>
    </table>
  </div>

  <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #41b6e6 0%, #2a8ab8 100%); border-radius: 8px; text-align: center;">
    <p style="color: white; font-size: 14px; margin: 0 0 12px 0; font-weight: 500;">Need a prepaid shipping label to send your watch?</p>
    <a href="${window.location.origin}/request-label/${estimate.id}" 
       style="display: inline-block; background: white; color: #41b6e6; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      Request Shipping Label
    </a>
    <p style="color: rgba(255,255,255,0.85); font-size: 11px; margin: 12px 0 0 0;">Click above to request a prepaid shipping label.<br/>The cost of the insured label will be added to your working estimate.</p>
  </div>
</body>
</html>
      `;

      // Open in new window for printing/saving as PDF
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write(pdfHtml);
        pdfWindow.document.close();
      }
    };

    const handlePrint = () => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const customerName = estimate.customer?.first_name
        ? `${estimate.customer.first_name} ${estimate.customer.last_name}`.trim()
        : estimate.customer?.company_name || 'Valued Customer';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email - ${estimate.estimate_number}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
              .header { border-bottom: 2px solid #2ca01c; padding-bottom: 20px; margin-bottom: 20px; }
              .header h1 { margin: 0 0 10px 0; color: #2ca01c; font-size: 24px; }
              .meta { color: #666; font-size: 14px; }
              .meta p { margin: 4px 0; }
              .body { white-space: pre-wrap; font-size: 14px; }
              @media print { body { margin: 20px; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Rolliworks</h1>
              <div class="meta">
                <p><strong>To:</strong> ${customerName} &lt;${toEmail}&gt;</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Date:</strong> ${format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
            </div>
            <div class="body">${body}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    };

    const handleSendEmail = async () => {
      if (!toEmail || !estimate) return;

      setIsSending(true);

      try {
        const { data, error } = await supabase.functions.invoke('send-estimate-email', {
          body: {
            estimateId: estimate.id,
            toEmail,
            subject,
            body,
            sendCopy: sendMeCopy,
          },
        });

        if (error) throw error;

        onSend();
        onOpenChange(false);
      } catch (error: any) {
        console.error('Error sending email:', error);
        alert('Failed to send email. Please try again or use "Compose Email" to open your email client.');
      } finally {
        setIsSending(false);
      }
    };

    const handleComposeEmail = () => {
      if (!toEmail) return;
      const mailtoLink = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');
    };

  // Guard: show loading if estimate is null
  if (!estimate) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="p-6 text-center text-muted-foreground">
            Loading estimate...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const customerName = estimate.customer?.first_name
    ? `${estimate.customer.first_name}`
    : estimate.customer?.company_name || 'Valued Customer';

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <span className="text-lg font-medium">Estimate {estimate?.estimate_number}</span>
            </div>
          </div>

          {/* Main Content - Side by side layout */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: Email Form */}
            <div className="flex-1 p-6 overflow-y-auto border-r">
              {/* Template selector */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm text-muted-foreground">Load Template</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/estimates/email-templates');
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Manage
                  </Button>
                </div>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {templatesLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : !templates || templates.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <p>No templates available</p>
                      </div>
                    ) : (
                      sortedCategories.map(category => (
                        <SelectGroup key={category}>
                          <SelectLabel className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {TEMPLATE_CATEGORIES.find(c => c.value === category)?.label || category}
                            </Badge>
                          </SelectLabel>
                          {groupedTemplates?.[category]?.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                <span>{template.name}</span>
                                {category === 'estimate' && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              {/* From field */}
              <div className="flex items-center gap-4 mb-4">
                <Label className="w-16 text-sm text-muted-foreground">From</Label>
                <Select defaultValue="rolliworks">
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rolliworks">Rolliworks LLC &lt;rolliworks2@gmail.com&gt;</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* To field */}
              <div className="flex items-center gap-4 mb-2">
                <Label className="w-16 text-sm text-muted-foreground">To</Label>
                <Input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="flex-1"
                />
                {!showBcc && (
                  <button 
                    type="button"
                    className="text-sm text-[#0077c5] hover:underline"
                    onClick={() => setShowBcc(true)}
                  >
                    Bcc
                  </button>
                )}
              </div>

              {/* BCC field */}
              {showBcc && (
                <div className="flex items-center gap-4 mb-2">
                  <Label className="w-16 text-sm text-muted-foreground">Bcc</Label>
                  <Input
                    value={bccEmail}
                    onChange={(e) => setBccEmail(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1"
                  />
                  <button 
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => { setShowBcc(false); setBccEmail(''); }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Send me a copy */}
              <div className="flex items-center gap-2 mb-4 ml-20">
                <Checkbox
                  id="send-copy"
                  checked={sendMeCopy}
                  onCheckedChange={(checked) => setSendMeCopy(checked as boolean)}
                />
                <label htmlFor="send-copy" className="text-sm text-muted-foreground cursor-pointer">
                  Send me a copy
                </label>
              </div>

              {/* Subject field */}
              <div className="flex items-center gap-4 mb-4">
                <Label className="w-16 text-sm text-muted-foreground">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="flex-1"
                />
              </div>

              {/* Attachment indicator */}
              <div className="flex items-center gap-2 mb-4 ml-20">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Estimate PDF</span>
              </div>

              {/* Email body */}
              <div className="flex gap-4">
                <Label className="w-16 text-sm text-muted-foreground pt-2">Email body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="flex-1 font-sans text-sm"
                  placeholder="Email body..."
                />
              </div>
            </div>

            {/* Right: PDF Preview */}
            <div className="w-[400px] bg-slate-100 p-4 overflow-y-auto">
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden p-4 text-[10px]">
                {/* Centered barcode */}
                <div className="text-center mb-3">
                  <div 
                    dangerouslySetInnerHTML={{ __html: generateBarcodeSVG(estimate?.estimate_number || '') }}
                    className="inline-block"
                    style={{ transform: 'scale(0.7)', transformOrigin: 'center' }}
                  />
                </div>

                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="text-[9px] leading-tight">
                    <div className="font-bold text-[10px]">Rolliworks LLC</div>
                    <div>14 NE 1st Ave Ste 403</div>
                    <div>Miami, FL 33132</div>
                    <div>+14088003244</div>
                    <div>contact@rolliworks.com</div>
                  </div>
                  <div className="text-right">
                    <img src="/images/rw-logo.jpg" alt="Rolliworks" className="max-h-8 w-auto ml-auto" />
                  </div>
                </div>

                {/* Estimate title */}
                <div className="text-[#41b6e6] text-xl font-light mb-2">Estimate</div>

                {/* Address and meta row */}
                <div className="flex justify-between border-b pb-2 mb-2">
                  <div>
                    <div className="font-bold text-[8px] uppercase mb-1">Address</div>
                    <div className="text-[9px] leading-tight">
                      {estimate?.customer?.company_name && <div>{estimate.customer.company_name}</div>}
                      <div>{customerName}</div>
                    </div>
                  </div>
                  <div className="text-right text-[9px]">
                    <div><span className="font-bold">ESTIMATE #</span> {estimate?.estimate_number?.replace(/^EST-/, 'E')}</div>
                    <div><span className="font-bold">DATE</span> {format(new Date(), 'MM/dd/yyyy')}</div>
                  </div>
                </div>

                {/* Line items header */}
                <div className="grid grid-cols-5 gap-1 text-[8px] font-bold text-[#41b6e6] uppercase border-b pb-1 mb-1">
                  <div>Activity</div>
                  <div className="col-span-2">Description</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Amount</div>
                </div>

                {/* Actual line items */}
                {lineItems && lineItems.length > 0 ? (
                  lineItems.map((item: any) => (
                    <div key={item.id} className="grid grid-cols-5 gap-1 text-[9px] border-b pb-1">
                      <div className="font-medium text-slate-600 truncate">{item.line_type || 'Service'}</div>
                      <div className="col-span-2 text-slate-500 truncate">{item.description}</div>
                      <div className="text-center">{item.quantity}</div>
                      <div className="text-right">${(item.extended_price || 0).toFixed(2)}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-[9px] text-slate-400 py-2 text-center">No line items</div>
                )}
                <div className="mb-2" />

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="text-right text-[9px] space-y-0.5">
                    <div><span className="font-bold uppercase mr-3">Subtotal:</span> ${(fullEstimateData?.subtotal || estimate?.total_amount || 0).toFixed(2)}</div>
                    {(fullEstimateData?.tax_amount || 0) > 0 && (
                      <div><span className="font-bold uppercase mr-3">Tax:</span> ${(fullEstimateData?.tax_amount || 0).toFixed(2)}</div>
                    )}
                    {(fullEstimateData?.shipping_amount || 0) > 0 && (
                      <div><span className="font-bold uppercase mr-3">Shipping:</span> ${(fullEstimateData?.shipping_amount || 0).toFixed(2)}</div>
                    )}
                    <div className="pt-1 border-t"><span className="font-bold uppercase mr-3">Total:</span> ${(fullEstimateData?.total_amount || estimate?.total_amount || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-white shrink-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[#0077c5] hover:text-[#005a94] hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={handleSaveAsPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Save as PDF
              </Button>
              <Button variant="outline" onClick={handleComposeEmail} disabled={!toEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Compose Email
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={!toEmail || isSending}
                className="bg-[#2ca01c] hover:bg-[#228b15]"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send with PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
}
