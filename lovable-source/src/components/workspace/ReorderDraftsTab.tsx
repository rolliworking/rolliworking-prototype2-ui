import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, Package, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReorderSuggestion {
  part_id: string;
  part_number: string;
  description: string;
  on_hand: number;
  reorder_point: number;
  reorder_up_to: number;
  suggested_qty: number;
  preferred_vendor_id: string | null;
  preferred_vendor_name: string | null;
  unit_cost: number;
  extended_cost: number;
}

export function ReorderDraftsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openTab } = useWorkspace();
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch parts that need reordering
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['reorder-suggestions'],
    queryFn: async () => {
      // Get parts with inventory below reorder point
      const { data: parts, error: partsError } = await supabase
        .from('parts')
        .select(`
          id,
          part_number,
          description,
          reorder_point,
          max_qty,
          inventory_stock (qty_on_hand)
        `)
        .eq('is_active', true)
        .not('reorder_point', 'is', null);

      if (partsError) throw partsError;

      // Get vendor pricing
      const { data: pricing, error: pricingError } = await supabase
        .from('part_vendor_prices')
        .select(`
          part_id,
          vendor_id,
          unit_cost,
          is_preferred,
          vendors (id, name)
        `)
        .order('unit_cost', { ascending: true });

      if (pricingError) throw pricingError;

      // Build suggestions
      const suggestionsData: ReorderSuggestion[] = [];

      for (const part of parts) {
        const onHand = part.inventory_stock?.reduce(
          (sum: number, s: any) => sum + (s.qty_on_hand || 0), 
          0
        ) || 0;

        const reorderPoint = part.reorder_point || 0;
        const reorderUpTo = part.max_qty || reorderPoint * 2;

        if (onHand <= reorderPoint) {
          const suggestedQty = Math.max(1, reorderUpTo - onHand);

          // Find best vendor (preferred or cheapest)
          const partPricing = pricing.filter(p => p.part_id === part.id);
          const preferredVendor = partPricing.find(p => p.is_preferred) || partPricing[0];

          suggestionsData.push({
            part_id: part.id,
            part_number: part.part_number,
            description: part.description,
            on_hand: onHand,
            reorder_point: reorderPoint,
            reorder_up_to: reorderUpTo,
            suggested_qty: suggestedQty,
            preferred_vendor_id: preferredVendor?.vendor_id || null,
            preferred_vendor_name: preferredVendor?.vendors?.name || null,
            unit_cost: preferredVendor?.unit_cost || 0,
            extended_cost: suggestedQty * (preferredVendor?.unit_cost || 0),
          });
        }
      }

      return suggestionsData.sort((a, b) => a.part_number.localeCompare(b.part_number));
    },
  });

  const togglePart = (partId: string) => {
    setSelectedParts(prev => {
      const next = new Set(prev);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!suggestions) return;
    if (selectedParts.size === suggestions.length) {
      setSelectedParts(new Set());
    } else {
      setSelectedParts(new Set(suggestions.map(s => s.part_id)));
    }
  };

  // Generate draft POs from selected suggestions
  const generateDraftsMutation = useMutation({
    mutationFn: async () => {
      if (!suggestions) return;
      setIsGenerating(true);

      const selectedSuggestions = suggestions.filter(s => selectedParts.has(s.part_id));
      
      // Group by vendor
      const byVendor = selectedSuggestions.reduce((acc, s) => {
        const vendorId = s.preferred_vendor_id || 'no-vendor';
        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendor_id: s.preferred_vendor_id,
            vendor_name: s.preferred_vendor_name,
            lines: [],
          };
        }
        acc[vendorId].lines.push(s);
        return acc;
      }, {} as Record<string, { vendor_id: string | null; vendor_name: string | null; lines: ReorderSuggestion[] }>);

      const createdPOs: string[] = [];

      for (const [vendorKey, group] of Object.entries(byVendor)) {
        if (!group.vendor_id) {
          toast({
            title: 'Some parts have no vendor',
            description: `${group.lines.length} parts skipped - no preferred vendor set`,
            variant: 'destructive',
          });
          continue;
        }

        // Check for existing draft PO for this vendor
        const { data: existingDraft } = await supabase
          .from('purchase_orders')
          .select('id, po_number')
          .eq('vendor_id', group.vendor_id)
          .eq('status', 'draft')
          .eq('source', 'reorder')
          .single();

        let poId: string;
        let poNumber: string;

        if (existingDraft) {
          poId = existingDraft.id;
          poNumber = existingDraft.po_number;
        } else {
          // Get next PO number
          const { data: nextNum } = await supabase.rpc('get_next_po_number');
          poNumber = nextNum;

          // Create new draft PO
          const { data: newPO, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
              po_number: poNumber,
              vendor_id: group.vendor_id,
              status: 'draft',
              source: 'reorder',
              order_date: new Date().toISOString().split('T')[0],
            })
            .select()
            .single();

          if (poError) throw poError;
          poId = newPO.id;
        }

        // Add lines
        const linesToInsert = group.lines.map((line, idx) => ({
          po_id: poId,
          part_id: line.part_id,
          qty_ordered: line.suggested_qty,
          unit_cost: line.unit_cost,
          extended_cost: line.extended_cost,
          sort_order: idx + 1,
        }));

        const { error: linesError } = await supabase
          .from('po_lines')
          .insert(linesToInsert);

        if (linesError) throw linesError;

        // Update PO totals
        const subtotal = group.lines.reduce((sum, l) => sum + l.extended_cost, 0);
        await supabase
          .from('purchase_orders')
          .update({ subtotal, total_amount: subtotal })
          .eq('id', poId);

        createdPOs.push(poNumber);
      }

      return createdPOs;
    },
    onSuccess: (poNumbers) => {
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSelectedParts(new Set());
      setIsGenerating(false);

      if (poNumbers && poNumbers.length > 0) {
        toast({
          title: 'Draft POs created',
          description: `Created/updated ${poNumbers.length} purchase orders`,
        });
      }
    },
    onError: (error: any) => {
      setIsGenerating(false);
      toast({
        title: 'Error creating drafts',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const totalSelected = selectedParts.size;
  const totalValue = suggestions
    ?.filter(s => selectedParts.has(s.part_id))
    .reduce((sum, s) => sum + s.extended_cost, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Reorder Suggestions</h1>
          <p className="text-muted-foreground">
            Parts at or below reorder point - generate draft POs automatically
          </p>
        </div>
        {suggestions && suggestions.length > 0 && (
          <Button
            onClick={() => generateDraftsMutation.mutate()}
            disabled={selectedParts.size === 0 || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Generate Draft POs
            {totalSelected > 0 && ` (${totalSelected})`}
          </Button>
        )}
      </div>

      {/* Selection summary */}
      {totalSelected > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm">
              <strong>{totalSelected}</strong> parts selected
            </span>
            <span className="font-mono font-semibold">
              ${totalValue.toFixed(2)} estimated
            </span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-green-600 opacity-70" />
            <p className="text-muted-foreground font-medium">All parts are stocked</p>
            <p className="text-sm text-muted-foreground mt-1">
              No parts are currently below their reorder point
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedParts.size === suggestions.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reorder Pt</TableHead>
                  <TableHead className="text-right">Suggested Qty</TableHead>
                  <TableHead>Preferred Vendor</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Extended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((suggestion) => (
                  <TableRow 
                    key={suggestion.part_id}
                    className={cn(
                      'cursor-pointer',
                      selectedParts.has(suggestion.part_id) && 'bg-primary/5'
                    )}
                    onClick={() => togglePart(suggestion.part_id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedParts.has(suggestion.part_id)}
                        onCheckedChange={() => togglePart(suggestion.part_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-mono font-medium">{suggestion.part_number}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {suggestion.description}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive font-medium">
                      {suggestion.on_hand}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {suggestion.reorder_point}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {suggestion.suggested_qty}
                    </TableCell>
                    <TableCell>
                      {suggestion.preferred_vendor_name ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{suggestion.preferred_vendor_name}</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          No vendor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${suggestion.unit_cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${suggestion.extended_cost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
