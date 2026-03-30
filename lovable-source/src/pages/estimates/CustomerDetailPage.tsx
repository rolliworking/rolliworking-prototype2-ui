import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Copy,
  Video,
  Pencil,
  Loader2,
  DollarSign,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CustomerSidePanel } from '@/components/customers';
import { Customer } from '@/types/database';
import { Separator } from '@/components/ui/separator';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  declined: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
  closed: 'bg-green-100 text-green-700',
  open: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditPanelOpen, setIsEditPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');

  // Fetch customer data
  const { data: customer, isLoading: loadingCustomer, refetch } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });

  // Fetch billing address
  const { data: billingAddress } = useQuery({
    queryKey: ['customer-billing-address', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', id)
        .eq('address_type', 'billing')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch shipping address
  const { data: shippingAddress } = useQuery({
    queryKey: ['customer-shipping-address', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', id)
        .eq('address_type', 'shipping')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch estimates for transactions
  const { data: estimates, isLoading: loadingEstimates } = useQuery({
    queryKey: ['customer-estimates-full', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch sales orders for transactions (if table exists)
  const { data: salesOrders } = useQuery({
    queryKey: ['customer-sales-orders-full', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch synced invoices from QuickBooks (if any)
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['customer-qbo-invoices', id, customer?.qbo_customer_id],
    queryFn: async () => {
      if (!id || !customer) return [];

      let query = supabase
        .from('qbo_invoices')
        .select('id, doc_number, invoice_date, total_amount, balance, status, memo, customer_name, customer_id, customer_qbo_id')
        .order('invoice_date', { ascending: false })
        .limit(200);

      if (customer.qbo_customer_id) {
        query = query.eq('customer_qbo_id', customer.qbo_customer_id);
      } else {
        query = query.eq('customer_id', id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!customer,
  });


  if (loadingCustomer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Customer not found</p>
        <Button onClick={() => navigate('/customers')}>Back to Customers</Button>
      </div>
    );
  }

  const displayName = customer.display_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
    'Unknown';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatAddress = (addr: any) => {
    if (!addr) return null;
    const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const billingAddressText = formatAddress(billingAddress);
  const shippingAddressText = formatAddress(shippingAddress);

  // Combine transactions
  const transactions = [
    ...(estimates || []).map((e: any) => ({
      id: e.id,
      date: e.created_at,
      type: 'Estimate',
      number: e.estimate_number?.replace(/^EST-/, 'E') || '',
      customer: displayName,
      memo: '',
      amount: e.total_amount || 0,
      status: e.status,
      href: `/estimates/${e.id}`,
    })),
    ...(invoices || []).map((inv: any) => ({
      id: `invoice-${inv.id}`,
      date: inv.invoice_date,
      type: 'Invoice',
      number: inv.doc_number || '',
      customer: inv.customer_name || displayName,
      memo: inv.memo || '',
      amount: Number(inv.total_amount || 0),
      status: inv.status,
      href: `/setup/qbo-invoices?search=${encodeURIComponent(inv.doc_number || inv.customer_name || '')}`,
    })),
    ...(salesOrders || []).map((so: any) => ({
      id: so.id,
      date: so.created_at,
      type: 'Sales Order',
      number: so.so_number,
      customer: displayName,
      memo: '',
      amount: so.total_amount || 0,
      status: so.status,
      href: `/sales/orders/${so.id}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate financial summary
  const openBalance = estimates
    ?.filter((e: any) => ['sent', 'pending'].includes(e.status))
    .reduce((sum: number, e: any) => sum + (e.total_amount || 0), 0) || 0;

  const handleEditCustomer = () => {
    setIsEditPanelOpen(true);
  };

  const handleCustomerSaved = () => {
    setIsEditPanelOpen(false);
    refetch();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <Button
          variant="link"
          className="text-primary p-0 h-auto font-medium"
          onClick={() => navigate('/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Customers
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEditCustomer}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#2CA01C] hover:bg-[#238A17] text-white">
                New transaction
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/estimates/new?customer_id=${customer.id}&return_to=/customers/${customer.id}`)}>
                Estimate
              </DropdownMenuItem>
              <DropdownMenuItem>Invoice</DropdownMenuItem>
              <DropdownMenuItem>Sales Receipt</DropdownMenuItem>
              <DropdownMenuItem>Payment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Customer Info Section */}
      <div className="px-6 py-6 border-b">
        <div className="flex gap-8">
          {/* Left: Avatar + Name */}
          <div className="flex flex-col items-center gap-3 min-w-[200px]">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h1 className="text-lg font-semibold">{displayName}</h1>
              {customer.company_name && (
                <p className="text-sm text-muted-foreground">{customer.company_name}</p>
              )}
            </div>
            {/* Action Icons */}
            <div className="flex gap-2 mt-2">
              {customer.email && (
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild>
                  <a href={`mailto:${customer.email}`}>
                    <Mail className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {customer.phone && (
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" asChild>
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Middle: Contact Info */}
          <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm font-medium">
                {customer.email || <span className="text-muted-foreground">—</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">
                {customer.phone || <span className="text-muted-foreground">—</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billing address</p>
              {billingAddressText ? (
                <p className="text-sm font-medium">{billingAddressText}</p>
              ) : (
                <button className="text-sm text-primary hover:underline" onClick={handleEditCustomer}>Add billing address</button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shipping address</p>
              {shippingAddressText ? (
                <p className="text-sm font-medium">{shippingAddressText}</p>
              ) : (
                <button className="text-sm text-primary hover:underline" onClick={handleEditCustomer}>Add shipping address</button>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              {customer.internal_notes ? (
                <p className="text-sm font-medium">{customer.internal_notes}</p>
              ) : (
                <button className="text-sm text-primary hover:underline" onClick={handleEditCustomer}>Add notes</button>
              )}
            </div>
          </div>

          {/* Right: Financial Summary */}
          <Card className="min-w-[220px] bg-blue-50 border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Financial summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                  <span className="text-sm">Open balance</span>
                </div>
                <span className="text-lg font-semibold">
                  ${openBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  <span className="text-sm">Overdue payment</span>
                </div>
                <span className="text-lg font-semibold">$0.00</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-12 bg-transparent gap-6 p-0">
              <TabsTrigger 
                value="transactions" 
                className="h-12 px-0 pb-0 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none"
              >
                Transaction List
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="h-12 px-0 pb-0 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none"
              >
                Customer Details
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="h-12 px-0 pb-0 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none"
              >
                Notes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="transactions" className="flex-1 overflow-auto m-0 px-6 py-4">
            {loadingEstimates || loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No transactions yet</p>
                <Button
                  variant="link"
                  className="text-primary mt-2"
                  onClick={() => navigate(`/estimates/new?customer_id=${customer.id}&return_to=/customers/${customer.id}`)}
                >
                  Create an estimate
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox />
                    </TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>TYPE</TableHead>
                    <TableHead>NO.</TableHead>
                    <TableHead>CUSTOMER</TableHead>
                    <TableHead>MEMO</TableHead>
                    <TableHead className="text-right">AMOUNT</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Checkbox />
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(tx.date), 'M/d/yy')}
                      </TableCell>
                      <TableCell className="text-sm">{tx.type}</TableCell>
                      <TableCell className="text-sm">{tx.number}</TableCell>
                      <TableCell className="text-sm">{tx.customer}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.memo || '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[tx.status] || 'bg-gray-100 text-gray-700'}>
                          {tx.status?.charAt(0).toUpperCase() + tx.status?.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={tx.href}
                          className="text-sm text-primary hover:underline"
                        >
                          {tx.type === 'Estimate' ? 'View/Edit' : 'View'}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-auto m-0 px-6 py-4">
            <div className="max-w-2xl space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Display Name</h3>
                  <p className="text-sm">{displayName}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Company</h3>
                  <p className="text-sm">{customer.company_name || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Email</h3>
                  <p className="text-sm">{customer.email || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Phone</h3>
                  <p className="text-sm">{customer.phone || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Mobile</h3>
                  <p className="text-sm">{customer.mobile_phone || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Website</h3>
                  <p className="text-sm">{customer.website || '—'}</p>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Billing Address</h3>
                <p className="text-sm">{billingAddressText || '—'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Shipping Address</h3>
                <p className="text-sm">{shippingAddressText || '—'}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-auto m-0 px-6 py-4">
            <div className="max-w-2xl">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Internal Notes</h3>
              <p className="text-sm whitespace-pre-wrap">
                {customer.internal_notes || 'No notes added yet.'}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Panel */}
      <CustomerSidePanel
        open={isEditPanelOpen}
        onOpenChange={setIsEditPanelOpen}
        customer={customer}
        onSave={handleCustomerSaved}
      />
    </div>
  );
}
