import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Watch, Save, ArrowLeft, User, FileText, Printer, History, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CustomerSelector } from '@/components/customers/CustomerSelector';
import { IntakeLabelWizard } from '@/components/labels/IntakeLabelWizard';
import { Customer } from '@/types/database';
import { useSendToRolliworking } from '@/hooks/useRolliworkingSync';
interface PreviousWatch {
  brand: string;
  model: string | null;
  reference_number: string | null;
}

export default function ClientWatchEntryPage() {
  const { permissions } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Permission check
  if (!permissions.canAccessIntake) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5" />
              <p>You don't have permission to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    estimateId: '',
    estimateNumber: '',
    brand: '',
    model: '',
    partNumber: '',
    notes: '',
  });

  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [savedPropertyId, setSavedPropertyId] = useState<string | null>(null);

  // Pre-fill from URL params (coming from Inspections page)
  const estimateParam = searchParams.get('estimate');

  // Fetch estimate data if estimate number is provided
  const { data: estimateData } = useQuery({
    queryKey: ['estimate-for-entry', estimateParam],
    queryFn: async () => {
      if (!estimateParam) return null;
      
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          customer_id,
          customer:customers(id, first_name, last_name, company_name, email, phone),
          watch:watches(brand, model, reference_number, serial_number)
        `)
        .eq('estimate_number', estimateParam)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!estimateParam,
  });

  // Fetch previous watches for selected customer
  const { data: previousWatches = [] } = useQuery({
    queryKey: ['customer-previous-watches', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      // Get unique watches from client_property
      const { data, error } = await supabase
        .from('client_property')
        .select('brand, model, reference_number')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Dedupe by brand + model + reference_number
      const seen = new Set<string>();
      const unique: PreviousWatch[] = [];
      for (const w of data || []) {
        const key = `${w.brand}|${w.model || ''}|${w.reference_number || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(w);
        }
      }
      return unique;
    },
    enabled: !!selectedCustomer?.id,
  });

  // Pre-fill form when estimate data loads
  useEffect(() => {
    if (estimateData) {
      const customer = estimateData.customer as any;
      const watch = estimateData.watch as any;
      
      if (customer) {
        setSelectedCustomer({
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          company_name: customer.company_name,
          email: customer.email,
          phone: customer.phone,
        } as Customer);
      }
      
      setFormData({
        estimateId: estimateData.id,
        estimateNumber: estimateData.estimate_number,
        brand: watch?.brand || '',
        model: watch?.model || '',
        partNumber: watch?.reference_number || '',
        notes: '',
      });
    }
  }, [estimateData]);

  // Handle selecting a previous watch
  const handleSelectPreviousWatch = (watch: PreviousWatch) => {
    setFormData(prev => ({
      ...prev,
      brand: watch.brand,
      model: watch.model || '',
      partNumber: watch.reference_number || '',
    }));
  };

  // Rolliworking sync mutation
  const rolliworkingSync = useSendToRolliworking();

  // Save client property mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error('Customer required');
      
      const { data, error } = await supabase
        .from('client_property')
        .insert({
          customer_id: selectedCustomer.id,
          estimate_id: formData.estimateId || null,
          brand: formData.brand,
          model: formData.model || null,
          reference_number: formData.partNumber || null,
          serial_number: '',
          notes: formData.notes || null,
          date_received: new Date().toISOString(),
          is_in_inventory: true,
          custody_status: 'received',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-property'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['customer-previous-watches', selectedCustomer?.id] });
      setSavedPropertyId(data.id);
      toast({
        title: 'Watch received',
        description: `${formData.brand} ${formData.model || ''} has been logged into client property.`,
      });

      // Send intake to Rolliworking (fire and forget)
      rolliworkingSync.mutate({
        fullName: getCustomerDisplayName(),
        email: selectedCustomer?.email || '',
        phone: selectedCustomer?.phone || '',
        partNumber: formData.partNumber,
        brand: formData.brand,
        model: formData.model,
        estimateNumber: formData.estimateNumber,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer', variant: 'destructive' });
      return;
    }
    if (!formData.brand) {
      toast({ title: 'Error', description: 'Brand is required', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const handleSaveAndPrint = () => {
    if (!selectedCustomer || !formData.brand) {
      handleSave();
      return;
    }
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        setLabelDialogOpen(true);
      },
    });
  };

  const getCustomerDisplayName = () => {
    if (!selectedCustomer) return '';
    return selectedCustomer.company_name || 
      `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Watch className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold">Receive Client Watch</h1>
          <p className="text-sm text-muted-foreground">
            Log customer property into custody
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Customer *</Label>
            <CustomerSelector
              selectedCustomer={selectedCustomer}
              onCustomerSelect={setSelectedCustomer}
            />
          </div>
          
          {selectedCustomer && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span>{' '}
                {selectedCustomer.email || '—'}
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>{' '}
                {selectedCustomer.phone || '—'}
              </div>
            </div>
          )}

          {formData.estimateNumber && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-2 rounded">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Linked to Estimate: <strong>{formData.estimateNumber}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Watch className="h-4 w-4" />
            Watch Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Previous watches quick select */}
          {previousWatches.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Previous Watches
              </Label>
              <div className="flex flex-wrap gap-2">
                {previousWatches.map((watch, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => handleSelectPreviousWatch(watch)}
                  >
                    {watch.brand} {watch.model || ''} {watch.reference_number ? `(${watch.reference_number})` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Brand *</Label>
              <Input
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g., Rolex, Omega"
              />
            </div>
            <div>
              <Label>Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Submariner, Speedmaster"
              />
            </div>
          </div>

          <div>
            <Label>Part #</Label>
            <Input
              value={formData.partNumber}
              onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
              placeholder="e.g., 126610LN"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Condition notes, accessories included, etc."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveAndPrint}
          disabled={saveMutation.isPending}
        >
          <Printer className="h-4 w-4 mr-2" />
          Save & Print Label
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      {/* Success state */}
      {savedPropertyId && !labelDialogOpen && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-800">
              Watch successfully logged. You can view it in{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-green-800 underline"
                onClick={() => navigate('/inventory/client-property')}
              >
                Client Property
              </Button>
              .
            </p>
          </CardContent>
        </Card>
      )}

      {/* Intake Label Wizard */}
      <IntakeLabelWizard
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        customerData={{
          fullName: getCustomerDisplayName(),
          lastName: selectedCustomer?.last_name || '',
          email: selectedCustomer?.email || '',
          phone: selectedCustomer?.phone || '',
          brand: formData.brand,
          model: formData.model,
          estimateNumber: formData.estimateNumber,
          partNumber: formData.partNumber,
        }}
      />
    </div>
  );
}
