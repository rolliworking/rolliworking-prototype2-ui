import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Watchmaker {
  id: string;
  name: string;
  initials: string;
  is_active: boolean;
  weekly_target: number;
  weekly_testing_target: number;
  created_at: string;
  updated_at: string;
}

export function useWatchmakers() {
  return useQuery({
    queryKey: ["watchmakers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchmakers")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Watchmaker[];
    },
  });
}

export function useActiveWatchmakers() {
  return useQuery({
    queryKey: ["watchmakers", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchmakers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as Watchmaker[];
    },
  });
}

export function useCreateWatchmaker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; initials: string }) => {
      const { data: result, error } = await supabase
        .from("watchmakers")
        .insert({
          name: data.name,
          initials: data.initials.toUpperCase().slice(0, 3),
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchmakers"] });
    },
  });
}

export function useUpdateWatchmaker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; initials?: string; is_active?: boolean; weekly_target?: number; weekly_testing_target?: number }) => {
      const updates: Record<string, any> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.initials !== undefined) updates.initials = data.initials.toUpperCase().slice(0, 3);
      if (data.is_active !== undefined) updates.is_active = data.is_active;
      if (data.weekly_target !== undefined) updates.weekly_target = data.weekly_target;
      if (data.weekly_testing_target !== undefined) updates.weekly_testing_target = data.weekly_testing_target;
      
      const { data: result, error } = await supabase
        .from("watchmakers")
        .update(updates)
        .eq("id", data.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchmakers"] });
    },
  });
}

export function useDeleteWatchmaker() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("watchmakers")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchmakers"] });
    },
  });
}
