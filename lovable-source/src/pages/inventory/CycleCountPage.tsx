import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, ClipboardCheck, AlertTriangle, CheckCircle, XCircle, ArrowRight, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import CycleCountMobile from '@/components/inventory/CycleCountMobile';

type CycleCountStatus = 'draft' | 'in_progress' | 'pending_approval' | 'approved' | 'posted';

const statusColors: Record<CycleCountStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pending_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  posted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function CycleCountPage() {
  const isMobile = useIsMobile();
  
  // Return mobile UI for mobile devices
  if (isMobile) {
    return <CycleCountMobile />;
  }
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CycleCountStatus>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch cycle counts
  const { data: cycleCounts, isLoading } = useQuery({
    queryKey: ['cycle-counts', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('cycle_counts')
        .select(`
          *,
          location:locations(name, stores(name)),
          bin:bins(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (search) {
        query = query.ilike('count_number', `%${search}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch settings for thresholds
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Create new cycle count
  const createCount = useMutation({
    mutationFn: async (data: { notes?: string }) => {
      // Get next count number
      const { data: nextNum, error: numError } = await supabase.rpc('get_next_count_number');
      if (numError) throw numError;

      const countNumber = nextNum || `CC-${Date.now()}`;

      const { data: result, error } = await supabase
        .from('cycle_counts')
        .insert({
          count_number: countNumber,
          notes: data.notes,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      setCreateDialogOpen(false);
      toast({
        title: 'Count Created',
        description: 'New cycle count has been created.',
      });
      // Navigate to scanner page
      navigate(`/inventory/cycle-count/${data.id}/scan`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Approve cycle count
  const approveCount = useMutation({
    mutationFn: async (countId: string) => {
      const { error } = await supabase
        .from('cycle_counts')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', countId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      toast({
        title: 'Count Approved',
        description: 'Cycle count has been approved.',
      });
    },
  });

  const stats = {
    draft: cycleCounts?.filter(c => c.status === 'draft').length || 0,
    inProgress: cycleCounts?.filter(c => c.status === 'in_progress').length || 0,
    pendingApproval: cycleCounts?.filter(c => c.status === 'pending_approval').length || 0,
    approved: cycleCounts?.filter(c => c.status === 'approved').length || 0,
  };

  const qtyThreshold = settings?.cycle_count_qty_threshold || 5;
  const valueThreshold = settings?.cycle_count_value_threshold || 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Cycle Counts</h1>
          <p className="text-muted-foreground">Physical inventory verification</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/inventory/quick-move')}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Quick Move
          </Button>
          <Button variant="outline" onClick={() => navigate('/inventory/parts/import-qty')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Qty
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Count
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Cycle Count</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createCount.mutate({
                notes: formData.get('notes') as string,
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Cycle count notes..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCount.isPending}>
                  {createCount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Count
                </Button>
              </div>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Approval Thresholds Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Approval Thresholds
          </CardTitle>
          <CardDescription>
            Counts require approval when variance exceeds thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Quantity Variance:</span>{' '}
              <span className="font-medium">±{qtyThreshold} units</span>
            </div>
            <div>
              <span className="text-muted-foreground">Value Variance:</span>{' '}
              <span className="font-medium">${valueThreshold.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer ${statusFilter === 'draft' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('draft')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">{stats.draft}</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'in_progress' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter('in_progress')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'pending_approval' ? 'ring-2 ring-warning' : ''}`}
          onClick={() => setStatusFilter('pending_approval')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-warning">{stats.pendingApproval}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer ${statusFilter === 'approved' ? 'ring-2 ring-success' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-success">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by count number..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending_approval">Needs Approval</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : cycleCounts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cycle counts found</p>
              <Button variant="link" onClick={() => setCreateDialogOpen(true)}>
                Create your first cycle count
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Count #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Qty Variance</TableHead>
                  <TableHead className="text-right">Value Variance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycleCounts?.map((count) => {
                  const needsApproval = count.requires_approval && count.status === 'pending_approval';
                  return (
                    <TableRow key={count.id}>
                      <TableCell>
                        <span className="font-mono font-medium">{count.count_number}</span>
                      </TableCell>
                      <TableCell>
                        {format(new Date(count.count_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {count.location ? (
                          <div className="text-sm">
                            <p>{count.location.stores?.name}</p>
                            <p className="text-muted-foreground">{count.location.name}</p>
                          </div>
                        ) : count.bin ? (
                          <span>{count.bin.name}</span>
                        ) : (
                          <span className="text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {count.total_variance_qty !== null && (
                          <span className={count.total_variance_qty !== 0 ? 'text-warning font-medium' : ''}>
                            {count.total_variance_qty > 0 ? '+' : ''}{count.total_variance_qty}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {count.total_variance_value !== null && (
                          <span className={Math.abs(count.total_variance_value) > valueThreshold ? 'text-warning font-medium' : ''}>
                            ${count.total_variance_value?.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[count.status as CycleCountStatus]}>
                          {count.status.replace('_', ' ')}
                        </Badge>
                        {needsApproval && (
                          <Badge variant="outline" className="ml-2 text-warning border-warning">
                            Needs Approval
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {count.status === 'pending_approval' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => approveCount.mutate(count.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            </>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => navigate(`/inventory/cycle-count/${count.id}/scan`)}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
