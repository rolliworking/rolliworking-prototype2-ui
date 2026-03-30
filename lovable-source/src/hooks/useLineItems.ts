import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineItem, LineItemFormData } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { TAX_RATE } from '@/lib/constants';

export function useLineItems(jobId: string) {
  return useQuery({
    queryKey: ['line_items', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('line_items')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!jobId,
  });
}

export function useCreateLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      itemData,
    }: {
      jobId: string;
      itemData: LineItemFormData;
    }) => {
      const { data, error } = await supabase
        .from('line_items')
        .insert({
          job_id: jobId,
          ...itemData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line_items', variables.jobId] });
      toast({
        title: 'Item Added',
        description: 'The line item has been added to the job.',
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
}

export function useUpdateLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      itemId,
      jobId,
      data,
    }: {
      itemId: string;
      jobId: string;
      data: Partial<LineItemFormData>;
    }) => {
      const { data: result, error } = await supabase
        .from('line_items')
        .update(data)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line_items', variables.jobId] });
      toast({
        title: 'Item Updated',
        description: 'The line item has been updated.',
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
}

export function useDeleteLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemId, jobId }: { itemId: string; jobId: string }) => {
      const { error } = await supabase
        .from('line_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['line_items', variables.jobId] });
      toast({
        title: 'Item Removed',
        description: 'The line item has been removed from the job.',
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
}

// Calculate totals
export function calculateJobTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.quantity * item.unit_price;
  }, 0);

  const taxableAmount = lineItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const tax = taxableAmount * TAX_RATE;
  const total = subtotal + tax;

  const totalCost = lineItems.reduce((sum, item) => {
    return sum + item.quantity * (item.internal_cost || 0);
  }, 0);

  const profit = subtotal - totalCost;

  return {
    subtotal,
    taxableAmount,
    tax,
    total,
    totalCost,
    profit,
  };
}
