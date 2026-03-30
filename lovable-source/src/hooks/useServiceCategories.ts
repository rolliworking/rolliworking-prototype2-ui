import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ServiceCategory, ServiceSubcategory, ServiceType } from '@/types/estimates';

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ServiceCategory[];
    },
  });
}

export function useServiceSubcategories(categoryId?: string) {
  return useQuery({
    queryKey: ['service-subcategories', categoryId],
    queryFn: async () => {
      let query = supabase
        .from('service_subcategories')
        .select(`
          *,
          category:service_categories(id, name)
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceSubcategory[];
    },
  });
}

export function useCreateServiceCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; sort_order?: number }) => {
      const { data: result, error } = await supabase
        .from('service_categories')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({
        title: 'Category Created',
        description: 'Service category has been created.',
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

export function useCreateServiceSubcategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      category_id: string;
      service_code: string;
      name: string;
      description?: string;
      service_type: ServiceType;
      default_price?: number;
      default_duration_minutes?: number;
      sort_order?: number;
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
      toast({
        title: 'Subcategory Created',
        description: 'Service subcategory has been created.',
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

export function useUpdateServiceSubcategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceSubcategory> }) => {
      const { data: result, error } = await supabase
        .from('service_subcategories')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-subcategories'] });
      toast({
        title: 'Subcategory Updated',
        description: 'Service subcategory has been updated.',
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
