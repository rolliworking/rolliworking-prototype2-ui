import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Watch, Loader2, Tag, Calendar, User, Printer, QrCode, Check, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import { LabelPrintDialog } from '@/components/labels/LabelPrintDialog';

export default function ClientPropertyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [labelPrintOpen, setLabelPrintOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  // Fetch client property
  const { data: properties, isLoading } = useQuery({
    queryKey: ['client-property', search, filter],
    queryFn: async () => {
      let query = supabase
        .from('client_property')
        .select(`
          *,
          customers (first_name, last_name, email, phone),
          jobs (job_id, status),
          bins (name, locations (name, stores (name)))
        `)
        .order('date_received', { ascending: false });

      if (search) {
        query = query.or(`serial_number.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
      }

      if (filter === 'in') {
        query = query.eq('is_in_inventory', true);
      } else if (filter === 'out') {
        query = query.eq('is_in_inventory', false);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  const inCount = properties?.filter(p => p.is_in_inventory).length || 0;
  const outCount = properties?.filter(p => !p.is_in_inventory).length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Client Property</h1>
          <p className="text-muted-foreground">Track customer watches in your inventory</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-colors ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tracked</p>
                <p className="text-2xl font-bold">{properties?.length || 0}</p>
              </div>
              <Watch className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-colors ${filter === 'in' ? 'ring-2 ring-success' : ''}`}
          onClick={() => setFilter('in')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Inventory</p>
                <p className="text-2xl font-bold text-success">{inCount}</p>
              </div>
              <Package className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-colors ${filter === 'out' ? 'ring-2 ring-muted-foreground' : ''}`}
          onClick={() => setFilter('out')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Released</p>
                <p className="text-2xl font-bold text-muted-foreground">{outCount}</p>
              </div>
              <Check className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by serial number, brand, or model..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : properties?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Watch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No client property found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Watch</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Labels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties?.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{property.brand}</p>
                        <p className="text-sm text-muted-foreground">{property.model}</p>
                        {property.reference_number && (
                          <p className="text-xs text-muted-foreground font-mono">Part #: {property.reference_number}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{property.serial_number}</code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {property.customers?.first_name} {property.customers?.last_name}
                        </p>
                        {property.customers?.email && (
                          <p className="text-sm text-muted-foreground">{property.customers.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {property.jobs?.job_id ? (
                        <Badge variant="outline" className="font-mono">{property.jobs.job_id}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {property.bins ? (
                        <div className="text-sm">
                          <p>{property.bins.locations?.stores?.name}</p>
                          <p className="text-muted-foreground">
                            {property.bins.locations?.name} / {property.bins.name}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(property.date_received), 'MMM d, yyyy')}</p>
                        {property.date_released && (
                          <p className="text-muted-foreground">
                            Released: {format(new Date(property.date_released), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={property.is_in_inventory ? 'default' : 'secondary'}>
                        {property.is_in_inventory ? 'In Inventory' : 'Released'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          title="Print Barcode Label"
                          onClick={() => {
                            setSelectedProperty(property);
                            setLabelPrintOpen(true);
                          }}
                        >
                          <Tag className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          title="Print QR Label"
                          onClick={() => {
                            setSelectedProperty(property);
                            setLabelPrintOpen(true);
                          }}
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Label Format Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Label Formats</CardTitle>
          <CardDescription>Print labels for client watches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-5 w-5" />
                <span className="font-medium">Barcode Label</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Format: Model Ref - Serial Number</p>
                <p className="font-mono text-xs bg-muted p-2 rounded">12-1601-374747</p>
                <p className="mt-2">Description: Date Entered / Watch Model / Client Name / Job#</p>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="h-5 w-5" />
                <span className="font-medium">QR Code Label</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Encodes: Customer Info</p>
                <p className="font-mono text-xs bg-muted p-2 rounded">name^^email^^phone</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Label Print Dialog */}
      {selectedProperty && (
        <LabelPrintDialog
          open={labelPrintOpen}
          onOpenChange={setLabelPrintOpen}
          data={{
            type: 'client_property',
            brand: selectedProperty.brand,
            model: selectedProperty.model,
            partNumber: selectedProperty.reference_number,
            serialNumber: selectedProperty.serial_number,
            customerName: `${selectedProperty.customers?.first_name || ''} ${selectedProperty.customers?.last_name || ''}`.trim(),
            customerEmail: selectedProperty.customers?.email,
            customerPhone: selectedProperty.customers?.phone,
            jobId: selectedProperty.jobs?.job_id,
            dateReceived: selectedProperty.date_received,
          }}
        />
      )}
    </div>
  );
}
