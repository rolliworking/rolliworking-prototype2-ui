import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay } from "date-fns";
import { Printer, Calendar } from "lucide-react";
import { SERVICE_TYPE_LABELS } from "@/lib/job-utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";

interface JobStatusChange {
  id: string;
  estimate_number: string | null;
  client_name: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  status: string;
  updated_at: string;
  service_type: string | null;
  inspections: { job_type: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  inspection: "Inspection",
  waiting_approval: "Waiting Approval",
  in_queue: "In Queue",
  in_progress: "In Progress",
  parts_approval: "Parts Approval",
  parts_on_order: "Parts On Order",
  in_testing: "In Testing",
  finished: "Finished",
};

export default function StatusChangesReport() {
  usePageMeta({ title: "Status Changes Report" });

  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["status-changes", selectedDate],
    queryFn: async () => {
      // Parse as local time by appending T00:00:00 to avoid UTC offset issues
      const localDate = new Date(selectedDate + "T00:00:00");
      const dateStart = startOfDay(localDate).toISOString();
      const dateEnd = endOfDay(localDate).toISOString();

      const { data, error } = await supabase
        .from("jobs")
        .select("id, estimate_number, client_name, watch_brand, watch_model, status, updated_at, service_type, inspections(job_type)")
        .gte("updated_at", dateStart)
        .lte("updated_at", dateEnd)
        .order("updated_at", { ascending: true });

      if (error) throw error;
      
      // Filter out jobs missing critical info (estimate_number or client_name)
      const filtered = (data || []).filter(
        (job) => job.estimate_number || job.client_name
      );
      return filtered as JobStatusChange[];
    },
  });

  const handlePrint = () => {
    window.print();
  };

  // Parse as local time to avoid UTC offset issues
  const formattedDate = format(new Date(selectedDate + "T00:00:00"), "MMMM d, yyyy");

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header - hidden in print */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold">Daily Status Changes Report</h1>
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      {/* Date Picker - hidden in print */}
      <Card className="mb-6 print:hidden">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="report-date">Report Date:</Label>
            </div>
            <Input
              id="report-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Printable Report */}
      <div className="print:pt-0">
        {/* Print Header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold text-center">Daily Status Changes Report</h1>
          <p className="text-center text-sm text-muted-foreground">{formattedDate}</p>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print:pb-2">
            <CardTitle className="text-lg print:text-base">
              Jobs Updated on {formattedDate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : jobs.length === 0 ? (
              <p className="text-muted-foreground">No status changes recorded for this date.</p>
            ) : (
              <div className="space-y-0">
                {/* Simple text list for printing */}
                <div className="font-mono text-sm space-y-2">
                  <div className="grid grid-cols-[120px_140px_1fr_140px_150px] gap-2 font-semibold border-b pb-2 mb-2">
                    <span>Est #</span>
                    <span>Ref #</span>
                    <span>Customer</span>
                    <span>Job Type</span>
                    <span>Status</span>
                  </div>
                  {jobs.map((job) => {
                    const jobType = job.inspections?.job_type || job.service_type || null;
                    const jobTypeLabel = jobType ? (SERVICE_TYPE_LABELS[jobType as keyof typeof SERVICE_TYPE_LABELS] || jobType) : "—";
                    return (
                      <div
                        key={job.id}
                        className="grid grid-cols-[120px_140px_1fr_140px_150px] gap-2 py-1 border-b border-dashed last:border-0"
                      >
                        <span className="truncate">{job.estimate_number || "—"}</span>
                        <span className="truncate">
                          {job.watch_brand && job.watch_model
                            ? `${job.watch_brand} ${job.watch_model}`
                            : job.watch_brand || "—"}
                        </span>
                        <span className="truncate">{job.client_name || "—"}</span>
                        <span className="truncate">{jobTypeLabel}</span>
                        <span className="font-medium">
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                  Total: {jobs.length} job{jobs.length !== 1 ? "s" : ""} updated
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .container, .container * {
            visibility: visible;
          }
          .container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
