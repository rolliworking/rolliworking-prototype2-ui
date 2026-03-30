import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/integrations/supabase/client';
import { useEstimate, useEstimateLineItems, useUpdateEstimate, useAddEstimateLineItem, useUpdateEstimateLineItem, useDeleteEstimateLineItem, useConvertEstimateToIntake, useDuplicateEstimate, calculateEstimateTotals } from '@/hooks/useEstimates';
import { useServiceCategories, useServiceSubcategories } from '@/hooks/useServiceCategories';
import { useShippingRates, calculateShippingCost } from '@/hooks/useShippingRates';
import { useModelReferenceLookup } from '@/hooks/useModelReferences';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle, 
  Loader2, 
  Package,
  Truck,
  Printer,
  ChevronDown,
  FileText,
  Wrench,
  Mail,
  X,
  Settings,
  HelpCircle,
  MessageSquare,
  GripVertical,
  PlusCircle,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ESTIMATE_STATUS_LABELS, LINE_TYPE_LABELS, TAX_RATE } from '@/types/estimates';
import type { EstimateStatus, LineType, EstimateLineItemFormData } from '@/types/estimates';
import { LabelPrintDialog } from '@/components/labels/LabelPrintDialog';
import { CalcInput } from '@/components/ui/calc-input';
import { EmailPreviewDialog } from '@/components/estimates/EmailPreviewDialog';
import { CustomerSelector } from '@/components/customers/CustomerSelector';
import { CustomerSidePanel } from '@/components/customers/CustomerSidePanel';
import { PartsSearchInput } from '@/components/estimates/PartsSearchInput';
import { BrandAutocomplete } from '@/components/estimates/BrandAutocomplete';
import { Customer } from '@/types/database';

const statusColors: Record<EstimateStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
};

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: estimate, isLoading: estimateLoading } = useEstimate(id!);
  const { data: lineItems, isLoading: lineItemsLoading } = useEstimateLineItems(id!);
  const { data: categories } = useServiceCategories();
  const { data: subcategories } = useServiceSubcategories();
  const { data: shippingRates } = useShippingRates();
  
  const updateEstimate = useUpdateEstimate();
  const addLineItem = useAddEstimateLineItem();
  const updateLineItem = useUpdateEstimateLineItem();
  const deleteLineItem = useDeleteEstimateLineItem();
  const convertToIntake = useConvertEstimateToIntake();
  const duplicateEstimate = useDuplicateEstimate();
  
  const [addLineDialogOpen, setAddLineDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newLine, setNewLine] = useState<EstimateLineItemFormData>({
    line_type: 'service',
    description: '',
    quantity: 1,
    unit_price: 0,
    taxable: true,
  });
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [editingEstimateNumber, setEditingEstimateNumber] = useState(false);
  const [estimateNumberValue, setEstimateNumberValue] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [partSearchByLineId, setPartSearchByLineId] = useState<Record<string, string>>({});
  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
  const [selectedCustomerForPanel, setSelectedCustomerForPanel] = useState<Customer | null>(null);

  const [notesValue, setNotesValue] = useState('');
  const [internalNotesValue, setInternalNotesValue] = useState('');
  const [validUntilValue, setValidUntilValue] = useState('');
  
  // Watch editing state
  const [selectedWatchId, setSelectedWatchId] = useState('');
  const [newWatch, setNewWatch] = useState({
    brand: '',
    model: '',
    serial_number: '',
    part_number: '',
  });

  // Auto-decode Part # to Brand/Model using model_references
  const { data: modelReference } = useModelReferenceLookup(newWatch.part_number);
  
  // Fetch watches for selected customer
  const { data: customerWatches } = useQuery({
    queryKey: ['customer-watches-detail', estimate?.customer?.id],
    queryFn: async () => {
      if (!estimate?.customer?.id) return [];
      const { data, error } = await supabase
        .from('watches')
        .select('*')
        .eq('customer_id', estimate.customer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!estimate?.customer?.id,
  });

  useEffect(() => {
    if (!estimate) return;

    setNotesValue(estimate.notes ?? 'Thank you for your business.');
    setInternalNotesValue(estimate.internal_notes ?? '');
    setValidUntilValue(
      estimate.valid_until ? format(new Date(estimate.valid_until), 'yyyy-MM-dd') : ''
    );
    
    // Initialize watch selection if estimate has a watch
    if (estimate.watch?.id) {
      setSelectedWatchId(estimate.watch.id);
    }
  }, [estimate?.id]);
  
  // Auto-fill brand/model when a matching reference is found
  useEffect(() => {
    if (modelReference && newWatch.part_number) {
      const shouldUpdateBrand = !newWatch.brand && modelReference.brand;
      const shouldUpdateModel = !newWatch.model && modelReference.model;
      
      if (shouldUpdateBrand || shouldUpdateModel) {
        setNewWatch(prev => ({
          ...prev,
          brand: shouldUpdateBrand ? modelReference.brand : prev.brand,
          model: shouldUpdateModel ? (modelReference.model || '') : prev.model,
        }));
        
        if (selectedWatchId) {
          setSelectedWatchId('');
        }
        
        toast({
          title: 'Watch Decoded',
          description: `${modelReference.brand}${modelReference.model ? ` ${modelReference.model}` : ''} (from Part #)`,
        });
      }
    }
  }, [modelReference, newWatch.part_number]);
  
  // Save watch to estimate
  const handleSaveWatch = async () => {
    if (!estimate) return;
    
    let watchId = selectedWatchId;
    
    // Create new watch if brand is filled
    if (newWatch.brand) {
      const { data: newW, error } = await supabase
        .from('watches')
        .insert({
          customer_id: estimate.customer?.id,
          brand: newWatch.brand,
          model: newWatch.model,
          serial_number: newWatch.serial_number,
          reference_number: newWatch.part_number,
        })
        .select()
        .single();
      
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to save watch information.',
          variant: 'destructive',
        });
        return;
      }
      watchId = newW.id;
      setNewWatch({ brand: '', model: '', serial_number: '', part_number: '' });
      setSelectedWatchId(newW.id);
    }
    
    if (watchId) {
      updateEstimate.mutate({
        estimateId: id!,
        data: { watch_id: watchId },
      });
      toast({
        title: 'Watch Saved',
        description: 'Watch information has been linked to the estimate.',
      });
    }
  };

  // Calculate totals
  const totals = lineItems ? calculateEstimateTotals(lineItems, TAX_RATE) : null;

  // Editable if draft OR sent
  const isEditable = estimate?.status === 'draft' || estimate?.status === 'sent';

  // Update estimate totals when line items change
  useEffect(() => {
    if (totals && estimate && isEditable) {
      const hasChanged = 
        Math.abs((estimate.subtotal || 0) - totals.subtotal) > 0.01 ||
        Math.abs((estimate.tax_amount || 0) - totals.tax_amount) > 0.01 ||
        Math.abs((estimate.total_amount || 0) - totals.total_amount) > 0.01;
      
      if (hasChanged) {
        updateEstimate.mutate({
          estimateId: id!,
          data: {
            subtotal: totals.subtotal,
            tax_amount: totals.tax_amount,
            shipping_amount: totals.shipping_amount,
            total_amount: totals.total_amount,
          },
        });
      }
    }
  }, [totals?.total_amount]);

  const handleAddLine = async () => {
    if (!newLine.description) {
      toast({
        title: 'Missing Description',
        description: 'Please enter a description.',
        variant: 'destructive',
      });
      return;
    }

    await addLineItem.mutateAsync({
      estimateId: id!,
      data: newLine,
    });

    setAddLineDialogOpen(false);
    setNewLine({
      line_type: 'service',
      description: '',
      quantity: 1,
      unit_price: 0,
      taxable: true,
    });
    setSelectedCategory('');
  };

  const handleSelectService = (subcategoryId: string) => {
    const sub = subcategories?.find(s => s.id === subcategoryId);
    if (sub) {
      setNewLine({
        ...newLine,
        line_type: 'service',
        service_subcategory_id: subcategoryId,
        description: sub.name,
        unit_price: sub.default_price || 0,
      });
    }
  };

  const handleSelectShipping = (rateId: string) => {
    const rate = shippingRates?.find(r => r.id === rateId);
    if (rate) {
      const shippingCost = calculateShippingCost(rate, 5000);
      setNewLine({
        ...newLine,
        line_type: 'shipping',
        description: `${rate.carrier} - ${rate.service_name}`,
        unit_price: shippingCost,
        quantity: 1,
        taxable: false,
      });
    }
  };

  const handleDeleteLine = async (lineItemId: string) => {
    await deleteLineItem.mutateAsync({
      lineItemId,
      estimateId: id!,
    });
  };

  const handleSendEstimate = async () => {
    await updateEstimate.mutateAsync({
      estimateId: id!,
      data: {
        status: 'sent',
      },
    });
    toast({
      title: 'Estimate Sent',
      description: 'Estimate status has been updated to Sent.',
    });
  };

  const handleOpenEmailPreview = () => {
    setEmailPreviewOpen(true);
  };

  const handleConvertToIntake = async () => {
    await convertToIntake.mutateAsync({ estimateId: id! });
    navigate('/dashboard');
  };

  // Generate CODE128 barcode SVG for print using JsBarcode
  const generateBarcodeSVG = (text: string): string => {
    // Create a temporary SVG element
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    
    try {
      JsBarcode(tempSvg, text, {
        format: 'CODE128',
        displayValue: true,
        width: 1.5,
        height: 30,
        margin: 5,
        font: 'monospace',
        fontSize: 10,
        textMargin: 3,
      });
      return tempSvg.outerHTML;
    } catch (e) {
      console.error('Barcode generation failed:', e);
    }
    
    // Fallback: return a simple placeholder if barcode generation fails
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="65" viewBox="0 0 200 65">
      <rect width="100%" height="100%" fill="white"/>
      <text x="100" y="40" text-anchor="middle" font-family="monospace" font-size="12">${text}</text>
    </svg>`;
  };

  const handlePrintEstimate = async () => {
    if (!estimate || !lineItems) return;

    const customerData = estimate.customer;
    const estimateNum = (estimate.estimate_number || '').replace(/^EST-/, 'E');
    const barcodeSVG = generateBarcodeSVG(estimate.estimate_number || '');
    const barcodeDataUrl = `data:image/svg+xml;base64,${btoa(barcodeSVG)}`;

    // Build address lines
    const addressLines: string[] = [];
    if ((customerData as any)?.company_name) addressLines.push((customerData as any).company_name);
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

    const formatCurrency = (amount: number | null | undefined) => (amount || 0).toFixed(2);

    const lineItemsHTML = lineItems.map((item: any) => `
      <tr>
        <td style="padding: 12px 8px; vertical-align: top; font-weight: 500; color: #333; width: 120px;">${(item.description || '').split(' - ')[0] || ''}</td>
        <td style="padding: 12px 8px; vertical-align: top; color: #555; line-height: 1.5;">${item.description || ''}</td>
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
      <div class="meta-row"><span class="meta-label">DATE</span> ${format(new Date(estimate.created_at || new Date()), 'MM/dd/yyyy')}</div>
    </div>
  </div>

  ${estimate.watch ? `
  <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #41b6e6;">
    <h3 style="font-size: 12px; font-weight: bold; color: #333; margin: 0 0 10px 0; text-transform: uppercase;">Watch Information</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 13px;">
      <div><span style="color: #666;">Brand:</span> <strong>${estimate.watch.brand || '-'}</strong></div>
      ${estimate.watch.model ? `<div><span style="color: #666;">Model:</span> <strong>${estimate.watch.model}</strong></div>` : ''}
      ${estimate.watch.reference_number ? `<div><span style="color: #666;">Reference:</span> <strong>${estimate.watch.reference_number}</strong></div>` : ''}
      ${estimate.watch.serial_number ? `<div><span style="color: #666;">Serial:</span> <strong>${estimate.watch.serial_number}</strong></div>` : ''}
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
      // Auto-trigger print dialog
      setTimeout(() => pdfWindow.print(), 500);
    }
  };

  if (estimateLoading || lineItemsLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex flex-col justify-center items-center">
        <p className="text-slate-500 mb-4">Estimate not found</p>
        <Button variant="outline" onClick={() => navigate('/estimates')}>
          Back to Estimates
        </Button>
      </div>
    );
  }

  const filteredSubcategories = selectedCategory
    ? subcategories?.filter(s => s.category_id === selectedCategory)
    : subcategories;

  const displayEstimateNumber = (estimate.estimate_number || '').replace(/^EST-/, 'E');

  const normalizeEstimateNumberForStorage = (raw: string) => {
    const v = (raw || '').trim();

    const mE = v.match(/^E(\d+)$/i);
    if (mE) return `EST-${mE[1].padStart(5, '0')}`;

    const mEst = v.match(/^EST-(\d+)$/i);
    if (mEst) return `EST-${mEst[1].padStart(5, '0')}`;

    const mDigits = v.match(/^(\d+)$/);
    if (mDigits) return `EST-${mDigits[1].padStart(5, '0')}`;

    return v;
  };

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      {/* QBO Header */}
      <div className="qbo-header">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-500" />
            <span className="qbo-header-title">Estimate {displayEstimateNumber}</span>
            <Badge
              variant="outline" 
              className={`${statusColors[estimate.status]} border font-normal ml-2`}
            >
              {ESTIMATE_STATUS_LABELS[estimate.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <HelpCircle className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" />
            <X 
              className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" 
              onClick={() => navigate('/estimates')}
            />
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-6 flex items-center justify-between border-t border-slate-100">
          <div className="flex">
            <button className="px-4 py-3 text-sm font-medium text-slate-900 border-b-2 border-slate-900">
              Edit
            </button>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <button className="flex items-center gap-1.5 hover:text-slate-700">
              <Settings className="h-4 w-4" />
              Manage
            </button>
            <button className="flex items-center gap-1.5 hover:text-slate-700">
              <HelpCircle className="h-4 w-4" />
              Take tour
            </button>
            <button className="flex items-center gap-1.5 hover:text-slate-700">
              <MessageSquare className="h-4 w-4" />
              Feedback
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="qbo-card">
          <div className="p-6">
            {/* ESTIMATE Header */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="qbo-document-title">ESTIMATE</h2>
              <p className="text-sm text-slate-600">
                Amount (hidden): <span className="font-semibold text-slate-900">${(totals?.total_amount || 0).toFixed(2)}</span>
              </p>
            </div>

            {/* Customer & Dates Section */}
            <div className="grid grid-cols-[280px_1fr] gap-8 mb-6">
              {/* Customer Info - Left */}
              <div>
                {isEditable ? (
                  <CustomerSelector
                    selectedCustomer={estimate.customer as Customer | null}
                    onCustomerSelect={(customer) => {
                      if (customer) {
                        updateEstimate.mutate({
                          estimateId: id!,
                          data: { customer_id: customer.id },
                        });
                      }
                    }}
                    onCustomerChange={(customer) => {
                      // Customer was edited, data will refresh via query
                    }}
                  />
                ) : (
                  <div className="inline-flex items-center gap-2 border border-[#0077c5] rounded px-3 py-2 text-[#0077c5] text-sm font-medium">
                    <User className="h-4 w-4" />
                    {`${estimate.customer?.first_name} ${estimate.customer?.last_name}`}
                  </div>
                )}
                
                {/* Customer address */}
                {estimate.customer && (
                  <>
                    <div className="mt-4 text-sm text-slate-600 space-y-0.5">
                      {estimate.customer.address && <p>{estimate.customer.address}</p>}
                      {(estimate.customer.city || estimate.customer.state || estimate.customer.zip) && (
                        <p>
                          {[estimate.customer.city, estimate.customer.state, estimate.customer.zip]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                      {['draft', 'sent'].includes(estimate.status) && editingEmail ? (
                        <Input
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          onBlur={async () => {
                            if (emailValue !== estimate.customer?.email) {
                              // Update customer email via supabase
                              const { supabase } = await import('@/integrations/supabase/client');
                              await supabase
                                .from('customers')
                                .update({ email: emailValue || null })
                                .eq('id', estimate.customer!.id);
                            }
                            setEditingEmail(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEmailValue(estimate.customer?.email || '');
                              setEditingEmail(false);
                            }
                          }}
                          autoFocus
                          placeholder="Email address"
                          className="qbo-input text-sm max-w-[200px]"
                        />
                      ) : (
                        <p 
                          className={`text-[#0077c5] ${['draft', 'sent'].includes(estimate.status) ? 'cursor-pointer hover:underline' : ''}`}
                          onClick={() => {
                            if (['draft', 'sent'].includes(estimate.status)) {
                              setEmailValue(estimate.customer?.email || '');
                              setEditingEmail(true);
                            }
                          }}
                        >
                          {estimate.customer?.email || (['draft', 'sent'].includes(estimate.status) ? <span className="text-slate-400 italic">+ Add email</span> : null)}
                        </p>
                      )}
                      {estimate.customer.phone && <p>{estimate.customer.phone}</p>}
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-sm text-[#0077c5] hover:underline"
                      onClick={() => {
                        // Open CustomerSidePanel for editing
                        setSelectedCustomerForPanel(estimate.customer as Customer);
                        setCustomerPanelOpen(true);
                      }}
                    >
                      Edit Customer
                    </button>
                  </>
                )}
              </div>
              
              {/* Right side: Dates in two columns */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                {/* Left column */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Estimate no.</label>
                    {['draft', 'sent'].includes(estimate.status) && editingEstimateNumber ? (
                      <Input 
                        value={estimateNumberValue}
                        onChange={(e) => setEstimateNumberValue(e.target.value)}
                        onBlur={() => {
                          const normalized = normalizeEstimateNumberForStorage(estimateNumberValue);

                          if (!/^EST-\d+$/.test(normalized)) {
                            toast({
                              title: 'Invalid estimate number',
                              description: 'Use format like E20031.',
                              variant: 'destructive',
                            });
                            setEstimateNumberValue(displayEstimateNumber);
                            setEditingEstimateNumber(false);
                            return;
                          }

                          if (normalized && normalized !== estimate.estimate_number) {
                            updateEstimate.mutate({
                              estimateId: id!,
                              data: { estimate_number: normalized },
                            });
                          }
                          setEditingEstimateNumber(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEstimateNumberValue(displayEstimateNumber);
                            setEditingEstimateNumber(false);
                          }
                        }}
                        autoFocus
                        className="qbo-input flex-1 max-w-[140px]" 
                      />
                    ) : (
                      <Input 
                        value={displayEstimateNumber}
                        onChange={() => {}} // Read-only display, editing happens via click
                        readOnly={!['draft', 'sent'].includes(estimate.status)}
                        onClick={() => {
                          if (['draft', 'sent'].includes(estimate.status)) {
                            setEstimateNumberValue(displayEstimateNumber);
                            setEditingEstimateNumber(true);
                          }
                        }}
                        className={`qbo-input flex-1 max-w-[140px] ${['draft', 'sent'].includes(estimate.status) ? 'cursor-pointer hover:border-[#0077c5]' : 'bg-slate-50'}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Estimate date</label>
                    <Input 
                      type="date"
                      value={format(new Date(estimate.created_at), 'yyyy-MM-dd')}
                      readOnly
                      className="qbo-input flex-1 max-w-[140px] bg-slate-50" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Expiration date</label>
                    <Input 
                      type="date"
                      value={estimate.valid_until ? format(new Date(estimate.valid_until), 'yyyy-MM-dd') : ''}
                      readOnly
                      className="qbo-input flex-1 max-w-[140px] bg-slate-50" 
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-28">Accepted by</label>
                    <Input 
                      value=""
                      readOnly
                      className="qbo-input flex-1 max-w-[140px] bg-slate-50" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-28">Accepted date</label>
                    <Input 
                      type="date"
                      value={estimate.converted_at ? format(new Date(estimate.converted_at), 'yyyy-MM-dd') : ''}
                      readOnly
                      className="qbo-input flex-1 max-w-[140px] bg-slate-50" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <hr className="border-slate-200 my-6" />

            {/* Watch Section - Always shown for editable estimates, or when watch exists */}
            {(isEditable || estimate.watch) && (
              <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                <label className="qbo-section-title block mb-3">Watch Information</label>
                
                {isEditable ? (
                  <>
                    {/* Existing watch selector for drafts */}
                    {customerWatches && customerWatches.length > 0 && (
                      <div className="mb-3">
                        <Select 
                          value={selectedWatchId} 
                          onValueChange={(value) => {
                            setSelectedWatchId(value);
                            setNewWatch({ brand: '', model: '', serial_number: '', part_number: '' });
                            // Auto-save watch selection
                            updateEstimate.mutate({
                              estimateId: id!,
                              data: { watch_id: value },
                            });
                          }}
                        >
                          <SelectTrigger className="qbo-input max-w-md">
                            <SelectValue placeholder="Select existing watch..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customerWatches.map((watch: any) => (
                              <SelectItem key={watch.id} value={watch.id}>
                                {watch.brand} {watch.model} {watch.serial_number ? `(S/N: ${watch.serial_number})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 mt-2">Or add a new watch below:</p>
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-3">
                      <BrandAutocomplete
                        value={newWatch.brand}
                        onChange={(value) => {
                          setNewWatch({ ...newWatch, brand: value });
                          setSelectedWatchId('');
                        }}
                        placeholder="Brand"
                      />
                      <Input
                        placeholder="Model"
                        value={newWatch.model}
                        onChange={(e) => setNewWatch({ ...newWatch, model: e.target.value })}
                        className="qbo-input"
                      />
                      <Input
                        placeholder="Serial Number"
                        value={newWatch.serial_number}
                        onChange={(e) => setNewWatch({ ...newWatch, serial_number: e.target.value })}
                        className="qbo-input"
                      />
                      <Input
                        placeholder="Part # (Reference)"
                        value={newWatch.part_number}
                        onChange={(e) => setNewWatch({ ...newWatch, part_number: e.target.value })}
                        className="qbo-input"
                      />
                    </div>
                    
                    {newWatch.brand && (
                      <div className="mt-3">
                        <Button 
                          size="sm" 
                          onClick={handleSaveWatch}
                          className="bg-[#0077c5] hover:bg-[#006bb3]"
                        >
                          Save Watch
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Read-only display for non-draft estimates */
                  estimate.watch && (
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Brand</label>
                        <Input
                          value={estimate.watch.brand}
                          readOnly
                          className="qbo-input bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Model</label>
                        <Input
                          value={estimate.watch.model || ''}
                          readOnly
                          className="qbo-input bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Serial Number</label>
                        <Input
                          value={estimate.watch.serial_number || ''}
                          readOnly
                          className="qbo-input bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Reference (Part #)</label>
                        <Input
                          value={estimate.watch.reference_number || ''}
                          readOnly
                          className="qbo-input bg-white"
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Product or Service Table */}
            <div className="mb-6">
              <h3 className="qbo-section-title mb-3">Product or service</h3>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="qbo-table">
                  <thead>
                    <tr>
                      <th className="w-8 px-2 py-2.5"></th>
                      <th className="w-10 px-2 py-2.5 text-center font-medium text-slate-600">#</th>
                      <th className="w-32 px-3 py-2.5 font-medium text-slate-600">Part #</th>
                      <th className="px-3 py-2.5 font-medium text-slate-600">Description</th>
                      <th className="w-20 px-3 py-2.5 text-right font-medium text-slate-600">Qty</th>
                      <th className="w-24 px-3 py-2.5 text-right font-medium text-slate-600">Rate</th>
                      <th className="w-24 px-3 py-2.5 text-right font-medium text-slate-600">Amount</th>
                      <th className="w-12 px-3 py-2.5 text-center font-medium text-slate-600">Tax</th>
                      {isEditable && <th className="w-10 px-2 py-2.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems?.length === 0 ? (
                      <tr>
                        <td colSpan={isEditable ? 9 : 8} className="px-4 py-8 text-center text-slate-500">
                          No line items yet. 
                          {isEditable && (
                            <button onClick={() => setAddLineDialogOpen(true)} className="qbo-link ml-1">
                              Add your first line item
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      lineItems?.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-1.5">
                            <GripVertical className="h-4 w-4 text-slate-300" />
                          </td>
                          <td className="px-2 py-1.5 text-center text-slate-500">{index + 1}</td>
                          <td className="w-32 px-3 py-2">
                            {isEditable ? (
                              <PartsSearchInput
                                value={partSearchByLineId[item.id] ?? item.part?.part_number ?? ''}
                                onChange={(value) =>
                                  setPartSearchByLineId((prev) => ({
                                    ...prev,
                                    [item.id]: value,
                                  }))
                                }
                                onPartSelect={(part) => {
                                  setPartSearchByLineId((prev) => ({
                                    ...prev,
                                    [item.id]: part.part_number,
                                  }));

                                  const nextDescription = item.description?.trim()
                                    ? item.description
                                    : part.description;
                                  const nextUnitPrice = item.unit_price && item.unit_price !== 0
                                    ? item.unit_price
                                    : part.default_sell_price ?? 0;

                                  updateLineItem.mutate({
                                    lineItemId: item.id,
                                    estimateId: id!,
                                    data: {
                                      part_id: part.id,
                                      description: nextDescription,
                                      unit_price: nextUnitPrice,
                                      quantity: item.quantity || 1,
                                    },
                                  });
                                }}
                                className="h-8 text-sm w-[10ch] px-2"
                                placeholder="Part #"
                              />
                            ) : (
                              <span className="text-sm text-slate-700">
                                {item.part?.part_number || '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm text-slate-900">{item.description}</p>
                            {item.notes && (
                              <p className="text-xs text-slate-400 italic">{item.notes}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">
                            {isEditable ? (
                              <CalcInput
                                value={item.quantity}
                                onChange={(val) => {
                                  updateLineItem.mutate({
                                    lineItemId: item.id,
                                    estimateId: id!,
                                    data: { quantity: val },
                                  });
                                }}
                                className="w-16 text-right text-xs"
                              />
                            ) : (
                              item.quantity
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">
                            {isEditable ? (
                              <CalcInput
                                value={item.unit_price}
                                onChange={(val) => {
                                  updateLineItem.mutate({
                                    lineItemId: item.id,
                                    estimateId: id!,
                                    data: { unit_price: val },
                                  });
                                }}
                                className="w-20 text-right text-xs"
                              />
                            ) : (
                              `$${item.unit_price.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                            ${item.extended_price.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Checkbox checked={item.taxable} disabled />
                          </td>
                          {isEditable && (
                            <td className="px-2 py-2">
                              <button
                                onClick={() => handleDeleteLine(item.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Add lines button */}
              {isEditable && (
                <div className="flex items-center gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-sm border-slate-300 text-slate-700"
                    onClick={() => addLineItem.mutate({
                      estimateId: id!,
                      data: {
                        line_type: 'service',
                        description: '',
                        quantity: 1,
                        unit_price: 0,
                        taxable: true,
                      },
                    })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add line
                  </Button>
                  <Dialog open={addLineDialogOpen} onOpenChange={setAddLineDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sm text-slate-500">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        More options
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Line Item</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Line Type Selection */}
                        <div className="grid grid-cols-4 gap-2">
                          {(['service', 'part', 'shipping', 'other'] as LineType[]).map((type) => (
                            <Button
                              key={type}
                              variant={newLine.line_type === type ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setNewLine({ ...newLine, line_type: type })}
                              className={newLine.line_type === type ? 'bg-[#2ca01c] hover:bg-[#248a17]' : 'border-slate-300'}
                            >
                              {type === 'service' && <Wrench className="h-4 w-4 mr-1" />}
                              {type === 'part' && <Package className="h-4 w-4 mr-1" />}
                              {type === 'shipping' && <Truck className="h-4 w-4 mr-1" />}
                              {type === 'other' && <FileText className="h-4 w-4 mr-1" />}
                              {LINE_TYPE_LABELS[type]}
                            </Button>
                          ))}
                        </div>

                        {/* Service Selector */}
                        {newLine.line_type === 'service' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-slate-700">Category</Label>
                              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="qbo-input">
                                  <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm text-slate-700">Service</Label>
                              <Select 
                                value={newLine.service_subcategory_id || ''} 
                                onValueChange={handleSelectService}
                              >
                                <SelectTrigger className="qbo-input">
                                  <SelectValue placeholder="Select service..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredSubcategories?.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id}>
                                      {sub.service_code} - {sub.name} (${sub.default_price || 0})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* Shipping Selector */}
                        {newLine.line_type === 'shipping' && (
                          <div>
                            <Label className="text-sm text-slate-700">Shipping Method</Label>
                            <Select onValueChange={handleSelectShipping}>
                              <SelectTrigger className="qbo-input">
                                <SelectValue placeholder="Select shipping..." />
                              </SelectTrigger>
                              <SelectContent>
                                {shippingRates?.map((rate) => (
                                  <SelectItem key={rate.id} value={rate.id}>
                                    {rate.carrier} - {rate.service_name} (${rate.base_rate})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Common Fields */}
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm text-slate-700">Description *</Label>
                            <Input
                              value={newLine.description}
                              onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                              placeholder="Enter description..."
                              className="qbo-input"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-sm text-slate-700">Qty</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={newLine.quantity}
                                onChange={(e) => setNewLine({ ...newLine, quantity: parseInt(e.target.value) || 1 })}
                                className="qbo-input"
                              />
                            </div>
                            <div>
                              <Label className="text-sm text-slate-700">Rate</Label>
                              <CalcInput
                                value={newLine.unit_price}
                                onChange={(value) => setNewLine({ ...newLine, unit_price: value })}
                                className="qbo-input"
                              />
                            </div>
                            <div>
                              <Label className="text-sm text-slate-700">Amount</Label>
                              <Input
                                readOnly
                                value={`$${(newLine.quantity * newLine.unit_price).toFixed(2)}`}
                                className="qbo-input bg-slate-50"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm text-slate-700">Notes (optional)</Label>
                            <Textarea
                              value={newLine.notes || ''}
                              onChange={(e) => setNewLine({ ...newLine, notes: e.target.value })}
                              placeholder="Internal notes..."
                              rows={2}
                              className="qbo-input"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setAddLineDialogOpen(false)} className="border-slate-300">
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleAddLine} 
                            disabled={addLineItem.isPending}
                            className="qbo-btn-primary"
                          >
                            {addLineItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add Line
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>

            {/* Two Column Layout: Notes & Totals */}
            <div className="grid grid-cols-[1fr_320px] gap-8">
              {/* Left: Notes Section */}
              <div className="space-y-6">
                {/* Note to customer */}
                <div>
                  <label className="qbo-section-title block mb-2">Note to customer</label>
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    onBlur={() => {
                      if (isEditable && notesValue !== (estimate.notes ?? 'Thank you for your business.')) {
                        updateEstimate.mutate({ estimateId: id!, data: { notes: notesValue } });
                      }
                    }}
                    readOnly={!isEditable}
                    className={`qbo-input min-h-[80px] resize-y ${!isEditable ? 'bg-slate-50' : ''}`}
                  />
                </div>
                
                {/* Memo on statement */}
                <div>
                  <label className="qbo-section-title block mb-2">Memo on statement (hidden)</label>
                  <Textarea
                    value={internalNotesValue}
                    onChange={(e) => setInternalNotesValue(e.target.value)}
                    onBlur={() => {
                      if (isEditable && internalNotesValue !== (estimate.internal_notes ?? '')) {
                        updateEstimate.mutate({ estimateId: id!, data: { internal_notes: internalNotesValue } });
                      }
                    }}
                    readOnly={!isEditable}
                    placeholder="This memo will not show up on your estimate, but will appear on the statement."
                    className={`qbo-input min-h-[80px] resize-y text-slate-500 ${!isEditable ? 'bg-slate-50' : ''}`}
                  />
                </div>

                {/* Attachments */}
                <div>
                  <label className="qbo-section-title block mb-2">Attachments</label>
                  <div className="border border-dashed border-slate-300 rounded p-6 text-center">
                    <button className="qbo-link flex items-center justify-center gap-1 mx-auto">
                      <PlusCircle className="h-4 w-4" />
                      Add attachment
                    </button>
                    <p className="text-xs text-slate-500 mt-1">Max file size: 20 MB</p>
                  </div>
                </div>
              </div>

              {/* Right: Totals */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">${(totals?.subtotal || 0).toFixed(2)}</span>
                </div>
                {(totals?.shipping_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Shipping</span>
                    <span className="text-slate-900">${totals?.shipping_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Estimate total</span>
                  <span className="text-slate-900">${(totals?.subtotal || 0).toFixed(2)}</span>
                </div>
                
                {/* Sales tax note */}
                <p className="text-xs text-slate-500 italic pt-2">
                  Sales tax will be calculated at time of invoice and added for physical goods on FL purchases (in person or shipped to FL).
                </p>
                
                <button className="qbo-link flex items-center gap-1 mt-2">
                  <PlusCircle className="h-4 w-4" />
                  Request a deposit
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="qbo-footer flex items-center justify-between">
            <button className="qbo-link" onClick={handlePrintEstimate}>
              Print or download
            </button>
            <div className="flex items-center gap-3">
              {isEditable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="qbo-btn-outline">
                      Save
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/estimates')}>
                      Save and close
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/estimates/new')}>
                      Save and new
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {(estimate.status === 'draft' || estimate.status === 'sent') && (
                <div className="flex items-center">
                  <Button 
                    className="qbo-btn-primary rounded-r-none" 
                    onClick={handleOpenEmailPreview}
                  >
                    {estimate.status === 'sent' ? 'Send again' : 'Review and send'}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="qbo-btn-primary rounded-l-none border-l border-white/20 px-2">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleOpenEmailPreview}>
                        <Mail className="h-4 w-4 mr-2" />
                        Review & Send Email
                      </DropdownMenuItem>
                      {estimate.status === 'draft' && (
                        <DropdownMenuItem onClick={handleSendEstimate}>
                          <Send className="h-4 w-4 mr-2" />
                          Mark as Sent (no email)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setLabelDialogOpen(true)}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print Watch Label
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {(estimate.status === 'draft' || estimate.status === 'sent') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      className="qbo-btn-primary flex items-center"
                      disabled={convertToIntake.isPending || updateEstimate.isPending}
                    >
                      {(convertToIntake.isPending || updateEstimate.isPending) ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      More
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleConvertToIntake}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept & Convert to Job
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => toast({ title: 'Coming Soon', description: 'Create PO from line items feature is under development.' })}>
                      <Package className="h-4 w-4 mr-2" />
                      Create PO from Line Items
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/intake/email?estimate=${estimate.estimate_number}`)}>
                      <Truck className="h-4 w-4 mr-2" />
                      Receive Items
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={async () => {
                        const result = await duplicateEstimate.mutateAsync(id!);
                        navigate(`/estimates/${result.id}`);
                      }}
                      disabled={duplicateEstimate.isPending}
                    >
                      {duplicateEstimate.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Duplicate Estimate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Label Dialog */}
      {estimate.watch && (
        <LabelPrintDialog
          open={labelDialogOpen}
          onOpenChange={setLabelDialogOpen}
          data={{
            type: 'client_property',
            brand: estimate.watch.brand,
            model: estimate.watch.model || '',
            partNumber: estimate.watch.reference_number || '',
            serialNumber: estimate.watch.serial_number || '',
            customerName: `${estimate.customer?.first_name || ''} ${estimate.customer?.last_name || ''}`.trim(),
            customerEmail: estimate.customer?.email || '',
            customerPhone: estimate.customer?.phone || '',
            jobId: estimate.job_id || '',
            dateReceived: new Date().toISOString().split('T')[0],
          }}
        />
      )}

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        estimate={{
          id: estimate.id,
          estimate_number: estimate.estimate_number,
          customer: estimate.customer,
          watch: estimate.watch,
          total_amount: estimate.total_amount,
          valid_until: estimate.valid_until,
        }}
        onSend={handleSendEstimate}
      />

      {/* Customer Side Panel */}
      <CustomerSidePanel
        open={customerPanelOpen}
        onOpenChange={setCustomerPanelOpen}
        customer={selectedCustomerForPanel}
      />
    </div>
  );
}
