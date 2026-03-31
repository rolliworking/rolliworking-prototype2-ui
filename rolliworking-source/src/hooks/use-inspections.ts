import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Inspection = Tables<"inspections">;
export type InspectionInsert = TablesInsert<"inspections">;

export const INSPECTION_TYPES = [
  { value: "complete_watch", label: "Complete Watch", weeksToAdd: 8 },
  { value: "bracelet_only", label: "Bracelet Only", weeksToAdd: 4 },
] as const;

export const JOB_TYPES = [
  { value: "movement_service", label: "Movement Service" },
  { value: "bracelet_work", label: "Bracelet Work" },
  { value: "case_work", label: "Case Work" },
  { value: "general_repair", label: "General Repair" },
] as const;

export const CONDITION_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "very_good", label: "Very Good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "none", label: "NONE" },
] as const;

export function useInspections(search?: string) {
  return useQuery({
    queryKey: ["inspections", search],
    queryFn: async () => {
      const searchTerm = search?.trim() || "";
      
      // If searching, search across all inspections via related tables
      if (searchTerm) {
        // Search by customer name or email
        const { data: byCustomer, error: customerError } = await supabase
          .from("inspections")
          .select(`
            *,
            watches!inner(
              *,
              customers!inner(*)
            )
          `)
          .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`, { referencedTable: "watches.customers" })
          .order("created_at", { ascending: false })
          .limit(250);
        
        if (customerError) throw customerError;
        
        // Search by watch reference number or estimate number
        const { data: byRef, error: refError } = await supabase
          .from("inspections")
          .select(`
            *,
            watches!inner(
              *,
              customers!inner(*)
            )
          `)
          .or(`reference_number.ilike.%${searchTerm}%,estimate_number.ilike.%${searchTerm}%`, { referencedTable: "watches" })
          .order("created_at", { ascending: false })
          .limit(250);
        
        if (refError) throw refError;
        
        // Merge and deduplicate results
        const allResults = [...(byCustomer || [])];
        const existingIds = new Set(allResults.map((i) => i.id));
        
        for (const inspection of byRef || []) {
          if (!existingIds.has(inspection.id)) {
            allResults.push(inspection);
            existingIds.add(inspection.id);
          }
        }
        
        // Sort by created_at descending
        return allResults.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      
      // Default: return most recent 250
      const { data, error } = await supabase
        .from("inspections")
        .select(`
          *,
          watches!inner(
            *,
            customers!inner(*)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspection: InspectionInsert) => {
      const { data, error } = await supabase
        .from("inspections")
        .insert(inspection)
        .select()
        .single();
      if (error) throw error;
      return data as Inspection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Inspection> & { id: string }) => {
      const { data, error } = await supabase
        .from("inspections")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Inspection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, get the inspection to find the associated watch_id
      const { data: inspection, error: fetchError } = await supabase
        .from("inspections")
        .select("watch_id")
        .eq("id", id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const watchId = inspection?.watch_id;
      
      // Delete the inspection first
      const { error: deleteInspectionError } = await supabase
        .from("inspections")
        .delete()
        .eq("id", id);
      if (deleteInspectionError) throw deleteInspectionError;
      
      // Then delete the associated watch record if it exists
      if (watchId) {
        // Check if this watch has other inspections referencing it
        const { data: otherInspections } = await supabase
          .from("inspections")
          .select("id")
          .eq("watch_id", watchId)
          .limit(1);
        
        // Only delete the watch if no other inspections reference it
        if (!otherInspections || otherInspections.length === 0) {
          const { error: deleteWatchError } = await supabase
            .from("watches")
            .delete()
            .eq("id", watchId);
          if (deleteWatchError) throw deleteWatchError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({ queryKey: ["watches"] });
    },
  });
}
