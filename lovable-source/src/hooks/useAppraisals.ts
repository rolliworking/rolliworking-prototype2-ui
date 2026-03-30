import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Appraisal {
  id: string;
  appraisal_number: string;
  customer_id: string;
  watch_id: string | null;
  appraisal_date: string;
  maker: string | null;
  model_description: string | null;
  movement: string | null;
  material: string | null;
  dial_features: string | null;
  hands: string | null;
  bracelet_strap: string | null;
  crystal: string | null;
  condition: string | null;
  style_number: string | null;
  item_description: string | null;
  replacement_cost: number | null;
  appraiser_name: string | null;
  appraiser_title: string | null;
  photo_url: string | null;
  status: string;
  sent_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  watch?: {
    id: string;
    brand: string;
    model: string | null;
    serial_number: string | null;
    reference_number: string | null;
    movement_type: string | null;
    case_material: string | null;
    band_material: string | null;
  };
}

export interface AppraisalFormData {
  customer_id: string;
  watch_id?: string | null;
  appraisal_date?: string;
  maker?: string;
  model_description?: string;
  movement?: string;
  material?: string;
  dial_features?: string;
  hands?: string;
  bracelet_strap?: string;
  crystal?: string;
  condition?: string;
  style_number?: string;
  item_description?: string;
  replacement_cost?: number | null;
  appraiser_name?: string;
  appraiser_title?: string;
  photo_url?: string | null;
  status?: string;
  notes?: string;
}

export function useAppraisals() {
  return useQuery({
    queryKey: ['appraisals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisals')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, address, city, state, zip),
          watch:watches(id, brand, model, serial_number, reference_number, movement_type, case_material, band_material)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Appraisal[];
    },
  });
}

export function useAppraisal(id: string) {
  return useQuery({
    queryKey: ['appraisal', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisals')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, address, city, state, zip),
          watch:watches(id, brand, model, serial_number, reference_number, movement_type, case_material, band_material)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Appraisal;
    },
    enabled: !!id,
  });
}

export function useCreateAppraisal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AppraisalFormData) => {
      // Generate appraisal number
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_appraisal_number');
      
      if (numberError) throw numberError;

      const { data: result, error } = await supabase
        .from('appraisals')
        .insert({
          ...data,
          appraisal_number: numberData,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      toast.success('Appraisal created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create appraisal: ' + error.message);
    },
  });
}

export function useUpdateAppraisal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AppraisalFormData> }) => {
      const { data: result, error } = await supabase
        .from('appraisals')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', variables.id] });
      toast.success('Appraisal updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update appraisal: ' + error.message);
    },
  });
}

export function useDeleteAppraisal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appraisals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      toast.success('Appraisal deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete appraisal: ' + error.message);
    },
  });
}
