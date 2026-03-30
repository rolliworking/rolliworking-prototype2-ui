import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Receipt, Loader2, DollarSign, Package, Truck, Send } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  open: 'bg-blue-100 text-blue-800',
  partial_fulfilled: 'bg-amber-100 text-amber-800',
  fulfilled: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch sales orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['sales-orders', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select(`
          *,
          customers (first_name, last_name),
          jobs (job_id)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`so_number.ilike.%${search}%`);
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
    open: orders?.filter(o => o.status === 'open').length || 0,
    partial: orders?.filter(o => o.status === 'partial_fulfilled').length || 0,
    fulfilled: orders?.filter(o => o.status === 'fulfilled').length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Sales Orders</h1>
          <p className="text-muted-foreground">Manage customer orders and fulfillment</p>
        </div>
        <Button onClick={() => navigate('/sales/orders/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Sales Order
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
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('open')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('partial_fulfilled')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Partial</p>
                <p className="text-2xl font-bold text-amber-600">{stats.partial}</p>
              </div>
              <Truck className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setStatusFilter('fulfilled')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fulfilled</p>
                <p className="text-2xl font-bold text-green-600">{stats.fulfilled}</p>
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
            placeholder="Search SO number..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="partial_fulfilled">Partial</TabsTrigger>
            <TabsTrigger value="fulfilled">Fulfilled</TabsTrigger>
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
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales orders found</p>
              <Button className="mt-4" onClick={() => navigate('/sales/orders/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Order
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Webhook</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow 
                    key={order.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/sales/orders/${order.id}`)}
                  >
                    <TableCell>
                      <span className="font-mono font-medium">{order.so_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {order.customers?.first_name} {order.customers?.last_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.jobs?.job_id ? (
                        <Badge variant="outline" className="font-mono">{order.jobs.job_id}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.order_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${(order.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[order.status]}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.work_completed_sent ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <Send className="h-3 w-3 mr-1" />
                          Sent
                        </Badge>
                      ) : order.status === 'fulfilled' ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          Pending
                        </Badge>
                      ) : null}
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
