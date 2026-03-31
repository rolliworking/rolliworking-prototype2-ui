import { useState } from "react";
import { Link } from "react-router-dom";
import { differenceInDays, format, parseISO } from "date-fns";
import { AlertTriangle, Clock, FileWarning, Truck, Save, Loader2, Package, Watch, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_STATUS_ORDER,
  SERVICE_TYPE_LABELS,
  type JobStatus,
  type RepairTask,
} from "@/lib/job-utils";

interface OutsourcedTask {
  id: string;
  description?: string;
  name?: string;
  status: "pending" | "sent" | "finished";
}

interface JobCardProps {
  job: {
    id: string;
    status: string;
    due_date: string | null;
    is_movement_service?: boolean | null;
    needs_liability_waiver?: boolean | null;
    waiver_signed?: boolean | null;
    services?: unknown;
    service_type?: string | null;
    repair_tasks?: unknown;
    outsourced_tasks?: unknown;
    parts_approval_status?: string | null;
    client_name?: string | null;
    watch_brand?: string | null;
    watch_model?: string | null;
    inspections?: {
      waiver_required: boolean | null;
      waiver_signed: boolean | null;
      job_type?: string;
      watches?: {
        brand: string;
        model: string | null;
        estimate_number: string;
        customers?: {
          name: string;
          email: string | null;
        };
      };
    } | null;
  };
  compact?: boolean;
  highlight?: "warning" | "danger" | null;
  showOutsourced?: boolean;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => Promise<void>;
}

export function JobCard({ job, compact, highlight, showOutsourced, onStatusChange }: JobCardProps) {
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Handle both inspection-linked jobs and standalone jobs
  const watch = job.inspections?.watches;
  const customer = watch?.customers;
  const customerName = customer?.name || job.client_name || "Unknown Client";
  const watchBrand = watch?.brand || job.watch_brand || "Unknown";
  const watchModel = watch?.model || job.watch_model || "";
  const estimateNumber = watch?.estimate_number || "";
  const originalStatus = job.status as JobStatus;
  const displayStatus = pendingStatus ?? originalStatus;
  const hasChanges = pendingStatus !== null && pendingStatus !== originalStatus;

  const handleStatusClick = (newStatus: JobStatus, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newStatus !== originalStatus) {
      setPendingStatus(newStatus);
    } else {
      setPendingStatus(null);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pendingStatus || !onStatusChange) return;
    
    setIsSaving(true);
    try {
      await onStatusChange(job.id, pendingStatus);
      setPendingStatus(null);
    } finally {
      setIsSaving(false);
    }
  };
  
  const daysUntilDue = job.due_date 
    ? differenceInDays(parseISO(job.due_date), new Date())
    : null;

  // Get outsourced tasks from the dedicated field
  const outsourcedTasks = Array.isArray(job.outsourced_tasks) 
    ? (job.outsourced_tasks as OutsourcedTask[])
    : [];
  
  const outsourcedPending = outsourcedTasks.filter(t => t.status !== "finished");

  // Also check repair_tasks for legacy compatibility
  const legacyOutsourced = Array.isArray(job.repair_tasks) 
    ? (job.repair_tasks as RepairTask[]).filter(
        (t: RepairTask) => t.is_outsourced && t.outsource_status !== "finished"
      )
    : [];
  
  const services = Array.isArray(job.services) ? job.services as string[] : [];

  // Only show alert badges for active (non-finished) jobs
  const isActiveJob = job.status !== "finished";
  
  // Check both job-level waiver AND inspection-level waiver (only for active jobs)
  const needsWaiver = isActiveJob && (
    (job.needs_liability_waiver && !job.waiver_signed) || 
    (job.inspections?.waiver_required && !job.inspections?.waiver_signed)
  );

  // Check for pending parts approval (only for active jobs)
  const hasPartsPending = isActiveJob && job.parts_approval_status === "pending";

  // Determine if this is a watchmaker job (anything except case_work)
  const jobType = job.inspections?.job_type || job.service_type;
  const isWatchmakerJob = jobType !== "case_work";
  const isCaseworkJob = jobType === "case_work";

  const currentStatusIndex = JOB_STATUS_ORDER.indexOf(displayStatus);

  return (
    <Card
      className={cn(
        "p-3 transition-all hover:shadow-md",
        highlight === "warning" && "bg-amber-50 border-amber-200",
        highlight === "danger" && "bg-red-50 border-red-200",
        hasChanges && "ring-2 ring-primary"
      )}
    >
      <Link to={`/new-job?edit=${job.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Watch info */}
            <p className="font-medium text-sm truncate">
              {watchBrand} {watchModel}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {customerName}
            </p>
            
            {/* Outsourced task details - show under client name */}
            {outsourcedPending.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {outsourcedPending.slice(0, 3).map((task) => (
                  <p key={task.id} className="text-[10px] text-blue-600 flex items-center gap-1">
                    <Truck className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">
                      {task.description || task.name}
                      <span className="text-blue-400 ml-1">
                        ({task.status === "pending" ? "Pending" : "Sent"})
                      </span>
                    </span>
                  </p>
                ))}
                {outsourcedPending.length > 3 && (
                  <p className="text-[10px] text-blue-500">
                    +{outsourcedPending.length - 3} more outsourced
                  </p>
                )}
              </div>
            )}
            
            {/* Services (hide in compact mode) */}
            {!compact && services.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {services.slice(0, 2).map((service) => (
                  <Badge key={service} variant="outline" className="text-[10px] px-1 py-0">
                    {SERVICE_TYPE_LABELS[service as keyof typeof SERVICE_TYPE_LABELS] || service}
                  </Badge>
                ))}
                {services.length > 2 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    +{services.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Due date */}
            {job.due_date && (
              <span
                className={cn(
                  "text-[10px]",
                  daysUntilDue !== null && daysUntilDue < 0 && "text-destructive font-medium",
                  daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 14 && "text-amber-600 font-medium",
                  daysUntilDue !== null && daysUntilDue > 14 && "text-muted-foreground"
                )}
              >
                {format(parseISO(job.due_date), "M/d/yy")}
                {daysUntilDue !== null && (
                  <span className="ml-1">
                    ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d late` : `${daysUntilDue}d`})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Alert badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {isWatchmakerJob && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-sky-50 text-sky-700 border-sky-200 gap-0.5">
              <Watch className="h-2.5 w-2.5" />
              Watchmaker
            </Badge>
          )}
          {isCaseworkJob && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 gap-0.5">
              <Wrench className="h-2.5 w-2.5" />
              CaseW
            </Badge>
          )}
          {needsWaiver && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 gap-0.5">
              <FileWarning className="h-2.5 w-2.5" />
              Waiver
            </Badge>
          )}
          {hasPartsPending && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200 gap-0.5">
              <Package className="h-2.5 w-2.5" />
              Parts Pending
            </Badge>
          )}
          {isActiveJob && showOutsourced && (outsourcedPending.length > 0 || legacyOutsourced.length > 0) && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 text-blue-600 border-blue-200 gap-0.5">
              <Truck className="h-2.5 w-2.5" />
              {outsourcedPending.length + legacyOutsourced.length} outsourced
            </Badge>
          )}
          {isActiveJob && daysUntilDue !== null && daysUntilDue <= 14 && daysUntilDue >= 0 && job.is_movement_service && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-600 border-amber-200 gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              Due soon
            </Badge>
          )}
          {isActiveJob && daysUntilDue !== null && daysUntilDue < 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-600 border-red-200 gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              Overdue
            </Badge>
          )}
        </div>
      </Link>

      {/* Status stepper - clickable */}
      {onStatusChange && (
        <div className="mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
            {JOB_STATUS_ORDER.map((status, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              
              return (
                <button
                  key={status}
                  type="button"
                  onClick={(e) => handleStatusClick(status, e)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors whitespace-nowrap",
                    isCompleted && "bg-emerald-100 text-emerald-700",
                    isCurrent && "bg-primary text-primary-foreground",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                    "hover:opacity-80 cursor-pointer"
                  )}
                >
                  {JOB_STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
          
          {/* Save Changes button */}
          {hasChanges && (
            <Button 
              size="sm" 
              className="w-full mt-2 h-7 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save Changes
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
