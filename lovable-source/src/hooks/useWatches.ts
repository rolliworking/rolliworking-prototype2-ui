import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Watch, WatchFormData } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useWatches(customerId?: string) {
  return useQuery({
    queryKey: ['watches', customerId],
    queryFn: async () => {
      let query = supabase
        .from('watches')
        .select('*')
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Watch[];
    },
  });
}

export function useWatch(watchId: string) {
  return useQuery({
    queryKey: ['watch', watchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watches')
        .select('*')
        .eq('id', watchId)
        .single();

      if (error) throw error;
      return data as Watch;
    },
    enabled: !!watchId,
  });
}

export function useSearchWatchesBySerial(serialNumber: string) {
  return useQuery({
    queryKey: ['watches', 'serial', serialNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watches')
        .select(`
          *,
          customer:customers(*)
        `)
        .ilike('serial_number', `%${serialNumber}%`);

      if (error) throw error;
      return data;
    },
    enabled: serialNumber.length >= 3,
  });
}

export function useCreateWatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      customerId,
      watchData,
    }: {
      customerId: string;
      watchData: WatchFormData;
    }) => {
      const { data, error } = await supabase
        .from('watches')
        .insert({
          customer_id: customerId,
          ...watchData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watches'] });
      toast({
        title: 'Watch Added',
        description: 'The watch has been registered successfully.',
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

export function useUpdateWatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      watchId,
      data,
    }: {
      watchId: string;
      data: Partial<WatchFormData>;
    }) => {
      const { data: result, error } = await supabase
        .from('watches')
        .update(data)
        .eq('id', watchId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watches'] });
      queryClient.invalidateQueries({ queryKey: ['watch', variables.watchId] });
      toast({
        title: 'Watch Updated',
        description: 'The watch information has been updated.',
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
