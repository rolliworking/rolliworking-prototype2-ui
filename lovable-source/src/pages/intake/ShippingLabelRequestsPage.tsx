import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Package, Upload, Mail, ExternalLink, CheckCircle, Circle, 
  Send, Eye, FileText, Truck, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ShippingLabelRequest {
  id: string;
  estimate_id: string;
  description: string;
  notes: string | null;
  created_at: string;
  estimate: {
    id: string;
    estimate_number: string;
    customer_id: string;
    customer: {
      id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    };
  };
  shipping_label?: {
    id: string;
    tracking_number: string;
    tracking_number_formatted: string | null;
    status: string;
    insurance_amount: number | null;
  } | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export default function ShippingLabelRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'sent' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ShippingLabelRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [insuranceUnits, setInsuranceUnits] = useState('1');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingTracking, setIsExtractingTracking] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch shipping label requests (line items with "Shipping Label Request" description)
  const { data: requests, isLoading } = useQuery({
    queryKey: ['shipping-label-requests', statusFilter, searchQuery],
    queryFn: async () => {
      // Get line items that are shipping label requests
      let query = supabase
        .from('estimate_line_items')
        .select(`
          id,
          estimate_id,
          description,
          notes,
          created_at,
          estimate:estimates!inner(
            id,
            estimate_number,
            customer_id,
            customer:customers!inner(
              id, first_name, last_name, email, phone, address, city, state, zip
            )
          )
        `)
        .eq('description', 'Shipping Label Request')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        // Search in notes or customer info - need to do client-side filtering
      }

      const { data: lineItems, error } = await query;
      if (error) throw error;

      // Fetch associated shipping labels
      const lineItemIds = lineItems?.map(li => li.id) || [];
      const { data: shippingLabels } = await supabase
        .from('shipping_labels')
        .select('*')
        .in('request_line_item_id', lineItemIds);

      // Map shipping labels to requests
      const requestsWithLabels = lineItems?.map(li => ({
        ...li,
        shipping_label: shippingLabels?.find(sl => sl.request_line_item_id === li.id) || null
      })) || [];

      // Filter by status
      if (statusFilter === 'pending') {
        return requestsWithLabels.filter(r => !r.shipping_label || r.shipping_label.status === 'pending');
      } else if (statusFilter === 'sent') {
        return requestsWithLabels.filter(r => r.shipping_label?.status === 'sent');
      }

      return requestsWithLabels;
    },
  });

  // Fetch shipping label email template
  const { data: emailTemplate } = useQuery({
    queryKey: ['email-template', 'shipping_label'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('category', 'shipping')
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as EmailTemplate | null;
    },
  });

  // Extract tracking number from PDF using pdf.js legacy build
  const extractTrackingFromPDF = async (file: File): Promise<string> => {
    try {
      // Use legacy build to avoid top-level await issues
      // @ts-ignore - legacy build path
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
      
      // Set worker from CDN for v3.11.174
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + ' ';
      }
      
      console.log('Extracted PDF text:', fullText.substring(0, 1000));
      
      // Look for FedEx tracking number patterns (12-15 digits)
      // Common patterns: spaces between groups, or continuous digits
      const patterns = [
        /(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/g,  // 16 digits with optional spaces
        /(\d{4}\s?\d{4}\s?\d{4})/g,           // 12 digits with optional spaces  
        /(\d{12,16})/g,                        // Continuous 12-16 digits
      ];
      
      for (const pattern of patterns) {
        const matches = fullText.match(pattern);
        if (matches && matches.length > 0) {
          // Return the first valid tracking number found
          const cleaned = matches[0].replace(/\s/g, '');
          if (cleaned.length >= 12 && cleaned.length <= 16) {
            return cleaned;
          }
        }
      }
      
      return '';
    } catch (error) {
      console.error('Error extracting tracking from PDF:', error);
      return '';
    }
  };

  // Parse tracking number from PDF file name as fallback
  const parseTrackingFromFilename = (filename: string): string => {
    // Try to extract 12-digit tracking from filename
    const match = filename.match(/(\d{12,16})/);
    if (match) {
      return match[1].replace(/\s/g, '');
    }
    return '';
  };

  const formatTrackingNumber = (tracking: string): string => {
    // Format as FedEx style: 8879 0105 0201 2066
    const clean = tracking.replace(/\s/g, '');
    return clean.match(/.{1,4}/g)?.join(' ') || clean;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsExtractingTracking(true);
    
    try {
      // Try to extract tracking from PDF content first
      let extractedTracking = await extractTrackingFromPDF(file);
      
      // Fall back to filename extraction if PDF extraction fails
      if (!extractedTracking) {
        extractedTracking = parseTrackingFromFilename(file.name);
      }
      
      if (extractedTracking) {
        setTrackingNumber(extractedTracking);
        toast.success('Tracking number extracted from PDF');
      } else {
        toast.info('Could not extract tracking number - please enter manually');
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      // Try filename as fallback
      const extractedTracking = parseTrackingFromFilename(file.name);
      if (extractedTracking) {
        setTrackingNumber(extractedTracking);
      }
    } finally {
      setIsExtractingTracking(false);
    }
  };

  const handleOpenReply = (request: ShippingLabelRequest) => {
    setSelectedRequest(request);
    setInsuranceUnits('1');
    setUploadedFile(null);
    setTrackingNumber('');
    
    // Parse insurance from notes if available
    if (request.notes) {
      const insuranceMatch = request.notes.match(/Insurance:\s*\$?([\d,]+)/i);
      if (insuranceMatch) {
        const amount = parseInt(insuranceMatch[1].replace(/,/g, ''));
        setInsuranceUnits(Math.ceil(amount / 1000).toString());
      }
    }
    
    setReplyDialogOpen(true);
  };

  const handlePrepareEmail = () => {
    if (!selectedRequest || !trackingNumber) {
      toast.error('Please enter a tracking number');
      return;
    }

    const customer = selectedRequest.estimate.customer;
    const insuranceAmount = parseInt(insuranceUnits) * 1000;
    
    // Load template and replace variables
    let subject = emailTemplate?.subject || 'Your FedEx Shipping Label - {{estimate_number}}';
    let body = emailTemplate?.body || 'Dear {{customer_first_name}},\n\nYour prepaid FedEx shipping label is attached. Please print this label and affix it to your package.\n\nTracking Number: {{tracking_number}}\nInsurance Value: ${{insurance_value}}\n\nPlease ensure your package is properly secured before shipping.\n\nThank you,\nRolliworks';

    // Replace template variables
    const replacements: Record<string, string> = {
      '{{customer_first_name}}': customer.first_name,
      '{{customer_last_name}}': customer.last_name,
      '{{customer_name}}': `${customer.first_name} ${customer.last_name}`,
      '{{customer_email}}': customer.email || '',
      '{{estimate_number}}': selectedRequest.estimate.estimate_number,
      '{{tracking_number}}': formatTrackingNumber(trackingNumber),
      '{{insurance_amount}}': insuranceAmount.toLocaleString(),
      '{{insurance_value}}': insuranceAmount.toLocaleString(),
    };

    Object.entries(replacements).forEach(([key, value]) => {
      subject = subject.replace(new RegExp(key, 'g'), value);
      body = body.replace(new RegExp(key, 'g'), value);
    });

    setEmailSubject(subject);
    setEmailBody(body);
    setReplyDialogOpen(false);
    setPreviewDialogOpen(true);
  };

  const saveLabelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequest || !trackingNumber) throw new Error('Missing data');

      const customer = selectedRequest.estimate.customer;
      const insuranceAmount = parseInt(insuranceUnits) * 1000;

      // Upload PDF if provided
      let filePath = null;
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split('.').pop();
        const fileName = `${selectedRequest.estimate_id}/${trackingNumber}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(`shipping-labels/${fileName}`, uploadedFile);

        if (uploadError) throw uploadError;
        filePath = `shipping-labels/${fileName}`;
      }

      // Create shipping label record as pending; we'll mark it "sent" after the email succeeds.
      const { data: label, error: labelError } = await supabase
        .from('shipping_labels')
        .insert({
          estimate_id: selectedRequest.estimate_id,
          customer_id: customer.id,
          tracking_number: trackingNumber.replace(/\s/g, ''),
          tracking_number_formatted: formatTrackingNumber(trackingNumber),
          carrier: 'FedEx',
          insurance_amount: insuranceAmount,
          status: 'pending',
          label_file_path: filePath,
          request_line_item_id: selectedRequest.id,
          created_by: user?.id,
        })
        .select()
        .single();

      if (labelError) throw labelError;

      return label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-label-requests'] });
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSendEmail = async () => {
    if (!selectedRequest) return;

    const customer = selectedRequest.estimate.customer;

    if (!customer.email) {
      toast.error('Customer email is not available');
      return;
    }

    if (!uploadedFile) {
      toast.error('Please upload the label PDF so it can be attached');
      return;
    }

    setIsUploading(true);

    try {
      // Convert uploaded file to base64 (without the data: prefix)
      const attachmentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') return reject(new Error('Failed to read file'));
          const base64 = result.split(',')[1] || '';
          if (!base64) return reject(new Error('Failed to encode attachment'));
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(uploadedFile);
      });

      // Save the label record first (pending)
      const label = await saveLabelMutation.mutateAsync();

      // Send the email from the backend so we can include the PDF attachment
      const { error: sendError } = await supabase.functions.invoke('send-shipping-label-email', {
        body: {
          toEmail: customer.email,
          subject: emailSubject,
          body: emailBody,
          attachment: {
            filename: uploadedFile.name || 'shipping-label.pdf',
            contentBase64: attachmentBase64,
            contentType: uploadedFile.type || 'application/pdf',
          },
        },
      });

      if (sendError) throw sendError;

      // Mark label as sent
      await supabase.from('shipping_labels').update({ status: 'sent' }).eq('id', label.id);

      // Add note to customer file with tracking history
      const insuranceAmount = parseInt(insuranceUnits) * 1000;
      const noteContent = `Shipping Label Sent - ${format(new Date(), 'MMM d, yyyy')}\nTracking: ${formatTrackingNumber(trackingNumber)}\nInsurance: $${insuranceAmount.toLocaleString()}\nEstimate: ${selectedRequest.estimate.estimate_number}`;

      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('internal_notes')
        .eq('id', customer.id)
        .single();

      const updatedNotes = existingCustomer?.internal_notes
        ? `${existingCustomer.internal_notes}\n\n---\n${noteContent}`
        : noteContent;

      await supabase.from('customers').update({ internal_notes: updatedNotes }).eq('id', customer.id);

      queryClient.invalidateQueries({ queryKey: ['shipping-label-requests'] });

      toast.success('Email sent successfully with PDF attachment');

      setPreviewDialogOpen(false);
      setSelectedRequest(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send email');
    } finally {
      setIsUploading(false);
    }
  };

  const parseRequestNotes = (notes: string | null) => {
    if (!notes) return {};
    
    const result: Record<string, string> = {};
    const lines = notes.split('\n');
    
    lines.forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        result[key.trim().toLowerCase()] = valueParts.join(':').trim();
      }
    });
    
    return result;
  };

  const markAsSentMutation = useMutation({
    mutationFn: async (labelId: string) => {
      const { error } = await supabase
        .from('shipping_labels')
        .update({ status: 'sent' })
        .eq('id', labelId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-label-requests'] });
      toast.success('Marked as sent');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const markSelectedAsSentMutation = useMutation({
    mutationFn: async (requestIds: string[]) => {
      // Get the requests to process
      const requestsToProcess = requests?.filter(r => requestIds.includes(r.id)) || [];
      
      for (const request of requestsToProcess) {
        const customer = request.estimate.customer;
        
        if (request.shipping_label) {
          // Update existing label to sent
          const { error } = await supabase
            .from('shipping_labels')
            .update({ status: 'sent' })
            .eq('id', request.shipping_label.id);
          if (error) throw error;
        } else {
          // Create a new shipping_label record marked as sent (no tracking - manual override)
          const { error } = await supabase
            .from('shipping_labels')
            .insert({
              estimate_id: request.estimate_id,
              customer_id: customer.id,
              tracking_number: 'MANUAL',
              tracking_number_formatted: 'Manual Entry',
              carrier: 'Manual',
              status: 'sent',
              request_line_item_id: request.id,
              created_by: user?.id,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-label-requests'] });
      setSelectedIds(new Set());
      toast.success('Marked as sent');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const toggleSelectAll = () => {
    if (!requests) return;
    const pendingIds = requests
      .filter(r => !r.shipping_label || r.shipping_label.status === 'pending')
      .map(r => r.id);
    
    if (selectedIds.size === pendingIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Shipping Label Requests</h1>
          <p className="text-muted-foreground">Manage customer shipping label requests</p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'pending' | 'sent' | 'all')} className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="h-10">
            <TabsTrigger value="pending" className="gap-2">
              <Circle className="h-3.5 w-3.5" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <CheckCircle className="h-3.5 w-3.5" />
              Sent
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Package className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tracking #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </Tabs>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {statusFilter === 'pending' && 'Pending Requests'}
              {statusFilter === 'sent' && 'Sent Labels'}
              {statusFilter === 'all' && 'All Requests'}
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                onClick={() => markSelectedAsSentMutation.mutate(Array.from(selectedIds))}
                disabled={markSelectedAsSentMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark {selectedIds.size} as Sent
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shipping label requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        requests?.filter(r => !r.shipping_label || r.shipping_label.status === 'pending').length === selectedIds.size &&
                        selectedIds.size > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((request) => {
                  const parsedNotes = parseRequestNotes(request.notes);
                  const customer = request.estimate.customer;
                  const isPending = !request.shipping_label || request.shipping_label.status === 'pending';
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        {isPending && (
                          <Checkbox
                            checked={selectedIds.has(request.id)}
                            onCheckedChange={() => toggleSelect(request.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => navigate(`/estimates/${request.estimate_id}`)}
                        >
                          {request.estimate.estimate_number}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                          {customer.email && <div className="text-sm text-muted-foreground">{customer.email}</div>}
                          {customer.phone && <div className="text-sm text-muted-foreground">{customer.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {parsedNotes['street'] || parsedNotes['address'] || customer.address || '-'}
                          {(parsedNotes['city'] || customer.city) && (
                            <div className="text-muted-foreground">
                              {parsedNotes['city'] || customer.city}, {parsedNotes['state'] || customer.state} {parsedNotes['zip'] || customer.zip}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {parsedNotes['insurance'] || request.shipping_label?.insurance_amount 
                          ? `$${(request.shipping_label?.insurance_amount ?? parseInt(parsedNotes['insurance'] || '0')).toLocaleString()}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {request.shipping_label?.tracking_number_formatted || '-'}
                      </TableCell>
                      <TableCell>
                        {request.shipping_label?.status === 'sent' ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Sent
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Circle className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!request.shipping_label ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleOpenReply(request)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Reply
                            </Button>
                          ) : request.shipping_label.status === 'pending' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenReply(request)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Reply
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => markAsSentMutation.mutate(request.shipping_label!.id)}
                                disabled={markAsSentMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark Sent
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/estimates/${request.estimate_id}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Send Shipping Label
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Customer:</span>{' '}
                  {selectedRequest.estimate.customer.first_name} {selectedRequest.estimate.customer.last_name}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Email:</span>{' '}
                  {selectedRequest.estimate.customer.email || 'Not provided'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Estimate:</span>{' '}
                  {selectedRequest.estimate.estimate_number}
                </div>
                {selectedRequest.notes && (
                  <div className="text-sm mt-2 pt-2 border-t">
                    <span className="font-medium">Customer Notes:</span>
                    <pre className="text-xs mt-1 whitespace-pre-wrap text-muted-foreground">
                      {selectedRequest.notes}
                    </pre>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Insurance Amount</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={insuranceUnits}
                    onChange={(e) => setInsuranceUnits(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">
                    × $1,000 = <strong>${(parseInt(insuranceUnits || '0') * 1000).toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Upload FedEx Label PDF</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="label-upload"
                    disabled={isExtractingTracking}
                  />
                  <label htmlFor="label-upload" className={`cursor-pointer ${isExtractingTracking ? 'pointer-events-none' : ''}`}>
                    {isExtractingTracking ? (
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Extracting tracking number...</span>
                      </div>
                    ) : uploadedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <FileText className="h-5 w-5" />
                        <span>{uploadedFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span>Click to upload PDF label</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tracking Number</Label>
                <Input
                  placeholder="Enter 12-16 digit tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.replace(/[^\d\s]/g, ''))}
                  disabled={isExtractingTracking}
                />
                {trackingNumber && (
                  <p className="text-sm text-muted-foreground">
                    Formatted: {formatTrackingNumber(trackingNumber)}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePrepareEmail} disabled={!trackingNumber}>
              <Eye className="h-4 w-4 mr-2" />
              Preview Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Preview
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input value={selectedRequest?.estimate.customer.email || ''} readOnly />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Note: To edit the default template, go to Setup → Email Templates and modify the "Shipping Label" template.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Back
            </Button>
            <Button onClick={handleSendEmail} disabled={isUploading}>
              <Send className="h-4 w-4 mr-2" />
              {isUploading ? 'Saving...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
