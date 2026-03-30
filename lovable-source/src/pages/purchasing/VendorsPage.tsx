import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Building2, Loader2, Phone, Mail, Globe, MapPin, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function VendorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [newVendor, setNewVendor] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    payment_terms: '',
    lead_time_days: '7',
    notes: '',
  });

  // Fetch vendors
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', search],
    queryFn: async () => {
      let query = supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (search) {
        query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: newVendor.name,
          contact_name: newVendor.contact_name || null,
          email: newVendor.email || null,
          phone: newVendor.phone || null,
          address: newVendor.address || null,
          city: newVendor.city || null,
          state: newVendor.state || null,
          zip: newVendor.zip || null,
          website: newVendor.website || null,
          payment_terms: newVendor.payment_terms || null,
          lead_time_days: parseInt(newVendor.lead_time_days) || 7,
          notes: newVendor.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setIsCreateOpen(false);
      setNewVendor({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        website: '',
        payment_terms: '',
        lead_time_days: '7',
        notes: '',
      });
      toast({ title: 'Vendor created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error creating vendor', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Vendors</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/purchasing/vendors/import')}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input 
                    value={newVendor.name} 
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} 
                    placeholder="Vendor name"
                  />
                </div>
                <div>
                  <Label>Contact Name</Label>
                  <Input 
                    value={newVendor.contact_name} 
                    onChange={(e) => setNewVendor({ ...newVendor, contact_name: e.target.value })} 
                    placeholder="Primary contact"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={newVendor.email} 
                    onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })} 
                    placeholder="email@vendor.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input 
                    value={newVendor.phone} 
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })} 
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input 
                  value={newVendor.address} 
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })} 
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>City</Label>
                  <Input 
                    value={newVendor.city} 
                    onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })} 
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input 
                    value={newVendor.state} 
                    onChange={(e) => setNewVendor({ ...newVendor, state: e.target.value })} 
                  />
                </div>
                <div>
                  <Label>ZIP</Label>
                  <Input 
                    value={newVendor.zip} 
                    onChange={(e) => setNewVendor({ ...newVendor, zip: e.target.value })} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Website</Label>
                  <Input 
                    value={newVendor.website} 
                    onChange={(e) => setNewVendor({ ...newVendor, website: e.target.value })} 
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Input 
                    value={newVendor.payment_terms} 
                    onChange={(e) => setNewVendor({ ...newVendor, payment_terms: e.target.value })} 
                    placeholder="e.g., Net 30"
                  />
                </div>
              </div>
              <div>
                <Label>Lead Time (days)</Label>
                <Input 
                  type="number"
                  value={newVendor.lead_time_days} 
                  onChange={(e) => setNewVendor({ ...newVendor, lead_time_days: e.target.value })} 
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={newVendor.notes} 
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })} 
                  placeholder="Additional notes..."
                />
              </div>
              <Button 
                className="w-full" 
                onClick={() => createVendorMutation.mutate()}
                disabled={!newVendor.name || createVendorMutation.isPending}
              >
                {createVendorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Vendor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search vendors..." 
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
          ) : vendors?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No vendors found</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Vendor
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors?.map((vendor) => (
                  <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedVendor(vendor)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{vendor.name}</p>
                        {vendor.website && (
                          <a 
                            href={vendor.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-3 w-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {vendor.contact_name && <p className="text-sm">{vendor.contact_name}</p>}
                        {vendor.email && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {vendor.email}
                          </p>
                        )}
                        {vendor.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.city || vendor.state ? (
                        <p className="text-sm flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{vendor.payment_terms || '-'}</TableCell>
                    <TableCell>{vendor.lead_time_days ? `${vendor.lead_time_days} days` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
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
