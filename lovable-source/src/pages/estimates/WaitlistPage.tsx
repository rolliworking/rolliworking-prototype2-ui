import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isBefore, addDays, startOfDay } from 'date-fns';
import { 
  Plus, Search, Calendar, User, FileText, Clock, Bell, 
  Check, X, MoreHorizontal, Trash2, Edit2, AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type WaitlistStatus = 'pending' | 'contacted' | 'completed' | 'cancelled';

interface WaitlistEntry {
  id: string;
  customer_id: string | null;
  estimate_id: string | null;
  service_requested: string | null;
  follow_up_date: string;
  notes: string | null;
  status: WaitlistStatus;
  notified_at: string | null;
  created_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  estimate?: {
    id: string;
    estimate_number: string;
  } | null;
}

interface FormData {
  customer_id: string;
  estimate_id: string;
  service_requested: string;
  follow_up_date: Date | undefined;
  notes: string;
}

export default function WaitlistPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WaitlistEntry | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [estimateSearch, setEstimateSearch] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    customer_id: '',
    estimate_id: '',
    service_requested: '',
    follow_up_date: undefined,
    notes: '',
  });

  // Fetch waitlist entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['waitlist', statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('waitlist')
        .select(`
          *,
          customer:customers(id, first_name, last_name, display_name, email, phone),
          estimate:estimates(id, estimate_number)
        `)
        .order('follow_up_date', { ascending: true });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Client-side search filtering
      let filtered = data as WaitlistEntry[];
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        filtered = filtered.filter(entry => {
          const customerName = entry.customer 
            ? `${entry.customer.first_name} ${entry.customer.last_name}`.toLowerCase()
            : '';
          const displayName = entry.customer?.display_name?.toLowerCase() || '';
          const estimateNumber = entry.estimate?.estimate_number?.toLowerCase() || '';
          const service = entry.service_requested?.toLowerCase() || '';
          
          return customerName.includes(search) || 
                 displayName.includes(search) || 
                 estimateNumber.includes(search) ||
                 service.includes(search);
        });
      }
      
      return filtered;
    },
  });

  // Customer search
  const { data: customers = [] } = useQuery({
    queryKey: ['customer-search', customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, display_name, email')
        .or(`first_name.ilike.%${customerSearch}%,last_name.ilike.%${customerSearch}%,display_name.ilike.%${customerSearch}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: customerSearch.length > 1,
  });

  // Estimate search
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimate-search', estimateSearch, formData.customer_id],
    queryFn: async () => {
      if (!estimateSearch.trim() && !formData.customer_id) return [];
      
      let query = supabase
        .from('estimates')
        .select('id, estimate_number, customer:customers(first_name, last_name)')
        .limit(10);

      if (estimateSearch.trim()) {
        query = query.ilike('estimate_number', `%${estimateSearch}%`);
      }
      
      if (formData.customer_id) {
        query = query.eq('customer_id', formData.customer_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: estimateSearch.length > 0 || !!formData.customer_id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { error } = await supabase.from('waitlist').insert({
        customer_id: data.customer_id || null,
        estimate_id: data.estimate_id || null,
        service_requested: data.service_requested || null,
        follow_up_date: data.follow_up_date ? format(data.follow_up_date, 'yyyy-MM-dd') : null,
        notes: data.notes || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: 'Entry added to waitlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData & { status: WaitlistStatus }> }) => {
      const updateData: Record<string, unknown> = {};
      if (data.customer_id !== undefined) updateData.customer_id = data.customer_id || null;
      if (data.estimate_id !== undefined) updateData.estimate_id = data.estimate_id || null;
      if (data.service_requested !== undefined) updateData.service_requested = data.service_requested || null;
      if (data.follow_up_date !== undefined) updateData.follow_up_date = data.follow_up_date ? format(data.follow_up_date, 'yyyy-MM-dd') : null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined) updateData.status = data.status;

      const { error } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      setEditingEntry(null);
      resetForm();
      toast({ title: 'Entry updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('waitlist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      toast({ title: 'Entry removed from waitlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      customer_id: '',
      estimate_id: '',
      service_requested: '',
      follow_up_date: undefined,
      notes: '',
    });
    setCustomerSearch('');
    setEstimateSearch('');
  };

  const handleEdit = (entry: WaitlistEntry) => {
    setEditingEntry(entry);
    setFormData({
      customer_id: entry.customer_id || '',
      estimate_id: entry.estimate_id || '',
      service_requested: entry.service_requested || '',
      follow_up_date: entry.follow_up_date ? new Date(entry.follow_up_date) : undefined,
      notes: entry.notes || '',
    });
    if (entry.customer) {
      setCustomerSearch(entry.customer.display_name || `${entry.customer.first_name} ${entry.customer.last_name}`);
    }
    if (entry.estimate) {
      setEstimateSearch(entry.estimate.estimate_number);
    }
    setShowAddDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.follow_up_date) {
      toast({ title: 'Please select a follow-up date', variant: 'destructive' });
      return;
    }

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleStatusChange = (id: string, status: WaitlistStatus) => {
    updateMutation.mutate({ id, data: { status } });
  };

  const getStatusBadge = (status: WaitlistStatus, followUpDate: string) => {
    const date = new Date(followUpDate);
    const today = startOfDay(new Date());
    const isOverdue = isBefore(date, today);
    const isDueToday = isToday(date);

    if (status === 'completed') {
      return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">Completed</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="secondary">Cancelled</Badge>;
    }
    if (status === 'contacted') {
      return <Badge variant="default" className="bg-blue-500/20 text-blue-700 border-blue-500/30">Contacted</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isDueToday) {
      return <Badge variant="default" className="bg-amber-500/20 text-amber-700 border-amber-500/30">Due Today</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  // Calculate summary metrics
  const metrics = {
    dueToday: entries.filter(e => e.status === 'pending' && isToday(new Date(e.follow_up_date))).length,
    overdue: entries.filter(e => e.status === 'pending' && isBefore(new Date(e.follow_up_date), startOfDay(new Date()))).length,
    upcoming: entries.filter(e => e.status === 'pending' && !isToday(new Date(e.follow_up_date)) && !isBefore(new Date(e.follow_up_date), startOfDay(new Date()))).length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-serif">Waitlist</h1>
            <p className="text-sm text-muted-foreground">Track customers awaiting service follow-up</p>
          </div>
          <Button onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add to Waitlist
          </Button>
        </div>
      </div>

      {/* Notification Ideas Card */}
      <div className="px-6 py-4">
        <Card className="bg-muted/50 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Ideas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Dashboard widget:</strong> Show entries due today/overdue on the main dashboard</p>
            <p>• <strong>Email digest:</strong> Daily email at 8am with that day's follow-ups</p>
            <p>• <strong>Browser notifications:</strong> Push notification when opening the app if items are due</p>
            <p>• <strong>Badge counter:</strong> Show count in sidebar menu item for pending/overdue entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      <div className="px-6 grid grid-cols-3 gap-4">
        <Card className={cn(metrics.overdue > 0 && "border-destructive/50 bg-destructive/5")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", metrics.overdue > 0 ? "bg-destructive/10" : "bg-muted")}>
              <AlertTriangle className={cn("h-5 w-5", metrics.overdue > 0 ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.overdue}</div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(metrics.dueToday > 0 && "border-amber-500/50 bg-amber-500/5")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", metrics.dueToday > 0 ? "bg-amber-500/10" : "bg-muted")}>
              <Clock className={cn("h-5 w-5", metrics.dueToday > 0 ? "text-amber-600" : "text-muted-foreground")} />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.dueToday}</div>
              <div className="text-sm text-muted-foreground">Due Today</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.upcoming}</div>
              <div className="text-sm text-muted-foreground">Upcoming</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, estimate #, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No waitlist entries found</p>
            <p className="text-sm">Add customers who need follow-up calls</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {entry.customer 
                            ? entry.customer.display_name || `${entry.customer.first_name} ${entry.customer.last_name}`
                            : 'No customer linked'}
                        </span>
                        {entry.estimate && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {entry.estimate.estimate_number}
                            </div>
                          </>
                        )}
                      </div>
                      
                      {entry.service_requested && (
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Service:</strong> {entry.service_requested}
                        </p>
                      )}
                      
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.notes}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Follow up: {format(new Date(entry.follow_up_date), 'MMM d, yyyy')}
                        </div>
                        {entry.customer?.phone && (
                          <div className="flex items-center gap-1">
                            {entry.customer.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.status, entry.follow_up_date)}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(entry)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(entry.id, 'contacted')}>
                            <Bell className="h-4 w-4 mr-2" />
                            Mark as Contacted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(entry.id, 'completed')}>
                            <Check className="h-4 w-4 mr-2" />
                            Mark as Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(entry.id, 'cancelled')}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(entry.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { 
        setShowAddDialog(open); 
        if (!open) {
          setEditingEntry(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Waitlist Entry' : 'Add to Waitlist'}</DialogTitle>
            <DialogDescription>
              Track a customer who needs follow-up for service
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Customer Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {formData.customer_id && customers.find(c => c.id === formData.customer_id) 
                      ? customers.find(c => c.id === formData.customer_id)?.display_name || 
                        `${customers.find(c => c.id === formData.customer_id)?.first_name} ${customers.find(c => c.id === formData.customer_id)?.last_name}`
                      : customerSearch || 'Select customer...'}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, customer_id: customer.id }));
                          setCustomerSearch(customer.display_name || `${customer.first_name} ${customer.last_name}`);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex flex-col"
                      >
                        <span className="font-medium">{customer.display_name || `${customer.first_name} ${customer.last_name}`}</span>
                        {customer.email && <span className="text-xs text-muted-foreground">{customer.email}</span>}
                      </button>
                    ))}
                    {customerSearch && customers.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No customers found</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Estimate Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estimate # (optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {formData.estimate_id && estimates.find(e => e.id === formData.estimate_id)
                      ? estimates.find(e => e.id === formData.estimate_id)?.estimate_number
                      : estimateSearch || 'Link an estimate...'}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search by estimate #..."
                      value={estimateSearch}
                      onChange={(e) => setEstimateSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-auto">
                    {estimates.map((estimate: any) => (
                      <button
                        key={estimate.id}
                        onClick={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            estimate_id: estimate.id,
                            customer_id: prev.customer_id || '' 
                          }));
                          setEstimateSearch(estimate.estimate_number);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex flex-col"
                      >
                        <span className="font-medium">{estimate.estimate_number}</span>
                        {estimate.customer && (
                          <span className="text-xs text-muted-foreground">
                            {estimate.customer.first_name} {estimate.customer.last_name}
                          </span>
                        )}
                      </button>
                    ))}
                    {(estimateSearch || formData.customer_id) && estimates.length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No estimates found</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Service Requested */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Requested</label>
              <Input
                placeholder="e.g., Full service, Band adjustment, Battery replacement"
                value={formData.service_requested}
                onChange={(e) => setFormData(prev => ({ ...prev, service_requested: e.target.value }))}
              />
            </div>

            {/* Follow-up Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Follow-up Date *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.follow_up_date && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.follow_up_date ? format(formData.follow_up_date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.follow_up_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, follow_up_date: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Any additional notes about this follow-up..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingEntry ? 'Save Changes' : 'Add to Waitlist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
