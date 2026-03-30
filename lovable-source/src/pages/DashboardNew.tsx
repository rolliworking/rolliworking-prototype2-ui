import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ShoppingCart, Truck, AlertTriangle, TrendingUp, DollarSign, Box, Users, ArrowRight, Loader2, AlertCircle, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';

export default function DashboardNew() {
  // Fetch dashboard stats
  const { data: partsCount } = useQuery({
    queryKey: ['dashboard-parts-count'],
    queryFn: async () => {
      const { count } = await supabase.from('parts').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const { data: lowStockParts } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      // Get parts where total on-hand is at or below reorder point
      const { data, error } = await supabase
        .from('parts')
        .select(`
          id,
          part_number,
          description,
          reorder_point,
          inventory_stock (qty_on_hand)
        `)
        .eq('item_type', 'inventory')
        .gt('reorder_point', 0);

      if (error) throw error;

      // Filter to those below reorder point
      return data?.filter(part => {
        const totalOnHand = part.inventory_stock?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;
        return totalOnHand <= (part.reorder_point || 0);
      }).slice(0, 5) || [];
    },
  });

  const { data: openPOs } = useQuery({
    queryKey: ['dashboard-open-pos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, vendors (name)')
        .in('status', ['draft', 'issued', 'partial_received'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: openSOs } = useQuery({
    queryKey: ['dashboard-open-sos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*, customers (first_name, last_name)')
        .in('status', ['draft', 'open', 'partial_fulfilled'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: clientProperty } = useQuery({
    queryKey: ['dashboard-client-property'],
    queryFn: async () => {
      const { count } = await supabase
        .from('client_property')
        .select('*', { count: 'exact', head: true })
        .eq('is_in_inventory', true);
      return count || 0;
    },
  });

  const { data: vendorsCount } = useQuery({
    queryKey: ['dashboard-vendors-count'],
    queryFn: async () => {
      const { count } = await supabase.from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true);
      return count || 0;
    },
  });

  const { data: inventoryValue, isLoading: isLoadingValue } = useQuery({
    queryKey: ['dashboard-inventory-value'],
    queryFn: async () => {
      // Get all inventory parts with their stock and average cost
      const { data, error } = await supabase
        .from('parts')
        .select(`
          id,
          average_cost,
          inventory_stock (qty_on_hand)
        `)
        .eq('item_type', 'inventory')
        .eq('is_active', true);

      if (error) throw error;

      // Calculate total value: sum of (qty_on_hand * average_cost) for each part
      const totalValue = data?.reduce((sum, part) => {
        const totalQty = part.inventory_stock?.reduce((qtySum, stock) => qtySum + (stock.qty_on_hand || 0), 0) || 0;
        const cost = part.average_cost || 0;
        return sum + (totalQty * cost);
      }, 0) || 0;

      return totalValue;
    },
  });

  // Missing cost stats
  const { data: missingCostCount } = useQuery({
    queryKey: ['dashboard-missing-cost'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('average_cost, last_cost')
        .eq('is_active', true)
        .in('item_type', ['inventory', 'non_inventory']);
      
      if (error) throw error;
      
      return data?.filter(p => 
        (p.average_cost === null || p.average_cost === 0) && 
        (p.last_cost === null || p.last_cost === 0)
      ).length || 0;
    },
  });

  // Missing sales price stats
  const { data: missingSalesPriceCount } = useQuery({
    queryKey: ['dashboard-missing-sales-price'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('default_sell_price')
        .eq('is_active', true);
      
      if (error) throw error;
      
      return data?.filter(p => 
        p.default_sell_price === null || p.default_sell_price === 0
      ).length || 0;
    },
  });

  // QBO Token status
  const { data: qboToken } = useQuery({
    queryKey: ['dashboard-qbo-token'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_tokens')
        .select('updated_at')
        .eq('environment', 'production')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Calculate days remaining on QBO token (100-day lifespan)
  const qboDaysRemaining = qboToken?.updated_at
    ? Math.max(0, differenceInDays(
        new Date(new Date(qboToken.updated_at).getTime() + 100 * 24 * 60 * 60 * 1000),
        new Date()
      ))
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your inventory operations</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Parts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partsCount?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Active SKUs in catalog</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingValue ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                `$${(inventoryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              )}
            </div>
            <p className="text-xs text-muted-foreground">Based on avg cost</p>
          </CardContent>
        </Card>

        <Card className={lowStockParts && lowStockParts.length > 0 ? 'border-warning' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{lowStockParts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Below reorder point</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Client Watches</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientProperty}</div>
            <p className="text-xs text-muted-foreground">In inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorsCount}</div>
            <p className="text-xs text-muted-foreground">Supplier partners</p>
          </CardContent>
        </Card>

        <Card className={missingCostCount && missingCostCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Cost</CardTitle>
            <AlertCircle className={`h-4 w-4 ${missingCostCount && missingCostCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${missingCostCount && missingCostCount > 0 ? 'text-destructive' : ''}`}>
              {missingCostCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Parts without cost data</p>
          </CardContent>
        </Card>

        <Card className={missingSalesPriceCount && missingSalesPriceCount > 0 ? "border-warning/50 bg-warning/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Price</CardTitle>
            <DollarSign className={`h-4 w-4 ${missingSalesPriceCount && missingSalesPriceCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${missingSalesPriceCount && missingSalesPriceCount > 0 ? 'text-warning' : ''}`}>
              {missingSalesPriceCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Products without sales price</p>
          </CardContent>
        </Card>

        <Link to="/setup/qbo-customers">
          <Card className={`cursor-pointer hover:bg-muted/50 transition-colors ${qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'border-destructive/50 bg-destructive/5' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">QBO Token</CardTitle>
              <Database className={`h-4 w-4 ${qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${qboDaysRemaining !== null && qboDaysRemaining < 14 ? 'text-destructive' : ''}`}>
                {qboDaysRemaining !== null ? `${qboDaysRemaining}d` : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Days until token expires</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Low Stock Alerts
                </CardTitle>
                <CardDescription>Parts below reorder point</CardDescription>
              </div>
              <Link to="/inventory/parts">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockParts?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>All stock levels are healthy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockParts?.map((part) => {
                  const totalOnHand = part.inventory_stock?.reduce((sum, s) => sum + (s.qty_on_hand || 0), 0) || 0;
                  return (
                    <div key={part.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-mono font-medium text-sm">{part.part_number}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{part.description}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-warning border-warning">
                          {totalOnHand} / {part.reorder_point}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Purchase Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Open Purchase Orders
                </CardTitle>
                <CardDescription>Pending and in-transit orders</CardDescription>
              </div>
              <Link to="/purchasing/orders">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {openPOs?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No open purchase orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openPOs?.map((po) => (
                  <div key={po.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-mono font-medium text-sm">{po.po_number}</p>
                      <p className="text-sm text-muted-foreground">{po.vendors?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(po.total_amount || 0).toFixed(2)}</p>
                      <Badge variant="outline" className="text-xs">
                        {po.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Sales Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Open Sales Orders
                </CardTitle>
                <CardDescription>Orders awaiting fulfillment</CardDescription>
              </div>
              <Link to="/sales/orders">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {openSOs?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No open sales orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openSOs?.map((so) => (
                  <div key={so.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-mono font-medium text-sm">{so.so_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {so.customers?.first_name} {so.customers?.last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(so.total_amount || 0).toFixed(2)}</p>
                      <Badge variant="outline" className="text-xs">
                        {so.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to="/inventory/parts">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 mr-2" />
                Add Part
              </Button>
            </Link>
            <Link to="/purchasing/orders">
              <Button variant="outline" className="w-full justify-start">
                <Truck className="h-4 w-4 mr-2" />
                Create PO
              </Button>
            </Link>
            <Link to="/sales/orders">
              <Button variant="outline" className="w-full justify-start">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create SO
              </Button>
            </Link>
            <Link to="/inventory/cycle-count">
              <Button variant="outline" className="w-full justify-start">
                <Box className="h-4 w-4 mr-2" />
                Cycle Count
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
