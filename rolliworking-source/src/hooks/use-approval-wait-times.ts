import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export interface ApprovalWaitRecord {
  jobId: string;
  enteredAt: string;
  exitedAt: string | null;
  daysWaiting: number;
  isStillWaiting: boolean;
}

/**
 * Fetches all waiting_approval status change records and calculates
 * how long each job has been (or was) in that status.
 */
export function useApprovalWaitTimes() {
  return useQuery({
    queryKey: ["approval-wait-times"],
    queryFn: async () => {
      // Get all transitions into or out of waiting_approval
      const { data, error } = await supabase
        .from("job_status_changes")
        .select("job_id, previous_status, new_status, changed_at")
        .or("new_status.eq.waiting_approval,previous_status.eq.waiting_approval")
        .order("changed_at", { ascending: true });

      if (error) throw error;

      // Group by job_id and pair enter/exit events
      const jobMap = new Map<string, { enteredAt: string; exitedAt: string | null }[]>();

      for (const row of data) {
        if (!jobMap.has(row.job_id)) jobMap.set(row.job_id, []);
        const entries = jobMap.get(row.job_id)!;

        if (row.new_status === "waiting_approval") {
          // Entered waiting_approval
          entries.push({ enteredAt: row.changed_at, exitedAt: null });
        } else if (row.previous_status === "waiting_approval") {
          // Exited waiting_approval — close the last open entry
          const lastOpen = [...entries].reverse().find(e => e.exitedAt === null);
          if (lastOpen) {
            lastOpen.exitedAt = row.changed_at;
          }
        }
      }

      const now = new Date();
      const records: ApprovalWaitRecord[] = [];

      for (const [jobId, entries] of jobMap) {
        // Sum all waiting periods for this job
        let totalDays = 0;
        let isStillWaiting = false;
        let firstEntry: string | null = null;
        let lastExit: string | null = null;

        for (const entry of entries) {
          if (!firstEntry) firstEntry = entry.enteredAt;
          const start = parseISO(entry.enteredAt);
          const end = entry.exitedAt ? parseISO(entry.exitedAt) : now;
          totalDays += Math.max(0, differenceInDays(end, start));
          if (!entry.exitedAt) isStillWaiting = true;
          if (entry.exitedAt) lastExit = entry.exitedAt;
        }

        if (firstEntry) {
          records.push({
            jobId,
            enteredAt: firstEntry,
            exitedAt: isStillWaiting ? null : lastExit,
            daysWaiting: totalDays,
            isStillWaiting,
          });
        }
      }

      // Sort by days waiting descending
      records.sort((a, b) => b.daysWaiting - a.daysWaiting);

      return records;
    },
  });
}
