import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, Receipt, Loader2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface CustomerHistoryProps {
  customerId: string;
  defaultOpen?: boolean;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  declined: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const jobStatusColors: Record<string, string> = {
  estimate: 'bg-slate-100 text-slate-700',
  waiting_inspection: 'bg-purple-100 text-purple-700',
  on_hand: 'bg-blue-100 text-blue-700',
  finished: 'bg-emerald-100 text-emerald-700',
};

const jobStatusLabels: Record<string, string> = {
  estimate: 'Estimate',
  waiting_inspection: 'Waiting Inspection',
  on_hand: 'On Hand',
  finished: 'Finished',
};

export function CustomerHistory({ customerId, defaultOpen = true }: CustomerHistoryProps) {
  const [historyOpen, setHistoryOpen] = useState(defaultOpen);

  // Fetch estimates for this customer with related job status
  const { data: estimates, isLoading: loadingEstimates } = useQuery({
    queryKey: ['customer-estimates', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          id, 
          estimate_number, 
          status, 
          total_amount, 
          created_at,
          jobs!estimates_job_id_fkey (
            id,
            job_id,
            simple_status
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  // Fetch sales orders for this customer
  const { data: salesOrders, isLoading: loadingSales } = useQuery({
    queryKey: ['customer-sales-orders', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, so_number, status, total_amount, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const isLoading = loadingEstimates || loadingSales;
  const hasEstimates = estimates && estimates.length > 0;
  const hasSalesOrders = salesOrders && salesOrders.length > 0;
  const hasHistory = hasEstimates || hasSalesOrders;

  return (
    <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:bg-muted rounded px-2 border-t border-border pt-4">
        {historyOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium">Customer History</span>
        {!isLoading && hasHistory && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {(estimates?.length || 0) + (salesOrders?.length || 0)} records
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasHistory ? (
          <p className="text-sm text-muted-foreground py-2">
            No estimates or sales orders found for this customer.
          </p>
        ) : (
          <>
            {/* Estimates */}
            {hasEstimates && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Estimates ({estimates.length})</span>
                </div>
                <div className="space-y-1">
                  {estimates.map((est) => (
                    <Link
                      key={est.id}
                      to={`/estimates/${est.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium group-hover:text-primary">
                            {est.estimate_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(est.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Show job status if there's a linked job */}
                        {est.jobs && (Array.isArray(est.jobs) ? est.jobs[0]?.simple_status : est.jobs.simple_status) && (
                          <Badge className={jobStatusColors[(Array.isArray(est.jobs) ? est.jobs[0]?.simple_status : est.jobs.simple_status) as string] || 'bg-gray-100 text-gray-700'}>
                            {jobStatusLabels[(Array.isArray(est.jobs) ? est.jobs[0]?.simple_status : est.jobs.simple_status) as string] || (Array.isArray(est.jobs) ? est.jobs[0]?.simple_status : est.jobs.simple_status)}
                          </Badge>
                        )}
                        <Badge className={statusColors[est.status] || 'bg-gray-100 text-gray-700'}>
                          {est.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          ${(est.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Sales Orders */}
            {hasSalesOrders && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  <span>Sales Orders ({salesOrders.length})</span>
                </div>
                <div className="space-y-1">
                  {salesOrders.map((so) => (
                    <Link
                      key={so.id}
                      to={`/sales/orders/${so.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium group-hover:text-primary">
                            {so.so_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(so.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[so.status] || 'bg-gray-100 text-gray-700'}>
                          {so.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          ${(so.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}