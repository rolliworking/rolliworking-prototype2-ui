import { differenceInDays, parseISO } from "date-fns";

export type JobStatus = 
  | "intake" 
  | "inspection" 
  | "waiting_approval" 
  | "in_queue" 
  | "uncased"
  | "in_progress" 
  | "parts_approval"
  | "parts_on_order"
  | "in_testing" 
  | "finished";

export type ServiceType =
  | "modern_movement_service"
  | "vintage_movement_service"
  | "antique_movement_service"
  | "bracelet_repair"
  | "gold_bracelet_repair"
  | "case_restoration"
  | "warranty"
  | "small_job";

export const JOB_STATUS_ORDER: JobStatus[] = [
  "intake",
  "inspection",
  "waiting_approval",
  "in_queue",
  "uncased",
  "in_progress",
  "parts_approval",
  "parts_on_order",
  "in_testing",
  "finished",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  intake: "Intake",
  inspection: "Inspection",
  waiting_approval: "Waiting Approval",
  in_queue: "In Queue",
  uncased: "Uncased",
  in_progress: "In Progress",
  parts_approval: "Parts Approval",
  parts_on_order: "Parts On Order",
  in_testing: "In Testing",
  finished: "Finished",
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  intake: "bg-slate-100 text-slate-700 border-slate-200",
  inspection: "bg-blue-100 text-blue-700 border-blue-200",
  waiting_approval: "bg-amber-100 text-amber-700 border-amber-200",
  in_queue: "bg-purple-100 text-purple-700 border-purple-200",
  uncased: "bg-violet-100 text-violet-700 border-violet-200",
  in_progress: "bg-indigo-100 text-indigo-700 border-indigo-200",
  parts_approval: "bg-orange-100 text-orange-700 border-orange-200",
  parts_on_order: "bg-rose-100 text-rose-700 border-rose-200",
  in_testing: "bg-cyan-100 text-cyan-700 border-cyan-200",
  finished: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  modern_movement_service: "Modern Movement Service",
  vintage_movement_service: "Vintage Movement Service",
  antique_movement_service: "Antique Movement Service",
  bracelet_repair: "Bracelet Repair",
  gold_bracelet_repair: "Gold Bracelet Repair",
  case_restoration: "Case Restoration",
  warranty: "Warranty",
  small_job: "Small Job",
};

export const SERVICE_DURATIONS: Record<ServiceType, number> = {
  modern_movement_service: 28, // 4 weeks
  vintage_movement_service: 84, // 12 weeks
  antique_movement_service: 182, // 6 months (26 weeks)
  bracelet_repair: 28, // 4 weeks
  gold_bracelet_repair: 42, // 6 weeks
  case_restoration: 21, // 3 weeks
  warranty: 28, // 4 weeks
  small_job: 14, // 2 weeks
};

export interface RepairTask {
  id: string;
  task: string;
  is_outsourced: boolean;
  outsource_vendor?: string;
  outsource_status?: "pending" | "sent" | "finished";
  completed: boolean;
}

export interface CustomTask {
  id: string;
  description: string;
  completed: boolean;
}

export function isMovementService(services: string[]): boolean {
  return services.some(s => 
    s === "modern_movement_service" || s === "vintage_movement_service" || s === "antique_movement_service"
  );
}

export function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return differenceInDays(parseISO(dueDate), new Date());
}

export function isJobLate(
  dueDate: string | null,
  status: JobStatus,
  isMovement: boolean
): boolean {
  if (!isMovement || !dueDate) return false;
  const daysUntil = getDaysUntilDue(dueDate);
  if (daysUntil === null) return false;
  
  const earlyStatuses: JobStatus[] = ["intake", "inspection", "waiting_approval", "in_queue"];
  return daysUntil <= 21 && earlyStatuses.includes(status);
}

export function isJobDueSoon(
  dueDate: string | null,
  isMovement: boolean
): boolean {
  if (!isMovement || !dueDate) return false;
  const daysUntil = getDaysUntilDue(dueDate);
  if (daysUntil === null) return false;
  return daysUntil <= 14 && daysUntil >= 0;
}

/**
 * Get the email reminder interval (in days) based on job/service type.
 * Modern = 14 days, Antique = 18 days, Vintage = 21 days, default = 14 days.
 */
export function getEmailReminderInterval(jobType: string | null | undefined): number {
  if (!jobType) return 14;
  const t = jobType.toLowerCase();
  if (t.includes("vintage")) return 21;
  if (t.includes("antique")) return 30;
  // Modern, chrono, case_work, warranty, and everything else
  return 14;
}

export function hasOutsourcedPending(repairTasks: RepairTask[]): boolean {
  return repairTasks.some(t => t.is_outsourced && t.outsource_status !== "finished");
}

export function getMaxServiceDuration(services: ServiceType[]): number {
  if (services.length === 0) return 28; // Default 4 weeks
  return Math.max(...services.map(s => SERVICE_DURATIONS[s] || 28));
}

// Re-export from centralized location for backwards compatibility
export { ROLEX_MODELS, WATCH_BRANDS } from "@/lib/watch-constants";
