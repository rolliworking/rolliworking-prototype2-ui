import { format } from "date-fns";

/**
 * Escapes a value for CSV format
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  
  const stringValue = typeof value === "object" 
    ? JSON.stringify(value) 
    : String(value);
  
  // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Converts an array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return "";

  // Header row
  const headerRow = columns.map(col => escapeCSVValue(col.header)).join(",");

  // Data rows
  const dataRows = data.map(row =>
    columns.map(col => escapeCSVValue(row[col.key])).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Triggers a download of a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate timestamped filename
 */
export function getExportFilename(baseName: string): string {
  const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
  return `${baseName}_${timestamp}.csv`;
}

// Column definitions for each exportable entity
export const CUSTOMER_COLUMNS = [
  { key: "id" as const, header: "ID" },
  { key: "name" as const, header: "Name" },
  { key: "email" as const, header: "Email" },
  { key: "phone" as const, header: "Phone" },
  { key: "created_at" as const, header: "Created At" },
  { key: "updated_at" as const, header: "Updated At" },
];

export const JOB_COLUMNS = [
  { key: "id" as const, header: "ID" },
  { key: "status" as const, header: "Status" },
  { key: "client_name" as const, header: "Client Name" },
  { key: "client_email" as const, header: "Client Email" },
  { key: "watch_brand" as const, header: "Watch Brand" },
  { key: "watch_model" as const, header: "Watch Model" },
  { key: "serial_number" as const, header: "Serial Number" },
  { key: "estimate_number" as const, header: "Estimate Number" },
  { key: "service_type" as const, header: "Service Type" },
  { key: "services" as const, header: "Services" },
  { key: "intake_date" as const, header: "Intake Date" },
  { key: "due_date" as const, header: "Due Date" },
  { key: "estimated_cost" as const, header: "Estimated Cost" },
  { key: "needs_liability_waiver" as const, header: "Needs Waiver" },
  { key: "waiver_signed" as const, header: "Waiver Signed" },
  { key: "work_started" as const, header: "Work Started" },
  { key: "work_started_at" as const, header: "Work Started At" },
  { key: "parts_approval_status" as const, header: "Parts Status" },
  { key: "notes" as const, header: "Notes" },
  { key: "created_at" as const, header: "Created At" },
  { key: "updated_at" as const, header: "Updated At" },
];

export const EMAIL_TEMPLATE_COLUMNS = [
  { key: "id" as const, header: "ID" },
  { key: "name" as const, header: "Name" },
  { key: "type" as const, header: "Type" },
  { key: "subject" as const, header: "Subject" },
  { key: "body" as const, header: "Body" },
  { key: "is_active" as const, header: "Is Active" },
  { key: "created_at" as const, header: "Created At" },
  { key: "updated_at" as const, header: "Updated At" },
];

export const WATCH_COLUMNS = [
  { key: "id" as const, header: "ID" },
  { key: "customer_id" as const, header: "Customer ID" },
  { key: "brand" as const, header: "Brand" },
  { key: "model" as const, header: "Model" },
  { key: "reference_number" as const, header: "Reference Number" },
  { key: "estimate_number" as const, header: "Estimate Number" },
  { key: "target_date" as const, header: "Target Date" },
  { key: "created_at" as const, header: "Created At" },
  { key: "updated_at" as const, header: "Updated At" },
];

export const INSPECTION_COLUMNS = [
  { key: "id" as const, header: "ID" },
  { key: "inspection_number" as const, header: "Inspection Number" },
  { key: "watch_id" as const, header: "Watch ID" },
  { key: "inspection_type" as const, header: "Inspection Type" },
  { key: "job_type" as const, header: "Job Type" },
  { key: "status" as const, header: "Status" },
  { key: "total_estimate" as const, header: "Total Estimate" },
  { key: "waiver_required" as const, header: "Waiver Required" },
  { key: "waiver_signed" as const, header: "Waiver Signed" },
  { key: "notes" as const, header: "Notes" },
  { key: "created_at" as const, header: "Created At" },
  { key: "updated_at" as const, header: "Updated At" },
];
