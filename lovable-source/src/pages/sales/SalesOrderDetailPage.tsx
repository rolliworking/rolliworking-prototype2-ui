// Sales Order Detail Page - QBO-style with quick add bar
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSalesOrder, useSalesOrderLines, useUpdateSalesOrder, useCreateSalesOrder, useRecalculateSalesOrderTotals } from '@/hooks/useSalesOrders';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomerSelector } from '@/components/customers/CustomerSelector';
import { PartsSearchInput } from '@/components/estimates/PartsSearchInput';
import { CalcInput } from '@/components/ui/calc-input';
import { ArrowLeft, CalendarIcon, Loader2, Trash2, MapPin, Package, Save, Plus, Truck, GripVertical, X, Settings, HelpCircle, MessageSquare, ChevronDown, Barcode, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Customer } from '@/types/database';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'partial_fulfilled', label: 'Partial Fulfilled' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-blue-100 text-blue-800',
  partial_fulfilled: 'bg-amber-100 text-amber-800',
  fulfilled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface LineItem {
  id: string;
  part_id: string | null;
  product: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  // Only fetch if not new
  const { data: order, isLoading: orderLoading } = useSalesOrder(isNew ? undefined : id);
  const { data: dbLines = [], isLoading: linesLoading } = useSalesOrderLines(isNew ? undefined : id);
  
  const createOrder = useCreateSalesOrder();
  const updateOrder = useUpdateSalesOrder();
  const recalcTotals = useRecalculateSalesOrderTotals();
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [shipDate, setShipDate] = useState<Date | undefined>();
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [shippingAmount, setShippingAmount] = useState(0);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [soNumber, setSoNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Line items - local state like CreateEstimatePage
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', part_id: null, product: '', description: '', qty: 1, rate: 0, amount: 0 },
  ]);
  
  // Quick entry bar state
  const [quickQty, setQuickQty] = useState(1);
  const [quickBarcode, setQuickBarcode] = useState('');
  const [isQuickSearching, setIsQuickSearching] = useState(false);
  const quickBarcodeRef = useRef<HTMLInputElement>(null);
  const quickQtyRef = useRef<HTMLInputElement>(null);
  
  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Initialize from order data
  useEffect(() => {
    if (order) {
      setSelectedCustomer(order.customers as unknown as Customer || null);
      setOrderDate(new Date(order.order_date));
      setShipDate(order.ship_date ? new Date(order.ship_date) : undefined);
      setStatus(order.status);
      setNotes(order.notes || '');
      setShippingAmount(order.shipping_amount || 0);
      setCurrentOrderId(order.id);
      setSoNumber(order.so_number || '');
    }
  }, [order]);
  
  // Initialize line items from database
  useEffect(() => {
    if (dbLines.length > 0) {
      const items: LineItem[] = dbLines.map((line, index) => ({
        id: line.id,
        part_id: line.part_id,
        product: line.parts?.part_number || '',
        description: line.parts?.description || '',
        qty: line.qty_ordered,
        rate: line.unit_price,
        amount: line.extended_price,
      }));
      setLineItems(items);
    }
  }, [dbLines]);

  // Handle customer selection for new orders
  const handleCustomerSelect = async (customer: Customer | null) => {
    setSelectedCustomer(customer);
    
    // For new orders, create the order immediately when customer is selected
    if (isNew && customer && !currentOrderId) {
      try {
        const newOrder = await createOrder.mutateAsync({
          customer_id: customer.id,
          order_date: format(orderDate, 'yyyy-MM-dd'),
        });
        setCurrentOrderId(newOrder.id);
        setSoNumber(newOrder.so_number);
        // Navigate to the new order's URL without full refresh
        navigate(`/sales/orders/${newOrder.id}`, { replace: true });
      } catch (error) {
        // Error handled in hook
      }
    }
  };
  
  // Line item management functions (same pattern as CreateEstimatePage)
  const updateLineItem = (itemId: string, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated.amount = updated.qty * updated.rate;
      }
      return updated;
    }));
  };
  
  const addLineItem = () => {
    const blankLine: LineItem = {
      id: String(Date.now()),
      part_id: null,
      product: '',
      description: '',
      qty: 1,
      rate: 0,
      amount: 0,
    };

    setLineItems((items) => [...items, blankLine]);
  };
  
  const removeLineItem = (itemId: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== itemId));
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
  
  const clearAllLines = () => {
    setLineItems([{ id: '1', part_id: null, product: '', description: '', qty: 1, rate: 0, amount: 0 }]);
  };

  // Quick barcode entry handler - supports exact match, partial match, vendor parts, and aliases
  const handleQuickBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBarcode.trim()) return;
    
    setIsQuickSearching(true);
    try {
      // Search by part_number, upc, or vendor_part_number
      const searchTerm = quickBarcode.trim();
      
      // First try exact match on part_number or upc
      const { data: exactMatch } = await supabase
        .from('parts')
        .select('id, part_number, description, default_sell_price')
        .or(`part_number.eq.${searchTerm},upc.eq.${searchTerm}`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      let foundPart = exactMatch;
      
      // If no exact match, try partial match on part_number (starts with)
      if (!foundPart) {
        const { data: partialMatch } = await supabase
          .from('parts')
          .select('id, part_number, description, default_sell_price')
          .ilike('part_number', `${searchTerm}%`)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (partialMatch) {
          foundPart = partialMatch;
        }
      }
      
      // If no exact match, try vendor_parts
      if (!foundPart) {
        const { data: vendorMatch } = await supabase
          .from('vendor_parts')
          .select('part_id, parts!inner(id, part_number, description, default_sell_price, is_active)')
          .eq('vendor_part_number', searchTerm)
          .eq('parts.is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (vendorMatch?.parts) {
          foundPart = vendorMatch.parts as any;
        }
      }
      
      // If no match, try part_aliases
      if (!foundPart) {
        const { data: aliasMatch } = await supabase
          .from('part_aliases')
          .select('part_id, parts!inner(id, part_number, description, default_sell_price, is_active)')
          .eq('alias_sku', searchTerm)
          .eq('parts.is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (aliasMatch?.parts) {
          foundPart = aliasMatch.parts as any;
        }
      }
      
      if (foundPart) {
        // Add to line items
        const newItem: LineItem = {
          id: String(Date.now()),
          part_id: foundPart.id,
          product: foundPart.part_number,
          description: foundPart.description || '',
          qty: quickQty,
          rate: foundPart.default_sell_price || 0,
          amount: quickQty * (foundPart.default_sell_price || 0),
        };
        
        // Find last empty row or add new (use functional update to avoid overwriting recent edits)
        const blankLine: LineItem = {
          id: String(Date.now() + 1),
          part_id: null,
          product: '',
          description: '',
          qty: 1,
          rate: 0,
          amount: 0,
        };

        setLineItems((items) => {
          const lastItem = items[items.length - 1];
          if (lastItem && !lastItem.part_id && !lastItem.product) {
            // Replace last empty row
            return [...items.slice(0, -1), newItem, blankLine];
          }
          return [...items, newItem, blankLine];
        });
        
        toast.success(`Added: ${foundPart.part_number}`);
        setQuickBarcode('');
        setQuickQty(1);
        quickQtyRef.current?.focus();
        quickQtyRef.current?.select();
      } else {
        toast.error(`Part not found: ${searchTerm}`);
        // Keep focus on input for retry
        quickBarcodeRef.current?.select();
      }
    } catch (error) {
      console.error('Quick search error:', error);
      toast.error('Error searching for part');
    } finally {
      setIsQuickSearching(false);
    }
  };
  
  // Save order and line items
  const handleSave = async (navigateAfter: boolean = false) => {
    const orderId = currentOrderId || order?.id;
    if (!orderId || !selectedCustomer) {
      toast.error('Please select a customer first');
      return;
    }
    
    setIsSaving(true);
    try {
      // Update order header (including editable SO number)
      await updateOrder.mutateAsync({
        id: orderId,
        so_number: soNumber || undefined,
        customer_id: selectedCustomer.id,
        order_date: format(orderDate, 'yyyy-MM-dd'),
        ship_date: shipDate ? format(shipDate, 'yyyy-MM-dd') : null,
        status: status as any,
        notes: notes || null,
        shipping_amount: shippingAmount,
      });
      
      // Delete existing lines and re-insert (same pattern as CreateEstimatePage)
      await supabase
        .from('so_lines')
        .delete()
        .eq('so_id', orderId);
      
      // Save valid line items
      const validLines = lineItems.filter(item => item.part_id || item.description);
      if (validLines.length > 0) {
        const linesToInsert = validLines.map((item, index) => ({
          so_id: orderId,
          part_id: item.part_id,
          qty_ordered: item.qty,
          unit_price: item.rate,
          extended_price: item.amount,
          qty_allocated: 0,
          qty_shipped: 0,
          sort_order: index + 1,
        }));
        
        const { error: linesError } = await supabase
          .from('so_lines')
          .insert(linesToInsert);
        
        if (linesError) {
          console.error('Error saving lines:', linesError);
          toast.error('Failed to save line items');
          return;
        }
      }
      
      await recalcTotals.mutateAsync(orderId);
      toast.success('Order saved');
      
      if (navigateAfter) {
        navigate('/sales/orders');
      }
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Save and fulfill - sets status to fulfilled, saves, then navigates to fulfill page
  const handleSaveAndFulfill = async () => {
    const orderId = currentOrderId || order?.id;
    if (!orderId || !selectedCustomer) {
      toast.error('Please select a customer first');
      return;
    }
    
    setIsSaving(true);
    try {
      // Update order header with fulfilled status (include editable SO number)
      await updateOrder.mutateAsync({
        id: orderId,
        so_number: soNumber || undefined,
        customer_id: selectedCustomer.id,
        order_date: format(orderDate, 'yyyy-MM-dd'),
        ship_date: shipDate ? format(shipDate, 'yyyy-MM-dd') : null,
        status: 'fulfilled' as const,
        notes: notes || null,
        shipping_amount: shippingAmount,
      });
      
      // Delete existing lines and re-insert
      await supabase
        .from('so_lines')
        .delete()
        .eq('so_id', orderId);
      
      const validLines = lineItems.filter(item => item.part_id || item.description);
      if (validLines.length > 0) {
        const linesToInsert = validLines.map((item, index) => ({
          so_id: orderId,
          part_id: item.part_id,
          qty_ordered: item.qty,
          unit_price: item.rate,
          extended_price: item.amount,
          qty_allocated: 0,
          qty_shipped: 0,
          sort_order: index + 1,
        }));
        
        await supabase.from('so_lines').insert(linesToInsert);
      }
      
      await recalcTotals.mutateAsync(orderId);
      
      // Navigate to fulfill page
      navigate(`/sales/orders/${orderId}/fulfill`);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Computed values
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal + shippingAmount;
  const canSave = !!selectedCustomer;
  
  // Show loading only for existing orders
  if (!isNew && orderLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Show not found only for existing orders that don't exist
  if (!isNew && !order && !orderLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }
  
  const displayStatus = status || 'draft';
  
  return (
    <div className="min-h-screen bg-[#f4f5f8]">
      {/* QBO Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/sales/orders')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium text-slate-900">Sales Order</span>
            <Badge className={STATUS_COLORS[displayStatus]}>
              {displayStatus.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <HelpCircle className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" />
            <X 
              className="h-5 w-5 text-slate-400 cursor-pointer hover:text-slate-600" 
              onClick={() => navigate('/sales/orders')}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">SALES ORDER</h2>
              <p className="text-sm text-slate-600">
                Total: <span className="font-semibold text-slate-900">${total.toFixed(2)}</span>
              </p>
            </div>

            {/* Customer & Dates Section */}
            <div className="grid grid-cols-[280px_1fr] gap-8 mb-6">
              {/* Customer Selector */}
              <div className="space-y-3">
                <CustomerSelector
                  selectedCustomer={selectedCustomer}
                  onCustomerSelect={handleCustomerSelect}
                />
                {selectedCustomer?.email && (
                  <Input
                    value={selectedCustomer.email}
                    readOnly
                    className="bg-slate-50 text-sm"
                  />
                )}
              </div>
              
              {/* Right side: Dates & Status */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">SO Number</label>
                    <Input 
                      value={soNumber}
                      onChange={(e) => setSoNumber(e.target.value)}
                      placeholder="SO-00001"
                      className="flex-1 max-w-[140px]" 
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Order Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(orderDate, 'MM/dd/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={orderDate}
                          onSelect={(d) => d && setOrderDate(d)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-32">Ship Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {shipDate ? format(shipDate, 'MM/dd/yyyy') : 'Select...'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={shipDate}
                          onSelect={(d) => setShipDate(d)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <label className="text-sm text-slate-600 w-28">Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Cards */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-sky-50 border border-sky-200 rounded-lg overflow-hidden">
                <div className="py-2 px-4 bg-sky-500">
                  <h3 className="text-white text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Bill To
                  </h3>
                </div>
                <div className="p-4 text-sm">
                  {selectedCustomer ? (
                    <div className="space-y-1">
                      <p className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                      {selectedCustomer.address && <p>{selectedCustomer.address}</p>}
                      {(selectedCustomer.city || selectedCustomer.state || selectedCustomer.zip) && (
                        <p>{selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zip}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No customer selected</p>
                  )}
                </div>
              </div>
              
              <div className="bg-sky-50 border border-sky-200 rounded-lg overflow-hidden">
                <div className="py-2 px-4 bg-sky-500">
                  <h3 className="text-white text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Ship To
                  </h3>
                </div>
                <div className="p-4 text-sm">
                  {selectedCustomer ? (
                    <div className="space-y-1">
                      <p className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                      <p className="text-muted-foreground">SAME AS BILLING</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No customer selected</p>
                  )}
                </div>
              </div>
            </div>

            <hr className="border-slate-200 my-6" />

            {/* Quick Entry Bar */}
            <form onSubmit={handleQuickBarcodeSubmit} className="mb-4">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-sky-50 to-slate-50 border border-sky-200 rounded-lg">
                <div className="flex items-center gap-2 text-sky-600">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Quick Add</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 font-medium">Qty:</label>
                  <Input
                    ref={quickQtyRef}
                    type="number"
                    value={quickQty}
                    onChange={(e) => setQuickQty(parseInt(e.target.value) || 1)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        quickBarcodeRef.current?.focus();
                      }
                    }}
                    className="w-16 h-8 text-center text-sm border-slate-300"
                    min={1}
                  />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-slate-400" />
                  <Input
                    ref={quickBarcodeRef}
                    type="text"
                    value={quickBarcode}
                    onChange={(e) => setQuickBarcode(e.target.value)}
                    placeholder="Scan barcode or enter part#..."
                    className="flex-1 h-8 text-sm border-slate-300"
                    disabled={isQuickSearching}
                  />
                </div>
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={isQuickSearching || !quickBarcode.trim()}
                  className="bg-sky-600 hover:bg-sky-700 h-8"
                >
                  {isQuickSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Line Items Table - QBO Style */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Line Items</h3>
              <div className="border border-slate-200 rounded overflow-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="w-8 px-1 py-2"></th>
                      <th className="w-8 px-1 py-2 text-left text-xs font-medium text-slate-600">#</th>
                      <th className="w-[200px] px-2 py-2 text-left text-xs font-medium text-slate-600">Part/Service</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-slate-600">Description</th>
                      <th className="w-20 px-2 py-2 text-right text-xs font-medium text-slate-600">Qty</th>
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
                              updateLineItem(item.id, 'part_id', part.id);
                              updateLineItem(item.id, 'product', part.part_number);
                              updateLineItem(item.id, 'description', part.description);
                              if (part.default_sell_price != null) {
                                updateLineItem(item.id, 'rate', part.default_sell_price);
                              }
                              // Auto-add new line if this is the last row
                              if (index === lineItems.length - 1) {
                                setTimeout(() => addLineItem(), 50);
                              }
                            }}
                            className="border border-slate-200 focus:ring-1 focus:ring-sky-500 text-xs h-8 rounded"
                            placeholder="Search parts..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Textarea
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-sky-500 text-xs min-h-[60px] resize-y rounded"
                            placeholder="Description..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <CalcInput
                            value={item.qty}
                            onChange={(value) => updateLineItem(item.id, 'qty', value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-sky-500 text-xs h-8 text-right rounded w-full"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <CalcInput
                            value={item.rate}
                            onChange={(value) => updateLineItem(item.id, 'rate', value)}
                            className="border border-slate-200 focus:ring-1 focus:ring-sky-500 text-xs h-8 text-right rounded w-full"
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
              
              {/* Add line buttons */}
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

            {/* Notes & Totals */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              {/* Notes */}
              <div>
                <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide block mb-2">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="min-h-[100px] resize-y"
                />
              </div>

              {/* Totals */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-600">Shipping</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={shippingAmount}
                    onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-right text-sm"
                  />
                </div>
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-slate-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-lg">
            <div className="flex items-center gap-3">
              {/* Empty left side or add secondary actions here */}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/sales/orders')}>
                Cancel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    className="bg-[#2ca01c] hover:bg-[#248a17] text-white"
                    disabled={!canSave || isSaving}
                  >
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Truck className="h-4 w-4 mr-2" />
                    Fulfill
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSaveAndFulfill}>
                    <Truck className="h-4 w-4 mr-2" />
                    Fulfill (Save & Continue)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSave(false)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSave(true)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save and Close
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
