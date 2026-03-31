import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Job = Tables<"jobs">;
export type JobInsert = TablesInsert<"jobs">;

const JOBS_PER_PAGE = 50;

export interface UseJobsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface JobsResult {
  jobs: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Paginated jobs hook for Work Queue
export function useJobsPaginated(options: UseJobsOptions = {}) {
  const { page = 1, pageSize = JOBS_PER_PAGE, status } = options;
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: ["jobs", "paginated", page, pageSize, status],
    queryFn: async (): Promise<JobsResult> => {
      // Build query
      let query = supabase
        .from("jobs")
        .select(`
          *,
          inspections(
            *,
            watches(
              *,
              customers(*)
            )
          )
        `, { count: "exact" });

      // Apply status filter if not "all" or "finished"
      if (status && status !== "all") {
        if (status === "active") {
          query = query.neq("status", "finished");
        } else {
          query = query.eq("status", status);
        }
      }

      const { data, error, count } = await query
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      return {
        jobs: data || [],
        totalCount: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Original hook for backward compatibility (loads all jobs up to 500)
export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          inspections(
            *,
            watches(
              *,
              customers(*)
            )
          )
        `)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Check if a job already exists for an inspection
export async function checkJobExistsForInspection(inspectionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("inspection_id", inspectionId)
    .maybeSingle();
  
  if (error) throw error;
  return !!data;
}

// Get existing job for an inspection
export async function getJobForInspection(inspectionId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("inspection_id", inspectionId)
    .maybeSingle();
  
  if (error) throw error;
  return data as Job | null;
}

// Find job by estimate number (via watch -> inspection -> job chain)
export async function findJobByEstimateNumber(estimateNumber: string): Promise<{ jobId: string; watchId: string } | null> {
  const { data, error } = await supabase
    .from("watches")
    .select(`
      id,
      inspections!inner(
        id,
        jobs!inner(id)
      )
    `)
    .eq("estimate_number", estimateNumber)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  const inspection = (data.inspections as any)?.[0];
  const job = inspection?.jobs?.[0];
  
  if (!job) return null;
  
  return { jobId: job.id, watchId: data.id };
}

// Find watch by estimate number or reference number.
// When `model` is provided, only match a watch with the SAME model/description
// under that estimate number. This supports multi-item estimates (e.g. "1 of 5", "2 of 5").
export async function findWatchByEstimateOrReference(
  estimateNumber: string, 
  referenceNumber?: string,
  model?: string
): Promise<{ watchId: string; hasJob: boolean; jobId?: string } | null> {
  // First check by estimate number
  let query = supabase
    .from("watches")
    .select(`
      id,
      model,
      inspections(
        id,
        jobs(id)
      )
    `)
    .eq("estimate_number", estimateNumber);

  // If model is provided, look for exact match on that model first
  if (model?.trim()) {
    const { data: exactMatch, error: exactError } = await query
      .eq("model", model.trim())
      .maybeSingle();
    
    if (exactError && !exactError.message.includes("multiple")) throw exactError;
    
    if (exactMatch) {
      const inspection = (exactMatch.inspections as any)?.[0];
      const job = inspection?.jobs?.[0];
      return {
        watchId: exactMatch.id,
        hasJob: !!job,
        jobId: job?.id
      };
    }
    
    // Model provided but no exact match found — this is a NEW item under the same estimate
    // Don't fall through to a generic estimate match, so we create a new watch record
    return null;
  }

  // No model provided — legacy behavior: match any watch with this estimate
  const { data: watches, error: estimateError } = await supabase
    .from("watches")
    .select(`
      id,
      model,
      inspections(
        id,
        jobs(id)
      )
    `)
    .eq("estimate_number", estimateNumber)
    .limit(1)
    .maybeSingle();
  
  if (estimateError && !estimateError.message.includes("multiple")) throw estimateError;
  
  if (watches) {
    const inspection = (watches.inspections as any)?.[0];
    const job = inspection?.jobs?.[0];
    return {
      watchId: watches.id,
      hasJob: !!job,
      jobId: job?.id
    };
  }
  
  // If reference number provided, check by that too
  if (referenceNumber?.trim()) {
    const { data: watchByRef, error: refError } = await supabase
      .from("watches")
      .select(`
        id,
        inspections(
          id,
          jobs(id)
        )
      `)
      .eq("reference_number", referenceNumber)
      .maybeSingle();
    
    if (refError) throw refError;
    
    if (watchByRef) {
      const inspection = (watchByRef.inspections as any)?.[0];
      const job = inspection?.jobs?.[0];
      return {
        watchId: watchByRef.id,
        hasJob: !!job,
        jobId: job?.id
      };
    }
  }
  
  return null;
}

// Find ANY watch by estimate number to get customer info (ignores model).
// Used by barcode scan to prefill customer data even for multi-item estimates.
export async function findCustomerByEstimate(
  estimateNumber: string
): Promise<{ watchId: string; customerId: string } | null> {
  const { data, error } = await supabase
    .from("watches")
    .select("id, customer_id")
    .eq("estimate_number", estimateNumber)
    .limit(1);
  
  if (error) throw error;
  if (data && data.length > 0) {
    return { watchId: data[0].id, customerId: data[0].customer_id };
  }
  return null;
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: JobInsert) => {
      // Check for existing job with same inspection_id to prevent duplicates
      if (job.inspection_id) {
        const exists = await checkJobExistsForInspection(job.inspection_id);
        if (exists) {
          throw new Error("A job already exists for this inspection");
        }
      }
      
      // Avoid .select().single() to prevent iOS Safari JSON coercion errors
      const { error } = await supabase
        .from("jobs")
        .insert(job);
      if (error) throw error;
      return job as JobInsert;
    },
    onSuccess: async () => {
      // Force refetch for iOS Safari compatibility
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.refetchQueries({ queryKey: ["jobs"] });
    },
  });
}

// Upsert job: update existing job if one exists for the inspection or estimate number, otherwise create new
export function useUpsertJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: JobInsert) => {
      // ── 0. Resolve the canonical estimate number from the watch (source of truth) ──
      // This prevents barcode misreads from corrupting the job record
      let canonicalEstimate = job.estimate_number;
      if (job.inspection_id) {
        const { data: inspectionData } = await supabase
          .from("inspections")
          .select("watch_id, watches(estimate_number, customer_id, customers(name))")
          .eq("id", job.inspection_id)
          .maybeSingle();

        const watchEstimate = (inspectionData?.watches as any)?.estimate_number;
        if (watchEstimate) {
          // Always prefer the watch's estimate number over whatever was scanned
          if (canonicalEstimate && canonicalEstimate !== watchEstimate) {
            console.warn(
              `[useUpsertJob] Estimate mismatch: scanned="${canonicalEstimate}" vs watch="${watchEstimate}". Using watch value.`
            );
          }
          canonicalEstimate = watchEstimate;
          job = { ...job, estimate_number: canonicalEstimate };

          // Also cross-validate customer — warn if names don't match
          const watchCustomerName = (inspectionData?.watches as any)?.customers?.name;
          if (watchCustomerName && job.client_name && watchCustomerName !== job.client_name) {
            console.warn(
              `[useUpsertJob] Customer mismatch: job="${job.client_name}" vs watch="${watchCustomerName}". Using watch customer.`
            );
            job = { ...job, client_name: watchCustomerName };
          }
        }
      }

      // ── 1. Check for existing job with same inspection_id ──
      if (job.inspection_id) {
        const existingJob = await getJobForInspection(job.inspection_id);
        
        if (existingJob) {
          const { error } = await supabase
            .from("jobs")
            .update({
              estimate_number: canonicalEstimate || existingJob.estimate_number,
              client_name: job.client_name || existingJob.client_name,
              due_date: job.due_date,
              service_type: job.service_type,
            })
            .eq("id", existingJob.id);
          if (error) throw error;
          return { wasUpdated: true, id: existingJob.id };
        }
      }

      // ── 2. Check for existing job with same estimate_number ──
      if (canonicalEstimate) {
        const { data: existingByEstimate } = await supabase
          .from("jobs")
          .select("id, inspection_id, client_name")
          .eq("estimate_number", canonicalEstimate)
          .maybeSingle();

        if (existingByEstimate) {
          // Cross-validate: if there's already a job for this estimate with a different customer, 
          // log a warning — this is a data integrity issue
          if (existingByEstimate.client_name && job.client_name &&
              existingByEstimate.client_name !== job.client_name) {
            console.error(
              `[useUpsertJob] DUPLICATE ESTIMATE CONFLICT: est="${canonicalEstimate}" ` +
              `existing="${existingByEstimate.client_name}" vs new="${job.client_name}"`
            );
          }

          // Link the inspection and update the job
          const { error } = await supabase
            .from("jobs")
            .update({
              inspection_id: job.inspection_id || existingByEstimate.inspection_id,
              due_date: job.due_date,
              service_type: job.service_type,
            })
            .eq("id", existingByEstimate.id);
          if (error) throw error;
          return { wasUpdated: true, id: existingByEstimate.id };
        }
      }

      // ── 3. Also check via watch -> estimate_number chain ──
      if (job.inspection_id && canonicalEstimate) {
        const { data: existingByWatchEst } = await supabase
          .from("jobs")
          .select("id")
          .eq("estimate_number", canonicalEstimate)
          .maybeSingle();

        if (existingByWatchEst) {
          const { error } = await supabase
            .from("jobs")
            .update({
              inspection_id: job.inspection_id,
              due_date: job.due_date,
              service_type: job.service_type,
            })
            .eq("id", existingByWatchEst.id);
          if (error) throw error;
          return { wasUpdated: true, id: existingByWatchEst.id };
        }
      }

      // ── 4. No existing job found — create new ──
      const { error } = await supabase.from("jobs").insert(job);
      if (error) throw error;
      return { wasUpdated: false };
    },
    onSuccess: async () => {
      // Force refetch for iOS Safari compatibility
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.refetchQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Job> & { id: string }) => {
      // Avoid .single() to prevent iOS Safari JSON coercion errors.
      // Use .select() (array) so we can detect RLS-denied updates (0 rows affected).
      const { data, error } = await supabase
        .from("jobs")
        .update(updates)
        .eq("id", id)
        .select("id,status,work_started,work_started_at,in_testing_at,updated_at");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update blocked (insufficient permissions or job not found)");
      }

      return data[0] as Pick<
        Job,
        "id" | "status" | "work_started" | "work_started_at" | "in_testing_at" | "updated_at"
      >;
    },
    onSuccess: async (updated) => {
      // Optimistically patch the cached jobs list so the UI updates immediately (esp. iOS Safari).
      queryClient.setQueryData(["jobs"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j) => (j?.id === updated.id ? { ...j, ...updated } : j));
      });

      // Keep a refetch as a safety net for nested joins.
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.refetchQueries({ queryKey: ["jobs"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Use this hook for status-only changes – bypasses RLS so Staff can update.
// ─────────────────────────────────────────────────────────────────────────────
export function useSetJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_job_status", {
        job_id: id,
        new_status: status,
      });
      if (error) throw error;
      return { id, status };
    },
    onSuccess: async ({ id, status }) => {
      // Optimistically patch the cached jobs list
      queryClient.setQueryData(["jobs"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j: any) =>
          j?.id === id ? { ...j, status, updated_at: new Date().toISOString() } : j
        );
      });
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.refetchQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
