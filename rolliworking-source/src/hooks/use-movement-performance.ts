import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, endOfMonth, format, parseISO, eachWeekOfInterval } from "date-fns";

interface WeeklyMetric {
  week: string;
  weekLabel: string;
  count: number;
}

interface PerformanceData {
  inProgress: WeeklyMetric[];
  inTesting: WeeklyMetric[];
  finished: WeeklyMetric[];
  averages: {
    inProgress: number;
    inTesting: number;
    finished: number;
  };
}

// Movement job types we care about for this report
const MOVEMENT_JOB_TYPES = [
  'modern_movement',
  'modern_lv2',
  'vintage_movement',
  'vintage_lv2',
  'antique_movement',
  'antique_lv2',
  'chrono',
  'chrono_lv2',
];

export function useMovementPerformance(selectedMonth?: string) {
  return useQuery({
    queryKey: ["movement-performance", selectedMonth],
    queryFn: async (): Promise<PerformanceData> => {
      // Parse selected month or use current month
      const monthDate = selectedMonth 
        ? parseISO(`${selectedMonth}-01`) 
        : new Date();
      
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      // Get all weeks that fall within the selected month
      const weeksInMonth = eachWeekOfInterval(
        { start: monthStart, end: monthEnd },
        { weekStartsOn: 1 }
      );
      
      // Query status changes for the selected month
      const { data: statusChanges, error } = await supabase
        .from("job_status_changes")
        .select("job_id, new_status, job_type, changed_at")
        .in("new_status", ["in_progress", "in_testing", "finished"])
        .gte("changed_at", monthStart.toISOString())
        .lte("changed_at", monthEnd.toISOString())
        .order("changed_at", { ascending: true });

      if (error) throw error;

      // Get job IDs that have NULL job_type in the status changes
      const jobIdsWithNullType = statusChanges
        ?.filter(sc => sc.job_type === null)
        .map(sc => sc.job_id) || [];
      
      // Build a map of job_id -> is_movement_service for jobs with NULL job_type
      const movementServiceMap = new Map<string, boolean>();
      
      if (jobIdsWithNullType.length > 0) {
        const uniqueJobIds = [...new Set(jobIdsWithNullType)];
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, is_movement_service")
          .in("id", uniqueJobIds);
        
        jobs?.forEach(job => {
          movementServiceMap.set(job.id, job.is_movement_service === true);
        });
      }

      // Initialize weekly buckets for weeks in the month
      const weeks: Map<string, { inProgress: number; inTesting: number; finished: number }> = new Map();
      
      weeksInMonth.forEach((weekStart) => {
        const weekKey = format(weekStart, "yyyy-MM-dd");
        weeks.set(weekKey, { inProgress: 0, inTesting: 0, finished: 0 });
      });

      // Count transitions by week from the status changes log
      statusChanges?.forEach((change) => {
        // Determine if this is a movement service job
        let isMovementJob = false;
        
        if (change.job_type) {
          // Has job_type - check if it's a movement type
          isMovementJob = MOVEMENT_JOB_TYPES.includes(change.job_type);
        } else {
          // No job_type - fall back to is_movement_service flag
          isMovementJob = movementServiceMap.get(change.job_id) === true;
        }
        
        if (!isMovementJob) return;
        
        const changeDate = parseISO(change.changed_at);
        const weekStart = startOfWeek(changeDate, { weekStartsOn: 1 });
        const weekKey = format(weekStart, "yyyy-MM-dd");
        const bucket = weeks.get(weekKey);
        
        if (bucket) {
          switch (change.new_status) {
            case "in_progress":
              bucket.inProgress++;
              break;
            case "in_testing":
              bucket.inTesting++;
              break;
            case "finished":
              bucket.finished++;
              break;
          }
        }
      });

      // Convert to arrays and calculate averages
      const sortedWeeks = Array.from(weeks.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      const inProgressData: WeeklyMetric[] = [];
      const inTestingData: WeeklyMetric[] = [];
      const finishedData: WeeklyMetric[] = [];

      let totalInProgress = 0;
      let totalInTesting = 0;
      let totalFinished = 0;

      sortedWeeks.forEach(([weekKey, counts]) => {
        const weekLabel = format(parseISO(weekKey), "MMM d");
        
        inProgressData.push({ week: weekKey, weekLabel, count: counts.inProgress });
        inTestingData.push({ week: weekKey, weekLabel, count: counts.inTesting });
        finishedData.push({ week: weekKey, weekLabel, count: counts.finished });

        totalInProgress += counts.inProgress;
        totalInTesting += counts.inTesting;
        totalFinished += counts.finished;
      });

      const weekCount = sortedWeeks.length || 1;

      return {
        inProgress: inProgressData,
        inTesting: inTestingData,
        finished: finishedData,
        averages: {
          inProgress: totalInProgress / weekCount,
          inTesting: totalInTesting / weekCount,
          finished: totalFinished / weekCount,
        },
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
