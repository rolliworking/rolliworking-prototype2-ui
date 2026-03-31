import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, addDays, format } from "date-fns";

interface ReportJob {
  estimateNumber: string;
  brand: string;
  model: string;
  clientName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  assignedWatchmaker: string | null;
  statusChangedAt?: string;
}

interface WatchmakerReport {
  watchmaker: string;
  weeklyTarget: number;
  weeklyTestingTarget: number;
  activeJobCount: number; // jobs excluding finished and in_testing
  accomplishments: {
    wentToTesting: ReportJob[];
    completed: ReportJob[];
    pastDueProgressed: ReportJob[]; // past due jobs that went into testing
  };
  needsImprovement: {
    pastDueStale: ReportJob[]; // past due jobs with no progress
    downgradedFromTesting: ReportJob[]; // in_testing → in_progress
  };
  upcoming: ReportJob[]; // due within 14 days
  pastDue: ReportJob[]; // currently past due
  waitingForParts: ReportJob[]; // parts_approval or parts_on_order
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  watchmakers: WatchmakerReport[];
}

function buildReportJob(
  job: any,
  now: Date,
  changedAt?: string
): ReportJob {
  const dueDate = job.due_date || job.inspections?.watches?.target_date || null;
  let daysOverdue: number | null = null;
  if (dueDate) {
    const diff = Math.floor(
      (now.getTime() - new Date(dueDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff > 0) daysOverdue = diff;
  }

  return {
    estimateNumber:
      job.estimate_number || job.inspections?.watches?.estimate_number || "—",
    brand: job.watch_brand || job.inspections?.watches?.brand || "Unknown",
    model: job.watch_model || job.inspections?.watches?.model || "",
    clientName:
      job.client_name || job.inspections?.watches?.customers?.name || "—",
    dueDate,
    daysOverdue,
    assignedWatchmaker: job.assigned_watchmaker || null,
    statusChangedAt: changedAt,
  };
}

export function useWeeklyWatchmakerReport(weekOffset = 0) {
  return useQuery({
    queryKey: ["weekly-watchmaker-report", weekOffset],
    queryFn: async (): Promise<WeeklyReportData> => {
      const now = new Date();
      // The "previous week" relative to offset. offset=0 means last week.
      const targetDate = subWeeks(now, weekOffset + 1);
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

      // 1. Fetch status changes for the target week
      // Use date-only boundaries in UTC to avoid timezone offset issues
      // (backfilled timestamps are at midnight UTC)
      const weekStartUtc = format(weekStart, "yyyy-MM-dd") + "T00:00:00Z";
      const weekEndUtc = format(weekEnd, "yyyy-MM-dd") + "T23:59:59Z";

      const { data: statusChanges, error: scErr } = await supabase
        .from("job_status_changes")
        .select("job_id, previous_status, new_status, changed_at")
        .gte("changed_at", weekStartUtc)
        .lte("changed_at", weekEndUtc);

      if (scErr) throw scErr;

      const allJobIds = new Set<string>();
      statusChanges?.forEach((sc) => allJobIds.add(sc.job_id));

      // 2. Fetch all active jobs (non-finished) for upcoming/past due
      const { data: activeJobs, error: ajErr } = await supabase
        .from("jobs")
        .select(
          "id, status, assigned_watchmaker, watch_brand, watch_model, client_name, due_date, estimate_number, service_type, inspection_id, inspections(job_type, watches(brand, model, estimate_number, target_date, customers(name)))"
        )
        .neq("status", "finished")
        .not("assigned_watchmaker", "is", null)
        .limit(1000);

      if (ajErr) throw ajErr;

      // 2b. Fetch watchmakers with weekly_target
      const { data: watchmakersList, error: wmErr } = await supabase
        .from("watchmakers")
        .select("initials, weekly_target, weekly_testing_target")
        .eq("is_active", true);

      if (wmErr) throw wmErr;

      const wmTargetMap = new Map<string, number>();
      const wmTestingTargetMap = new Map<string, number>();
      watchmakersList?.forEach((wm: any) => {
        wmTargetMap.set(wm.initials, wm.weekly_target ?? 0);
        wmTestingTargetMap.set(wm.initials, wm.weekly_testing_target ?? 0);
      });

      activeJobs?.forEach((j) => allJobIds.add(j.id));

      // 3. Fetch all relevant jobs that had status changes
      const scJobIds = [...new Set(statusChanges?.map((sc) => sc.job_id) || [])];
      let scJobs: any[] = [];
      if (scJobIds.length > 0) {
        const { data, error } = await supabase
          .from("jobs")
          .select(
            "id, status, assigned_watchmaker, watch_brand, watch_model, client_name, due_date, estimate_number, service_type, inspection_id, inspections(job_type, watches(brand, model, estimate_number, target_date, customers(name)))"
          )
          .in("id", scJobIds);
        if (error) throw error;
        scJobs = data || [];
      }

      // Build job lookup
      const jobMap = new Map<string, any>();
      scJobs.forEach((j) => jobMap.set(j.id, j));
      activeJobs?.forEach((j) => {
        if (!jobMap.has(j.id)) jobMap.set(j.id, j);
      });

      // Group by watchmaker
      const watchmakerMap = new Map<string, WatchmakerReport>();

      function getOrCreate(name: string): WatchmakerReport {
        if (!watchmakerMap.has(name)) {
          watchmakerMap.set(name, {
            watchmaker: name,
            weeklyTarget: wmTargetMap.get(name) ?? 0,
            weeklyTestingTarget: wmTestingTargetMap.get(name) ?? 0,
            activeJobCount: 0,
            accomplishments: {
              wentToTesting: [],
              completed: [],
              pastDueProgressed: [],
            },
            needsImprovement: {
              pastDueStale: [],
              downgradedFromTesting: [],
            },
            upcoming: [],
            pastDue: [],
            waitingForParts: [],
          });
        }
        return watchmakerMap.get(name)!;
      }

      // Process status changes for accomplishments & needs improvement
      statusChanges?.forEach((sc) => {
        const job = jobMap.get(sc.job_id);
        if (!job) return;
        const wm = job.assigned_watchmaker;
        if (!wm) return;

        // Skip case_work
        const jobType = job.inspections?.job_type || job.service_type;
        if (jobType === "case_work" || jobType === "warranty") return;

        const report = getOrCreate(wm);
        const rj = buildReportJob(job, now, sc.changed_at);

        // Went to testing
        if (sc.new_status === "in_testing") {
          report.accomplishments.wentToTesting.push(rj);
          // If past due and went to testing, also add to pastDueProgressed
          if (rj.daysOverdue && rj.daysOverdue > 0) {
            report.accomplishments.pastDueProgressed.push(rj);
          }
        }

        // Completed
        if (sc.new_status === "finished") {
          report.accomplishments.completed.push(rj);
        }

        // Downgraded from testing back to in_progress
        if (
          sc.previous_status === "in_testing" &&
          sc.new_status === "in_progress"
        ) {
          report.needsImprovement.downgradedFromTesting.push(rj);
        }
      });

      // Count active jobs per watchmaker (excluding finished, in_testing, case_work, warranty)
      activeJobs?.forEach((job) => {
        const wm = job.assigned_watchmaker;
        if (!wm) return;
        const jobType = job.inspections?.job_type || job.service_type;
        if (jobType === "case_work" || jobType === "warranty") return;
        if (job.status === "in_testing") return;
        const report = getOrCreate(wm);
        report.activeJobCount++;
      });

      // Process active jobs for upcoming/past due
      const in14Days = addDays(now, 14);

      activeJobs?.forEach((job) => {
        const wm = job.assigned_watchmaker;
        if (!wm) return;

        const jobType = job.inspections?.job_type;
        if (jobType === "case_work" || jobType === "warranty") return;

        const report = getOrCreate(wm);

        // Waiting for parts — separate section, skip past due/upcoming
        if (job.status === "parts_approval" || job.status === "parts_on_order") {
          const rj = buildReportJob(job, now);
          report.waitingForParts.push(rj);
          return;
        }

        const dueDate = job.due_date || job.inspections?.watches?.target_date;
        if (!dueDate) return;

        const dueDateObj = new Date(dueDate + "T12:00:00");
        const rj = buildReportJob(job, now);

        if (dueDateObj < now) {
          // Past due
          report.pastDue.push(rj);

          // Check if this past due job had NO progress during the week
          const hadProgress = statusChanges?.some(
            (sc) =>
              sc.job_id === job.id &&
              ["in_progress", "in_testing", "finished"].includes(sc.new_status)
          );
          if (!hadProgress) {
            report.needsImprovement.pastDueStale.push(rj);
          }
        } else if (dueDateObj <= in14Days) {
          // Due within 14 days
          report.upcoming.push(rj);
        }
      });

      // Sort and deduplicate
      const sortByOverdue = (a: ReportJob, b: ReportJob) =>
        (b.daysOverdue || 0) - (a.daysOverdue || 0);

      const dedup = (arr: ReportJob[]) => {
        const seen = new Set<string>();
        return arr.filter((j) => {
          const key = j.estimateNumber;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      const watchmakers = Array.from(watchmakerMap.values())
        .sort((a, b) => a.watchmaker.localeCompare(b.watchmaker));

      watchmakers.forEach((wm) => {
        wm.accomplishments.wentToTesting = dedup(wm.accomplishments.wentToTesting);
        wm.accomplishments.completed = dedup(wm.accomplishments.completed);
        wm.accomplishments.pastDueProgressed = dedup(wm.accomplishments.pastDueProgressed);
        wm.needsImprovement.pastDueStale = dedup(wm.needsImprovement.pastDueStale).sort(sortByOverdue);
        wm.needsImprovement.downgradedFromTesting = dedup(wm.needsImprovement.downgradedFromTesting);
        wm.pastDue = dedup(wm.pastDue).sort(sortByOverdue);
        wm.waitingForParts = dedup(wm.waitingForParts).sort(sortByOverdue);
        wm.upcoming = dedup(wm.upcoming).sort(
          (a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")
        );
      });

      return {
        weekStart: format(weekStart, "yyyy-MM-dd"),
        weekEnd: format(weekEnd, "yyyy-MM-dd"),
        watchmakers,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
