import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Save,
  Send,
  Printer,
  Truck,
  Plus,
  Trash2,
  Building2,
  MapPin,
  Search,
  Loader2,
  ExternalLink,
  Package,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface POLineItem {
  id: string;
  lineNumber: number;
  partId: string | null;
  partNumber: string;
  description: string;
  qty: number;
  unitCost: number;
  extendedCost: number;
}

interface PurchaseOrderFormProps {
  tabId: string;
  poId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  issued: 'bg-blue-100 text-blue-800 border-blue-300',
  partial_received: 'bg-amber-100 text-amber-800 border-amber-300',
  received: 'bg-green-100 text-green-800 border-green-300',
};

export function PurchaseOrderForm({ tabId, poId }: PurchaseOrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateTab, markDirty, openTab } = useWorkspace();
  
  // Form state
  const [vendorId, setVendorId] = useState<string>('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expectedDate, setExpectedDate] = useState('');
  const [carrier, setCarrier] = useState('');
  const [fob, setFob] = useState('');
  const [shipToId, setShipToId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [partPopoverOpen, setPartPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, address, city, state, zip, contact_name, email, phone')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations for ship-to
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-for-po'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, address, city, state, zip')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Search parts
  const { data: searchedParts = [] } = useQuery({
    queryKey: ['parts-search', partSearch],
    queryFn: async () => {
      if (!partSearch.trim()) return [];
      const { data, error } = await supabase
        .from('parts')
        .select(`
          id, 
          part_number, 
          description, 
          last_cost,
          average_cost,
          reorder_point,
          inventory_stock (qty_on_hand)
        `)
        .eq('is_active', true)
        .or(`part_number.ilike.%${partSearch}%,description.ilike.%${partSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: partSearch.length > 0,
  });

  // Fetch existing PO data
  const { data: existingPO, isLoading: isLoadingPO } = useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: async () => {
      if (!poId) return null;
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (id, name, address, city, state, zip, contact_name, email, phone),
          po_lines (
            id,
            part_id,
            qty_ordered,
            unit_cost,
            extended_cost,
            sort_order,
            notes,
            parts (id, part_number, description)
          )
        `)
        .eq('id', poId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!poId,
  });

  // Generate next PO number
  const { data: nextPoNumber } = useQuery({
    queryKey: ['next-po-number'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_next_po_number');
      if (error) throw error;
      return data;
    },
    enabled: !poId,
  });

  // Load existing PO data
  useEffect(() => {
    if (existingPO) {
      setVendorId(existingPO.vendor_id);
      setPoNumber(existingPO.po_number);
      setStatus(existingPO.status);
      setOrderDate(existingPO.order_date);
      setExpectedDate(existingPO.expected_date || '');
      setNotes(existingPO.notes || '');
      
      if (existingPO.po_lines) {
        setLineItems(existingPO.po_lines.map((line: any, index: number) => ({
          id: line.id,
          lineNumber: index + 1,
          partId: line.part_id,
          partNumber: line.parts?.part_number || '',
          description: line.parts?.description || '',
          qty: line.qty_ordered,
          unitCost: line.unit_cost,
          extendedCost: line.extended_cost,
        })));
      }
      
      updateTab(tabId, { title: `PO: ${existingPO.po_number}` });
    }
  }, [existingPO, tabId, updateTab]);

  // Set initial PO number for new POs
  useEffect(() => {
    if (!poId && nextPoNumber) {
      setPoNumber(nextPoNumber);
    }
  }, [poId, nextPoNumber]);

  // Get selected vendor details
  const selectedVendor = vendors.find(v => v.id === vendorId);
  const selectedShipTo = locations.find(l => l.id === shipToId);
  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.extendedCost, 0);

  // Mark dirty on changes
  const handleChange = useCallback(() => {
    markDirty(tabId, true);
  }, [tabId, markDirty]);

  // Add new line item
  const addLineItem = () => {
    const newLine: POLineItem = {
      id: `new-${Date.now()}`,
      lineNumber: lineItems.length + 1,
      partId: null,
      partNumber: '',
      description: '',
      qty: 1,
      unitCost: 0,
      extendedCost: 0,
    };
    setLineItems([...lineItems, newLine]);
    handleChange();
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      lineNumber: i + 1,
    }));
    setLineItems(newItems);
    handleChange();
  };

  // Update line item
  const updateLineItem = (index: number, updates: Partial<POLineItem>) => {
    setLineItems(items => items.map((item, i) => {
      if (i === index) {
        const updated = { ...item, ...updates };
        updated.extendedCost = updated.qty * updated.unitCost;
        return updated;
      }
      return item;
    }));
    handleChange();
  };

  // Select part for line item
  const selectPart = (part: any) => {
    if (activeLineIndex !== null) {
      const onHandQty = part.inventory_stock?.reduce((sum: number, s: any) => sum + s.qty_on_hand, 0) || 0;
      updateLineItem(activeLineIndex, {
        partId: part.id,
        partNumber: part.part_number,
        description: part.description,
        unitCost: part.last_cost || part.average_cost || 0,
      });
      setPartPopoverOpen(false);
      setPartSearch('');
      setActiveLineIndex(null);
    }
  };

  // Save PO mutation
  const savePOMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      
      if (!vendorId) {
        throw new Error('Please select a vendor');
      }

      const poData = {
        vendor_id: vendorId,
        po_number: poNumber,
        status: status as any,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes || null,
        subtotal,
        total_amount: subtotal,
      };

      let savedPoId = poId;

      if (poId) {
        // Update existing PO
        const { error } = await supabase
          .from('purchase_orders')
          .update(poData)
          .eq('id', poId);
        if (error) throw error;

        // Delete existing lines and re-insert
        await supabase.from('po_lines').delete().eq('po_id', poId);
      } else {
        // Create new PO
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert(poData)
          .select()
          .single();
        if (error) throw error;
        savedPoId = data.id;
      }

      // Insert line items
      if (lineItems.length > 0 && savedPoId) {
        const linesToInsert = lineItems
          .filter(line => line.partId)
          .map((line, index) => ({
            po_id: savedPoId,
            part_id: line.partId,
            qty_ordered: line.qty,
            unit_cost: line.unitCost,
            extended_cost: line.extendedCost,
            sort_order: index + 1,
          }));

        if (linesToInsert.length > 0) {
          const { error } = await supabase.from('po_lines').insert(linesToInsert);
          if (error) throw error;
        }
      }

      return savedPoId;
    },
    onSuccess: (savedPoId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', savedPoId] });
      markDirty(tabId, false);
      
      if (!poId && savedPoId) {
        updateTab(tabId, { 
          type: 'po',
          recordId: savedPoId,
          title: `PO: ${poNumber}`,
        });
      }
      
      toast({ title: 'Purchase order saved successfully' });
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error saving purchase order', 
        description: error.message, 
        variant: 'destructive' 
      });
      setIsSaving(false);
    },
  });

  // Issue PO mutation
  const issuePOMutation = useMutation({
    mutationFn: async () => {
      if (!poId && !vendorId) {
        throw new Error('Please save the PO first');
      }
      
      // Save first, then issue
      await savePOMutation.mutateAsync();
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'issued' })
        .eq('po_number', poNumber);
      if (error) throw error;
    },
    onSuccess: () => {
      setStatus('issued');
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({ title: 'Purchase order issued successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error issuing purchase order', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const openVendorTab = () => {
    if (vendorId) {
      openTab({
        type: 'vendor',
        title: `Vendor: ${selectedVendor?.name}`,
        recordId: vendorId,
      });
    }
  };

  const isLocked = status !== 'draft';

  if (isLoadingPO && poId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
        <Button 
          size="sm" 
          onClick={() => savePOMutation.mutate()}
          disabled={isSaving || isLocked}
        >
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>
        <Button 
          size="sm" 
          variant="default"
          onClick={() => issuePOMutation.mutate()}
          disabled={issuePOMutation.isPending || isLocked}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Send className="h-4 w-4 mr-2" />
          Issue PO
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" variant="outline" disabled>
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button size="sm" variant="outline" disabled={status !== 'issued'}>
          <Truck className="h-4 w-4 mr-2" />
          Receive
        </Button>
        
        <div className="flex-1" />
        
        <Badge className={cn('text-sm', STATUS_COLORS[status])}>
          {status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Section - Fishbowl Style */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Vendor Info */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Vendor
                  </Label>
                  {vendorId && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 px-2"
                      onClick={openVendorTab}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorPopoverOpen}
                      className="w-full justify-between mb-3"
                      disabled={isLocked}
                    >
                      {selectedVendor?.name || 'Select vendor...'}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search vendors..." 
                        value={vendorSearch}
                        onValueChange={setVendorSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No vendor found.</CommandEmpty>
                        <CommandGroup>
                          {filteredVendors.map((vendor) => (
                            <CommandItem
                              key={vendor.id}
                              value={vendor.name}
                              onSelect={() => {
                                setVendorId(vendor.id);
                                setVendorPopoverOpen(false);
                                setVendorSearch('');
                                handleChange();
                              }}
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              {vendor.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedVendor && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    {selectedVendor.contact_name && <p>{selectedVendor.contact_name}</p>}
                    {selectedVendor.address && <p>{selectedVendor.address}</p>}
                    {(selectedVendor.city || selectedVendor.state) && (
                      <p>{[selectedVendor.city, selectedVendor.state, selectedVendor.zip].filter(Boolean).join(', ')}</p>
                    )}
                    {selectedVendor.email && <p>{selectedVendor.email}</p>}
                    {selectedVendor.phone && <p>{selectedVendor.phone}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Center: PO Details */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">PO Number</Label>
                    <Input 
                      value={poNumber} 
                      onChange={(e) => { setPoNumber(e.target.value); handleChange(); }}
                      className="font-mono"
                      disabled={isLocked}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Input 
                      value={status.replace('_', ' ').toUpperCase()} 
                      disabled 
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Order Date</Label>
                    <Input 
                      type="date" 
                      value={orderDate}
                      onChange={(e) => { setOrderDate(e.target.value); handleChange(); }}
                      disabled={isLocked}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expected Date</Label>
                    <Input 
                      type="date" 
                      value={expectedDate}
                      onChange={(e) => { setExpectedDate(e.target.value); handleChange(); }}
                      disabled={isLocked}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Carrier</Label>
                    <Input 
                      value={carrier}
                      onChange={(e) => { setCarrier(e.target.value); handleChange(); }}
                      placeholder="e.g., UPS"
                      disabled={isLocked}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">FOB</Label>
                    <Select value={fob} onValueChange={(v) => { setFob(v); handleChange(); }} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="origin">FOB Origin</SelectItem>
                        <SelectItem value="destination">FOB Destination</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: Ship To */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4" />
                  Ship To
                </Label>
                
                <Select value={shipToId} onValueChange={(v) => { setShipToId(v); handleChange(); }} disabled={isLocked}>
                  <SelectTrigger className="mb-3">
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedShipTo && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{selectedShipTo.name}</p>
                    {selectedShipTo.address && <p>{selectedShipTo.address}</p>}
                    {(selectedShipTo.city || selectedShipTo.state) && (
                      <p>{[selectedShipTo.city, selectedShipTo.state, selectedShipTo.zip].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Line Items Section */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Line Items
                </h3>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={addLineItem}
                  disabled={isLocked}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-40">Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Unit Cost</TableHead>
                    <TableHead className="w-32 text-right">Extended</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No line items. Click "Add Line" to add parts.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-muted-foreground">
                          {item.lineNumber}
                        </TableCell>
                        <TableCell>
                          <Popover 
                            open={partPopoverOpen && activeLineIndex === index} 
                            onOpenChange={(open) => {
                              setPartPopoverOpen(open);
                              if (open) setActiveLineIndex(index);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-mono text-xs"
                                disabled={isLocked}
                              >
                                {item.partNumber || 'Select part...'}
                                <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput 
                                  placeholder="Search parts..." 
                                  value={partSearch}
                                  onValueChange={setPartSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>No parts found.</CommandEmpty>
                                  <CommandGroup>
                                    {searchedParts.map((part: any) => {
                                      const onHand = part.inventory_stock?.reduce((sum: number, s: any) => sum + s.qty_on_hand, 0) || 0;
                                      return (
                                        <CommandItem
                                          key={part.id}
                                          value={part.part_number}
                                          onSelect={() => selectPart(part)}
                                          className="flex flex-col items-start"
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span className="font-mono font-medium">{part.part_number}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                              On Hand: {onHand}
                                            </span>
                                          </div>
                                          <span className="text-sm text-muted-foreground truncate w-full">
                                            {part.description}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            Last Cost: ${(part.last_cost || part.average_cost || 0).toFixed(2)}
                                          </span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, { description: e.target.value })}
                            placeholder="Description"
                            className="h-8"
                            disabled={isLocked}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updateLineItem(index, { qty: parseInt(e.target.value) || 0 })}
                            className="h-8 text-right"
                            min={1}
                            disabled={isLocked}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitCost}
                            onChange={(e) => updateLineItem(index, { unitCost: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-right"
                            step="0.01"
                            disabled={isLocked}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${item.extendedCost.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeLineItem(index)}
                            disabled={isLocked}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="border-t px-4 py-3">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-mono">$0.00</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm font-semibold mb-2 block">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); handleChange(); }}
                placeholder="Internal notes for this purchase order..."
                rows={3}
                disabled={isLocked}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
