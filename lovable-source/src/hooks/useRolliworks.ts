// ============================================================
// ROLLIWORKS COMPREHENSIVE HOOKS
// Aligned with actual database schema
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sendIntakeToRolliworking } from '@/hooks/useRolliworkingSync';
import type {
  ServiceCategory,
  ServiceSubcategory,
  ShippingRate,
  ShopTimeEntry,
  CycleCount,
  ServiceType,
  ShippingCalculatorResult,
} from '@/types/rolliworks';

// ============================================================
// SERVICE CATEGORIES & SUBCATEGORIES
// ============================================================

export function useServiceCategoriesAll() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as ServiceCategory[];
    },
  });
}

export function useServiceSubcategoriesAll(categoryId?: string) {
  return useQuery({
    queryKey: ['service-subcategories', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('service_subcategories')
        .select('*, category:service_categories(*)')
        .eq('is_active', true)
        .order('sort_order');
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceSubcategory[];
    },
  });
}

export function useCreateServiceSubcategoryNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      category_id: string;
      name: string;
      service_code: string;
      service_type?: ServiceType;
      default_price?: number;
      description?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('service_subcategories')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-subcategories'] });
      toast({ title: 'Service Created', description: 'Service subcategory added successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// SHIPPING RATES & CALCULATOR
// ============================================================

export function useShippingRatesAll() {
  return useQuery({
    queryKey: ['shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_rates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as ShippingRate[];
    },
  });
}

export function useUpdateShippingRateNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShippingRate> }) => {
      const { data: result, error } = await supabase
        .from('shipping_rates')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates'] });
      toast({ title: 'Rate Updated', description: 'Shipping rate updated successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Calculate shipping cost based on item type and insured value
 */
export function calculateShippingCostNew(
  rates: ShippingRate[],
  insuredValue: number
): ShippingCalculatorResult | null {
  // Find the applicable rate based on value thresholds
  const applicableRate = rates.find(rate => {
    if (insuredValue < (rate.min_insured_value || 0)) return false;
    if (rate.max_insured_value !== null && insuredValue > rate.max_insured_value) return false;
    return true;
  });

  if (!applicableRate) return null;

  const insuranceCost = Math.ceil(insuredValue / 1000) * applicableRate.insurance_rate_per_1000;
  const totalCost = applicableRate.base_rate + insuranceCost;

  return {
    carrier: applicableRate.carrier,
    service_name: applicableRate.service_name,
    base_rate: applicableRate.base_rate,
    insurance_cost: insuranceCost,
    total_cost: totalCost,
  };
}

// ============================================================
// SHOP TIME ENTRIES
// ============================================================

export function useShopTimeEntriesAll(jobId?: string) {
  return useQuery({
    queryKey: ['shop-time-entries', jobId],
    queryFn: async () => {
      let query = supabase
        .from('shop_time_entries')
        .select('*, job:jobs(*), service_subcategory:service_subcategories(*)')
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ShopTimeEntry[];
    },
  });
}

export function useCreateShopTimeEntryNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      job_id?: string;
      service_subcategory_id?: string;
      start_time?: string;
      end_time?: string;
      duration_minutes?: number;
      is_manual_entry?: boolean;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('shop_time_entries')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-time-entries'] });
      toast({ title: 'Time Entry Added', description: 'Shop time recorded successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateShopTimeEntryNew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ShopTimeEntry> }) => {
      const { data: result, error } = await supabase
        .from('shop_time_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-time-entries'] });
    },
  });
}

// ============================================================
// CYCLE COUNTS (Enhanced)
// ============================================================

export function useCycleCountsAll() {
  return useQuery({
    queryKey: ['cycle-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycle_counts')
        .select('*, location:locations(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CycleCount[];
    },
  });
}

export function useApproveCycleCountNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (countId: string) => {
      const { data, error } = await supabase
        .from('cycle_counts')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', countId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      toast({ title: 'Approved', description: 'Cycle count approved successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePostCycleCountNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (countId: string) => {
      const { data, error } = await supabase
        .from('cycle_counts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
        })
        .eq('id', countId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast({ title: 'Posted', description: 'Cycle count posted and inventory updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// AUDIT LOG
// ============================================================

export function useAuditLogAll(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ['audit-log', entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) query = query.eq('entity_id', entityId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!entityType || !!entityId,
  });
}

export function useCreateAuditLogNew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      entity_type: string;
      entity_id: string;
      action: string;
      old_data?: unknown;
      new_data?: unknown;
      metadata?: unknown;
    }) => {
      const { error } = await supabase
        .from('audit_log')
        .insert([{
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          action: data.action,
          old_data: data.old_data as never,
          new_data: data.new_data as never,
          metadata: data.metadata as never,
        }]);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-log'] });
    },
  });
}

// ============================================================
// INTAKE (Convert Estimate to On Hand)
// ============================================================

export function useConvertToIntakeNew() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (estimateId: string) => {
      // 1. Get the estimate with all related data
      const { data: estimate, error: estError } = await supabase
        .from('estimates')
        .select('*, customer:customers(*), watch:watches(*)')
        .eq('id', estimateId)
        .single();
      
      if (estError) throw estError;
      if (!estimate) throw new Error('Estimate not found');

      const intakeDate = format(new Date(), 'yyyy-MM-dd');
      const jobId = `${format(new Date(), 'yy')}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

      // 2. Create or update job
      let job;
      if (estimate.job_id) {
        const { data, error } = await supabase
          .from('jobs')
          .update({
            simple_status: 'on_hand',
            intake_date: intakeDate,
          })
          .eq('id', estimate.job_id)
          .select()
          .single();
        
        if (error) throw error;
        job = data;
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert({
            job_id: jobId,
            customer_id: estimate.customer_id,
            watch_id: estimate.watch_id,
            estimate_id: estimate.id,
            simple_status: 'on_hand',
            intake_date: intakeDate,
            status: 'intake', // Keep legacy status for compatibility
          })
          .select()
          .single();
        
        if (error) throw error;
        job = data;
      }

      // 3. Update estimate status to converted
      await supabase
        .from('estimates')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          job_id: job.id,
        })
        .eq('id', estimateId);

      // 4. Update client property custody record
      if (estimate.watch_id && estimate.watch) {
        const watch = estimate.watch as { serial_number?: string; brand: string; model?: string; reference_number?: string };
        
        const { data: existing } = await supabase
          .from('client_property')
          .select('id')
          .eq('customer_id', estimate.customer_id)
          .eq('serial_number', watch.serial_number || '')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('client_property')
            .update({
              custody_status: 'in_custody',
              is_in_inventory: true,
              intake_date: intakeDate,
              job_id: job.id,
              estimate_id: estimate.id,
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('client_property')
            .insert({
              customer_id: estimate.customer_id,
              brand: watch.brand,
              model: watch.model,
              reference_number: watch.reference_number,
              serial_number: watch.serial_number || '',
              custody_status: 'in_custody',
              is_in_inventory: true,
              intake_date: intakeDate,
              job_id: job.id,
              estimate_id: estimate.id,
            });
        }
      }

      // 5. Create audit log entry
      await supabase
        .from('audit_log')
        .insert([{
          entity_type: 'estimate',
          entity_id: estimateId,
          action: 'CONVERTED_TO_INTAKE',
          new_data: { job_id: job.id, intake_date: intakeDate },
          metadata: { estimate_number: estimate.estimate_number },
        }]);

      // 6. Send intake to Rolliworking (fire and forget)
      const customer = estimate.customer as { first_name?: string; last_name?: string; company_name?: string; email?: string; phone?: string } | null;
      const watch = estimate.watch as { brand?: string; model?: string; reference_number?: string } | null;
      
      if (customer && watch) {
        const fullName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        sendIntakeToRolliworking({
          fullName,
          email: customer.email || '',
          phone: customer.phone || '',
          partNumber: watch.reference_number || '',
          date: intakeDate,
          brand: watch.brand || '',
          model: watch.model || '',
          estimateNumber: estimate.estimate_number,
        });
      }

      return { estimate, job, intakeDate };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['client-property'] });
      toast({
        title: 'Marked On Hand',
        description: 'Estimate converted to intake. Watch is now in custody.',
      });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// LOCATIONS
// ============================================================

export function useLocationsAll() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*, store:stores(*)')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
}

// ============================================================
// ESTIMATES (Enhanced)
// ============================================================

export function useEstimatesEnhanced(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['estimates', filters],
    queryFn: async () => {
      let query = supabase
        .from('estimates')
        .select('*, customer:customers(*), watch:watches(*)')
        .order('created_at', { ascending: false });
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as 'draft' | 'sent' | 'converted');
      }
      
      if (filters?.search) {
        query = query.or(`estimate_number.ilike.%${filters.search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useEstimateDetail(estimateId: string) {
  return useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('*, customer:customers(*), watch:watches(*)')
        .eq('id', estimateId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!estimateId,
  });
}

export function useEstimateLineItemsAll(estimateId: string) {
  return useQuery({
    queryKey: ['estimate-line-items', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*, service_subcategory:service_subcategories(*)')
        .eq('estimate_id', estimateId)
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!estimateId,
  });
}
