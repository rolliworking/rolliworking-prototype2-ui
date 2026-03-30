import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSearchTerm } from '@/lib/sanitize';
import type { Estimate, EstimateLineItem, EstimateFormData, EstimateLineItemFormData, EstimateStatus } from '@/types/estimates';

export function useEstimates(filters?: { status?: EstimateStatus; customerId?: string; search?: string }) {
  return useQuery({
    queryKey: ['estimates', filters],
    queryFn: async () => {
      let query = supabase
        .from('estimates')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone),
          watch:watches(id, brand, model, serial_number, reference_number)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.search) {
        const sanitizedSearch = sanitizeSearchTerm(filters.search);
        query = query.or(`estimate_number.ilike.%${sanitizedSearch}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Estimate[];
    },
  });
}

export function useEstimate(estimateId: string) {
  return useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, address, city, state, zip),
          watch:watches(id, brand, model, serial_number, reference_number)
        `)
        .eq('id', estimateId)
        .single();

      if (error) throw error;
      return data as Estimate;
    },
    enabled: !!estimateId,
  });
}

export function useEstimateLineItems(estimateId: string) {
  return useQuery({
    queryKey: ['estimate-line-items', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select(`
          *,
          service_subcategory:service_subcategories(id, service_code, name, service_type),
          part:parts(id, part_number, description)
        `)
        .eq('estimate_id', estimateId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as EstimateLineItem[];
    },
    enabled: !!estimateId,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: EstimateFormData) => {
      let estimateNumber = data.estimate_number;
      
      // If no custom estimate number provided, get next auto-generated one
      if (!estimateNumber) {
        const { data: numberResult, error: numberError } = await supabase
          .rpc('get_next_estimate_number');
        if (numberError) throw numberError;
        estimateNumber = numberResult;
      } else {
        // Format custom number as EST-XXXXX
        if (!estimateNumber.startsWith('EST-')) {
          estimateNumber = 'EST-' + estimateNumber.padStart(5, '0');
        }
        
        // Check if this estimate number already exists
        const { data: existing, error: checkError } = await supabase
          .from('estimates')
          .select('id')
          .eq('estimate_number', estimateNumber)
          .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (existing) {
          throw new Error(`Estimate number ${estimateNumber} already exists. Please use a different number.`);
        }
        
        // Update settings to next number (+5) if custom is higher
        const numericPart = parseInt(estimateNumber.replace('EST-', ''), 10);
        if (!isNaN(numericPart)) {
          await supabase
            .from('settings')
            .update({ next_estimate_number: numericPart + 5 })
            .gt('next_estimate_number', 0); // ensures update happens
        }
      }

      const { data: result, error } = await supabase
        .from('estimates')
        .insert({
          estimate_number: estimateNumber,
          customer_id: data.customer_id,
          watch_id: data.watch_id || null,
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          internal_notes: data.internal_notes || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast({
        title: 'Estimate Created',
        description: 'New estimate has been created.',
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

export function useUpdateEstimate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ estimateId, data }: { estimateId: string; data: Partial<EstimateFormData> & { status?: EstimateStatus; subtotal?: number; tax_amount?: number; shipping_amount?: number; total_amount?: number } }) => {
      const { data: result, error } = await supabase
        .from('estimates')
        .update(data)
        .eq('id', estimateId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate', variables.estimateId] });
      toast({
        title: 'Estimate Updated',
        description: 'The estimate has been updated.',
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

export function useAddEstimateLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ estimateId, data }: { estimateId: string; data: EstimateLineItemFormData }) => {
      const extended_price = data.quantity * data.unit_price;
      
      const { data: result, error } = await supabase
        .from('estimate_line_items')
        .insert({
          estimate_id: estimateId,
          line_type: data.line_type,
          service_subcategory_id: data.service_subcategory_id || null,
          part_id: data.part_id || null,
          description: data.description,
          quantity: data.quantity,
          unit_price: data.unit_price,
          extended_price,
          taxable: data.taxable,
          internal_cost: data.internal_cost || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-line-items', variables.estimateId] });
      toast({
        title: 'Line Added',
        description: 'Line item has been added.',
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

export function useUpdateEstimateLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lineItemId, estimateId, data }: { lineItemId: string; estimateId: string; data: Partial<EstimateLineItemFormData> }) => {
      const updateData: any = { ...data };
      if (data.quantity !== undefined && data.unit_price !== undefined) {
        updateData.extended_price = data.quantity * data.unit_price;
      }

      const { data: result, error } = await supabase
        .from('estimate_line_items')
        .update(updateData)
        .eq('id', lineItemId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-line-items', variables.estimateId] });
      toast({
        title: 'Line Updated',
        description: 'Line item has been updated.',
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

export function useDeleteEstimateLineItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lineItemId, estimateId }: { lineItemId: string; estimateId: string }) => {
      const { error } = await supabase
        .from('estimate_line_items')
        .delete()
        .eq('id', lineItemId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-line-items', variables.estimateId] });
      toast({
        title: 'Line Removed',
        description: 'Line item has been removed.',
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

export function useDeleteEstimate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      // First delete line items
      const { error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .delete()
        .eq('estimate_id', estimateId);

      if (lineItemsError) throw lineItemsError;

      // Then delete the estimate
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', estimateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast({
        title: 'Estimate Deleted',
        description: 'The estimate has been deleted.',
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

export function useDuplicateEstimate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      // Fetch the original estimate
      const { data: original, error: fetchError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (fetchError) throw fetchError;

      // Get next estimate number
      const { data: newEstimateNumber, error: numberError } = await supabase
        .rpc('get_next_estimate_number');
      if (numberError) throw numberError;

      // Create the duplicate estimate
      const { data: newEstimate, error: createError } = await supabase
        .from('estimates')
        .insert({
          estimate_number: newEstimateNumber,
          customer_id: original.customer_id,
          watch_id: original.watch_id,
          valid_until: original.valid_until,
          notes: original.notes,
          internal_notes: original.internal_notes,
          status: 'draft',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Fetch and duplicate line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('sort_order', { ascending: true });

      if (lineItemsError) throw lineItemsError;

      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map((item, index) => ({
          estimate_id: newEstimate.id,
          line_type: item.line_type,
          service_subcategory_id: item.service_subcategory_id,
          part_id: item.part_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          extended_price: item.extended_price,
          taxable: item.taxable,
          internal_cost: item.internal_cost,
          notes: item.notes,
          sort_order: index,
        }));

        const { error: insertError } = await supabase
          .from('estimate_line_items')
          .insert(newLineItems);

        if (insertError) throw insertError;
      }

      return newEstimate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      toast({
        title: 'Estimate Duplicated',
        description: `Created new estimate ${data.estimate_number}.`,
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

export function useConvertEstimateToIntake() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ estimateId }: { estimateId: string }) => {
      // Get the estimate
      const { data: estimate, error: fetchError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single();

      if (fetchError) throw fetchError;

      // Get the next job ID
      const { data: jobId, error: jobIdError } = await supabase.rpc('get_next_job_id');
      if (jobIdError) throw jobIdError;

      // Create or update the job with simple_status = 'on_hand'
      const today = new Date().toISOString().split('T')[0];

      if (estimate.job_id) {
        // Update existing job
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            simple_status: 'on_hand',
            intake_date: today,
          })
          .eq('id', estimate.job_id);

        if (updateError) throw updateError;
      } else {
        // Create new job
        const { data: newJob, error: createError } = await supabase
          .from('jobs')
          .insert({
            job_id: jobId,
            customer_id: estimate.customer_id,
            watch_id: estimate.watch_id,
            simple_status: 'on_hand',
            intake_date: today,
            estimate_id: estimateId,
            status: 'intake', // Keep legacy status for compatibility
            priority: 'normal',
          })
          .select()
          .single();

        if (createError) throw createError;

        // Link estimate to job
        await supabase
          .from('estimates')
          .update({ job_id: newJob.id })
          .eq('id', estimateId);
      }

      // Update estimate status
      const { data: result, error: statusError } = await supabase
        .from('estimates')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
        })
        .eq('id', estimateId)
        .select()
        .single();

      if (statusError) throw statusError;

      // Create client property record if watch exists
      if (estimate.watch_id) {
        const { data: existingProperty } = await supabase
          .from('client_property')
          .select('id')
          .eq('customer_id', estimate.customer_id)
          .eq('job_id', estimate.job_id)
          .maybeSingle();

        if (!existingProperty) {
          const { data: watch } = await supabase
            .from('watches')
            .select('*')
            .eq('id', estimate.watch_id)
            .single();

          if (watch) {
            await supabase
              .from('client_property')
              .insert({
                customer_id: estimate.customer_id,
                job_id: estimate.job_id,
                brand: watch.brand,
                model: watch.model,
                serial_number: watch.serial_number || 'UNKNOWN',
                reference_number: watch.reference_number,
                date_received: today,
                is_in_inventory: true,
                custody_status: 'in_custody',
                intake_date: today,
                estimate_id: estimateId,
              });
          }
        }
      }

      // Log activity
      if (estimate.job_id) {
        await supabase
          .from('job_activity_log')
          .insert({
            job_id: estimate.job_id,
            action_type: 'StatusChanged',
            message: `Estimate ${estimate.estimate_number} converted to intake. Watch is now On Hand.`,
          });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['client-property'] });
      toast({
        title: 'Watch On Hand',
        description: 'Estimate converted. Watch is now in inventory.',
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

// Calculate estimate totals
export function calculateEstimateTotals(lineItems: EstimateLineItem[], taxRate: number = 0.0825) {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.extended_price || 0), 0);
  const taxableAmount = lineItems
    .filter(item => item.taxable)
    .reduce((sum, item) => sum + (item.extended_price || 0), 0);
  const tax_amount = taxableAmount * taxRate;
  const shipping_amount = lineItems
    .filter(item => item.line_type === 'shipping')
    .reduce((sum, item) => sum + (item.extended_price || 0), 0);
  const total_amount = subtotal + tax_amount;

  return {
    subtotal,
    tax_amount,
    shipping_amount,
    total_amount,
    taxable_amount: taxableAmount,
  };
}
