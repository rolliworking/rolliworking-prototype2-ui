import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Box, Loader2, AlertTriangle } from 'lucide-react';

export function PartsListTab() {
  const { openTab } = useWorkspace();
  const [search, setSearch] = useState('');

  // Fetch parts
  const { data: parts, isLoading } = useQuery({
    queryKey: ['parts-list', search],
    queryFn: async () => {
      let query = supabase
        .from('parts')
        .select(`
          *,
          inventory_stock (qty_on_hand, qty_allocated, qty_on_order)
        `)
        .eq('is_active', true)
        .order('part_number');

      const rawTokens = search ? search.trim().split(/\s+/) : [];
      const tokens = rawTokens
        .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
        .filter(t => t.length > 0);

      if (tokens.length > 0) {
        const orConditions = tokens
          .flatMap(t => [`part_number.ilike.%${t}%`, `description.ilike.%${t}%`])
          .join(',');
        query = query.or(orConditions);
      }

      // Pull more rows when searching to avoid missing relevant matches.
      const maxRows = tokens.length > 0 ? 500 : 100;

      const { data, error } = await query.range(0, maxRows - 1);
      if (error) throw error;

      let results = data;
      if (tokens.length > 1 && data) {
        results = [...data]
          .map(part => {
            const haystack = `${part.part_number || ''} ${part.description || ''}`.toLowerCase();
            const matchCount = tokens.reduce(
              (count, t) => count + (haystack.includes(t.toLowerCase()) ? 1 : 0),
              0
            );
            return { part, matchCount };
          })
          .filter(x => x.matchCount > 0)
          .sort(
            (a, b) =>
              b.matchCount - a.matchCount ||
              String(a.part.part_number).localeCompare(String(b.part.part_number))
          )
          .map(x => x.part);
      }

      return results;
    },
  });

  const handleOpenPart = (part: any) => {
    openTab({
      type: 'part',
      title: `Part: ${part.part_number}`,
      recordId: part.id,
    });
  };

  const getTotalOnHand = (part: any) => {
    return part.inventory_stock?.reduce((sum: number, s: any) => sum + (s.qty_on_hand || 0), 0) || 0;
  };

  const getTotalAllocated = (part: any) => {
    return part.inventory_stock?.reduce((sum: number, s: any) => sum + (s.qty_allocated || 0), 0) || 0;
  };

  const getTotalOnOrder = (part: any) => {
    return part.inventory_stock?.reduce((sum: number, s: any) => sum + (s.qty_on_order || 0), 0) || 0;
  };

  const isLowStock = (part: any) => {
    const onHand = getTotalOnHand(part);
    return part.reorder_point && onHand <= part.reorder_point;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Parts Inventory</h1>
          <p className="text-muted-foreground">Manage parts, stock levels, and pricing</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search parts..." 
          className="pl-9" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : parts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No parts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">On Order</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts?.map((part) => {
                  const onHand = getTotalOnHand(part);
                  const allocated = getTotalAllocated(part);
                  const onOrder = getTotalOnOrder(part);
                  const available = onHand - allocated;
                  const lowStock = isLowStock(part);
                  
                  return (
                    <TableRow 
                      key={part.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenPart(part)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{part.part_number}</span>
                          {lowStock && (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {part.description}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {onHand}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {allocated > 0 ? allocated : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        {onOrder > 0 ? onOrder : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {available}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${(part.average_cost || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {lowStock ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
