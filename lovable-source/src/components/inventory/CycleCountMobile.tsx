import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Loader2, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle,
  ScanLine,
  ArrowRight,
  Clock,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type CycleCountStatus = 'draft' | 'in_progress' | 'pending_approval' | 'approved' | 'posted';

const statusConfig: Record<CycleCountStatus, { bg: string; icon: React.ReactNode; label: string }> = {
  draft: { 
    bg: 'bg-muted', 
    icon: <ClipboardCheck className="h-5 w-5" />, 
    label: 'Draft' 
  },
  in_progress: { 
    bg: 'bg-blue-500', 
    icon: <ScanLine className="h-5 w-5" />, 
    label: 'Scanning' 
  },
  pending_approval: { 
    bg: 'bg-amber-500', 
    icon: <AlertTriangle className="h-5 w-5" />, 
    label: 'Pending' 
  },
  approved: { 
    bg: 'bg-green-500', 
    icon: <CheckCircle className="h-5 w-5" />, 
    label: 'Approved' 
  },
  posted: { 
    bg: 'bg-purple-500', 
    icon: <Package className="h-5 w-5" />, 
    label: 'Posted' 
  },
};

export default function CycleCountMobile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showNewForm, setShowNewForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  // Fetch active/recent cycle counts
  const { data: cycleCounts, isLoading } = useQuery({
    queryKey: ['cycle-counts-mobile', search],
    queryFn: async () => {
      let query = supabase
        .from('cycle_counts')
        .select(`
          *,
          location:locations(name),
          bin:bins(name),
          cycle_count_lines(count)
        `)
        .in('status', ['draft', 'in_progress', 'pending_approval'])
        .order('updated_at', { ascending: false });

      if (search) {
        query = query.ilike('count_number', `%${search}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Create new cycle count
  const createCount = useMutation({
    mutationFn: async () => {
      const { data: nextNum, error: numError } = await supabase.rpc('get_next_count_number');
      if (numError) throw numError;

      const countNumber = nextNum || `CC-${Date.now()}`;

      const { data: result, error } = await supabase
        .from('cycle_counts')
        .insert({
          count_number: countNumber,
          notes: notes || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts-mobile'] });
      setShowNewForm(false);
      setNotes('');
      toast({
        title: 'Count Created',
        description: 'Ready to scan',
      });
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

  const activeCount = cycleCounts?.find(c => c.status === 'in_progress');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Cycle Count</h1>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => navigate('/inventory/quick-move')}
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            Move
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Active Count Banner */}
        {activeCount && (
          <Card 
            className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate(`/inventory/cycle-count/${activeCount.id}/scan`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500 text-white">
                  <ScanLine className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Continue Scanning
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {activeCount.count_number} • {activeCount.cycle_count_lines?.[0]?.count || 0} items counted
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Count Section */}
        {!showNewForm ? (
          <Button 
            className="w-full h-14 text-lg"
            onClick={() => setShowNewForm(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Count
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowNewForm(false);
                    setNotes('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => createCount.mutate()}
                  disabled={createCount.isPending}
                >
                  {createCount.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4 mr-2" />
                      Start Scanning
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search counts..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Count List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cycleCounts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active counts</p>
              <p className="text-sm">Tap "New Count" to start</p>
            </div>
          ) : (
            cycleCounts?.filter(c => c.id !== activeCount?.id).map((count) => {
              const config = statusConfig[count.status as CycleCountStatus];
              const itemCount = count.cycle_count_lines?.[0]?.count || 0;
              
              return (
                <Card 
                  key={count.id}
                  className="cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => navigate(`/inventory/cycle-count/${count.id}/scan`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${config.bg} text-white`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">
                            {count.count_number}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(count.updated_at), 'MMM d, h:mm a')}
                          </span>
                          <span>{itemCount} items</span>
                        </div>
                        {count.total_variance_qty !== null && count.total_variance_qty !== 0 && (
                          <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                            Variance: {count.total_variance_qty > 0 ? '+' : ''}{count.total_variance_qty} units
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
