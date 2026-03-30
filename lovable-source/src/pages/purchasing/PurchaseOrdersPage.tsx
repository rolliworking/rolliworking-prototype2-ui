import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, ClipboardList, Loader2, Truck, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  partial_received: 'bg-amber-100 text-amber-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch purchase orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (name)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`po_number.ilike.%${search}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    draft: orders?.filter(o => o.status === 'draft').length || 0,
    issued: orders?.filter(o => o.status === 'issued').length || 0,
    partial: orders?.filter(o => o.status === 'partial_received').length || 0,
    received: orders?.filter(o => o.status === 'received').length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage purchasing and receiving</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="cursor-pointer" onClick={() => setStatusFilter('draft')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('issued')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Issued</p>
                <p className="text-2xl font-bold text-blue-600">{stats.issued}</p>
              </div>
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('partial_received')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Partial</p>
                <p className="text-2xl font-bold text-amber-600">{stats.partial}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('received')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Received</p>
                <p className="text-2xl font-bold text-green-600">{stats.received}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search PO number..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="issued">Issued</TabsTrigger>
            <TabsTrigger value="partial_received">Partial</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : orders?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No purchase orders found</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First PO
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <span className="font-mono font-medium">{order.po_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{order.vendors?.name}</span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.order_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {order.expected_date 
                        ? format(new Date(order.expected_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(order.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {order.source ? (
                        <Badge variant="outline">{order.source}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[order.status]}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
