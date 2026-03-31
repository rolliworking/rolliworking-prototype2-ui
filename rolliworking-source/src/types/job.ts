import type { Json } from "@/integrations/supabase/types";

/**
 * Parts request structure stored in jobs.parts_requests JSONB field
 */
export interface PartsRequest {
  id: string;
  qty: number;
  price: number | null;
  status: string;
  priced_at?: string | null;
  email_sent?: boolean;
  description: string;
  requested_at: string;
  request_number: string;
  added_to_template?: boolean;
}

/**
 * Outsourced task structure
 */
export interface OutsourcedTask {
  id: string;
  status: string;
  vendor: string;
  description: string;
}

/**
 * Repair task structure (from job-utils)
 */
export interface RepairTask {
  id: string;
  code?: string;
  label: string;
  category?: string;
  price: number;
}

/**
 * Extended job type with nested inspection, watch, and customer details.
 * Used across Reports, WorkQueue, Jobs, and Dashboard pages.
 * 
 * NOTE: This is the canonical type - do not redefine in individual pages.
 * JSONB fields use `Json` type for Supabase compatibility - cast when needed.
 */
export interface JobWithDetails {
  id: string;
  status: string;
  due_date: string | null;
  intake_date: string | null;
  created_at: string;
  updated_at: string;
  services: Json;
  service_type: string | null;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  serial_number: string | null;
  estimate_number: string | null;
  notes: string | null;
  needs_liability_waiver: boolean | null;
  waiver_signed: boolean | null;
  waiver_reason: string | null;
  repair_tasks: Json;
  custom_tasks: Json;
  outsourced_tasks: Json;
  last_update_email_sent: string | null;
  is_movement_service: boolean | null;
  work_started: boolean | null;
  work_started_at: string | null;
  parts_approval_needed: boolean | null;
  parts_details: string | null;
  parts_approval_status: string | null;
  parts_requests: Json;
  estimated_cost: number | null;
  sent_email_templates: string[] | null;
  in_testing_at: string | null;
  finished_date: string | null;
  inspections: {
    id: string;
    inspection_type?: string;
    job_type?: string;
    waiver_required: boolean | null;
    waiver_signed: boolean | null;
    total_estimate?: number | null;
    watches: {
      id: string;
      brand: string;
      model: string | null;
      estimate_number: string;
      reference_number: string | null;
      customers: {
        id: string;
        name: string;
        email: string | null;
      };
    };
  } | null;
}

/**
 * Enriched job type with calculated day metrics for dialogs/reports.
 */
export interface JobWithMetrics extends JobWithDetails {
  daysWaiting?: number;
  daysLate?: number;
  daysOverdue?: number;
}

// Type guards and helpers for JSONB fields
export function getServicesArray(services: Json): string[] {
  if (Array.isArray(services)) return services as unknown as string[];
  return [];
}

export function getPartsRequestsArray(parts: Json): PartsRequest[] {
  if (Array.isArray(parts)) return parts as unknown as PartsRequest[];
  return [];
}

export function getOutsourcedTasksArray(tasks: Json): OutsourcedTask[] {
  if (Array.isArray(tasks)) return tasks as unknown as OutsourcedTask[];
  return [];
}

export function getRepairTasksArray(tasks: Json): RepairTask[] {
  if (Array.isArray(tasks)) return tasks as unknown as RepairTask[];
  return [];
}
