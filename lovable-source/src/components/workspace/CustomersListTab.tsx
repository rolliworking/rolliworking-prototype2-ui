import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Users, Loader2, Phone, Mail } from 'lucide-react';

export function CustomersListTab() {
  const { openTab } = useWorkspace();
  const [search, setSearch] = useState('');

  // Fetch customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-list-tab', search],
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('*')
        .order('last_name, first_name')
        .limit(100);

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,display_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleOpenCustomer = (customer: any) => {
    openTab({
      type: 'customer',
      title: `Customer: ${customer.display_name || `${customer.first_name} ${customer.last_name}`}`,
      recordId: customer.id,
    });
  };

  const handleNewCustomer = () => {
    openTab({
      type: 'new-customer',
      title: 'New Customer',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Customers</h1>
          <p className="text-muted-foreground">Manage customer records</p>
        </div>
        <Button onClick={handleNewCustomer}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search customers..." 
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
          ) : customers?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No customers found</p>
              <Button className="mt-4" onClick={handleNewCustomer}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Customer
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.map((customer) => (
                  <TableRow 
                    key={customer.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenCustomer(customer)}
                  >
                    <TableCell>
                      <span className="font-medium">
                        {customer.display_name || `${customer.first_name} ${customer.last_name}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {customer.company_name || '-'}
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {customer.city || customer.state ? (
                        [customer.city, customer.state].filter(Boolean).join(', ')
                      ) : '-'}
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
