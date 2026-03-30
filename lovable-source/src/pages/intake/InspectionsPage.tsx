import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  ClipboardCheck,
  User,
  Watch,
  CheckCircle2,
  Clock,
  Loader2,
  Printer,
  ShoppingCart,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { RELATED_PART_CATEGORIES } from '@/lib/constants';
import { CreateLabelDialog } from '@/components/labels/CreateLabelDialog';

// Type for pre-filled QR label data
interface QRLabelPrefill {
  fullName: string;
  email: string;
  phone: string;
  brand: string;
  model: string;
  estimateNumber: string;
  date: string;
}

interface InspectionRequest {
  id: string;
  estimate_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  estimate: {
    estimate_number: string;
    watch: {
      brand: string;
      model: string | null;
    } | null;
  } | null;
  customer: {
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

// Extract received items from line items
function getReceivedItems(lineItems: Array<{ description: string; parts?: { category: string | null } | null }>): string[] {
  const categories = new Set<string>();
  
  lineItems.forEach((item) => {
    // Check part category first
    const partCategory = item.parts?.category?.toLowerCase();
    if (partCategory) {
      const match = RELATED_PART_CATEGORIES.find(c => c.value === partCategory);
      if (match) {
        categories.add(match.label);
      }
    }
    
    // Fallback to description keywords
    const desc = item.description?.toLowerCase() || '';
    if (!partCategory) {
      if (desc.includes('watch') && !desc.includes('bracelet') && !desc.includes('band')) {
        categories.add('Watch');
      } else if (desc.includes('bracelet') || desc.includes('band') || desc.includes('jubilee')) {
        categories.add('Bracelet');
      } else if (desc.includes('clasp')) {
        categories.add('Clasp');
      } else if (desc.includes('bezel')) {
        categories.add('Bezel');
      }
    }
  });

  return Array.from(categories);
}

export default function InspectionsPage() {
  const { permissions } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelPrefillData, setLabelPrefillData] = useState<QRLabelPrefill | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

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

  // Fetch inspection requests with customer email/phone for labels
  const { data: inspections, isLoading } = useQuery({
    queryKey: ['inspection-requests', showCompleted],
    queryFn: async () => {
      let query = supabase
        .from('inspection_requests')
        .select(`
          id,
          estimate_id,
          customer_id,
          status,
          created_at,
          completed_at,
          notes,
          estimate:estimates(
            estimate_number,
            watch:watches(brand, model)
          ),
          customer:customers(first_name, last_name, company_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (!showCompleted) {
        query = query.neq('status', 'completed');
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as InspectionRequest[];
    },
  });

  // Handle print label click
  const handlePrintLabel = (inspection: InspectionRequest) => {
    const customer = inspection.customer;
    const estimate = inspection.estimate;
    const watch = estimate?.watch;
    
    setLabelPrefillData({
      fullName: customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
      email: customer?.email || '',
      phone: customer?.phone || '',
      brand: watch?.brand || '',
      model: watch?.model || '',
      estimateNumber: estimate?.estimate_number || '',
      date: new Date().toISOString().split('T')[0],
    });
    setLabelDialogOpen(true);
  };

  // Get all estimate IDs from inspections
  const estimateIds = useMemo(() => 
    inspections?.map(i => i.estimate_id).filter(Boolean) || [],
    [inspections]
  );

  // Fetch line items for all estimates to get received items
  const { data: lineItemsMap } = useQuery({
    queryKey: ['inspection-line-items', estimateIds],
    queryFn: async () => {
      if (estimateIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('estimate_id, description, parts:part_id(category)')
        .in('estimate_id', estimateIds);
      
      if (error) throw error;
      
      // Group by estimate_id
      const grouped: Record<string, Array<{ description: string; parts?: { category: string | null } | null }>> = {};
      (data || []).forEach((item: any) => {
        if (!grouped[item.estimate_id]) {
          grouped[item.estimate_id] = [];
        }
        grouped[item.estimate_id].push(item);
      });
      
      return grouped;
    },
    enabled: estimateIds.length > 0,
  });

  // Complete inspection mutation
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Prevent duplicate calls for the same ID
      if (completingId === id) {
        throw new Error('Already completing this inspection');
      }
      setCompletingId(id);
      
      const { error } = await supabase
        .from('inspection_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-requests'] });
      toast({
        title: 'Inspection completed',
        description: 'The inspection has been marked as done.',
      });
      setCompletingId(null);
    },
    onError: (error) => {
      // Don't show error for duplicate call prevention
      if (error.message !== 'Already completing this inspection') {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
      setCompletingId(null);
    },
  });

  // Reopen inspection mutation (mark as pending again)
  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      if (reopeningId === id) {
        throw new Error('Already reopening this inspection');
      }
      setReopeningId(id);
      
      const { error } = await supabase
        .from('inspection_requests')
        .update({
          status: 'pending',
          completed_at: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection-requests'] });
      toast({
        title: 'Inspection reopened',
        description: 'The inspection has been marked as pending.',
      });
      setReopeningId(null);
    },
    onError: (error) => {
      if (error.message !== 'Already reopening this inspection') {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
      setReopeningId(null);
    },
  });

  // Filter inspections by search query
  const filteredInspections = inspections?.filter((inspection) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const estimateNumber = inspection.estimate?.estimate_number?.toLowerCase() || '';
    const customerName = `${inspection.customer?.first_name || ''} ${inspection.customer?.last_name || ''}`.toLowerCase();
    const companyName = inspection.customer?.company_name?.toLowerCase() || '';
    const brand = inspection.estimate?.watch?.brand?.toLowerCase() || '';
    
    return (
      estimateNumber.includes(query) ||
      customerName.includes(query) ||
      companyName.includes(query) ||
      brand.includes(query)
    );
  });

  // Group inspections by day
  const groupedInspections = useMemo(() => {
    if (!filteredInspections) return [];
    
    const groups: { date: Date; label: string; inspections: InspectionRequest[] }[] = [];
    const dateMap = new Map<string, InspectionRequest[]>();
    
    filteredInspections.forEach((inspection) => {
      const dateKey = startOfDay(new Date(inspection.created_at)).toISOString();
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(inspection);
    });
    
    // Sort by date descending and create groups
    Array.from(dateMap.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(([dateKey, inspections]) => {
        const date = new Date(dateKey);
        let label: string;
        
        if (isToday(date)) {
          label = 'Today';
        } else if (isYesterday(date)) {
          label = 'Yesterday';
        } else {
          label = format(date, 'EEEE, MMMM d, yyyy');
        }
        
        groups.push({ date, label, inspections });
      });
    
    return groups;
  }, [filteredInspections]);

  const pendingCount = inspections?.filter(i => i.status === 'pending').length || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold">Inspections</h1>
          <p className="text-sm text-muted-foreground">
            Review incoming items after intake email is sent
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Scan barcode or search by estimate #, customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showCompleted"
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(!!checked)}
              />
              <Label htmlFor="showCompleted" className="text-sm cursor-pointer">
                Show completed
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspections Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inspection Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedInspections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No inspections found matching your search.' : 'No pending inspections.'}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedInspections.map((group) => (
                <div key={group.date.toISOString()}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
                    <Badge variant="outline" className="text-xs">
                      {group.inspections.length}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estimate</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Watch</TableHead>
                        <TableHead>Items Received</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[150px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.inspections.map((inspection) => {
                        const receivedItems = lineItemsMap?.[inspection.estimate_id] 
                          ? getReceivedItems(lineItemsMap[inspection.estimate_id])
                          : [];
                        const hasWatch = receivedItems.includes('Watch');
                          
                        return (
                          <TableRow
                            key={inspection.id}
                            className={cn(
                              inspection.status === 'completed' && 'opacity-60'
                            )}
                          >
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {inspection.estimate?.estimate_number?.replace(/^EST-/, 'E')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {inspection.customer?.company_name ||
                                    `${inspection.customer?.first_name} ${inspection.customer?.last_name}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {inspection.estimate?.watch && (
                                <div className="flex items-center gap-2">
                                  <Watch className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    {inspection.estimate.watch.brand}{' '}
                                    {inspection.estimate.watch.model}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {receivedItems.length > 0 ? (
                                  receivedItems.map((item) => (
                                    <Badge 
                                      key={item} 
                                      variant="secondary" 
                                      className="text-xs"
                                    >
                                      {item}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(inspection.created_at), 'h:mm a')}
                            </TableCell>
                            <TableCell>
                              {inspection.status === 'completed' ? (
                                <Badge variant="secondary" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Done
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {hasWatch && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => navigate(`/intake/receive-watch?estimate=${inspection.estimate?.estimate_number}`)}
                                    className="gap-1"
                                    title="Receive Client Watch"
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePrintLabel(inspection)}
                                  className="gap-1"
                                  title="Print QR Label"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                {inspection.status === 'completed' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => reopenMutation.mutate(inspection.id)}
                                    disabled={reopeningId === inspection.id}
                                    className="gap-1"
                                  >
                                    {reopeningId === inspection.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Clock className="h-3.5 w-3.5" />
                                    )}
                                    Reopen
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => completeMutation.mutate(inspection.id)}
                                    disabled={completingId === inspection.id}
                                    className="gap-1"
                                  >
                                    {completingId === inspection.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Done
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Label Dialog */}
      <CreateLabelDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        defaultType="qrcode"
        prefillQRData={labelPrefillData || undefined}
      />
    </div>
  );
}
