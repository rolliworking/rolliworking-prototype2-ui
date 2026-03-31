import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Watch = Tables<"watches">;
export type WatchInsert = TablesInsert<"watches">;

// Type for job-based watch references (from jobs table, not watches table)
export type JobWatchRef = {
  id: string; // job id prefixed with "job-"
  brand: string;
  model: string | null;
  reference_number: string | null;
  estimate_number: string;
  isFromJob: true;
  jobId: string;
};

// Combined type for selector
export type WatchOrJobRef = Watch | JobWatchRef;

// Re-export from centralized location for backwards compatibility
export { WATCH_BRANDS, ROLEX_MODELS, TUDOR_MODELS, getModelsByBrand } from "@/lib/watch-constants";

export function useWatchesByCustomer(customerId?: string) {
  return useQuery({
    queryKey: ["watches", "customer", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("watches")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Watch[];
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Fetch watches AND job references for a customer
export function useWatchesAndJobsByCustomer(customerId?: string) {
  return useQuery({
    queryKey: ["watches-and-jobs", "customer", customerId],
    queryFn: async (): Promise<WatchOrJobRef[]> => {
      if (!customerId) return [];

      // Fetch watches
      const { data: watches, error: watchError } = await supabase
        .from("watches")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (watchError) throw watchError;

      // Fetch jobs with serial_number (reference) for this customer
      const { data: jobs, error: jobError } = await supabase
        .from("jobs")
        .select("id, watch_brand, watch_model, serial_number, estimate_number")
        .eq("client_id", customerId)
        .not("serial_number", "is", null)
        .order("created_at", { ascending: false });
      if (jobError) throw jobError;

      // Get existing reference numbers from watches to avoid duplicates
      const watchRefs = new Set(
        (watches || [])
          .map((w) => w.reference_number?.toLowerCase())
          .filter(Boolean)
      );

      // Convert jobs to JobWatchRef, excluding ones already in watches
      const jobRefs: JobWatchRef[] = (jobs || [])
        .filter((j) => j.serial_number && !watchRefs.has(j.serial_number.toLowerCase()))
        .map((j) => ({
          id: `job-${j.id}`,
          brand: j.watch_brand || "Unknown",
          model: j.watch_model || null,
          reference_number: j.serial_number,
          estimate_number: j.estimate_number || "",
          isFromJob: true as const,
          jobId: j.id,
        }));

      return [...(watches || []), ...jobRefs];
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watch: WatchInsert) => {
      const { data, error } = await supabase
        .from("watches")
        .insert(watch)
        .select()
        .single();
      if (error) throw error;
      return data as Watch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["watches"] });
      queryClient.invalidateQueries({ queryKey: ["watches", "customer", data.customer_id] });
    },
  });
}

export function useUpdateWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Watch> & { id: string }) => {
      const { data, error } = await supabase
        .from("watches")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Watch;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["watches"] });
      queryClient.invalidateQueries({ queryKey: ["watches", "customer", data.customer_id] });
    },
  });
}
