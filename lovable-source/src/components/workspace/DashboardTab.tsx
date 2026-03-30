import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ClipboardList, 
  Truck, 
  Package, 
  Users, 
  AlertTriangle,
  Plus,
  ArrowRight,
  DollarSign,
  Loader2
} from 'lucide-react';

export function DashboardTab() {
  const { openTab } = useWorkspace();

  // Fetch stats
  const { data: poStats } = useQuery({
    queryKey: ['dashboard-po-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('status');
      if (error) throw error;
      
      return {
        draft: data.filter(o => o.status === 'draft').length,
        issued: data.filter(o => o.status === 'issued').length,
        total: data.length,
      };
    },
  });

  const { data: vendorCount } = useQuery({
    queryKey: ['dashboard-vendor-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: partCount } = useQuery({
    queryKey: ['dashboard-part-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('parts')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: lowStockCount } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      // This is a simplified query - in production you'd want a proper RPC
      const { data, error } = await supabase
        .from('parts')
        .select(`
          id,
          reorder_point,
          inventory_stock (qty_on_hand)
        `)
        .eq('is_active', true)
        .not('reorder_point', 'is', null);
      
      if (error) throw error;
      
      return data.filter(part => {
        const onHand = part.inventory_stock?.reduce((sum: number, s: any) => sum + (s.qty_on_hand || 0), 0) || 0;
        return onHand <= (part.reorder_point || 0);
      }).length;
    },
  });

  const { data: inventoryValue, isLoading: isLoadingValue } = useQuery({
    queryKey: ['dashboard-inventory-value'],
    queryFn: async () => {
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

      const totalValue = data?.reduce((sum, part) => {
        const totalQty = part.inventory_stock?.reduce((qtySum: number, stock: any) => qtySum + (stock.qty_on_hand || 0), 0) || 0;
        const cost = part.average_cost || 0;
        return sum + (totalQty * cost);
      }, 0) || 0;

      return totalValue;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Workspace Dashboard</h1>
          <p className="text-muted-foreground">Quick overview and actions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button onClick={() => openTab({ type: 'new-po', title: 'New Purchase Order' })}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
        <Button variant="outline" onClick={() => openTab({ type: 'vendors-list', title: 'Vendors' })}>
          <Users className="h-4 w-4 mr-2" />
          View Vendors
        </Button>
        <Button variant="outline" onClick={() => openTab({ type: 'parts-list', title: 'Parts' })}>
          <Package className="h-4 w-4 mr-2" />
          View Parts
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openTab({ type: 'po-list', title: 'Purchase Orders' })}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft POs</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{poStats?.draft || 0}</div>
            <p className="text-xs text-muted-foreground">Ready to issue</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openTab({ type: 'po-issued', title: 'Issued POs' })}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Issued POs</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{poStats?.issued || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting receipt</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openTab({ type: 'vendors-list', title: 'Vendors' })}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Vendors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorCount || 0}</div>
            <p className="text-xs text-muted-foreground">Suppliers</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => openTab({ type: 'parts-list', title: 'Parts' })}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parts</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partCount || 0}</div>
            <p className="text-xs text-muted-foreground">Active SKUs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
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
      </div>

      {/* Alerts Section */}
      {(lowStockCount || 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-sm font-medium text-amber-800">Reorder Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              {lowStockCount} parts are at or below reorder point
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto text-amber-700"
              onClick={() => openTab({ type: 'parts-list', title: 'Parts' })}
            >
              View Parts <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recent purchase orders and receiving activity will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
