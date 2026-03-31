import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  Mail,
  Package,
  PlayCircle,
  FlaskConical,
  CheckCircle2,
  FileText,
  Clock,
  History,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { JobWithDetails } from "@/types/job";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineEvent {
  date: Date;
  type: "created" | "intake" | "work_started" | "in_testing" | "finished" | "email" | "part_request" | "part_priced" | "part_status";
  label: string;
  detail?: string;
}

function buildTimeline(job: JobWithDetails): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Job created
  if (job.created_at) {
    events.push({
      date: parseISO(job.created_at),
      type: "created",
      label: "Job Created",
    });
  }

  // Intake date
  if (job.intake_date) {
    events.push({
      date: parseISO(job.intake_date),
      type: "intake",
      label: "Intake",
    });
  }

  // Work started
  if (job.work_started_at) {
    events.push({
      date: parseISO(job.work_started_at),
      type: "work_started",
      label: "Work Started",
    });
  }

  // In testing
  if (job.in_testing_at) {
    events.push({
      date: parseISO(job.in_testing_at),
      type: "in_testing",
      label: "Moved to Testing",
    });
  }

  // Finished
  if (job.finished_date) {
    events.push({
      date: parseISO(job.finished_date),
      type: "finished",
      label: "Job Finished",
    });
  }

  // Parts requests from JSONB
  const partsRequests = job.parts_requests as any[] | null;
  if (Array.isArray(partsRequests)) {
    partsRequests.forEach((part) => {
      if (part.requested_at) {
        events.push({
          date: parseISO(part.requested_at),
          type: "part_request",
          label: "Part Requested",
          detail: part.description || part.request_number,
        });
      }
      if (part.priced_at) {
        events.push({
          date: parseISO(part.priced_at),
          type: "part_priced",
          label: "Part Priced",
          detail: `${part.description || part.request_number}${part.price ? ` - $${part.price}` : ""}`,
        });
      }
    });
  }

  // Emails sent from JSONB (sent_email_templates stores template IDs when used)
  const sentTemplates = job.sent_email_templates as string[] | null;
  if (Array.isArray(sentTemplates) && sentTemplates.length > 0) {
    // We don't have timestamps for these, but we can note they were sent
    // For now, just mark last email sent if we have the timestamp
  }

  // Last update email sent
  if (job.last_update_email_sent) {
    events.push({
      date: parseISO(job.last_update_email_sent),
      type: "email",
      label: "Update Email Sent",
    });
  }

  // Sort by date descending (most recent first)
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return events;
}

const EVENT_ICONS: Record<TimelineEvent["type"], React.ReactNode> = {
  created: <FileText className="h-3.5 w-3.5" />,
  intake: <Calendar className="h-3.5 w-3.5" />,
  work_started: <PlayCircle className="h-3.5 w-3.5" />,
  in_testing: <FlaskConical className="h-3.5 w-3.5" />,
  finished: <CheckCircle2 className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  part_request: <Package className="h-3.5 w-3.5" />,
  part_priced: <Package className="h-3.5 w-3.5" />,
  part_status: <Package className="h-3.5 w-3.5" />,
};

const EVENT_COLORS: Record<TimelineEvent["type"], string> = {
  created: "bg-muted text-muted-foreground",
  intake: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  work_started: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_testing: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  finished: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  part_request: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  part_priced: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  part_status: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

interface JobActivityTimelineProps {
  job: JobWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobActivityTimeline({ job, open, onOpenChange }: JobActivityTimelineProps) {
  if (!job) return null;

  const events = buildTimeline(job);
  const clientName = job.client_name || job.inspections?.watches?.customers?.name || "Unknown";
  const estimateNumber = job.estimate_number || job.inspections?.watches?.estimate_number || "-";
  const watchBrand = job.watch_brand || job.inspections?.watches?.brand || "";
  const watchModel = job.watch_model || job.inspections?.watches?.model || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Job Activity
          </DialogTitle>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="font-medium text-foreground">{clientName}</div>
            <div>
              Est# {estimateNumber}
              {watchBrand && ` • ${watchBrand}`}
              {watchModel && ` ${watchModel}`}
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 pb-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Current: {job.status.replace(/_/g, " ")}
          </Badge>
          {job.due_date && (
            <Badge variant="secondary" className="text-xs">
              Due: {format(parseISO(job.due_date), "MMM d, yyyy")}
            </Badge>
          )}
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity recorded yet.
            </p>
          ) : (
            <div className="relative pl-4 space-y-3">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              {events.map((event, idx) => (
                <div key={idx} className="relative flex gap-3">
                  {/* Dot */}
                  <div
                    className={cn(
                      "absolute -left-4 top-0.5 h-4 w-4 rounded-full flex items-center justify-center border-2 border-background",
                      EVENT_COLORS[event.type]
                    )}
                  >
                    {EVENT_ICONS[event.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{event.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(event.date, "MMM d, yyyy")}
                      </span>
                    </div>
                    {event.detail && (
                      <p className="text-xs text-muted-foreground truncate">
                        {event.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
