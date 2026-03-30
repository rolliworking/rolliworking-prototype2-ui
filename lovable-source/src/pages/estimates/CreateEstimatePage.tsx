import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateEstimate } from '@/hooks/useEstimates';
import { useEstimateTemplates, useEstimateTemplate } from '@/hooks/useEstimateTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Clock, X, Settings, HelpCircle, MessageSquare, Plus, Loader2, ChevronDown, Trash2, PlusCircle, GripVertical } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { CustomerSelector } from '@/components/customers/CustomerSelector';
import { Customer } from '@/types/database';
import { TemplateSelector } from '@/components/estimates/TemplateSelector';
import { PartsSearchInput } from '@/components/estimates/PartsSearchInput';
import { AddPartDialog } from '@/components/estimates/AddPartDialog';
import { EmailPreviewDialog } from '@/components/estimates/EmailPreviewDialog';
import { BrandAutocomplete } from '@/components/estimates/BrandAutocomplete';
import { CalcInput } from '@/components/ui/calc-input';
import { useToast } from '@/hooks/use-toast';
import { ShippingCalculator, ShippingBreakdown } from '@/components/estimates/ShippingCalculator';
import { useModelReferenceLookup, useSaveModelReference } from '@/hooks/useModelReferences';

interface LineItem {
  id: string;
  product: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  taxable: boolean;
}

export default function CreateEstimatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerIdFromUrl = searchParams.get('customer_id');
  const leadIdFromUrl = searchParams.get('lead_id');
  const returnToUrl = searchParams.get('return_to');
  const createEstimate = useCreateEstimate();
  const saveModelReference = useSaveModelReference();
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [estimateNumber, setEstimateNumber] = useState('');
  const [estimateDate, setEstimateDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expirationDate, setExpirationDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [acceptedBy, setAcceptedBy] = useState('');
  const [acceptedDate, setAcceptedDate] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [notes, setNotes] = useState('Thank you for your business.');
  const [internalNotes, setInternalNotes] = useState('');
  
  // Add part dialog state
  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [addPartLineItemId, setAddPartLineItemId] = useState<string | null>(null);
  const [addPartInitialValue, setAddPartInitialValue] = useState('');
  
  // Email preview dialog state
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [savedEstimateData, setSavedEstimateData] = useState<{
    id: string;
    estimate_number: string;
    customer?: { first_name: string; last_name: string; email?: string | null; company_name?: string | null } | null;
    watch?: { brand: string; model?: string | null } | null;
    total_amount?: number | null;
    valid_until?: string | null;
  } | null>(null);
  
  const { toast } = useToast();
  
  // Shipping calculator state
  const [shippingTotal, setShippingTotal] = useState(0);
  const [shippingBreakdown, setShippingBreakdown] = useState<ShippingBreakdown | null>(null);
  
  // Address state
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // Fetch customer from URL param
  const { data: customerFromUrl } = useQuery({
    queryKey: ['customer-from-url', customerIdFromUrl],
    queryFn: async () => {
      if (!customerIdFromUrl) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerIdFromUrl)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!customerIdFromUrl,
  });

  // Auto-select customer when loaded from URL
  useEffect(() => {
    if (customerFromUrl && !selectedCustomer) {
      setSelectedCustomer(customerFromUrl);
    }
  }, [customerFromUrl]);

  // Auto-populate billing address when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      const lines = [];
      // Line 1: Company name
      if (selectedCustomer.company_name) {
        lines.push(selectedCustomer.company_name);
      }
      // Line 2: Full name
      const fullName = [
        selectedCustomer.first_name,
        selectedCustomer.middle_name,
        selectedCustomer.last_name,
        selectedCustomer.suffix
      ].filter(Boolean).join(' ');
      if (fullName) {
        lines.push(fullName);
      }
      // Line 3: Address (street1, street2/apt)
      if (selectedCustomer.address) {
        lines.push(selectedCustomer.address);
      }
      // Line 4: City, State ZIP
      const cityStateZip = [
        selectedCustomer.city,
        selectedCustomer.state,
        selectedCustomer.zip
      ].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1'); // Format as "City, State ZIP"
      if (cityStateZip) {
        lines.push(cityStateZip);
      }
      // Line 5: Country (default to USA if not set)
      lines.push('USA');
      // Line 6: Phone
      if (selectedCustomer.phone) {
        lines.push(selectedCustomer.phone);
      } else if (selectedCustomer.mobile_phone) {
        lines.push(selectedCustomer.mobile_phone);
      }
      // Note: Email is displayed separately, not in billing address
      
      const formattedAddress = lines.join('\n');
      setBillingAddress(formattedAddress);
      if (sameAsBilling) {
        setShippingAddress(formattedAddress);
      }
    } else {
      setBillingAddress('');
      if (sameAsBilling) {
        setShippingAddress('');
      }
    }
  }, [selectedCustomer]);

  // Sync shipping to billing when checkbox is checked
  useEffect(() => {
    if (sameAsBilling) {
      setShippingAddress(billingAddress);
    }
  }, [sameAsBilling, billingAddress]);

  // Fetch intake lead data - either by lead_id directly or selected customer's most recent lead
  const { data: intakeLead } = useQuery({
    queryKey: ['intake-lead-for-estimate', leadIdFromUrl, selectedCustomer?.id],
    queryFn: async () => {
      // Prioritize lead_id if provided
      if (leadIdFromUrl) {
        const { data, error } = await supabase
          .from('intake_leads')
          .select('*')
          .eq('id', leadIdFromUrl)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      // Otherwise fetch most recent lead for selected customer
      if (selectedCustomer?.id) {
        const { data, error } = await supabase
          .from('intake_leads')
          .select('*')
          .eq('customer_id', selectedCustomer.id)
          .order('received_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      return null;
    },
    enabled: !!(leadIdFromUrl || selectedCustomer?.id),
  });

  // Auto-populate customer from intake lead data
  const [leadCustomerLoaded, setLeadCustomerLoaded] = useState(false);
  useEffect(() => {
    if (intakeLead && leadIdFromUrl && !leadCustomerLoaded && !selectedCustomer) {
      // If the lead has a linked customer_id, fetch that customer
      if (intakeLead.customer_id) {
        supabase
          .from('customers')
          .select('*')
          .eq('id', intakeLead.customer_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setSelectedCustomer(data as Customer);
              setLeadCustomerLoaded(true);
            }
          });
      } else if (intakeLead.full_name || intakeLead.email) {
        // Try to find an existing customer by email
        if (intakeLead.email) {
          supabase
            .from('customers')
            .select('*')
            .ilike('email', intakeLead.email)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setSelectedCustomer(data as Customer);
              }
              setLeadCustomerLoaded(true);
            });
        } else {
          setLeadCustomerLoaded(true);
        }
      } else {
        setLeadCustomerLoaded(true);
      }
      
      // Also populate watch info from lead
      if (intakeLead.watch_reference || intakeLead.watch_serial) {
        setNewWatch(prev => ({
          ...prev,
          part_number: intakeLead.watch_reference || prev.part_number,
          serial_number: intakeLead.watch_serial || prev.serial_number,
        }));
      }
    }
  }, [intakeLead, leadIdFromUrl, leadCustomerLoaded, selectedCustomer]);

  // Fetch next estimate number suggestion using the database function
  const { data: nextEstimateNumber, refetch: refetchEstimateNumber } = useQuery({
    queryKey: ['next-estimate-number'],
    queryFn: async () => {
      // Use the same RPC function that useCreateEstimate uses for consistency
      const { data: numberResult, error: numberError } = await supabase
        .rpc('get_next_estimate_number');
      
      if (numberError) {
        console.error('Error fetching next estimate number:', numberError);
        // Fallback: Get the highest estimate number and add 5
        const { data, error } = await supabase
          .from('estimates')
          .select('estimate_number')
          .order('estimate_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data?.estimate_number) {
          const numPart = parseInt(data.estimate_number.replace('EST-', ''), 10);
          if (!isNaN(numPart)) {
            return numPart + 5;
          }
        }
        return 20000;
      }
      
      // Extract numeric part from EST-XXXXX format returned by RPC
      if (numberResult) {
        const numPart = parseInt(String(numberResult).replace('EST-', ''), 10);
        if (!isNaN(numPart)) {
          return numPart;
        }
      }
      
      return 20000;
    },
    // Always refetch when the page mounts to get the latest number
    staleTime: 0,
    gcTime: 0,
  });

  // Auto-set the suggested estimate number when loaded
  useEffect(() => {
    // Always refetch when component mounts to ensure we have the latest number
    refetchEstimateNumber();
  }, []);
  
  useEffect(() => {
    if (nextEstimateNumber && !estimateNumber) {
      setEstimateNumber(String(nextEstimateNumber));
    }
  }, [nextEstimateNumber]);

  // Line items - default 7 blank lines
  const [lineItems, setLineItems] = useState<LineItem[]>(
    Array.from({ length: 7 }, (_, i) => ({
      id: String(i + 1),
      product: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      taxable: false,
    }))
  );

  // Auto-load "W or P" template by default
  const { data: templates } = useEstimateTemplates();
  const defaultTemplate = templates?.find(t => t.name === 'W or P');
  const [defaultTemplateLoaded, setDefaultTemplateLoaded] = useState(false);
  const { data: defaultTemplateDetails } = useEstimateTemplate(
    !defaultTemplateLoaded && defaultTemplate?.id ? defaultTemplate.id : null
  );

  useEffect(() => {
    if (defaultTemplateDetails && !defaultTemplateLoaded) {
      const lines: LineItem[] = defaultTemplateDetails.lines.map((line, index) => ({
        id: String(Date.now() + index),
        product: line.description.split(' - ')[0] || '',
        description: line.description,
        qty: Number(line.quantity),
        rate: Number(line.unit_price),
        amount: Number(line.quantity) * Number(line.unit_price),
        taxable: line.taxable,
      }));
      if (lines.length > 0) {
        setLineItems(lines);
      }
      setDefaultTemplateLoaded(true);
    }
  }, [defaultTemplateDetails, defaultTemplateLoaded]);

  // New watch form
  const [selectedWatchId, setSelectedWatchId] = useState('');
  const [newWatch, setNewWatch] = useState({
    brand: '',
    model: '',
    serial_number: '',
    part_number: '',
  });

  // Auto-decode Part # to Brand/Model using model_references
  const { data: modelReference } = useModelReferenceLookup(newWatch.part_number);
  
  // Auto-fill brand/model when a matching reference is found
  useEffect(() => {
    if (modelReference && newWatch.part_number) {
      // Only auto-fill if the fields are currently empty
      const shouldUpdateBrand = !newWatch.brand && modelReference.brand;
      const shouldUpdateModel = !newWatch.model && modelReference.model;
      
      if (shouldUpdateBrand || shouldUpdateModel) {
        setNewWatch(prev => ({
          ...prev,
          brand: shouldUpdateBrand ? modelReference.brand : prev.brand,
          model: shouldUpdateModel ? (modelReference.model || '') : prev.model,
        }));
        
        // Clear any selected watch since we're using new data
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

  // Fetch watches for selected customer
  const { data: customerWatches } = useQuery({
    queryKey: ['customer-watches', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const { data, error } = await supabase
        .from('watches')
        .select('*')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer?.id,
  });

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated.amount = updated.qty * updated.rate;
      }
      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: String(Date.now()),
      product: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
      taxable: false,
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id));
    }
  };

  const moveLineItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= lineItems.length) return;
    setLineItems(items => {
      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    });
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const clearAllLines = () => {
    setLineItems([{ id: '1', product: '', description: '', qty: 1, rate: 0, amount: 0, taxable: false }]);
  };

  const loadTemplateLines = (templateLines: LineItem[]) => {
    if (templateLines.length > 0) {
      setLineItems(templateLines);
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxableSubtotal = lineItems.filter(item => item.taxable).reduce((sum, item) => sum + item.amount, 0);
  const estimateTotal = subtotal + shippingTotal;

  // Handle shipping total changes
  const handleShippingTotalChange = (total: number, breakdown: ShippingBreakdown) => {
    setShippingTotal(total);
    setShippingBreakdown(breakdown);
  };
  // Core save logic - returns the estimate ID
  const saveEstimate = async (navigateAfter: boolean = true): Promise<string | null> => {
    if (!selectedCustomer) return null;
    
    setIsSaving(true);
    try {
      let customerId = selectedCustomer.id;
      let watchId = selectedWatchId;

      // Create new watch if brand is filled
      if (newWatch.brand) {
        const { data: newW, error } = await supabase
          .from('watches')
          .insert({
            customer_id: customerId,
            brand: newWatch.brand,
            model: newWatch.model,
            serial_number: newWatch.serial_number,
            reference_number: newWatch.part_number,
          })
          .select()
          .single();
        
        if (error) {
          console.error(error);
          return null;
        }
        watchId = newW.id;
        // Clear the new watch form so we don't create duplicates
        setNewWatch({ brand: '', model: '', serial_number: '', part_number: '' });
        setSelectedWatchId(newW.id);
      }

      // Calculate totals from line items
      const validLineItems = lineItems.filter(item => item.description || item.product);
      const calculatedSubtotal = validLineItems.reduce((sum, item) => sum + item.amount, 0);

      let estimateId = savedEstimateId;

      if (!estimateId) {
        // Create new estimate
        const result = await createEstimate.mutateAsync({
          customer_id: customerId,
          watch_id: watchId || undefined,
          valid_until: expirationDate,
          notes: notes || undefined,
          internal_notes: internalNotes || undefined,
          estimate_number: estimateNumber || undefined,
        });
        estimateId = result.id;
        setSavedEstimateId(estimateId);
      } else {
        // Update existing estimate
        await supabase
          .from('estimates')
          .update({
            customer_id: customerId,
            watch_id: watchId || undefined,
            valid_until: expirationDate,
            notes: notes || undefined,
            internal_notes: internalNotes || undefined,
          })
          .eq('id', estimateId);
      }

      // Delete existing line items and re-insert
      await supabase
        .from('estimate_line_items')
        .delete()
        .eq('estimate_id', estimateId);

      // Save line items to the estimate
      if (validLineItems.length > 0) {
        const lineItemsToInsert = validLineItems.map((item, index) => ({
          estimate_id: estimateId,
          line_type: 'service' as const,
          description: item.description || item.product,
          quantity: item.qty,
          unit_price: item.rate,
          extended_price: item.amount,
          taxable: item.taxable,
          sort_order: index + 1,
        }));

        const { error: lineItemsError } = await supabase
          .from('estimate_line_items')
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error('Error saving line items:', lineItemsError);
        }
      }

      // Update estimate totals
      const taxableAmount = validLineItems.filter(i => i.taxable).reduce((sum, i) => sum + i.amount, 0);
      const taxAmount = taxableAmount * 0.0825; // 8.25% tax rate
      
      await supabase
        .from('estimates')
        .update({
          subtotal: calculatedSubtotal,
          tax_amount: taxAmount,
          total_amount: calculatedSubtotal + taxAmount,
        })
        .eq('id', estimateId);

      // Prompt to save model reference if we have a new Part # and Brand
      // This adds it to our library for future decoding and syncs to RolliWorking
      if (newWatch.part_number && newWatch.brand && !modelReference) {
        const partNum = newWatch.part_number;
        const brandName = newWatch.brand;
        const modelName = newWatch.model || undefined;
        
        toast({
          title: 'Save to Reference Library?',
          description: `Add ${brandName} ${partNum} to your decoding library?`,
          action: (
            <Button
              size="sm"
              onClick={() => {
                saveModelReference.mutate({
                  part_number: partNum,
                  brand: brandName,
                  model: modelName,
                });
              }}
            >
              Save
            </Button>
          ),
          duration: 10000, // Give user 10 seconds to decide
        });
      }

      // Link intake lead to this estimate ONLY if we explicitly came from that lead
      if (leadIdFromUrl && intakeLead?.id) {
        await supabase
          .from('intake_leads')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', intakeLead.id);
      }

      if (navigateAfter) {
        navigate(`/estimates/${estimateId}`);
      }

      return estimateId;
    } finally {
      setIsSaving(false);
    }
  };

  // Save and stay on page
  const handleSave = async () => {
    await saveEstimate(false);
  };

  // Save and navigate to detail page
  const handleSubmit = async () => {
    await saveEstimate(true);
  };

  // Save and open email preview dialog
  const handleReviewAndSend = async () => {
    const estimateId = await saveEstimate(false);
    if (estimateId) {
      // Fetch the saved estimate data for the preview dialog
      const { data: estimate } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          total_amount,
          valid_until,
          customer:customers(first_name, last_name, email, company_name),
          watch:watches(brand, model)
        `)
        .eq('id', estimateId)
        .single();
      
      if (estimate) {
        setSavedEstimateData({
          id: estimate.id,
          estimate_number: estimate.estimate_number,
          customer: estimate.customer,
          watch: estimate.watch,
          total_amount: estimate.total_amount,
          valid_until: estimate.valid_until,
        });
        setEmailPreviewOpen(true);
      }
    }
  };

  const canSubmit = !!selectedCustomer;

  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      {/* QBO Header */}
      <div className="qbo-header">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-500" />
            <span className="qbo-header-title">Estimate</span>
          </div>
          <div className="flex items-center gap-4">
            <HelpCircle className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" />
            <X 
              className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" 
              onClick={() => navigate(returnToUrl || '/estimates')}
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
                Amount (hidden): <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
              </p>
            </div>

            {/* Customer & Dates Section */}
            <div className="grid grid-cols-[280px_1fr] gap-8 mb-6">
              {/* Customer Selector - Left */}
              <div className="space-y-3">
                <CustomerSelector
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={setSelectedCustomer}
                  onCustomerChange={(customer) => setSelectedCustomer(customer)}
                />
                {/* Email field below customer */}
                <Input
                  value={selectedCustomer?.email || ''}
                  readOnly
                  placeholder="Customer email"
                  className="qbo-input bg-slate-50"
                />
              </div>
              
              {/* Right side: Dates in two columns */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                {/* Left column */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Estimate no.</label>
                    <Input 
                      value={estimateNumber}
                      onChange={(e) => setEstimateNumber(e.target.value)}
                      placeholder={nextEstimateNumber ? String(nextEstimateNumber) : '1000'}
                      className="qbo-input flex-1 max-w-[140px]" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Estimate date</label>
                    <Input 
                      type="date"
                      value={estimateDate}
                      onChange={(e) => setEstimateDate(e.target.value)}
                      className="qbo-input flex-1 max-w-[140px]" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Expiration date</label>
                    <Input 
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className="qbo-input flex-1 max-w-[140px]" 
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-28">Accepted by</label>
                    <Input 
                      value={acceptedBy}
                      onChange={(e) => setAcceptedBy(e.target.value)}
                      className="qbo-input flex-1 max-w-[140px]" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-28">Accepted date</label>
                    <Input 
                      type="date"
                      value={acceptedDate}
                      onChange={(e) => setAcceptedDate(e.target.value)}
                      className="qbo-input flex-1 max-w-[140px]" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Billing & Shipping Address Section */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Billing Address */}
              <div>
                <label className="qbo-label mb-1.5 block">Billing address</label>
                <Textarea
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Enter billing address..."
                  className="qbo-input min-h-[100px] resize-none"
                />
              </div>
              
              {/* Shipping Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="qbo-label">Shipping address</label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="same-as-billing"
                      checked={sameAsBilling}
                      onCheckedChange={(checked) => setSameAsBilling(checked === true)}
                    />
                    <label 
                      htmlFor="same-as-billing" 
                      className="text-xs text-slate-500 cursor-pointer"
                    >
                      Same as billing
                    </label>
                  </div>
                </div>
                <Textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter shipping address..."
                  className="qbo-input min-h-[100px] resize-none"
                  disabled={sameAsBilling}
                />
              </div>
            </div>

            {/* Divider */}
            <hr className="border-slate-200 my-6" />

            {/* Client Notes Section */}
            <div className="mb-6 p-4 bg-amber-50 rounded border border-amber-200">
              <label className="qbo-section-title block mb-3">Client Notes</label>
              
              {intakeLead && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-medium text-amber-700 uppercase tracking-wide">Service Requested</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {intakeLead.item_type || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-700 uppercase tracking-wide">Customer Comments</label>
                    <p className="text-sm text-slate-700 mt-1">
                      {intakeLead.notes || 'No comments'}
                    </p>
                  </div>
                </div>
              )}
              
              <Textarea 
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Add additional notes about the client's request..."
                className="qbo-input min-h-[80px]"
              />
            </div>

            {/* Tags and Store */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-slate-600">Tags (hidden):</label>
                  <button className="qbo-link">Manage tags</button>
                </div>
                <Input 
                  placeholder="Start typing to add a tag"
                  className="qbo-input"
                />
              </div>
              <div>
                <label className="qbo-label">Store (hidden):</label>
                <Select>
                  <SelectTrigger className="qbo-input">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Store</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Watch Section */}
            {selectedCustomer && (
              <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                <label className="qbo-section-title block mb-3">Item (Watch)</label>
                
                {customerWatches && customerWatches.length > 0 && (
                  <div className="mb-3">
                    <Select 
                      value={selectedWatchId} 
                      onValueChange={(value) => {
                        setSelectedWatchId(value);
                        setNewWatch({ brand: '', model: '', serial_number: '', part_number: '' });
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
                    placeholder="Part #"
                    value={newWatch.part_number}
                    onChange={(e) => setNewWatch({ ...newWatch, part_number: e.target.value })}
                    className="qbo-input"
                  />
                </div>
                
                {/* Save Reference Button - show when user has entered data that could be saved */}
                {newWatch.part_number && newWatch.brand && !modelReference && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => saveModelReference.mutate({
                        part_number: newWatch.part_number.trim(),
                        brand: newWatch.brand.trim(),
                        model: newWatch.model?.trim() || null,
                      })}
                      disabled={saveModelReference.isPending}
                      className="text-xs"
                    >
                      {saveModelReference.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Save Reference to RolliWorking
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-slate-500">
                      Reference not found - save for future auto-decode
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Product or Service Table - QBO Style */}
            <div className="mb-6">
              <h3 className="qbo-section-title mb-3">Product or service</h3>
              <div className="border border-slate-200 rounded overflow-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-8 px-1 py-2"></th>
                      <th className="w-8 px-1 py-2 text-left text-xs font-medium text-slate-600">#</th>
                      <th className="w-[220px] px-2 py-2 text-left text-xs font-medium text-slate-600">Product/Service</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-slate-600">Description</th>
                      <th className="w-16 px-2 py-2 text-right text-xs font-medium text-slate-600">Qty</th>
                      <th className="w-24 px-2 py-2 text-right text-xs font-medium text-slate-600">Rate</th>
                      <th className="w-28 px-2 py-2 text-right text-xs font-medium text-slate-600">Amount</th>
                      <th className="w-10 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr 
                        key={item.id} 
                        className={`border-b border-slate-100 last:border-0 align-top ${draggedIndex === index ? 'opacity-50 bg-slate-100' : ''}`}
                        draggable
                        onDragStart={() => setDraggedIndex(index)}
                        onDragEnd={() => setDraggedIndex(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedIndex !== null && draggedIndex !== index) {
                            moveLineItem(draggedIndex, index);
                          }
                          setDraggedIndex(null);
                        }}
                      >
                        <td className="px-1 py-2 cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-slate-400" />
                        </td>
                        <td className="px-1 py-2 text-xs text-slate-500">{index + 1}</td>
                        <td className="px-1 py-1">
                          <PartsSearchInput
                            value={item.product}
                            onChange={(val) => updateLineItem(item.id, 'product', val)}
                            onPartSelect={(part) => {
                              updateLineItem(item.id, 'product', part.part_number);
                              updateLineItem(item.id, 'description', part.description);
                              if (part.default_sell_price != null) {
                                updateLineItem(item.id, 'rate', part.default_sell_price);
                              }
                            }}
                            onAddPart={() => {
                              setAddPartLineItemId(item.id);
                              setAddPartInitialValue(item.product);
                              setAddPartDialogOpen(true);
                            }}
                            className="border border-slate-200 focus:ring-1 focus:ring-[#0077c5] text-xs h-8 rounded"
                            placeholder="Search..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-[#0077c5] text-xs min-h-[60px] resize-y rounded"
                            placeholder="Enter description..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <CalcInput
                            value={item.qty}
                            onChange={(value) => updateLineItem(item.id, 'qty', value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-[#0077c5] text-xs h-8 text-right rounded w-full"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <CalcInput
                            value={item.rate}
                            onChange={(value) => updateLineItem(item.id, 'rate', value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-[#0077c5] text-xs h-8 text-right rounded w-full"
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium text-slate-900">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="px-2 py-2">
                          <button 
                            onClick={() => removeLineItem(item.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Add line button */}
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={addLineItem}
                  className="text-sm border-slate-300 text-slate-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
                <TemplateSelector onLoadTemplate={loadTemplateLines} currentLineItems={lineItems} />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllLines}
                  className="text-xs text-slate-500"
                >
                  Clear all
                </Button>
              </div>
            </div>

            {/* Three Column Layout: Notes, Totals & Shipping */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_300px] gap-6">
              {/* Left: Notes Section */}
              <div className="space-y-6">
                {/* Note to customer */}
                <div>
                  <label className="qbo-section-title block mb-2">Note to customer</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder=""
                    className="qbo-input min-h-[80px] resize-y"
                  />
                </div>
                
                {/* Memo on statement */}
                <div>
                  <label className="qbo-section-title block mb-2">Memo on statement (hidden)</label>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="This memo will not show up on your estimate, but will appear on the statement."
                    className="qbo-input min-h-[80px] resize-y text-slate-500"
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

              {/* Middle: Totals */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">${subtotal.toFixed(2)}</span>
                </div>
                {shippingTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Shipping</span>
                    <span className="text-slate-900">${shippingTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Estimate total</span>
                  <span className="text-slate-900">${estimateTotal.toFixed(2)}</span>
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

              {/* Right: Shipping Calculator */}
              <div>
                <ShippingCalculator 
                  onTotalChange={handleShippingTotalChange}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="qbo-footer flex items-center justify-between">
            <button className="qbo-link">
              Print or download
            </button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/estimates')}>
                Cancel
              </Button>
              <Button 
                variant="outline"
                onClick={handleSave}
                disabled={!canSubmit || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="qbo-btn-outline"
                  >
                    Save
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSubmit} disabled={!canSubmit}>
                    Save and close
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSubmit} disabled={!canSubmit}>
                    Save and new
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="qbo-btn-primary flex items-center"
                    disabled={!canSubmit || isSaving}
                    onClick={handleReviewAndSend}
                  >
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save and review
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleReviewAndSend} disabled={!canSubmit}>
                    Save and review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSubmit} disabled={!canSubmit}>
                    Save only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Add Part Dialog */}
      <AddPartDialog
        open={addPartDialogOpen}
        onOpenChange={setAddPartDialogOpen}
        initialPartNumber={addPartInitialValue}
        onPartCreated={(part) => {
          if (addPartLineItemId) {
            updateLineItem(addPartLineItemId, 'product', part.part_number);
            updateLineItem(addPartLineItemId, 'description', part.description);
            if (part.default_sell_price != null) {
              updateLineItem(addPartLineItemId, 'rate', part.default_sell_price);
            }
          }
        }}
      />

      {/* Email Preview Dialog */}
      <EmailPreviewDialog
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        estimate={savedEstimateData}
        onSend={() => {
          setEmailPreviewOpen(false);
          toast({
            title: "Email sent",
            description: "The estimate has been sent successfully.",
          });
          if (savedEstimateData?.id) {
            navigate(`/estimates/${savedEstimateData.id}`);
          }
        }}
      />
    </div>
  );
}
