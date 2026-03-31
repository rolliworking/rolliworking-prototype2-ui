import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays, addDays, subDays, startOfDay, endOfDay, getDay } from "date-fns";
import { AlertTriangle, Clock, CalendarX, Mail, Printer, Target, ArrowRightLeft, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs } from "@/hooks/use-jobs";
import { useApprovalWaitTimes } from "@/hooks/use-approval-wait-times";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { JobWithDetails } from "@/types/job";
import { SERVICE_TYPE_LABELS, getEmailReminderInterval } from "@/lib/job-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

/** Get the previous business day (skip Saturday → Friday, Sunday → Friday, Monday → Friday) */
function getPreviousBusinessDay(date: Date): Date {
  const day = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat
  if (day === 1) return subDays(date, 3); // Monday → Friday
  if (day === 0) return subDays(date, 2); // Sunday → Friday
  return subDays(date, 1); // Tue-Sat → previous day
}

interface StatusChangeRecord {
  id: string;
  job_id: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  job_type: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake", inspection: "Inspection", waiting_approval: "Waiting Approval",
  in_queue: "In Queue", uncased: "Uncased", in_progress: "In Progress",
  parts_approval: "Parts Approval", parts_on_order: "Parts On Order",
  in_testing: "In Testing", finished: "Finished",
};

const SHORT_JOB_TYPES: Record<string, string> = {
  modern_movement: "Modern", vintage_movement: "Vintage", antique_movement: "Antique",
  modern_lv2: "Modern LV2", vintage_lv2: "Vintage LV2", antique_lv2: "Antique LV2",
  chrono: "Chrono", chrono_lv2: "Chrono LV2", case_work: "Case Work",
  small_job: "Small Job", warranty: "Warranty", bracelet_repair: "Bracelet",
  gold_bracelet: "Gold Bracelet", case_restoration: "Case Restore",
  stretch_repair: "Stretch", partial_job: "Partial", other: "Other",
};

function getJobLabel(job: JobWithDetails) {
  const jt = job.inspections?.job_type || job.service_type || null;
  if (!jt) return null;
  return SHORT_JOB_TYPES[jt] || SERVICE_TYPE_LABELS[jt as keyof typeof SERVICE_TYPE_LABELS] || jt;
}

function getNextEmailDays(job: JobWithDetails): number | null {
  if (job.status === "finished") return null;
  const jobType = job.inspections?.job_type || job.service_type || null;
  const interval = getEmailReminderInterval(jobType);
  if (!job.last_update_email_sent) {
    if (job.intake_date) {
      const daysSinceIntake = differenceInDays(new Date(), parseISO(job.intake_date));
      return Math.max(0, interval - daysSinceIntake);
    }
    return 0;
  }
  const lastSent = parseISO(job.last_update_email_sent);
  const nextDue = addDays(lastSent, interval);
  return differenceInDays(nextDue, new Date());
}

interface SectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  jobs: JobWithDetails[];
  extraColumn?: { header: string; render: (job: JobWithDetails) => React.ReactNode };
  emptyMessage: string;
  variant?: "destructive" | "warning" | "default";
}

function HitListSection({ title, description, icon: Icon, jobs, extraColumn, emptyMessage, variant = "default" }: SectionProps) {
  const borderColor = variant === "destructive" ? "border-l-destructive" : variant === "warning" ? "border-l-amber-500" : "border-l-primary";

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
          <Badge variant={variant === "destructive" ? "destructive" : "secondary"} className="ml-2">
            {jobs.length}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Estimate #</TableHead>
                  <TableHead>Watch</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Status</TableHead>
                  {extraColumn && <TableHead>{extraColumn.header}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => {
                  const clientName = job.client_name || job.inspections?.watches?.customers?.name || "—";
                  const watchBrand = job.watch_brand || job.inspections?.watches?.brand || "";
                  const watchModel = job.watch_model || job.inspections?.watches?.model || "";
                  const estimateNumber = job.estimate_number || job.inspections?.watches?.estimate_number || "—";
                  const statusLabel = STATUS_LABELS[job.status] || job.status;
                  const jobTypeLabel = getJobLabel(job);

                  return (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium max-w-[160px] truncate">{clientName}</TableCell>
                      <TableCell>{estimateNumber}</TableCell>
                      <TableCell>{watchBrand} {watchModel}</TableCell>
                      <TableCell>
                        {jobTypeLabel ? (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">{jobTypeLabel}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{statusLabel}</Badge></TableCell>
                      {extraColumn && <TableCell>{extraColumn.render(job)}</TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DailyHitList() {
  usePageMeta({ title: "Daily Hit List | Rolliworks" });
  const [pushing, setPushing] = useState(false);

  const { data: jobs, isLoading } = useJobs();
  const { data: approvalWaitData } = useApprovalWaitTimes();

  // Previous business day status changes
  const prevBizDay = useMemo(() => getPreviousBusinessDay(new Date()), []);
  const prevBizDayLabel = format(prevBizDay, "EEEE, MMM d");

  const { data: statusChanges = [] } = useQuery({
    queryKey: ["prev-biz-day-changes", format(prevBizDay, "yyyy-MM-dd")],
    queryFn: async () => {
      const dayStart = startOfDay(prevBizDay).toISOString();
      const dayEnd = endOfDay(prevBizDay).toISOString();

      const { data, error } = await supabase
        .from("job_status_changes")
        .select("id, job_id, previous_status, new_status, changed_at, job_type")
        .gte("changed_at", dayStart)
        .lte("changed_at", dayEnd)
        .order("changed_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as StatusChangeRecord[];
    },
  });

  const { sections, approvalWaitMap } = useMemo(() => {
    if (!jobs) return { sections: { longWaiting: [], pastDue: [], atRisk: [], needsEmail: [] }, approvalWaitMap: new Map<string, number>() };
    const allJobs = jobs as JobWithDetails[];
    const now = new Date();

    // 1. Waiting approval > 7 days
    // Build a map of days waiting, using approval wait data when available,
    // falling back to intake_date for jobs that predate status change tracking
    const waitMap = new Map<string, number>();
    if (approvalWaitData) {
      for (const r of approvalWaitData) {
        if (r.isStillWaiting) waitMap.set(r.jobId, r.daysWaiting);
      }
    }
    // For waiting_approval jobs with no status change record, use intake_date as fallback
    for (const j of allJobs) {
      if (j.status === "waiting_approval" && !waitMap.has(j.id)) {
        const fallbackDate = j.intake_date ? parseISO(j.intake_date) : (j.created_at ? parseISO(j.created_at) : now);
        waitMap.set(j.id, Math.max(0, differenceInDays(now, fallbackDate)));
      }
    }
    const longWaiting = allJobs
      .filter(j => j.status === "waiting_approval" && (waitMap.get(j.id) ?? 0) >= 7)
      .sort((a, b) => (waitMap.get(b.id) ?? 0) - (waitMap.get(a.id) ?? 0));

    // 2. Past due (not finished)
    const pastDue = allJobs
      .filter(j => j.status !== "finished" && j.due_date && differenceInDays(parseISO(j.due_date), now) < 0)
      .sort((a, b) => differenceInDays(parseISO(a.due_date!), now) - differenceInDays(parseISO(b.due_date!), now));

    // 3. Due within 3 weeks, still in waiting_approval or in_queue
    const atRisk = allJobs.filter(j => {
      if (!j.due_date || j.status === "finished") return false;
      const days = differenceInDays(parseISO(j.due_date), now);
      return days >= 0 && days <= 21 && (j.status === "waiting_approval" || j.status === "in_queue");
    }).sort((a, b) => differenceInDays(parseISO(a.due_date!), now) - differenceInDays(parseISO(b.due_date!), now));

    // 4. Needs email update (overdue for 14-day email)
    const needsEmail = allJobs.filter(j => {
      if (j.status === "finished") return false;
      const emailDays = getNextEmailDays(j);
      return emailDays !== null && emailDays <= 0;
    });

    return { sections: { longWaiting, pastDue, atRisk, needsEmail }, approvalWaitMap: waitMap };
  }, [jobs, approvalWaitData]);

  const totalItems = sections.longWaiting.length + sections.pastDue.length + sections.atRisk.length + sections.needsEmail.length;

  // Enrich status changes with job details
  const enrichedChanges = useMemo(() => {
    if (!statusChanges.length || !jobs) return [];
    const jobsMap = new Map<string, JobWithDetails>();
    for (const j of jobs as JobWithDetails[]) jobsMap.set(j.id, j);

    return statusChanges.map(sc => {
      const job = jobsMap.get(sc.job_id);
      return {
        ...sc,
        clientName: job?.client_name || job?.inspections?.watches?.customers?.name || "—",
        estimateNumber: job?.estimate_number || job?.inspections?.watches?.estimate_number || "—",
        watchBrand: job?.watch_brand || job?.inspections?.watches?.brand || "",
        watchModel: job?.watch_model || job?.inspections?.watches?.model || "",
      };
    });
  }, [statusChanges, jobs]);

  const handlePrint = () => {
    const printSections = [
      { title: "Waiting for Approval > 7 Days", jobs: sections.longWaiting },
      { title: "Past Due", jobs: sections.pastDue },
      { title: "At Risk (Due ≤ 3 Weeks, Not Started)", jobs: sections.atRisk },
      { title: "Needs Email Update", jobs: sections.needsEmail },
    ];

    const statusChangePrint = enrichedChanges.length > 0 ? `
      <h2>Status Changes — ${prevBizDayLabel} <span class="count">${enrichedChanges.length}</span></h2>
      <table><thead><tr><th>Time</th><th>Estimate #</th><th>Client</th><th>From</th><th>To</th></tr></thead><tbody>
      ${enrichedChanges.map(sc => `
        <tr>
          <td>${format(parseISO(sc.changed_at), "h:mm a")}</td>
          <td>${sc.estimateNumber}</td>
          <td>${sc.clientName}</td>
          <td>${sc.previous_status ? (STATUS_LABELS[sc.previous_status] || sc.previous_status) : "—"}</td>
          <td>${STATUS_LABELS[sc.new_status] || sc.new_status}</td>
        </tr>
      `).join("")}
      </tbody></table>
    ` : "";

    const printContent = `
      <!DOCTYPE html><html><head><title>Daily Hit List</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 16px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
        th { background: #f0f0f0; font-weight: 600; }
        .count { background: #e0e0e0; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
        .footer { margin-top: 20px; font-size: 11px; color: #999; }
      </style></head><body>
      <h1>ROLLIWORKS — Daily Hit List</h1>
      <p class="subtitle">Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} | ${totalItems} action items</p>
      ${statusChangePrint}
      ${printSections.map(s => `
        <h2>${s.title} <span class="count">${s.jobs.length}</span></h2>
        ${s.jobs.length === 0 ? "<p style='color:#999;font-size:12px'>None</p>" : `
        <table><thead><tr><th>Client</th><th>Estimate #</th><th>Watch</th><th>Status</th></tr></thead><tbody>
        ${s.jobs.map(j => {
          const cn = j.client_name || j.inspections?.watches?.customers?.name || "—";
          const en = j.estimate_number || j.inspections?.watches?.estimate_number || "—";
          const wb = j.watch_brand || j.inspections?.watches?.brand || "";
          const wm = j.watch_model || j.inspections?.watches?.model || "";
          return `<tr><td>${cn}</td><td>${en}</td><td>${wb} ${wm}</td><td>${STATUS_LABELS[j.status] || j.status}</td></tr>`;
        }).join("")}
        </tbody></table>`}
      `).join("")}
      <p class="footer">Rolliworks Client Portal</p>
      </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  const handlePushToRS = async () => {
    setPushing(true);
    try {
      const res = await supabase.functions.invoke("hit-list-push", { method: "POST", body: {} });
      if (res.error) throw res.error;
      const data = res.data as { success: boolean; pushed?: number; rs_status?: number };
      if (data.success && data.rs_status === 200) {
        toast.success(`Pushed ${data.pushed} items to RolliSuite`);
      } else {
        toast.warning(`Push sent ${data.pushed} items but RS returned ${data.rs_status}`);
      }
    } catch (err: any) {
      toast.error("Failed to push: " + (err.message || "Unknown error"));
    } finally {
      setPushing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Daily Hit List</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" />
            Daily Hit List
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")} — {totalItems} action items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePushToRS} variant="outline" size="sm" disabled={pushing}>
            <Send className="h-4 w-4 mr-2" />
            {pushing ? "Pushing…" : "Push to RS"}
          </Button>
          {totalItems > 0 && (
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          )}
        </div>
      </div>

      {/* Previous Business Day Status Changes */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-5 w-5" />
            Status Changes — {prevBizDayLabel}
            <Badge variant="secondary" className="ml-2">{enrichedChanges.length}</Badge>
          </CardTitle>
          <CardDescription>All job status transitions from the previous business day</CardDescription>
        </CardHeader>
        <CardContent>
          {enrichedChanges.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No status changes recorded for {prevBizDayLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Estimate #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Watch</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedChanges.map(sc => (
                    <TableRow key={sc.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(sc.changed_at), "h:mm a")}</TableCell>
                      <TableCell>{sc.estimateNumber}</TableCell>
                      <TableCell className="font-medium max-w-[160px] truncate">{sc.clientName}</TableCell>
                      <TableCell>{sc.watchBrand} {sc.watchModel}</TableCell>
                      <TableCell>
                        {sc.previous_status ? (
                          <Badge variant="outline">{STATUS_LABELS[sc.previous_status] || sc.previous_status}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{STATUS_LABELS[sc.new_status] || sc.new_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <HitListSection
        title="Waiting for Approval &gt; 7 Days"
        description="Jobs stuck in waiting approval for more than a week"
        icon={Clock}
        jobs={sections.longWaiting}
        variant="destructive"
        emptyMessage="No jobs waiting for approval longer than 7 days ✓"
        extraColumn={{
          header: "Days Waiting",
          render: (job) => {
            const days = approvalWaitMap.get(job.id) ?? 0;
            return <span className="font-medium text-destructive">{days}d</span>;
          },
        }}
      />

      <HitListSection
        title="Past Due"
        description="Jobs that have passed their due date"
        icon={CalendarX}
        jobs={sections.pastDue}
        variant="destructive"
        emptyMessage="No past due jobs ✓"
        extraColumn={{
          header: "Overdue",
          render: (job) => {
            const days = Math.abs(differenceInDays(parseISO(job.due_date!), new Date()));
            return <span className="font-medium text-destructive">{days}d overdue</span>;
          },
        }}
      />

      <HitListSection
        title="At Risk — Due ≤ 3 Weeks, Not Started"
        description="Jobs in waiting approval or in queue with due date within 3 weeks"
        icon={AlertTriangle}
        jobs={sections.atRisk}
        variant="warning"
        emptyMessage="No at-risk jobs ✓"
        extraColumn={{
          header: "Days Left",
          render: (job) => {
            const days = differenceInDays(parseISO(job.due_date!), new Date());
            return (
              <span className={cn("font-medium", days <= 7 ? "text-destructive" : "text-amber-600")}>
                {days}d
              </span>
            );
          },
        }}
      />

      <HitListSection
        title="Needs Email Update"
        description="Jobs overdue for a 14-day client update email"
        icon={Mail}
        jobs={sections.needsEmail}
        variant="default"
        emptyMessage="All emails are up to date ✓"
        extraColumn={{
          header: "Overdue By",
          render: (job) => {
            const emailDays = getNextEmailDays(job);
            return <span className="font-medium">{emailDays !== null ? `${Math.abs(emailDays)}d` : "—"}</span>;
          },
        }}
      />
    </div>
  );
}
