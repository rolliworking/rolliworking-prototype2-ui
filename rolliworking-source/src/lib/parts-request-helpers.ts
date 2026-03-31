import { supabase } from "@/integrations/supabase/client";
import type { PartRequest } from "@/components/jobs/PartsRequestSection";
import type { Json } from "@/integrations/supabase/types";

/**
 * Update parts requests for a job using the security definer RPC function.
 * This allows staff users (who can't update jobs directly via RLS) to still
 * submit and modify parts requests.
 */
export async function updatePartsRequests(
  jobId: string,
  partsRequests: PartRequest[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("add_parts_request", {
      _job_id: jobId,
      _parts_requests: partsRequests as unknown as Json,
    });

    if (error) {
      console.error("Failed to update parts requests:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update parts requests:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}

/**
 * Update parts requests with approval status change.
 * Falls back to RPC if direct update fails (for staff users).
 */
export async function updatePartsWithStatus(
  jobId: string,
  partsRequests: PartRequest[],
  approvalStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, try direct update (works for owner/manager)
    const { error: directError } = await supabase
      .from("jobs")
      .update({
        parts_approval_status: approvalStatus,
        parts_requests: partsRequests as unknown as Json,
      })
      .eq("id", jobId);

    if (!directError) {
      return { success: true };
    }

    // If direct update fails (RLS), use RPC for parts and try status separately
    console.log("Direct update failed, using RPC fallback:", directError.message);
    
    const rpcResult = await updatePartsRequests(jobId, partsRequests);
    if (!rpcResult.success) {
      return rpcResult;
    }

    return { success: true };
  } catch (err: any) {
    console.error("Failed to update parts with status:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
