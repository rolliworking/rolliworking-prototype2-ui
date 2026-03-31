import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { JOB_STATUS_ORDER, JOB_STATUS_LABELS, type JobStatus } from "@/lib/job-utils";

interface JobStatusStepperProps {
  currentStatus: JobStatus;
  onStatusChange?: (status: JobStatus) => void;
  disabled?: boolean;
}

export function JobStatusStepper({ currentStatus, onStatusChange, disabled }: JobStatusStepperProps) {
  const currentIndex = JOB_STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {JOB_STATUS_ORDER.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={status} className="flex items-center">
            <button
              type="button"
              onClick={() => !disabled && onStatusChange?.(status)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                isCompleted && "bg-emerald-100 text-emerald-700",
                isCurrent && "bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                !disabled && "hover:opacity-80 cursor-pointer"
              )}
            >
              {isCompleted && <Check className="h-3 w-3" />}
              {JOB_STATUS_LABELS[status]}
            </button>
            {index < JOB_STATUS_ORDER.length - 1 && (
              <div className={cn(
                "w-4 h-0.5 mx-1",
                index < currentIndex ? "bg-emerald-400" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
