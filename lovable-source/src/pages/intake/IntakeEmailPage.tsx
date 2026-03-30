import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScanBarcode, Search, Mail, Send, User, Watch, Package, Save, Check, Eye, FileEdit } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { RELATED_PART_CATEGORIES } from '@/lib/constants';

const INTAKE_DEFAULT_TEMPLATE_KEY = 'rolliworks-intake-default-template';

interface EstimateResult {
  id: string;
  estimate_number: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    company_name: string | null;
  } | null;
  watch: {
    brand: string;
    model: string | null;
  } | null;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  category: string | null;
}

const TEMPLATE_CATEGORIES = [
  { value: 'intake', label: 'Intake' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'status_update', label: 'Status Update' },
  { value: 'completion', label: 'Completion' },
  { value: 'general', label: 'General' },
];

export default function IntakeEmailPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateResult | null>(null);
  const [receivedItems, setReceivedItems] = useState<string[]>([]);
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewBody, setPreviewBody] = useState('');
  
  // Store original template content (with tokens) for saving back to DB
  const [originalTemplateSubject, setOriginalTemplateSubject] = useState<string>('');
  const [originalTemplateBody, setOriginalTemplateBody] = useState<string>('');

  // Load default template from localStorage
  useEffect(() => {
    const savedDefault = localStorage.getItem(INTAKE_DEFAULT_TEMPLATE_KEY);
    if (savedDefault) {
      setDefaultTemplateId(savedDefault);
    }
  }, []);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search for estimates
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['intake-estimate-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      
      const query = searchQuery.trim();
      
      // First search by estimate number
      const { data: byEstimate, error: estError } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          customer:customers(id, first_name, last_name, email, company_name),
          watch:watches(brand, model)
        `)
        .ilike('estimate_number', `%${query}%`)
        .limit(10);
      
      if (estError) throw estError;
      
      // Also search by customer name
      const { data: byCustomer, error: custError } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          customer:customers!inner(id, first_name, last_name, email, company_name),
          watch:watches(brand, model)
        `)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,company_name.ilike.%${query}%`, { referencedTable: 'customers' })
        .limit(10);
      
      // Combine results, removing duplicates
      const allResults = [...(byEstimate || [])];
      const existingIds = new Set(allResults.map(r => r.id));
      
      (byCustomer || []).forEach(r => {
        if (!existingIds.has(r.id)) {
          allResults.push(r);
        }
      });
      
      return allResults.slice(0, 10) as EstimateResult[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch all email templates
  const { data: templates } = useQuery({
    queryKey: ['all-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      
      if (error) throw error;
      return (data || []) as MessageTemplate[];
    },
  });

  // Auto-load estimate from URL param
  const estimateParam = searchParams.get('estimate');
  const { data: preloadedEstimate } = useQuery({
    queryKey: ['intake-preload-estimate', estimateParam],
    queryFn: async () => {
      if (!estimateParam) return null;
      
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          customer:customers(id, first_name, last_name, email, company_name),
          watch:watches(brand, model)
        `)
        .eq('estimate_number', estimateParam)
        .maybeSingle();
      
      if (error) throw error;
      return data as EstimateResult | null;
    },
    enabled: !!estimateParam && !selectedEstimate,
  });

  // When preloaded estimate is fetched, auto-select it
  const preloadHandled = useRef(false);
  useEffect(() => {
    if (preloadedEstimate && !selectedEstimate && templates && !preloadHandled.current) {
      preloadHandled.current = true;
      
      // Inline selection logic to avoid function hoisting issues
      const estimate = preloadedEstimate;
      setSelectedEstimate(estimate);
      setSearchQuery('');
      setToEmail(estimate.customer?.email || '');
      
      // Find default template or first intake template
      const templateToUse = defaultTemplateId 
        ? templates.find(t => t.id === defaultTemplateId)
        : templates.find(t => t.category === 'intake');
      
      if (templateToUse && estimate.customer) {
        // Store original template content (with tokens) for later saving
        setOriginalTemplateSubject(templateToUse.subject || '');
        setOriginalTemplateBody(templateToUse.body);
        
        const firstName = estimate.customer.first_name || '';
        
        let processedSubject = templateToUse.subject || 'Your items have arrived safely';
        let processedBody = templateToUse.body;
        
        const replacements: Record<string, string> = {
          '{{first_name}}': firstName,
          '{{full_name}}': `${estimate.customer.first_name} ${estimate.customer.last_name}`.trim(),
          '{{customer_name}}': firstName,
          '{{estimate_number}}': estimate.estimate_number,
          '{{brand}}': estimate.watch?.brand || '',
          '{{model}}': estimate.watch?.model || '',
        };
        
        Object.entries(replacements).forEach(([key, value]) => {
          processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
          processedBody = processedBody.replace(new RegExp(key, 'g'), value);
        });
        
        setSelectedTemplateId(templateToUse.id);
        setSubject(processedSubject);
        setBody(processedBody);
      } else {
        setSelectedTemplateId('');
        setOriginalTemplateSubject('');
        setOriginalTemplateBody('');
        setSubject(`Your items have arrived safely - ${estimate.estimate_number}`);
        setBody(`Dear ${estimate.customer?.first_name || 'Valued Customer'},\n\nWe received: \n\nThank you for trusting us with your timepiece.\n\nBest regards,\nThe Rolliworks Team`);
      }
      
      // Clear the URL param after loading
      setSearchParams({}, { replace: true });
    }
  }, [preloadedEstimate, selectedEstimate, templates, defaultTemplateId, setSearchParams]);

  const groupedTemplates = templates?.reduce((acc, template) => {
    const category = template.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, MessageTemplate[]>);

  // Fetch line items when estimate is selected
  const { data: lineItems } = useQuery({
    queryKey: ['intake-line-items', selectedEstimate?.id],
    queryFn: async () => {
      if (!selectedEstimate?.id) return [];
      
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('id, description, part_id, parts:part_id(category)')
        .eq('estimate_id', selectedEstimate.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEstimate?.id,
  });

  // Extract received items from line items
  useEffect(() => {
    if (!lineItems || lineItems.length === 0) {
      setReceivedItems([]);
      return;
    }

    const categories = new Set<string>();
    
    lineItems.forEach((item: any) => {
      // Check part category first
      const partCategory = item.parts?.category?.toLowerCase();
      if (partCategory) {
        const match = RELATED_PART_CATEGORIES.find(c => c.value === partCategory);
        if (match) {
          categories.add(match.label.toLowerCase());
        }
      }
      
      // Fallback to description keywords
      const desc = item.description?.toLowerCase() || '';
      if (!partCategory) {
        if (desc.includes('watch') && !desc.includes('bracelet') && !desc.includes('band')) {
          categories.add('watch');
        } else if (desc.includes('bracelet') || desc.includes('band') || desc.includes('jubilee')) {
          categories.add('bracelet');
        } else if (desc.includes('clasp')) {
          categories.add('clasp');
        } else if (desc.includes('bezel')) {
          categories.add('bezel');
        }
      }
    });

    setReceivedItems(Array.from(categories));
  }, [lineItems]);

  // Apply template with variable substitution
  const applyTemplate = (template: MessageTemplate) => {
    if (!selectedEstimate) return;
    
    // Store original template content (with tokens) for later saving
    setOriginalTemplateSubject(template.subject || '');
    setOriginalTemplateBody(template.body);
    
    const firstName = selectedEstimate.customer?.first_name || '';
    
    let processedSubject = template.subject || 'Your items have arrived safely';
    let processedBody = template.body;
    
    const replacements: Record<string, string> = {
      '{{first_name}}': firstName,
      '{{full_name}}': `${selectedEstimate.customer?.first_name || ''} ${selectedEstimate.customer?.last_name || ''}`.trim(),
      '{{customer_name}}': firstName,
      '{{estimate_number}}': selectedEstimate.estimate_number,
      '{{brand}}': selectedEstimate.watch?.brand || '',
      '{{model}}': selectedEstimate.watch?.model || '',
    };
    
    Object.entries(replacements).forEach(([key, value]) => {
      processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
      processedBody = processedBody.replace(new RegExp(key, 'g'), value);
    });
    
    setSelectedTemplateId(template.id);
    setSubject(processedSubject);
    setBody(processedBody);
  };

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      applyTemplate(template);
    }
  };

  // Save as default template
  const handleSaveAsDefault = () => {
    if (!selectedTemplateId) {
      toast({
        title: 'No template selected',
        description: 'Please select a template first.',
        variant: 'destructive',
      });
      return;
    }
    
    localStorage.setItem(INTAKE_DEFAULT_TEMPLATE_KEY, selectedTemplateId);
    setDefaultTemplateId(selectedTemplateId);
    toast({
      title: 'Default saved',
      description: 'This template will be used by default for intake emails.',
    });
  };

  // Save template edits mutation - saves the ORIGINAL template (with tokens), not the processed version
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId) throw new Error('No template selected');
      if (!originalTemplateSubject && !originalTemplateBody) {
        throw new Error('No original template content to save');
      }
      
      const { error } = await supabase
        .from('message_templates')
        .update({ 
          subject: originalTemplateSubject, 
          body: originalTemplateBody,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-email-templates'] });
      toast({
        title: 'Template saved',
        description: 'Your edits have been saved to the template.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save',
        description: error.message || 'Could not save template edits.',
        variant: 'destructive',
      });
    },
  });

  // Select estimate and populate email fields
  const handleSelectEstimate = (estimate: EstimateResult) => {
    setSelectedEstimate(estimate);
    setSearchQuery('');
    setToEmail(estimate.customer?.email || '');
    
    // Find default template or first intake template
    const templateToUse = defaultTemplateId 
      ? templates?.find(t => t.id === defaultTemplateId)
      : templates?.find(t => t.category === 'intake');
    
    if (templateToUse && estimate.customer) {
      // Store original template content (with tokens) for later saving
      setOriginalTemplateSubject(templateToUse.subject || '');
      setOriginalTemplateBody(templateToUse.body);
      
      const firstName = estimate.customer.first_name || '';
      
      let processedSubject = templateToUse.subject || 'Your items have arrived safely';
      let processedBody = templateToUse.body;
      
      const replacements: Record<string, string> = {
        '{{first_name}}': firstName,
        '{{full_name}}': `${estimate.customer.first_name} ${estimate.customer.last_name}`.trim(),
        '{{customer_name}}': firstName,
        '{{estimate_number}}': estimate.estimate_number,
        '{{brand}}': estimate.watch?.brand || '',
        '{{model}}': estimate.watch?.model || '',
      };
      
      Object.entries(replacements).forEach(([key, value]) => {
        processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
        processedBody = processedBody.replace(new RegExp(key, 'g'), value);
      });
      
      setSelectedTemplateId(templateToUse.id);
      setSubject(processedSubject);
      setBody(processedBody);
    } else {
      // Default subject
      setSelectedTemplateId('');
      setOriginalTemplateSubject('');
      setOriginalTemplateBody('');
      setSubject(`Your items have arrived safely - ${estimate.estimate_number}`);
      setBody(`Dear ${estimate.customer?.first_name || 'Valued Customer'},\n\nWe received: \n\nThank you for trusting us with your timepiece.\n\nBest regards,\nThe Rolliworks Team`);
    }
  };

  // Build received items text
  const getReceivedItemsText = useCallback((): string => {
    if (receivedItems.length === 0) return 'your item';
    if (receivedItems.length === 1) return `your ${receivedItems[0]}`;

    const lastItem = receivedItems[receivedItems.length - 1];
    const otherItems = receivedItems.slice(0, -1);
    return `your ${otherItems.join(', ')} and ${lastItem}`;
  }, [receivedItems]);

  const ITEMS_RECEIVED_TOKEN_RE = /{{\s*items_received\s*}}/gi;

  // Get final body with received items substituted
  const getFinalBody = useCallback(() => {
    const itemsText = getReceivedItemsText();
    let out = body;

    const hasToken = /{{\s*items_received\s*}}/i.test(out);

    // Preferred: template uses {{items_received}}
    if (hasToken) {
      out = out.replace(ITEMS_RECEIVED_TOKEN_RE, itemsText);
      // If older templates still have "We received:", normalize it to "We received "
      out = out.replace(/We received:\s*/i, 'We received ');
      return out;
    }

    // Backwards compatible: older templates have a "We received:" placeholder
    return out.replace(/We received:\s*/i, `We received ${itemsText}. `);
  }, [body, getReceivedItemsText]);

  // Keep preview in sync if items finish loading after opening
  useEffect(() => {
    if (!showPreview) return;
    setPreviewBody(getFinalBody());
  }, [showPreview, getFinalBody]);

  // Open preview dialog
  const handleOpenPreview = () => {
    if (!toEmail) {
      toast({
        title: 'Missing email',
        description: 'Please enter a recipient email address.',
        variant: 'destructive',
      });
      return;
    }

    setPreviewBody(getFinalBody());
    setShowPreview(true);
  };

  // Open email client directly (no preview)
  const handleSendDirectEmail = async () => {
    if (!toEmail) {
      toast({
        title: 'Missing email',
        description: 'Please enter a recipient email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    
    // Build mailto link with final body (items substituted)
    const finalBody = getFinalBody();
    const mailtoSubject = encodeURIComponent(subject);
    const mailtoBody = encodeURIComponent(finalBody);
    const mailtoLink = `mailto:${toEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;
    
    // Open email client FIRST - before any async operations
    // Use location.href for mailto links as it's more reliable than window.open
    // which can be blocked by popup blockers in some browsers/user roles
    const mailWindow = window.open(mailtoLink, '_self');
    if (!mailWindow) {
      // Fallback to direct location assignment
      window.location.href = mailtoLink;
    }

    try {
      // Update estimate sent_at timestamp
      if (selectedEstimate) {
        await supabase
          .from('estimates')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', selectedEstimate.id);

        // Mark any linked intake leads as done
        if (selectedEstimate.customer?.id) {
          const { data: linkedLeads } = await supabase
            .from('intake_leads')
            .select('id')
            .eq('customer_id', selectedEstimate.customer.id)
            .in('status', ['new', 'pending', 'on_hold', 'processed']);

          if (linkedLeads && linkedLeads.length > 0) {
            await supabase
              .from('intake_leads')
              .update({ 
                status: 'done',
                processed_at: new Date().toISOString()
              })
              .in('id', linkedLeads.map(l => l.id));
          }

          // Create inspection request only if customer_id exists
          await supabase
            .from('inspection_requests')
            .insert({
              estimate_id: selectedEstimate.id,
              customer_id: selectedEstimate.customer.id,
              status: 'pending',
            });
        }
      }
      
      toast({
        title: 'Email client opened',
        description: 'Your email client has been opened with the composed message.',
      });
      
      handleClear();
    } catch (error) {
      console.error('Error updating records:', error);
      toast({
        title: 'Email client opened',
        description: 'Email opened but there was an issue updating records.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Open email client and update database records (from preview)
  const handleSendEmail = async () => {
    setIsSending(true);
    
    // Build mailto link
    const mailtoSubject = encodeURIComponent(subject);
    const mailtoBody = encodeURIComponent(previewBody);
    const mailtoLink = `mailto:${toEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;
    
    // Open email client FIRST - before any async operations
    // Use location.href for mailto links as it's more reliable than window.open
    const mailWindow = window.open(mailtoLink, '_self');
    if (!mailWindow) {
      window.location.href = mailtoLink;
    }

    setShowPreview(false);

    try {
      // Update estimate sent_at timestamp
      if (selectedEstimate) {
        await supabase
          .from('estimates')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', selectedEstimate.id);

        // Mark any linked intake leads as done - only if customer exists
        if (selectedEstimate.customer?.id) {
          const { data: linkedLeads } = await supabase
            .from('intake_leads')
            .select('id')
            .eq('customer_id', selectedEstimate.customer.id)
            .in('status', ['new', 'pending', 'on_hold', 'processed']);

          if (linkedLeads && linkedLeads.length > 0) {
            await supabase
              .from('intake_leads')
              .update({ 
                status: 'done',
                processed_at: new Date().toISOString()
              })
              .in('id', linkedLeads.map(l => l.id));
          }

          // Create inspection request only if customer_id exists
          const { error } = await supabase
            .from('inspection_requests')
            .insert({
              estimate_id: selectedEstimate.id,
              customer_id: selectedEstimate.customer.id,
              status: 'pending',
            });

          if (error) {
            console.error('Failed to create inspection request:', error);
          }
        }
      }
      
      toast({
        title: 'Email client opened',
        description: 'Your email client has been opened with the composed message.',
      });
      
      // Clear form after opening email client
      handleClear();
    } catch (error: any) {
      console.error('Error updating records:', error);
      toast({
        title: 'Email client opened',
        description: 'Email opened but there was an issue updating records.',
        variant: 'destructive',
      });
      handleClear();
    } finally {
      setIsSending(false);
    }
  };

  // Clear selection
  const handleClear = () => {
    setSelectedEstimate(null);
    setReceivedItems([]);
    setToEmail('');
    setSubject('');
    setBody('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold">Intake Email</h1>
          <p className="text-sm text-muted-foreground">Send confirmation after items arrive safely</p>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScanBarcode className="h-4 w-4" />
            Find Estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Scan barcode or type estimate #, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectEstimate(result)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {result.estimate_number}
                    </Badge>
                    <div>
                      <div className="font-medium">
                        {result.customer?.company_name || `${result.customer?.first_name} ${result.customer?.last_name}`}
                      </div>
                      {result.watch && (
                        <div className="text-sm text-muted-foreground">
                          {result.watch.brand} {result.watch.model}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && isSearching && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Searching...
            </div>
          )}

          {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No estimates found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Estimate & Email Compose */}
      {selectedEstimate && (
        <>
          {/* Estimate Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">{selectedEstimate.estimate_number}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {selectedEstimate.customer?.company_name || 
                       `${selectedEstimate.customer?.first_name} ${selectedEstimate.customer?.last_name}`}
                    </span>
                  </div>
                  {selectedEstimate.watch && (
                    <div className="flex items-center gap-2 text-sm">
                      <Watch className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedEstimate.watch.brand} {selectedEstimate.watch.model}</span>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleClear}>
                  Clear
                </Button>
              </div>

              {/* Received Items */}
              {receivedItems.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Items Received
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {receivedItems.map((item) => (
                      <Badge key={item} variant="secondary" className="capitalize">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Compose */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Compose Email
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selector */}
              <div className="space-y-2">
                <Label>Email Template</Label>
                <div className="flex items-center gap-2">
                  <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map(category => {
                        const categoryTemplates = groupedTemplates?.[category.value];
                        if (!categoryTemplates || categoryTemplates.length === 0) return null;
                        return (
                          <SelectGroup key={category.value}>
                            <SelectLabel>{category.label}</SelectLabel>
                            {categoryTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex items-center gap-2">
                                  {template.name}
                                  {template.id === defaultTemplateId && (
                                    <Badge variant="outline" className="text-xs ml-2">Default</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAsDefault}
                    disabled={!selectedTemplateId || selectedTemplateId === defaultTemplateId}
                    className="gap-1.5 whitespace-nowrap"
                  >
                    {selectedTemplateId === defaultTemplateId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Default
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Set Default
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="customer@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <div className="mb-2 p-3 bg-muted/50 rounded-md text-sm">
                  <span className="font-medium">Preview: </span>
                  <span className="text-muted-foreground">
                    "We received {getReceivedItemsText()}."
                  </span>
                </div>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Email body..."
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClear}>
                  Cancel
                </Button>
                {selectedTemplateId && (
                  <Button 
                    variant="outline" 
                    onClick={() => saveTemplateMutation.mutate()}
                    disabled={saveTemplateMutation.isPending}
                    className="gap-2"
                  >
                    <FileEdit className="h-4 w-4" />
                    {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                )}
                <Button onClick={handleSendDirectEmail} disabled={isSending} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isSending ? 'Opening...' : 'Send Email'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Email Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              Review your email before sending
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <div className="font-medium">{toEmail}</div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <div className="font-medium">{subject}</div>
            </div>
            
            <Separator />
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Message</Label>
              <div className="bg-muted/50 p-4 rounded-md whitespace-pre-wrap text-sm">
                {previewBody}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isSending}>
              Edit
            </Button>
            <Button onClick={handleSendEmail} disabled={isSending} className="gap-2">
              <Send className="h-4 w-4" />
              {isSending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
