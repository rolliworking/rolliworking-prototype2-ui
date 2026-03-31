import { useMemo } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs } from "@/hooks/use-jobs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { Loader2, TrendingUp, Clock, CheckCircle, AlertTriangle, Hourglass, FlaskConical, Mail, Timer } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const STATUS_COLORS: Record<string, string> = {
  intake: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  in_testing: "hsl(210, 80%, 55%)",
  awaiting_approval: "hsl(45, 90%, 50%)",
  completed: "hsl(142, 70%, 45%)",
  delivered: "hsl(var(--chart-5))",
};

export default function Analytics() {
  usePageMeta({ title: "Analytics" });
  const { data: jobs, isLoading } = useJobs();

  const analytics = useMemo(() => {
    if (!jobs) return null;

    const now = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      return {
        month: format(date, "MMM"),
        start: startOfMonth(date),
        end: endOfMonth(date),
      };
    });

    // Jobs by month
    const jobsByMonth = last6Months.map(({ month, start, end }) => {
      const created = jobs.filter((job) => {
        const createdAt = new Date(job.created_at);
        return isWithinInterval(createdAt, { start, end });
      }).length;

      // Use updated_at for completed jobs (status = completed or delivered)
      const completed = jobs.filter((job) => {
        if (!["completed", "delivered"].includes(job.status || "")) return false;
        const updatedAt = new Date(job.updated_at);
        return isWithinInterval(updatedAt, { start, end });
      }).length;

      return { month, created, completed };
    });

    // Jobs by status
    const statusCounts = jobs.reduce((acc, job) => {
      const status = job.status || "intake";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const jobsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
      status,
    }));

    // Jobs by service type
    const serviceTypeCounts = jobs.reduce((acc, job) => {
      const services = job.service_type;
      if (Array.isArray(services)) {
        services.forEach((service: string) => {
          acc[service] = (acc[service] || 0) + 1;
        });
      } else if (typeof services === "string" && services) {
        acc[services] = (acc[services] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const jobsByService = Object.entries(serviceTypeCounts)
      .map(([service, count]) => ({
        name: service.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Average turnaround time (completed/delivered jobs only)
    const completedJobs = jobs.filter((job) => 
      ["completed", "delivered"].includes(job.status || "") && job.created_at && job.updated_at
    );
    const avgTurnaround = completedJobs.length > 0
      ? Math.round(
          completedJobs.reduce((sum, job) => {
            return sum + differenceInDays(new Date(job.updated_at), new Date(job.created_at));
          }, 0) / completedJobs.length
        )
      : 0;

    // Active jobs count
    const activeJobs = jobs.filter((job) => 
      !["completed", "delivered"].includes(job.status || "")
    ).length;

    // Late jobs
    const lateJobs = jobs.filter((job) => {
      if (!job.due_date || ["completed", "delivered"].includes(job.status || "")) return false;
      return new Date(job.due_date) < now;
    }).length;

    // Completion rate this month
    const thisMonth = last6Months[5];
    const createdThisMonth = jobs.filter((job) => {
      const createdAt = new Date(job.created_at);
      return isWithinInterval(createdAt, { start: thisMonth.start, end: thisMonth.end });
    }).length;
    
    const completedThisMonth = jobs.filter((job) => {
      if (!["completed", "delivered"].includes(job.status || "")) return false;
      const updatedAt = new Date(job.updated_at);
      return isWithinInterval(updatedAt, { start: thisMonth.start, end: thisMonth.end });
    }).length;

    // NEW: Average days waiting for approval
    const approvalJobs = jobs.filter((job) => 
      ["awaiting_approval", "waiting_approval", "parts_approval"].includes(job.status || "")
    );
    const avgDaysWaitingApproval = approvalJobs.length > 0
      ? Math.round(
          approvalJobs.reduce((sum, job) => {
            return sum + differenceInDays(now, new Date(job.updated_at));
          }, 0) / approvalJobs.length
        )
      : 0;

    // NEW: Average days in testing
    const testingJobs = jobs.filter((job) => 
      job.status === "in_testing" && job.in_testing_at
    );
    const avgDaysInTesting = testingJobs.length > 0
      ? Math.round(
          testingJobs.reduce((sum, job) => {
            return sum + differenceInDays(now, new Date(job.in_testing_at!));
          }, 0) / testingJobs.length
        )
      : 0;

    // NEW: Update email stats - count jobs with sent email templates
    const jobsWithEmails = jobs.filter((job) => {
      const templates = job.sent_email_templates;
      return Array.isArray(templates) && templates.length > 0;
    });
    const totalEmailsSent = jobsWithEmails.reduce((sum, job) => {
      const templates = job.sent_email_templates;
      return sum + (Array.isArray(templates) ? templates.length : 0);
    }, 0);

    // Average days between update emails (for jobs with last_update_email_sent)
    const jobsNeedingUpdate = jobs.filter((job) => 
      !["completed", "delivered"].includes(job.status || "") && job.last_update_email_sent
    );
    const avgDaysSinceUpdate = jobsNeedingUpdate.length > 0
      ? Math.round(
          jobsNeedingUpdate.reduce((sum, job) => {
            return sum + differenceInDays(now, new Date(job.last_update_email_sent!));
          }, 0) / jobsNeedingUpdate.length
        )
      : 0;

    // NEW: Average response time to update notifications
    // Measures days from when update became due (14 days after last email/intake) to when email was sent
    // We look at jobs that have sent emails and calculate the delay
    const UPDATE_INTERVAL_DAYS = 14;
    let totalResponseDays = 0;
    let responseCount = 0;
    
    jobsWithEmails.forEach((job) => {
      const templates = job.sent_email_templates as Array<{ sentAt?: string; template_id?: string }> | null;
      if (!Array.isArray(templates) || templates.length === 0) return;
      
      const intakeDate = job.intake_date ? new Date(job.intake_date) : new Date(job.created_at);
      
      templates.forEach((template, index) => {
        if (!template.sentAt) return;
        
        const sentAt = new Date(template.sentAt);
        // Calculate when the update was due
        let dueDate: Date;
        if (index === 0) {
          // First email: due 14 days after intake
          dueDate = new Date(intakeDate);
          dueDate.setDate(dueDate.getDate() + UPDATE_INTERVAL_DAYS);
        } else {
          // Subsequent emails: due 14 days after previous email
          const prevSentAt = templates[index - 1]?.sentAt;
          if (prevSentAt) {
            dueDate = new Date(prevSentAt);
            dueDate.setDate(dueDate.getDate() + UPDATE_INTERVAL_DAYS);
          } else {
            return; // Can't calculate without previous date
          }
        }
        
        // Response time = days from due date to actual send
        // Negative means sent early, positive means delayed
        const responseDays = differenceInDays(sentAt, dueDate);
        totalResponseDays += responseDays;
        responseCount++;
      });
    });
    
    const avgEmailResponseTime = responseCount > 0
      ? Math.round(totalResponseDays / responseCount)
      : 0;

    return {
      jobsByMonth,
      jobsByStatus,
      jobsByService,
      avgTurnaround,
      activeJobs,
      lateJobs,
      totalJobs: jobs.length,
      completedThisMonth,
      createdThisMonth,
      avgDaysWaitingApproval,
      approvalJobsCount: approvalJobs.length,
      avgDaysInTesting,
      testingJobsCount: testingJobs.length,
      totalEmailsSent,
      avgDaysSinceUpdate,
      jobsNeedingUpdateCount: jobsNeedingUpdate.length,
      avgEmailResponseTime,
      emailResponseCount: responseCount,
    };
  }, [jobs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Performance metrics and trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalJobs}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.createdThisMonth} created this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeJobs}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Turnaround</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgTurnaround} days</div>
            <p className="text-xs text-muted-foreground">
              {analytics.completedThisMonth} completed this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Jobs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.lateJobs > 0 ? "text-destructive" : ""}`}>
              {analytics.lateJobs}
            </div>
            <p className="text-xs text-muted-foreground">
              Past due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Days Waiting Approval</CardTitle>
            <Hourglass className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgDaysWaitingApproval} days</div>
            <p className="text-xs text-muted-foreground">
              {analytics.approvalJobsCount} jobs awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Days In Testing</CardTitle>
            <FlaskConical className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgDaysInTesting} days</div>
            <p className="text-xs text-muted-foreground">
              {analytics.testingJobsCount} jobs currently testing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Update Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalEmailsSent} sent</div>
            <p className="text-xs text-muted-foreground">
              Avg {analytics.avgDaysSinceUpdate} days since last update ({analytics.jobsNeedingUpdateCount} jobs)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Response Time</CardTitle>
            <Timer className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.avgEmailResponseTime > 0 ? "text-amber-500" : "text-emerald-500"}`}>
              {analytics.avgEmailResponseTime > 0 ? `+${analytics.avgEmailResponseTime}` : analytics.avgEmailResponseTime} days
            </div>
            <p className="text-xs text-muted-foreground">
              Avg delay from due date ({analytics.emailResponseCount} emails)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Jobs Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs Over Time</CardTitle>
            <CardDescription>Created vs Completed (Last 6 Months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                created: { label: "Created", color: "hsl(var(--primary))" },
                completed: { label: "Completed", color: "hsl(142, 70%, 45%)" },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.jobsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(142, 70%, 45%)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(142, 70%, 45%)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Jobs by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
            <CardDescription>Current distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: { label: "Jobs" },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.jobsByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {analytics.jobsByStatus.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs by Service Type</CardTitle>
          <CardDescription>Most common services</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              count: { label: "Jobs", color: "hsl(var(--primary))" },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.jobsByService} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
