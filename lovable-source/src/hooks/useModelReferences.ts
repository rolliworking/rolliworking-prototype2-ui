import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModelReference {
  id: string;
  part_number: string;
  brand: string;
  model: string | null;
  caliber: string | null;
  notes: string | null;
  source: string | null;
}

interface SyncStats {
  portal_count: number;
  local_count: number;
  difference: number;
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors?: number;
  portal_count: number;
  local_count: number;
  message: string;
}

interface ModelReferenceInput {
  part_number: string;
  brand: string;
  model?: string | null;
  caliber?: string | null;
  notes?: string | null;
}

export function useModelReferenceLookup(partNumber: string | undefined) {
  return useQuery({
    queryKey: ['model-reference', partNumber],
    queryFn: async () => {
      if (!partNumber || partNumber.length < 3) return null;

      // Clean the part number - remove trailing dashes and whitespace
      const cleanedPartNumber = partNumber.replace(/[-\s]+$/, '').trim();
      
      if (!cleanedPartNumber) return null;

      // Try exact match first
      const { data: exactMatch, error: exactError } = await supabase
        .from('model_references')
        .select('*')
        .eq('part_number', cleanedPartNumber)
        .limit(1)
        .maybeSingle();

      if (exactMatch) return exactMatch as ModelReference;

      // Try prefix match (e.g., "168000" might match "168000-93150")
      const { data: prefixMatch, error: prefixError } = await supabase
        .from('model_references')
        .select('*')
        .ilike('part_number', `${cleanedPartNumber}%`)
        .limit(1)
        .maybeSingle();

      if (prefixMatch) return prefixMatch as ModelReference;

      // Try contains match as fallback
      const { data: containsMatch, error: containsError } = await supabase
        .from('model_references')
        .select('*')
        .ilike('part_number', `%${cleanedPartNumber}%`)
        .limit(1)
        .maybeSingle();

      return containsMatch as ModelReference | null;
    },
    enabled: !!partNumber && partNumber.length >= 3,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useModelReferences() {
  return useQuery({
    queryKey: ['model-references'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('model_references')
        .select('*')
        .order('brand', { ascending: true })
        .order('part_number', { ascending: true });

      if (error) throw error;
      return data as ModelReference[];
    },
  });
}

export function useModelReferenceStats() {
  return useQuery({
    queryKey: ['model-reference-stats'],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('model_references')
        .select('brand', { count: 'exact' });

      if (error) throw error;

      // Get unique brands count
      const uniqueBrands = new Set(data?.map(r => r.brand) || []);
      
      return {
        totalRecords: count || 0,
        uniqueBrands: uniqueBrands.size,
      };
    },
  });
}

export function useSaveModelReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ModelReferenceInput) => {
      // Call the edge function that saves locally AND syncs to RolliWorking
      const { data, error } = await supabase.functions.invoke('sync-model-to-rolliworking', {
        body: { records: [input] },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['model-references'] });
      queryClient.invalidateQueries({ queryKey: ['model-reference-stats'] });
      
      if (data.synced_to_rolliworking) {
        toast.success('Model reference saved and synced to RolliWorking');
      } else {
        toast.warning('Saved locally, but RolliWorking sync failed');
      }
    },
    onError: (error) => {
      console.error('Failed to save model reference:', error);
      toast.error('Failed to save model reference');
    },
  });
}

export function useModelReferenceSyncStats() {
  return useQuery({
    queryKey: ['model-reference-sync-stats'],
    queryFn: async (): Promise<SyncStats> => {
      const { data, error } = await supabase.functions.invoke('pull-model-references', {
        body: null,
        method: 'GET',
      });

      // Parse URL with count param
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pull-model-references?count=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sync stats');
      }

      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

export function usePullModelReferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (since?: string): Promise<SyncResult> => {
      const url = since 
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pull-model-references?since=${encodeURIComponent(since)}`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pull-model-references`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pull from Portal');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['model-references'] });
      queryClient.invalidateQueries({ queryKey: ['model-reference-stats'] });
      queryClient.invalidateQueries({ queryKey: ['model-reference-sync-stats'] });
      
      toast.success(data.message || `Synced ${data.synced} records from Portal`);
    },
    onError: (error) => {
      console.error('Failed to pull from Portal:', error);
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}
