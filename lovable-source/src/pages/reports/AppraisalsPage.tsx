import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import JsBarcode from 'jsbarcode';
import { supabase } from '@/integrations/supabase/client';
import { useAppraisals, useCreateAppraisal, useUpdateAppraisal, useDeleteAppraisal, type AppraisalFormData, type Appraisal } from '@/hooks/useAppraisals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalcInput } from '@/components/ui/calc-input';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Printer,
  Mail,
  Trash2,
  Edit,
  FileText,
  Upload,
  Loader2,
  X,
  Eye,
} from 'lucide-react';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Watch {
  id: string;
  brand: string;
  model: string | null;
  serial_number: string | null;
  reference_number: string | null;
  movement_type: string | null;
  case_material: string | null;
  band_material: string | null;
}

export default function AppraisalsPage() {
  const queryClient = useQueryClient();
  const { data: appraisals = [], isLoading } = useAppraisals();
  const createAppraisal = useCreateAppraisal();
  const updateAppraisal = useUpdateAppraisal();
  const deleteAppraisal = useDeleteAppraisal();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppraisal, setEditingAppraisal] = useState<Appraisal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Watch selection
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null);
  const [showWatchSelector, setShowWatchSelector] = useState(false);
  
  // Photo upload
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState<AppraisalFormData>({
    customer_id: '',
    appraisal_date: format(new Date(), 'yyyy-MM-dd'),
    maker: '',
    model_description: '',
    movement: '',
    material: '',
    dial_features: '',
    hands: '',
    bracelet_strap: '',
    crystal: '',
    condition: '',
    style_number: '',
    item_description: '',
    replacement_cost: null,
    appraiser_name: '',
    appraiser_title: '',
    photo_url: null,
    notes: '',
  });

  // Search customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: async () => {
      if (!customerSearch || customerSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, address, city, state, zip')
        .or(`first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,company_name.ilike.%${customerSearch}%`)
        .limit(10);
      if (error) throw error;
      return data as Customer[];
    },
    enabled: customerSearch.length >= 2,
  });

  // Fetch watches for selected customer
  const { data: customerWatches = [] } = useQuery({
    queryKey: ['customer-watches', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const { data, error } = await supabase
        .from('watches')
        .select('id, brand, model, serial_number, reference_number, movement_type, case_material, band_material')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Watch[];
    },
    enabled: !!selectedCustomer?.id,
  });

  const resetForm = () => {
    setFormData({
      customer_id: '',
      appraisal_date: format(new Date(), 'yyyy-MM-dd'),
      maker: '',
      model_description: '',
      movement: '',
      material: '',
      dial_features: '',
      hands: '',
      bracelet_strap: '',
      crystal: '',
      condition: '',
      style_number: '',
      item_description: '',
      replacement_cost: null,
      appraiser_name: '',
      appraiser_title: '',
      photo_url: null,
      notes: '',
    });
    setSelectedCustomer(null);
    setSelectedWatch(null);
    setCustomerSearch('');
    setPhotoPreview(null);
    setEditingAppraisal(null);
  };

  const handleOpenDialog = (appraisal?: Appraisal) => {
    if (appraisal) {
      setEditingAppraisal(appraisal);
      setFormData({
        customer_id: appraisal.customer_id,
        watch_id: appraisal.watch_id,
        appraisal_date: appraisal.appraisal_date,
        maker: appraisal.maker || '',
        model_description: appraisal.model_description || '',
        movement: appraisal.movement || '',
        material: appraisal.material || '',
        dial_features: appraisal.dial_features || '',
        hands: appraisal.hands || '',
        bracelet_strap: appraisal.bracelet_strap || '',
        crystal: appraisal.crystal || '',
        condition: appraisal.condition || '',
        style_number: appraisal.style_number || '',
        item_description: appraisal.item_description || '',
        replacement_cost: appraisal.replacement_cost,
        appraiser_name: appraisal.appraiser_name || '',
        appraiser_title: appraisal.appraiser_title || '',
        photo_url: appraisal.photo_url,
        notes: appraisal.notes || '',
      });
      setSelectedCustomer(appraisal.customer || null);
      setSelectedWatch(appraisal.watch || null);
      setPhotoPreview(appraisal.photo_url);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({ ...formData, customer_id: customer.id });
    setShowCustomerDropdown(false);
    setCustomerSearch(`${customer.first_name} ${customer.last_name}`);
    setSelectedWatch(null);
    // Show watch selector if customer has watches
  };

  const handleSelectWatch = (watch: Watch) => {
    setSelectedWatch(watch);
    setFormData({
      ...formData,
      watch_id: watch.id,
      maker: watch.brand,
      model_description: watch.model || '',
      movement: watch.movement_type || '',
      material: watch.case_material || '',
      bracelet_strap: watch.band_material || '',
      style_number: watch.reference_number || '',
    });
    setShowWatchSelector(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileName = `appraisal-${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(`appraisals/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(`appraisals/${fileName}`);

      setPhotoPreview(urlData.publicUrl);
      setFormData({ ...formData, photo_url: urlData.publicUrl });
      toast.success('Photo uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (editingAppraisal) {
      updateAppraisal.mutate({
        id: editingAppraisal.id,
        data: formData,
      }, {
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
        },
      });
    } else {
      createAppraisal.mutate(formData, {
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
        },
      });
    }
  };

  const handlePrint = (appraisal: Appraisal) => {
    generateAppraisalPDF(appraisal);
  };

  const handleSendEmail = async (appraisal: Appraisal) => {
    const pdfHtml = generateAppraisalPDFContent(appraisal);
    
    // Create mailto link with subject
    const email = appraisal.customer?.email || '';
    const subject = encodeURIComponent(`Appraisal Report - ${appraisal.appraisal_number}`);
    const body = encodeURIComponent(`Dear ${appraisal.customer?.first_name},\n\nPlease find attached your appraisal report for your ${appraisal.maker} ${appraisal.model_description}.\n\nAppraisal Number: ${appraisal.appraisal_number}\nDate: ${format(new Date(appraisal.appraisal_date), 'MMMM d, yyyy')}\nEstimated Replacement Cost: $${appraisal.replacement_cost?.toLocaleString() || '0'}\n\nBest regards,\n${appraisal.appraiser_name || 'Rolliworks'}`);
    
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    toast.info('Email client opened. The PDF can be printed and attached manually.');
  };

  const generateAppraisalPDFContent = (appraisal: Appraisal): string => {
    // Get logo URL
    const logoUrl = supabase.storage.from('assets').getPublicUrl('rw-logo.jpg').data.publicUrl;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Appraisal Report - ${appraisal.appraisal_number}</title>
        <style>
          @page { size: letter; margin: 0.5in; }
          body { 
            font-family: 'Times New Roman', Georgia, serif; 
            font-size: 11pt; 
            line-height: 1.4;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #4a5568;
          }
          .header img {
            max-height: 60px;
            margin-bottom: 5px;
          }
          .header-bar {
            height: 4px;
            background: linear-gradient(90deg, #4a5568 0%, #718096 50%, #4a5568 100%);
            margin: 10px 0;
          }
          .date-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
          }
          .date { font-size: 10pt; color: #4a5568; }
          .title { 
            font-size: 16pt; 
            font-weight: bold;
            text-align: center;
            flex: 1;
          }
          .section-title {
            font-weight: bold;
            font-style: italic;
            margin: 15px 0 8px 0;
          }
          .description-box {
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            margin-bottom: 20px;
            background: #fafafa;
          }
          .content-grid {
            display: flex;
            gap: 25px;
          }
          .attributes {
            flex: 1;
          }
          .attribute-row {
            display: flex;
            border-bottom: 1px solid #e2e8f0;
            padding: 4px 0;
          }
          .attribute-label {
            width: 100px;
            font-weight: bold;
            font-size: 10pt;
          }
          .attribute-value {
            flex: 1;
            font-size: 10pt;
          }
          .photo-container {
            width: 200px;
            text-align: center;
          }
          .photo-container img {
            max-width: 100%;
            max-height: 200px;
            border: 1px solid #ccc;
          }
          .valuation-box {
            border: 2px solid #4a5568;
            margin-top: 25px;
            display: flex;
          }
          .valuation-label {
            background: #f7fafc;
            padding: 12px 15px;
            border-right: 2px solid #4a5568;
            font-size: 10pt;
          }
          .valuation-amount {
            padding: 12px 15px;
            font-size: 14pt;
            font-weight: bold;
            text-align: right;
            flex: 1;
          }
          .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .customer-address {
            background: #f7fafc;
            padding: 10px 12px;
            font-size: 9pt;
            line-height: 1.5;
          }
          .appraiser-info {
            text-align: right;
            font-size: 9pt;
          }
          .signature-line {
            font-style: italic;
            margin-bottom: 5px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoUrl}" alt="Company Logo" onerror="this.style.display='none'" />
          <div class="header-bar"></div>
        </div>

        <div class="date-title-row">
          <div class="date">${format(new Date(appraisal.appraisal_date), 'MMMM d, yyyy')}</div>
          <div class="title">Appraisal Report for Insurance</div>
          <div class="date" style="visibility: hidden;">${format(new Date(appraisal.appraisal_date), 'MMMM d, yyyy')}</div>
        </div>

        <div class="section-title">Item description:</div>
        <div class="description-box">
          ${appraisal.item_description || `${appraisal.maker || ''} wristwatch. ${appraisal.model_description || ''}. The watch attributes are listed below.`}
        </div>

        <div class="content-grid">
          <div class="attributes">
            <div class="attribute-row">
              <span class="attribute-label">Maker:</span>
              <span class="attribute-value">${appraisal.maker || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Model:</span>
              <span class="attribute-value">${appraisal.model_description || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Movement:</span>
              <span class="attribute-value">${appraisal.movement || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Material:</span>
              <span class="attribute-value">${appraisal.material || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Dial/features:</span>
              <span class="attribute-value">${appraisal.dial_features || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Hands:</span>
              <span class="attribute-value">${appraisal.hands || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Bracelet/strap:</span>
              <span class="attribute-value">${appraisal.bracelet_strap || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Crystal:</span>
              <span class="attribute-value">${appraisal.crystal || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Condition:</span>
              <span class="attribute-value">${appraisal.condition || ''}</span>
            </div>
            <div class="attribute-row">
              <span class="attribute-label">Style No.</span>
              <span class="attribute-value">${appraisal.style_number || ''}</span>
            </div>
          </div>
          ${appraisal.photo_url ? `
          <div class="photo-container">
            <img src="${appraisal.photo_url}" alt="Watch Photo" />
          </div>
          ` : ''}
        </div>

        <div class="valuation-box">
          <div class="valuation-label">
            Total estimated retail<br/>replacement cost:
          </div>
          <div class="valuation-amount">
            $${appraisal.replacement_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
          </div>
        </div>

        <div class="footer">
          <div class="customer-address">
            ${appraisal.customer?.first_name || ''} ${appraisal.customer?.last_name || ''}<br/>
            ${appraisal.customer?.address || ''}<br/>
            ${appraisal.customer?.city || ''}${appraisal.customer?.state ? `, ${appraisal.customer.state}` : ''} ${appraisal.customer?.zip || ''}
          </div>
          <div class="appraiser-info">
            <div class="signature-line">${appraisal.appraiser_name || ''}</div>
            <div>${appraisal.appraiser_title || ''}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const generateAppraisalPDF = (appraisal: Appraisal) => {
    const htmlContent = generateAppraisalPDFContent(appraisal);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups for printing');
      return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Add print button
    const printButton = printWindow.document.createElement('button');
    printButton.innerText = 'Print / Save as PDF';
    printButton.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; z-index: 1000;';
    printButton.onclick = () => {
      printButton.style.display = 'none';
      printWindow.print();
      printButton.style.display = 'block';
    };
    printWindow.document.body.appendChild(printButton);
  };

  const filteredAppraisals = appraisals.filter(a => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      a.appraisal_number.toLowerCase().includes(search) ||
      a.customer?.first_name?.toLowerCase().includes(search) ||
      a.customer?.last_name?.toLowerCase().includes(search) ||
      a.maker?.toLowerCase().includes(search) ||
      a.model_description?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-bold">Appraisals</h1>
          <p className="text-muted-foreground">Create and manage watch appraisal reports</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          New Appraisal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search appraisals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredAppraisals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No appraisals found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appraisal #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Watch</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppraisals.map((appraisal) => (
                  <TableRow key={appraisal.id}>
                    <TableCell className="font-medium">{appraisal.appraisal_number}</TableCell>
                    <TableCell>{format(new Date(appraisal.appraisal_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {appraisal.customer?.first_name} {appraisal.customer?.last_name}
                    </TableCell>
                    <TableCell>
                      {appraisal.maker} {appraisal.model_description}
                    </TableCell>
                    <TableCell>
                      ${appraisal.replacement_cost?.toLocaleString() || '0'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={appraisal.status === 'sent' ? 'default' : 'secondary'}>
                        {appraisal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(appraisal)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrint(appraisal)}
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendEmail(appraisal)}
                          title="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAppraisal.mutate(appraisal.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAppraisal ? 'Edit Appraisal' : 'New Appraisal'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Search */}
            <div className="space-y-2">
              <Label>Customer *</Label>
              <div className="relative">
                <Input
                  placeholder="Search customer by name..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                {showCustomerDropdown && customers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                        {customer.email && (
                          <div className="text-muted-foreground text-xs">{customer.email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedCustomer.first_name} {selectedCustomer.last_name}
                  {selectedCustomer.address && ` - ${selectedCustomer.address}`}
                </div>
              )}
            </div>

            {/* Watch Selection */}
            {selectedCustomer && customerWatches.length > 0 && (
              <div className="space-y-2">
                <Label>Select Watch</Label>
                <Select
                  value={selectedWatch?.id || ''}
                  onValueChange={(value) => {
                    const watch = customerWatches.find(w => w.id === value);
                    if (watch) handleSelectWatch(watch);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a watch to load details..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customerWatches.map((watch) => (
                      <SelectItem key={watch.id} value={watch.id}>
                        {watch.brand} {watch.model} {watch.serial_number ? `(S/N: ${watch.serial_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Appraisal Date */}
            <div className="space-y-2">
              <Label>Appraisal Date</Label>
              <Input
                type="date"
                value={formData.appraisal_date}
                onChange={(e) => setFormData({ ...formData, appraisal_date: e.target.value })}
              />
            </div>

            {/* Item Description */}
            <div className="space-y-2">
              <Label>Item Description</Label>
              <Textarea
                placeholder="One gentleman's Rolex two-tone Oyster Perpetual certified chronometer..."
                value={formData.item_description || ''}
                onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Watch Attributes Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maker</Label>
                <Input
                  value={formData.maker || ''}
                  onChange={(e) => setFormData({ ...formData, maker: e.target.value })}
                  placeholder="Rolex Watch Company"
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={formData.model_description || ''}
                  onChange={(e) => setFormData({ ...formData, model_description: e.target.value })}
                  placeholder="Man's Rolex two-tone Oyster perpetual date"
                />
              </div>
              <div className="space-y-2">
                <Label>Movement</Label>
                <Input
                  value={formData.movement || ''}
                  onChange={(e) => setFormData({ ...formData, movement: e.target.value })}
                  placeholder="Rolex Certified Swiss Chronometer movement"
                />
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Input
                  value={formData.material || ''}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  placeholder="Stainless steel and 18 karat yellow gold"
                />
              </div>
              <div className="space-y-2">
                <Label>Dial/Features</Label>
                <Input
                  value={formData.dial_features || ''}
                  onChange={(e) => setFormData({ ...formData, dial_features: e.target.value })}
                  placeholder="Gold dial"
                />
              </div>
              <div className="space-y-2">
                <Label>Hands</Label>
                <Input
                  value={formData.hands || ''}
                  onChange={(e) => setFormData({ ...formData, hands: e.target.value })}
                  placeholder="Hour, minute, and second hands"
                />
              </div>
              <div className="space-y-2">
                <Label>Bracelet/Strap</Label>
                <Input
                  value={formData.bracelet_strap || ''}
                  onChange={(e) => setFormData({ ...formData, bracelet_strap: e.target.value })}
                  placeholder="Two-tone Jubilee bracelet"
                />
              </div>
              <div className="space-y-2">
                <Label>Crystal</Label>
                <Input
                  value={formData.crystal || ''}
                  onChange={(e) => setFormData({ ...formData, crystal: e.target.value })}
                  placeholder="Sapphire crystal"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Input
                  value={formData.condition || ''}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder="Excellent; As new"
                />
              </div>
              <div className="space-y-2">
                <Label>Style No.</Label>
                <Input
                  value={formData.style_number || ''}
                  onChange={(e) => setFormData({ ...formData, style_number: e.target.value })}
                  placeholder="116333"
                />
              </div>
            </div>

            {/* Replacement Cost */}
            <div className="space-y-2">
              <Label>Total Estimated Retail Replacement Cost ($)</Label>
              <CalcInput
                value={formData.replacement_cost ?? undefined}
                onChange={(val) => setFormData({ ...formData, replacement_cost: val ?? null })}
                placeholder="10900.00"
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex items-start gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </>
                  )}
                </Button>
                {photoPreview && (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-24 w-auto border rounded"
                    />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      onClick={() => {
                        setPhotoPreview(null);
                        setFormData({ ...formData, photo_url: null });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Appraiser Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Appraiser Name</Label>
                <Input
                  value={formData.appraiser_name || ''}
                  onChange={(e) => setFormData({ ...formData, appraiser_name: e.target.value })}
                  placeholder="James Price Pomeroy GG"
                />
              </div>
              <div className="space-y-2">
                <Label>Appraiser Title</Label>
                <Input
                  value={formData.appraiser_title || ''}
                  onChange={(e) => setFormData({ ...formData, appraiser_title: e.target.value })}
                  placeholder="Graduate Gemologist (GIA)"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes (not shown on appraisal)"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAppraisal.isPending || updateAppraisal.isPending}
              >
                {(createAppraisal.isPending || updateAppraisal.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingAppraisal ? 'Update Appraisal' : 'Create Appraisal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
