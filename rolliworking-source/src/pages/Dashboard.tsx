import { useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInDays, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  FileWarning, 
  Hourglass, 
  Loader2, 
  Truck 
} from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs } from "@/hooks/use-jobs";
import type { JobWithDetails } from "@/types/job";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/JobCard";

export default function Dashboard() {
  usePageMeta({
    title: "Dashboard | Rolliworks",
    description: "Watch repair management dashboard",
    canonicalPath: "/",
  });

  const { data: jobs, isLoading } = useJobs();

  const stats = useMemo(() => {
    if (!jobs) return { thisMonth: 0, active: 0, awaitingApproval: 0, outsourcedPending: 0 };
    
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const allJobs = jobs as JobWithDetails[];

    return {
      thisMonth: allJobs.filter((j) => {
        const created = parseISO(j.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length,
      active: allJobs.filter((j) => j.status !== "completed").length,
      awaitingApproval: allJobs.filter((j) => j.status === "waiting_approval").length,
      outsourcedPending: allJobs.filter((j) => {
        if (j.status === "finished") return false;
        const tasks = (j.outsourced_tasks || []) as Array<{ status?: string }>;
        return tasks.some((t) => t.status !== "complete");
      }).length,
    };
  }, [jobs]);

  const alerts = useMemo(() => {
    if (!jobs) return { dueSoon: [], late: [], waiverNeeded: [], outsourced: [] };
    
    const allJobs = jobs as JobWithDetails[];
    const now = new Date();

    return {
      dueSoon: allJobs.filter((j) => {
        if (!j.due_date || !j.is_movement_service) return false;
        const days = differenceInDays(parseISO(j.due_date), now);
        return days >= 0 && days <= 14;
      }),
      late: allJobs.filter((j) => {
        if (!j.due_date || !j.is_movement_service) return false;
        const days = differenceInDays(parseISO(j.due_date), now);
        const earlyStatuses = ["intake", "inspection", "waiting_approval", "in_queue"];
        return days <= 21 && earlyStatuses.includes(j.status);
      }),
      waiverNeeded: allJobs.filter((j) => 
        j.status !== "finished" && j.inspections?.waiver_required && !j.inspections?.waiver_signed
      ),
      outsourced: allJobs.filter((j) => {
        if (j.status === "finished") return false;
        const tasks = (j.outsourced_tasks || []) as Array<{ status?: string }>;
        return tasks.some((t) => t.status !== "finished");
      }),
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">This Month</p>
            <div className="text-xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Active Jobs</p>
            <div className="text-xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Awaiting Approval</p>
            <div className="text-xl font-bold text-amber-600">{stats.awaitingApproval}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Outsourced Pending</p>
            <div className="text-xl font-bold text-blue-600">{stats.outsourcedPending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Sections */}
      <div className="grid gap-2 lg:grid-cols-2">
        {/* Due Within 14 Days */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <CardTitle className="text-xs font-medium">Due Within 14 Days</CardTitle>
              {alerts.dueSoon.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {alerts.dueSoon.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" asChild>
              <Link to="/work-queue?filter=due_fourteen">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {alerts.dueSoon.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs due soon</p>
            ) : (
              <div className="space-y-1.5">
                {alerts.dueSoon.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} compact highlight="warning" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Late Jobs */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <CardTitle className="text-xs font-medium">Late Jobs</CardTitle>
              {alerts.late.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {alerts.late.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" asChild>
              <Link to="/work-queue?filter=past_due">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {alerts.late.length === 0 ? (
              <p className="text-xs text-muted-foreground">No late jobs</p>
            ) : (
              <div className="space-y-1.5">
                {alerts.late.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} compact highlight="danger" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waiver Required */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileWarning className="h-3.5 w-3.5 text-orange-500" />
              <CardTitle className="text-xs font-medium">Waiver Required</CardTitle>
              {alerts.waiverNeeded.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {alerts.waiverNeeded.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {alerts.waiverNeeded.length === 0 ? (
              <p className="text-xs text-muted-foreground">All waivers signed</p>
            ) : (
              <div className="space-y-1.5">
                {alerts.waiverNeeded.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outsourced Pending */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-blue-500" />
              <CardTitle className="text-xs font-medium">Outsourced Pending</CardTitle>
              {alerts.outsourced.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {alerts.outsourced.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" asChild>
              <Link to="/work-queue?filter=outsourced">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {alerts.outsourced.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending outsourced work</p>
            ) : (
              <div className="space-y-1.5">
                {alerts.outsourced.slice(0, 3).map((job) => (
                  <JobCard key={job.id} job={job} compact showOutsourced />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
