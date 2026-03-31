import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format, startOfWeek, endOfWeek, subWeeks, eachWeekOfInterval } from "date-fns";

interface WeeklyActivity {
  week: string;
  weekLabel: string;
  inProgress: number;
  inTesting: number;
  finished: number;
  downgraded: number;
  total: number;
}

interface WatchmakerWeeklyData {
  watchmaker: string;
  weeks: WeeklyActivity[];
  totals: {
    inProgress: number;
    inTesting: number;
    finished: number;
    downgraded: number;
    total: number;
  };
}

interface WatchmakerActivityData {
  watchmakers: WatchmakerWeeklyData[];
  weekLabels: string[];
  totals: {
    inProgress: number;
    inTesting: number;
    finished: number;
    downgraded: number;
    total: number;
  };
}

export function useWatchmakerActivity(selectedWeek?: string, customRange?: { start: string; end: string } | null) {
  return useQuery({
    queryKey: ["watchmaker-activity", selectedWeek, customRange?.start, customRange?.end],
    queryFn: async (): Promise<WatchmakerActivityData> => {
      let windowStart: Date;
      let windowEnd: Date;

      if (customRange?.start && customRange?.end) {
        // Custom range mode: use the provided start/end dates
        windowStart = startOfWeek(parseISO(customRange.start), { weekStartsOn: 1 });
        windowEnd = endOfWeek(parseISO(customRange.end), { weekStartsOn: 1 });
      } else {
        // selectedWeek is a yyyy-MM-dd (Monday). Show a rolling 6-week window ending on that week.
        const focusWeekStart = selectedWeek
          ? parseISO(selectedWeek)
          : startOfWeek(new Date(), { weekStartsOn: 1 });

        windowStart = subWeeks(focusWeekStart, 5); // 6 weeks total
        windowEnd = endOfWeek(focusWeekStart, { weekStartsOn: 1 });
      }

      const weeksInWindow = eachWeekOfInterval(
        { start: windowStart, end: windowEnd },
        { weekStartsOn: 1 }
      );

      const weekLabels = weeksInWindow.map(w => format(w, "MMM d"));
      const weekKeys = weeksInWindow.map(w => format(w, "yyyy-MM-dd"));

      const rangeStartUtc = format(windowStart, "yyyy-MM-dd") + "T00:00:00Z";
      const rangeEndUtc = format(windowEnd, "yyyy-MM-dd") + "T23:59:59Z";

      // Get all status changes for the window
      const { data: statusChanges, error: statusError } = await supabase
        .from("job_status_changes")
        .select("job_id, previous_status, new_status, changed_at")
        .in("new_status", ["in_progress", "in_testing", "finished"])
        .gte("changed_at", rangeStartUtc)
        .lte("changed_at", rangeEndUtc);

      if (statusError) throw statusError;

      const jobIds = [...new Set(statusChanges?.map(sc => sc.job_id) || [])];

      if (jobIds.length === 0) {
        return {
          watchmakers: [],
          weekLabels,
          totals: { inProgress: 0, inTesting: 0, finished: 0, downgraded: 0, total: 0 },
        };
      }

      // Fetch jobs with their assigned watchmaker and service type
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, assigned_watchmaker, service_type, inspection_id")
        .in("id", jobIds);

      if (jobsError) throw jobsError;

      // Get inspection job_type for jobs with inspections
      const inspectionIds = jobs
        ?.filter(j => j.inspection_id)
        .map(j => j.inspection_id) || [];

      let inspectionJobTypes: Record<string, string> = {};

      if (inspectionIds.length > 0) {
        const { data: inspections } = await supabase
          .from("inspections")
          .select("id, job_type")
          .in("id", inspectionIds);

        inspections?.forEach(i => {
          inspectionJobTypes[i.id] = i.job_type;
        });
      }

      const jobMap = new Map<string, { watchmaker: string; jobType: string | null }>();
      jobs?.forEach(job => {
        const jobType = job.inspection_id
          ? inspectionJobTypes[job.inspection_id]
          : job.service_type;
        jobMap.set(job.id, {
          watchmaker: job.assigned_watchmaker || "Unassigned",
          jobType: jobType || null,
        });
      });

      // Count transitions by watchmaker and week (excluding case_work, warranty)
      const watchmakerWeekCounts = new Map<string, Map<string, { inProgress: number; inTesting: number; finished: number; downgraded: number }>>();

      statusChanges?.forEach(change => {
        const jobInfo = jobMap.get(change.job_id);
        if (!jobInfo) return;
        if (jobInfo.jobType === "case_work" || jobInfo.jobType === "warranty") return;

        const { watchmaker } = jobInfo;
        const changeDate = parseISO(change.changed_at);
        const ws = startOfWeek(changeDate, { weekStartsOn: 1 });
        const weekKey = format(ws, "yyyy-MM-dd");

        if (!watchmakerWeekCounts.has(watchmaker)) {
          watchmakerWeekCounts.set(watchmaker, new Map());
        }

        const weekMap = watchmakerWeekCounts.get(watchmaker)!;
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, { inProgress: 0, inTesting: 0, finished: 0, downgraded: 0 });
        }

        const counts = weekMap.get(weekKey)!;
        switch (change.new_status) {
          case "in_progress":
            counts.inProgress++;
            // Track downgrades: in_testing → in_progress
            if (change.previous_status === "in_testing") {
              counts.downgraded++;
            }
            break;
          case "in_testing": counts.inTesting++; break;
          case "finished": counts.finished++; break;
        }
      });

      // Convert to array format
      const watchmakers: WatchmakerWeeklyData[] = [];
      let totalInProgress = 0;
      let totalInTesting = 0;
      let totalFinished = 0;
      let totalDowngraded = 0;

      const sortedWatchmakerNames = Array.from(watchmakerWeekCounts.keys()).sort((a, b) => {
        if (a === "Unassigned") return 1;
        if (b === "Unassigned") return -1;
        return a.localeCompare(b);
      });

      sortedWatchmakerNames.forEach(watchmaker => {
        const weekMap = watchmakerWeekCounts.get(watchmaker)!;
        const weeks: WeeklyActivity[] = [];
        let wmInProgress = 0;
        let wmInTesting = 0;
        let wmFinished = 0;
        let wmDowngraded = 0;

        weekKeys.forEach((weekKey, index) => {
          const counts = weekMap.get(weekKey) || { inProgress: 0, inTesting: 0, finished: 0, downgraded: 0 };
          const weekTotal = counts.inProgress + counts.inTesting + counts.finished;

          weeks.push({
            week: weekKey,
            weekLabel: weekLabels[index],
            inProgress: counts.inProgress,
            inTesting: counts.inTesting,
            finished: counts.finished,
            downgraded: counts.downgraded,
            total: weekTotal,
          });

          wmInProgress += counts.inProgress;
          wmInTesting += counts.inTesting;
          wmFinished += counts.finished;
          wmDowngraded += counts.downgraded;
        });

        watchmakers.push({
          watchmaker,
          weeks,
          totals: {
            inProgress: wmInProgress,
            inTesting: wmInTesting,
            finished: wmFinished,
            downgraded: wmDowngraded,
            total: wmInProgress + wmInTesting + wmFinished,
          },
        });

        totalInProgress += wmInProgress;
        totalInTesting += wmInTesting;
        totalFinished += wmFinished;
        totalDowngraded += wmDowngraded;
      });

      return {
        watchmakers,
        weekLabels,
        totals: {
          inProgress: totalInProgress,
          inTesting: totalInTesting,
          finished: totalFinished,
          downgraded: totalDowngraded,
          total: totalInProgress + totalInTesting + totalFinished,
        },
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
