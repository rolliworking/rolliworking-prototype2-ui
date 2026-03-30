import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ShippingRate } from '@/types/estimates';

export function useShippingRates() {
  return useQuery({
    queryKey: ['shipping-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_rates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ShippingRate[];
    },
  });
}

export function calculateShippingCost(rate: ShippingRate, insuredValue: number): number {
  // Check if value exceeds max
  if (rate.max_insured_value && insuredValue > rate.max_insured_value) {
    return -1; // Indicates need to switch to higher service
  }

  // Check if value is below minimum
  if (insuredValue < rate.min_insured_value) {
    return rate.base_rate;
  }

  // Calculate insurance: ceil(value / 1000) * rate per 1000
  const insuranceUnits = Math.ceil(insuredValue / 1000);
  const insuranceCost = insuranceUnits * rate.insurance_rate_per_1000;
  
  return rate.base_rate + insuranceCost;
}

export function findBestShippingRate(rates: ShippingRate[], insuredValue: number): { rate: ShippingRate; cost: number } | null {
  // Sort by sort_order to prefer lower cost services first
  const sortedRates = [...rates].sort((a, b) => a.sort_order - b.sort_order);

  for (const rate of sortedRates) {
    const cost = calculateShippingCost(rate, insuredValue);
    if (cost >= 0) {
      return { rate, cost };
    }
  }

  // If no rate fits, return the highest capacity rate
  const lastRate = sortedRates[sortedRates.length - 1];
  if (lastRate) {
    const cost = lastRate.base_rate + Math.ceil(insuredValue / 1000) * lastRate.insurance_rate_per_1000;
    return { rate: lastRate, cost };
  }

  return null;
}

export function useCreateShippingRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<ShippingRate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('shipping_rates')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-rates'] });
      toast({
        title: 'Shipping Rate Created',
        description: 'New shipping rate has been added.',
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

export function useUpdateShippingRate() {
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
      toast({
        title: 'Shipping Rate Updated',
        description: 'Shipping rate has been updated.',
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
