import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ServiceCodeMapping {
  code: string;
  jobType: string;
  weeks: number;
  label: string;
  isBracelet: boolean;
  isMovementService: boolean;
}

/** Fetch active service codes from DB and return as a lookup map */
export function useServiceCodes() {
  return useQuery({
    queryKey: ["service_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_codes")
        .select("code, job_type, weeks, label, is_bracelet, is_movement_service")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/** Build a SERVICE_CODE_MAP-compatible object from DB rows */
export function buildServiceCodeMap(
  rows: Array<{ code: string; job_type: string; weeks: number; label: string; is_bracelet: boolean; is_movement_service: boolean }>
): Record<string, ServiceCodeMapping> {
  const map: Record<string, ServiceCodeMapping> = {};
  for (const row of rows) {
    map[row.code] = {
      code: row.code,
      jobType: row.job_type,
      weeks: row.weeks,
      label: row.label,
      isBracelet: row.is_bracelet,
      isMovementService: row.is_movement_service,
    };
  }
  return map;
}

/** Standalone fetch for use outside React (edge functions, callbacks) */
export async function fetchServiceCodeMap(): Promise<Record<string, ServiceCodeMapping>> {
  const { data, error } = await supabase
    .from("service_codes")
    .select("code, job_type, weeks, label, is_bracelet, is_movement_service")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return buildServiceCodeMap(data || []);
}
