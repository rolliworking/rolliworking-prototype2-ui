import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, RefreshCw, ShoppingCart, Loader2, Package, Check, X, Truck } from 'lucide-react';

type ReorderSuggestion = {
  id: string;
  suggested_qty: number;
  current_on_hand: number;
  reorder_point: number;
  suggested_cost: number | null;
  status: string;
  created_at: string;
  parts: {
    id: string;
    part_number: string;
    description: string;
    reorder_qty: number | null;
  };
  vendors: {
    id: string;
    name: string;
  } | null;
};

type LowStockPart = {
  id: string;
  part_number: string;
  description: string;
  reorder_point: number | null;
  reorder_qty: number | null;
  inventory_stock: { qty_on_hand: number }[];
};

export default function ReorderAlertsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'suggestions'>('alerts');

  // Fetch low stock parts
  const { data: lowStockParts, isLoading: loadingParts } = useQuery({
    queryKey: ['low-stock-parts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(`
          id,
          part_number,
          description,
          reorder_point,
          reorder_qty,
          inventory_stock (qty_on_hand)
        `)
        .eq('item_type', 'inventory')
        .eq('is_active', true)
        .gt('reorder_point', 0);

      if (error) throw error;

      // Filter to those at or below reorder point
      return (data as LowStockPart[])?.filter(part => {
        const totalOnHand = part.inventory_stock?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;
        return totalOnHand <= (part.reorder_point || 0);
      }) || [];
    },
  });

  // Fetch reorder suggestions
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['reorder-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reorder_suggestions')
        .select(`
          *,
          parts (id, part_number, description, reorder_qty),
          vendors (id, name)
        `)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReorderSuggestion[];
    },
  });

  // Generate suggestions mutation
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_reorder_suggestions');
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
      toast({ title: `Generated ${count} reorder suggestions` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error generating suggestions', description: error.message, variant: 'destructive' });
    },
  });

  // Update suggestion status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('reorder_suggestions')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
      setSelectedIds([]);
      toast({ title: 'Status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && suggestions) {
      setSelectedIds(suggestions.filter(s => s.status === 'pending').map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const pendingCount = suggestions?.filter(s => s.status === 'pending').length || 0;
  const approvedCount = suggestions?.filter(s => s.status === 'approved').length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Reorder Alerts
          </h1>
          <p className="text-muted-foreground">Monitor low stock and generate purchase orders</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => generateSuggestionsMutation.mutate()}
            disabled={generateSuggestionsMutation.isPending}
          >
            {generateSuggestionsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Suggestions
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button 
                variant="outline"
                onClick={() => updateStatusMutation.mutate({ ids: selectedIds, status: 'dismissed' })}
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss ({selectedIds.length})
              </Button>
              <Button onClick={() => updateStatusMutation.mutate({ ids: selectedIds, status: 'approved' })}>
                <Check className="h-4 w-4 mr-2" />
                Approve ({selectedIds.length})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={lowStockParts && lowStockParts.length > 0 ? 'border-warning' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold text-warning">{lowStockParts?.length || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Suggestions</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-success">{approvedCount}</p>
              </div>
              <Check className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Est. PO Value</p>
                <p className="text-2xl font-bold">
                  ${suggestions?.filter(s => s.status === 'approved').reduce((sum, s) => sum + (s.suggested_cost || 0) * s.suggested_qty, 0).toFixed(2) || '0.00'}
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 -mb-px text-sm font-medium transition-colors ${
            activeTab === 'alerts' 
              ? 'border-b-2 border-primary text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('alerts')}
        >
          Low Stock Alerts ({lowStockParts?.length || 0})
        </button>
        <button
          className={`px-4 py-2 -mb-px text-sm font-medium transition-colors ${
            activeTab === 'suggestions' 
              ? 'border-b-2 border-primary text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('suggestions')}
        >
          Reorder Suggestions ({suggestions?.length || 0})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'alerts' ? (
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Parts</CardTitle>
            <CardDescription>Parts at or below their reorder point</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingParts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : lowStockParts?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">All stock levels are healthy!</p>
                <p className="text-sm">No parts are below their reorder point</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Reorder Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockParts?.map((part) => {
                    const totalOnHand = part.inventory_stock?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;
                    const isOutOfStock = totalOnHand === 0;
                    return (
                      <TableRow key={part.id}>
                        <TableCell className="font-mono font-medium">{part.part_number}</TableCell>
                        <TableCell>{part.description}</TableCell>
                        <TableCell className="text-right font-medium">{totalOnHand}</TableCell>
                        <TableCell className="text-right">{part.reorder_point}</TableCell>
                        <TableCell className="text-right">{part.reorder_qty || part.reorder_point}</TableCell>
                        <TableCell>
                          <Badge variant={isOutOfStock ? 'destructive' : 'outline'} className="text-warning border-warning">
                            {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Reorder Suggestions</CardTitle>
            <CardDescription>Approve suggestions to create purchase orders</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSuggestions ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : suggestions?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No reorder suggestions</p>
                <p className="text-sm">Click "Refresh Suggestions" to generate based on stock levels</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedIds.length === pendingCount && pendingCount > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Suggested Qty</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions?.map((suggestion) => (
                    <TableRow key={suggestion.id}>
                      <TableCell>
                        {suggestion.status === 'pending' && (
                          <Checkbox 
                            checked={selectedIds.includes(suggestion.id)}
                            onCheckedChange={(checked) => handleSelect(suggestion.id, !!checked)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-medium">{suggestion.parts.part_number}</TableCell>
                      <TableCell>{suggestion.parts.description}</TableCell>
                      <TableCell>{suggestion.vendors?.name || 'No vendor'}</TableCell>
                      <TableCell className="text-right">{suggestion.current_on_hand}</TableCell>
                      <TableCell className="text-right font-medium">{suggestion.suggested_qty}</TableCell>
                      <TableCell className="text-right">
                        ${suggestion.suggested_cost ? (suggestion.suggested_cost * suggestion.suggested_qty).toFixed(2) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={suggestion.status === 'approved' ? 'default' : 'outline'}>
                          {suggestion.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      {approvedCount > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{approvedCount} items approved for reorder</p>
              <p className="text-sm text-muted-foreground">Generate purchase orders from approved suggestions</p>
            </div>
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Create Purchase Orders
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
