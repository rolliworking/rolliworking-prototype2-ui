import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Printer, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWeeklyWatchmakerReport } from "@/hooks/use-weekly-watchmaker-report";
import { usePageMeta } from "@/hooks/use-page-meta";

interface ReportJob {
  estimateNumber: string;
  brand: string;
  model: string;
  clientName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  statusChangedAt?: string;
}

function JobRow({ job, showOverdue = false }: { job: ReportJob; showOverdue?: boolean }) {
  return (
    <tr className="border-b border-border/50 text-sm">
      <td className="py-1.5 pr-3 font-mono text-xs">{job.estimateNumber}</td>
      <td className="py-1.5 pr-3">{job.brand} {job.model}</td>
      <td className="py-1.5 pr-3">{job.clientName}</td>
      <td className="py-1.5 pr-3 text-xs">
        {job.dueDate ? format(parseISO(job.dueDate), "MMM d") : "—"}
      </td>
      {showOverdue && (
        <td className="py-1.5 text-xs font-semibold text-destructive">
          {job.daysOverdue ? `${job.daysOverdue}d` : "—"}
        </td>
      )}
    </tr>
  );
}

function JobTable({
  jobs,
  showOverdue = false,
  emptyText = "None",
}: {
  jobs: ReportJob[];
  showOverdue?: boolean;
  emptyText?: string;
}) {
  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground italic ml-1">{emptyText}</p>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="text-xs text-muted-foreground border-b">
          <th className="text-left py-1 pr-3 font-medium">Est #</th>
          <th className="text-left py-1 pr-3 font-medium">Watch</th>
          <th className="text-left py-1 pr-3 font-medium">Client</th>
          <th className="text-left py-1 pr-3 font-medium">Due</th>
          {showOverdue && <th className="text-left py-1 font-medium">Over</th>}
        </tr>
      </thead>
      <tbody>
        {jobs.map((job, i) => (
          <JobRow key={`${job.estimateNumber}-${i}`} job={job} showOverdue={showOverdue} />
        ))}
      </tbody>
    </table>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  variant = "default",
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  variant?: "success" | "warning" | "default";
}) {
  const colors = {
    success: "text-green-600",
    warning: "text-amber-600",
    default: "text-foreground",
  };
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${colors[variant]}`} />
      <h4 className={`font-semibold text-sm ${colors[variant]}`}>{title}</h4>
      <Badge variant="secondary" className="text-xs">{count}</Badge>
    </div>
  );
}

export default function WeeklyWatchmakerReport() {
  usePageMeta({ title: "Weekly Watchmaker Report" });
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, isLoading } = useWeeklyWatchmakerReport(weekOffset);

  const handlePrint = () => {
    window.print();
  };

  const weekLabel = data
    ? `${format(parseISO(data.weekStart), "MMM d")} – ${format(parseISO(data.weekEnd), "MMM d, yyyy")}`
    : "";

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Header - hides on print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Weekly Watchmaker Report</h1>
          <p className="text-muted-foreground text-sm">
            Print individual reports for each watchmaker every Monday
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
            disabled={weekOffset === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={handlePrint} className="ml-4">
            <Printer className="h-4 w-4 mr-2" />
            Print All
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32 print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {data && data.watchmakers.length === 0 && (
        <Card className="print:hidden">
          <CardContent className="py-8 text-center text-muted-foreground">
            No watchmaker data found for this week.
          </CardContent>
        </Card>
      )}

      {/* One card per watchmaker — each gets its own print page */}
      {data?.watchmakers.map((wm) => (
        <div key={wm.watchmaker} className="print-page-break">
          <Card className="print:shadow-none print:border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl">{wm.watchmaker}</CardTitle>
                  <Badge variant="outline" className="text-sm font-semibold">
                    {wm.activeJobCount} jobs
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground print:text-black">
                  Week of {weekLabel}
                </span>
              </div>
              <Separator />
            </CardHeader>
            <CardContent className="space-y-5">
              {/* ACCOMPLISHMENTS */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-green-700 uppercase tracking-wide text-sm">
                  ✓ Accomplishments
                </h3>

                <div>
                  <SectionHeader
                    icon={CheckCircle2}
                    title="Jobs Completed"
                    count={wm.accomplishments.completed.length}
                    variant="success"
                  />
                  <JobTable jobs={wm.accomplishments.completed} emptyText="No completions this week" />
                </div>

                {wm.weeklyTarget > 0 && wm.accomplishments.completed.length >= wm.weeklyTarget && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-3">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      Weekly Goal Met! {wm.accomplishments.completed.length} of {wm.weeklyTarget} completed ✓
                    </span>
                  </div>
                )}

                <div>
                  <SectionHeader
                    icon={Clock}
                    title="Jobs Moved to Testing"
                    count={wm.accomplishments.wentToTesting.length}
                    variant="success"
                  />
                  <JobTable jobs={wm.accomplishments.wentToTesting} emptyText="None moved to testing" />
                </div>

                {wm.weeklyTestingTarget > 0 && wm.accomplishments.wentToTesting.length >= wm.weeklyTestingTarget && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-3">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      Testing Goal Met! {wm.accomplishments.wentToTesting.length} of {wm.weeklyTestingTarget} to testing ✓
                    </span>
                  </div>
                )}

                {wm.accomplishments.pastDueProgressed.length > 0 && (
                  <div>
                    <SectionHeader
                      icon={CheckCircle2}
                      title="Past Due Jobs Progressed to Testing"
                      count={wm.accomplishments.pastDueProgressed.length}
                      variant="success"
                    />
                    <JobTable jobs={wm.accomplishments.pastDueProgressed} showOverdue />
                  </div>
                )}
              </div>

              <Separator />

              {/* NEEDS IMPROVEMENT */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-amber-700 uppercase tracking-wide text-sm">
                  ⚠ Needs Improvement
                </h3>

                {wm.weeklyTarget > 0 && wm.accomplishments.completed.length < wm.weeklyTarget && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                    <Target className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Missed Weekly Goal — {wm.accomplishments.completed.length} of {wm.weeklyTarget} completed ({wm.weeklyTarget - wm.accomplishments.completed.length} short)
                    </span>
                  </div>
                )}

                {wm.weeklyTestingTarget > 0 && wm.accomplishments.wentToTesting.length < wm.weeklyTestingTarget && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3">
                    <Target className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Missed Testing Goal — {wm.accomplishments.wentToTesting.length} of {wm.weeklyTestingTarget} to testing ({wm.weeklyTestingTarget - wm.accomplishments.wentToTesting.length} short)
                    </span>
                  </div>
                )}

                <div>
                  <SectionHeader
                    icon={AlertTriangle}
                    title="Past Due — No Progress"
                    count={wm.needsImprovement.pastDueStale.length}
                    variant="warning"
                  />
                  <JobTable
                    jobs={wm.needsImprovement.pastDueStale}
                    showOverdue
                    emptyText="All past due jobs showed progress 👍"
                  />
                </div>

                <div>
                  <SectionHeader
                    icon={AlertTriangle}
                    title="Downgraded from Testing → In Progress"
                    count={wm.needsImprovement.downgradedFromTesting.length}
                    variant="warning"
                  />
                  <JobTable
                    jobs={wm.needsImprovement.downgradedFromTesting}
                    emptyText="No downgrades this week 👍"
                  />
                </div>
              </div>

              <Separator />

              {/* UPCOMING */}
              <div className="space-y-3">
                <h3 className="font-bold text-base uppercase tracking-wide text-sm">
                  📅 Due in Next 14 Days
                </h3>
                <JobTable jobs={wm.upcoming} emptyText="No upcoming deadlines" />
              </div>

              <Separator />

              {/* WAITING FOR PARTS */}
              {wm.waitingForParts.length > 0 && (
                <>
                  <div className="space-y-3">
                    <h3 className="font-bold text-base text-purple-700 uppercase tracking-wide text-sm">
                      📦 Waiting for Parts
                    </h3>
                    <JobTable jobs={wm.waitingForParts} showOverdue emptyText="" />
                  </div>
                  <Separator />
                </>
              )}

              {/* PAST DUE */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-destructive uppercase tracking-wide text-sm">
                  🔴 Past Due
                </h3>
                <JobTable jobs={wm.pastDue} showOverdue emptyText="No past due jobs!" />
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Print styles */}
      <style>{`
        @media print {
          html, body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: letter portrait;
            margin: 0.35in 0.4in;
          }

          /* Hide sidebar (outer wrapper + inner), app header, toasts */
          nav, aside,
          [data-sidebar="sidebar"],
          [data-sonner-toaster],
          [data-variant="inset"],
          [data-state="expanded"],
          [data-state="collapsed"],
          header {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            min-width: 0 !important;
            min-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }

          /* The print:hidden elements */
          .print\\:hidden {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          /* Reset ALL wrappers to simple block flow — no flex gaps */
          #root,
          #root > *,
          [data-sidebar="provider"],
          [data-sidebar="inset"],
          main,
          .flex-1 {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            background: white !important;
            border: none !important;
            gap: 0 !important;
          }

          /* Override sidebar CSS variables */
          :root {
            --sidebar-width: 0px !important;
            --sidebar-width-icon: 0px !important;
          }

          /* Page breaks */
          .print-page-break {
            break-before: page;
            page-break-before: always;
          }
          .print-page-break:first-of-type {
            break-before: auto;
            page-break-before: auto;
          }

          /* Card — clean border, no shadow */
          .print-page-break > div {
            border: 1.5pt solid #333 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: white !important;
          }

          /* Card header */
          .print-page-break [class*="CardHeader"] {
            padding: 8px 12px 6px !important;
          }
          .text-xl {
            font-size: 18px !important;
            font-weight: 800 !important;
            color: black !important;
          }

          /* Card content */
          .print-page-break [class*="CardContent"] {
            padding: 4px 12px 10px !important;
          }

          /* Section headers (Accomplishments, Needs Improvement, etc.) */
          h3 {
            font-size: 11px !important;
            letter-spacing: 0.08em !important;
            margin-bottom: 3px !important;
            padding-bottom: 2px !important;
            border-bottom: 1px solid #ccc !important;
            color: black !important;
          }

          /* Sub-section headers (Jobs Completed, etc.) */
          h4, .font-semibold.text-sm {
            font-size: 10px !important;
          }

          /* Tables */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-family: "SF Mono", "Consolas", "Monaco", monospace !important;
          }
          table th {
            padding: 2px 4px !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.05em !important;
            border-bottom: 1.5pt solid #666 !important;
            color: #333 !important;
          }
          table td {
            padding: 2px 4px !important;
            font-size: 9px !important;
            border-bottom: 0.5pt solid #ddd !important;
            color: black !important;
          }
          table tr:last-child td {
            border-bottom: none !important;
          }

          /* Badges */
          [class*="Badge"], .inline-flex[class*="badge"] {
            font-size: 8px !important;
            padding: 1px 5px !important;
            border-radius: 2px !important;
          }

          /* Goal banners */
          .rounded-md {
            border-radius: 3px !important;
            padding: 4px 8px !important;
            margin: 3px 0 !important;
            font-size: 9px !important;
          }

          /* Separator — thin line */
          [data-orientation="horizontal"] {
            margin: 6px 0 !important;
            border-color: #ccc !important;
          }

          /* Tighten all spacing */
          .space-y-5 > * + * {
            margin-top: 6px !important;
          }
          .space-y-3 > * + * {
            margin-top: 4px !important;
          }
          .space-y-6 > * + * {
            margin-top: 0 !important;
          }

          /* Muted text should be visible */
          .text-muted-foreground {
            color: #555 !important;
          }
          .print\\:text-black {
            color: black !important;
          }

          /* Italic empty text */
          .italic {
            font-size: 9px !important;
            color: #888 !important;
          }

          /* Destructive text */
          .text-destructive {
            color: #c00 !important;
          }
        }
      `}</style>
    </div>
  );
}
