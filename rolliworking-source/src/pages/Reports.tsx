import * as React from "react";
import { format, parseISO, differenceInDays, addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, FileText, Filter, Printer, Zap } from "lucide-react";
import { SERVICE_TYPE_LABELS } from "@/lib/job-utils";

import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs } from "@/hooks/use-jobs";
import { useApprovalWaitTimes } from "@/hooks/use-approval-wait-times";
import type { JobWithDetails } from "@/types/job";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const WORKFLOW_STATUSES = [
  { value: "intake", label: "Intake" },
  { value: "inspection", label: "Inspection" },
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "in_queue", label: "In Queue" },
  { value: "in_progress", label: "In Progress" },
  { value: "parts_approval", label: "Parts Approval" },
  { value: "parts_on_order", label: "Parts On Order" },
  { value: "in_testing", label: "In Testing" },
  { value: "finished", label: "Finished" },
] as const;

const CATEGORIES = [
  { value: "waiting_approval", label: "Waiting for Approval" },
  { value: "due_four_weeks", label: "Due Within 4 Weeks" },
  { value: "due_three_weeks", label: "Due Within 3 Weeks" },
  { value: "due_fourteen", label: "Due Within 14 Days" },
  { value: "warranty", label: "Warranty Service" },
  { value: "outsourced", label: "Outstanding Outsourced" },
  { value: "parts_approval", label: "Awaiting Parts Approval" },
  { value: "parts_on_order", label: "Parts On Order" },
  { value: "needs_email", label: "Needing Update Email" },
  { value: "past_due", label: "Past Due Date" },
  { value: "waiver_required", label: "Waiver Required" },
] as const;

// Preset report configurations
const PRESET_REPORTS = [
  {
    id: "at_risk",
    label: "At Risk (Not Started)",
    description: "Jobs not yet in progress but within 3 weeks or past due date",
    statuses: ["intake", "inspection", "waiting_approval", "in_queue"],
    categories: ["due_three_weeks", "past_due"],
    movementOnly: false,
  },
  {
    id: "late_jobs",
    label: "Late Jobs",
    description: "Movement services in early stages with ≤21 days to due date",
    statuses: ["intake", "inspection", "waiting_approval", "in_queue"],
    categories: ["due_three_weeks"],
    movementOnly: true,
  },
  {
    id: "overdue",
    label: "Overdue Jobs",
    description: "All jobs past their due date",
    statuses: [],
    categories: ["past_due"],
    movementOnly: false,
  },
  {
    id: "approval_wait",
    label: "Approval Wait Time",
    description: "How many days each job has been waiting for approval",
    statuses: [],
    categories: [],
    movementOnly: false,
  },
  {
    id: "pending_waivers",
    label: "Pending Waivers",
    description: "Jobs requiring unsigned liability waivers",
    statuses: [],
    categories: ["waiver_required"],
    movementOnly: false,
  },
  {
    id: "parts_status",
    label: "Parts Status",
    description: "Jobs in parts approval or waiting for parts",
    statuses: ["parts_approval", "parts_on_order"],
    categories: [],
    movementOnly: false,
  },
] as const;

function isMovementService(job: JobWithDetails): boolean {
  const services = job.services as string[] | null;
  if (Array.isArray(services)) {
    return services.some(s => s.includes("movement"));
  }
  const jobType = job.inspections?.job_type || "";
  return ["antique_movement", "vintage_movement", "modern_movement", "movement_service"].includes(jobType);
}

function getNextEmailDays(job: JobWithDetails): number | null {
  if (job.status === "finished") return null;
  
  if (!job.last_update_email_sent) {
    if (job.intake_date) {
      const intake = parseISO(job.intake_date);
      const daysSinceIntake = differenceInDays(new Date(), intake);
      return Math.max(0, 14 - daysSinceIntake);
    }
    return 0;
  }
  
  const lastSent = parseISO(job.last_update_email_sent);
  const nextDue = addDays(lastSent, 14);
  return differenceInDays(nextDue, new Date());
}

export default function Reports() {
  usePageMeta({ title: "Reports | Rolliworks" });

  const { data: jobs, isLoading } = useJobs();
  const { data: approvalWaitData, isLoading: isLoadingWait } = useApprovalWaitTimes();

  // Date range state
  const [startDate, setStartDate] = React.useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined);

  // Multi-select statuses
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);

  // Multi-select categories
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

  // Movement only filter (for late jobs preset)
  const [movementOnly, setMovementOnly] = React.useState(false);

  // Active preset name for display
  const [activePreset, setActivePreset] = React.useState<string | null>(null);

  const isApprovalWaitReport = activePreset === "approval_wait";

  const toggleStatus = (status: string) => {
    setActivePreset(null);
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleCategory = (category: string) => {
    setActivePreset(null);
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedStatuses([]);
    setSelectedCategories([]);
    setMovementOnly(false);
    setActivePreset(null);
  };

  const applyPreset = (preset: typeof PRESET_REPORTS[number]) => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedStatuses([...preset.statuses]);
    setSelectedCategories([...preset.categories]);
    setMovementOnly(preset.movementOnly);
    setActivePreset(preset.id);
  };

  // Filter jobs based on criteria
  const filteredJobs = React.useMemo(() => {
    if (!jobs) return [];
    let result = jobs as JobWithDetails[];
    const now = new Date();

    // For "At Risk" preset, always exclude finished jobs upfront
    if (activePreset === "at_risk") {
      result = result.filter(j => j.status !== "finished");
    }

    // Date range filter (based on intake_date)
    if (startDate || endDate) {
      result = result.filter(j => {
        if (!j.intake_date) return false;
        const intakeDate = parseISO(j.intake_date);
        if (startDate && endDate) {
          return isWithinInterval(intakeDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate),
          });
        }
        if (startDate) return intakeDate >= startOfDay(startDate);
        if (endDate) return intakeDate <= endOfDay(endDate);
        return true;
      });
    }

    // Movement only filter
    if (movementOnly) {
      result = result.filter(j => isMovementService(j));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      result = result.filter(j => selectedStatuses.includes(j.status));
    }

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter(j => {
        return selectedCategories.some(cat => {
          switch (cat) {
            case "waiting_approval":
              return j.status === "waiting_approval";
            case "due_four_weeks": {
              if (!j.due_date || j.status === "finished") return false;
              const days = differenceInDays(parseISO(j.due_date), now);
              return days >= 0 && days <= 28;
            }
            case "due_three_weeks": {
              if (!j.due_date) return false;
              const days = differenceInDays(parseISO(j.due_date), now);
              return days >= 0 && days <= 21 && (j.status === "in_queue" || j.status === "waiting_approval" || j.status === "intake" || j.status === "inspection");
            }
            case "due_fourteen": {
              if (!j.due_date || j.status === "finished") return false;
              const days = differenceInDays(parseISO(j.due_date), now);
              return days >= 0 && days <= 14;
            }
            case "warranty": {
              if (j.status === "finished") return false;
              const services = j.services as string[] | null;
              return Array.isArray(services) && services.includes("warranty");
            }
            case "outsourced": {
              if (j.status === "finished") return false;
              const tasks = j.outsourced_tasks as any[];
              return Array.isArray(tasks) && tasks.some(t => t.status === "pending" || t.status === "sent");
            }
            case "parts_approval":
              return j.status === "parts_approval";
            case "parts_on_order":
              return j.status === "parts_on_order";
            case "needs_email": {
              if (j.status === "finished") return false;
              const emailDays = getNextEmailDays(j);
              return emailDays !== null && emailDays <= 0;
            }
            case "past_due": {
              if (j.status === "finished" || !j.due_date) return false;
              const days = differenceInDays(parseISO(j.due_date), now);
              return days < 0;
            }
            case "waiver_required": {
              if (j.status === "finished") return false;
              const needsWaiver = j.needs_liability_waiver || j.inspections?.waiver_required;
              const signed = j.waiver_signed || j.inspections?.waiver_signed;
              return needsWaiver && !signed;
            }
            default:
              return false;
          }
        });
      });
    }

    return result;
  }, [jobs, startDate, endDate, selectedStatuses, selectedCategories, movementOnly]);

  const hasFilters = startDate || endDate || selectedStatuses.length > 0 || selectedCategories.length > 0 || movementOnly;

  // Print report function
  const handlePrint = () => {
    const presetLabel = activePreset 
      ? PRESET_REPORTS.find(p => p.id === activePreset)?.label 
      : "Custom Report";
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rolliworks Report - ${presetLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .filters { background: #f5f5f5; padding: 10px; margin-bottom: 20px; border-radius: 4px; }
          .filters span { display: inline-block; background: #e0e0e0; padding: 2px 8px; margin: 2px; border-radius: 3px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #f0f0f0; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 20px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <h1>ROLLIWORKS - ${presetLabel}</h1>
        <p class="subtitle">Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} | ${filteredJobs.length} jobs</p>
        
        ${hasFilters ? `
        <div class="filters">
          <strong>Filters:</strong>
          ${startDate ? `<span>From: ${format(startDate, "MM/dd/yy")}</span>` : ""}
          ${endDate ? `<span>To: ${format(endDate, "MM/dd/yy")}</span>` : ""}
          ${movementOnly ? `<span>Movement Services Only</span>` : ""}
          ${selectedStatuses.map(s => `<span>${WORKFLOW_STATUSES.find(ws => ws.value === s)?.label}</span>`).join("")}
          ${selectedCategories.map(c => `<span>${CATEGORIES.find(cat => cat.value === c)?.label}</span>`).join("")}
        </div>
        ` : ""}
        
        <table>
           <thead>
            <tr>
              <th>Client</th>
              <th>Watch</th>
              <th>Estimate #</th>
              <th>Job Type</th>
              <th>Status</th>
              <th>Intake</th>
              <th>Due</th>
              <th>Days Until Due</th>
            </tr>
          </thead>
          <tbody>
            ${filteredJobs.map(job => {
              const clientName = job.client_name || job.inspections?.watches?.customers?.name || "—";
              const watchBrand = job.watch_brand || job.inspections?.watches?.brand || "";
              const watchModel = job.watch_model || job.inspections?.watches?.model || "";
              const estimateNumber = job.estimate_number || job.inspections?.watches?.estimate_number || "—";
              const statusLabel = WORKFLOW_STATUSES.find(s => s.value === job.status)?.label || job.status;
              const daysUntil = job.due_date ? differenceInDays(parseISO(job.due_date), new Date()) : null;
              const jobType = job.inspections?.job_type || job.service_type || null;
              const jobTypeLabel = jobType ? (SERVICE_TYPE_LABELS[jobType as keyof typeof SERVICE_TYPE_LABELS] || jobType) : "—";
              
              return `
                <tr>
                  <td>${clientName}</td>
                  <td>${watchBrand} ${watchModel}</td>
                  <td>${estimateNumber}</td>
                  <td>${jobTypeLabel}</td>
                  <td>${statusLabel}</td>
                  <td>${job.intake_date ? format(parseISO(job.intake_date), "MM/dd/yy") : "—"}</td>
                  <td>${job.due_date ? format(parseISO(job.due_date), "MM/dd/yy") : "—"}</td>
                  <td>${daysUntil !== null ? (daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`) : "—"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        
        <p class="footer">Rolliworks Client Portal</p>
      </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Generate custom reports based on your filters</p>
      </div>

      {/* Quick Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Quick Reports
          </CardTitle>
          <CardDescription>Click a preset to instantly load report filters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {PRESET_REPORTS.map(preset => {
              const isAtRisk = preset.id === "at_risk";
              const isActive = activePreset === preset.id;
              
              return (
                <Button
                  key={preset.id}
                  variant={isActive ? "default" : isAtRisk ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className={`flex-col h-auto py-2 px-4 ${
                    isAtRisk && !isActive
                      ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg shadow-orange-500/25 ring-2 ring-orange-400/50"
                      : ""
                  } ${isAtRisk ? "min-w-[180px]" : ""}`}
                >
                  <span className={`font-medium ${isAtRisk ? "text-base" : ""}`}>
                    {isAtRisk && "⚠️ "}{preset.label}
                  </span>
                  <span className={`text-xs font-normal ${isAtRisk && !isActive ? "text-white/90" : "opacity-70"}`}>
                    {preset.description}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filter Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Customize your report criteria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range (Intake Date)</Label>
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setActivePreset(null); }} initialFocus />
                </PopoverContent>
              </Popover>
              <span className="self-center text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setActivePreset(null); }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Movement Only Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="movement-only"
              checked={movementOnly}
              onCheckedChange={(checked) => { setMovementOnly(!!checked); setActivePreset(null); }}
            />
            <Label htmlFor="movement-only" className="text-sm cursor-pointer">
              Movement services only
            </Label>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Job Status (select multiple)</Label>
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_STATUSES.map(status => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={selectedStatuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <Label htmlFor={`status-${status.value}`} className="text-sm cursor-pointer">
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Categories (select multiple)</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${cat.value}`}
                    checked={selectedCategories.includes(cat.value)}
                    onCheckedChange={() => toggleCategory(cat.value)}
                  />
                  <Label htmlFor={`cat-${cat.value}`} className="text-sm cursor-pointer">
                    {cat.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Report Results
                {activePreset && (
                  <Badge variant="secondary" className="ml-2">
                    {PRESET_REPORTS.find(p => p.id === activePreset)?.label}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isApprovalWaitReport
                  ? (isLoadingWait ? "Loading..." : `${approvalWaitData?.length ?? 0} jobs with approval wait data`)
                  : (isLoading ? "Loading..." : `${filteredJobs.length} jobs match your criteria`)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {filteredJobs.length > 0 && (
                <Button onClick={handlePrint} variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
              )}
            </div>
          </div>
          {hasFilters && (
            <div className="flex flex-wrap gap-1 mt-2">
              {startDate && <Badge variant="secondary">From: {format(startDate, "MM/dd/yy")}</Badge>}
              {endDate && <Badge variant="secondary">To: {format(endDate, "MM/dd/yy")}</Badge>}
              {movementOnly && <Badge variant="secondary">Movement Only</Badge>}
              {selectedStatuses.map(s => (
                <Badge key={s} variant="outline">{WORKFLOW_STATUSES.find(ws => ws.value === s)?.label}</Badge>
              ))}
              {selectedCategories.map(c => (
                <Badge key={c} variant="default">{CATEGORIES.find(cat => cat.value === c)?.label}</Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isApprovalWaitReport ? (
            // Approval Wait Time report view
            isLoadingWait ? (
              <p className="text-muted-foreground">Loading approval wait data...</p>
            ) : !approvalWaitData || approvalWaitData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No jobs have entered waiting approval status.</p>
            ) : (() => {
              // Build a lookup from job id to job details
              const jobsMap = new Map<string, JobWithDetails>();
              if (jobs) {
                for (const j of jobs as JobWithDetails[]) {
                  jobsMap.set(j.id, j);
                }
              }
              const waitRecords = approvalWaitData
                .map(r => ({ ...r, job: jobsMap.get(r.jobId) }))
                .filter(r => r.job); // Only show records we have job details for

              return (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Watch</TableHead>
                        <TableHead>Estimate #</TableHead>
                        <TableHead>Job Type</TableHead>
                        <TableHead>Current Status</TableHead>
                        <TableHead>Entered Waiting</TableHead>
                        <TableHead>Left Waiting</TableHead>
                        <TableHead>Days Waiting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waitRecords.map(({ jobId, job, enteredAt, exitedAt, daysWaiting, isStillWaiting }) => {
                        const j = job!;
                        const clientName = j.client_name || j.inspections?.watches?.customers?.name || "—";
                        const watchBrand = j.watch_brand || j.inspections?.watches?.brand || "";
                        const watchModel = j.watch_model || j.inspections?.watches?.model || "";
                        const estimateNumber = j.estimate_number || j.inspections?.watches?.estimate_number || "—";
                        const statusLabel = WORKFLOW_STATUSES.find(s => s.value === j.status)?.label || j.status;
                        const jobType = j.inspections?.job_type || j.service_type || null;
                        const jobTypeLabel = jobType ? (SERVICE_TYPE_LABELS[jobType as keyof typeof SERVICE_TYPE_LABELS] || jobType) : "—";
                        const shortLabels: Record<string, string> = {
                          modern_movement: "Modern", vintage_movement: "Vintage", antique_movement: "Antique",
                          modern_lv2: "Modern LV2", vintage_lv2: "Vintage LV2", antique_lv2: "Antique LV2",
                          chrono: "Chrono", chrono_lv2: "Chrono LV2", case_work: "Case Work",
                          small_job: "Small Job", warranty: "Warranty", bracelet_repair: "Bracelet",
                          gold_bracelet: "Gold Bracelet", case_restoration: "Case Restore",
                          stretch_repair: "Stretch", partial_job: "Partial", other: "Other",
                        };

                        return (
                          <TableRow key={jobId}>
                            <TableCell className="font-medium max-w-[160px] truncate">{clientName}</TableCell>
                            <TableCell>{watchBrand} {watchModel}</TableCell>
                            <TableCell>{estimateNumber}</TableCell>
                            <TableCell>
                              {jobType ? (
                                <Badge variant="secondary" className="text-xs font-medium whitespace-nowrap">
                                  {shortLabels[jobType] || jobTypeLabel}
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{statusLabel}</Badge>
                            </TableCell>
                            <TableCell>{format(parseISO(enteredAt), "MM/dd/yy")}</TableCell>
                            <TableCell>{exitedAt ? format(parseISO(exitedAt), "MM/dd/yy") : "—"}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "font-medium",
                                isStillWaiting && "text-amber-600",
                                daysWaiting >= 7 && "text-destructive"
                              )}>
                                {daysWaiting}d {isStillWaiting && "(active)"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              );
            })()
          ) : isLoading ? (
            <p className="text-muted-foreground">Loading jobs...</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {hasFilters ? "No jobs match your selected filters." : "Select filters above or click a Quick Report to generate results."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Watch</TableHead>
                    <TableHead>Estimate #</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Intake</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map(job => {
                    const clientName = job.client_name || job.inspections?.watches?.customers?.name || "—";
                    const watchBrand = job.watch_brand || job.inspections?.watches?.brand || "";
                    const watchModel = job.watch_model || job.inspections?.watches?.model || "";
                    const estimateNumber = job.estimate_number || job.inspections?.watches?.estimate_number || "—";
                    const statusLabel = WORKFLOW_STATUSES.find(s => s.value === job.status)?.label || job.status;
                    const daysUntil = job.due_date ? differenceInDays(parseISO(job.due_date), new Date()) : null;
                    const jobType = job.inspections?.job_type || job.service_type || null;
                    const jobTypeLabel = jobType ? (SERVICE_TYPE_LABELS[jobType as keyof typeof SERVICE_TYPE_LABELS] || jobType) : "—";

                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium max-w-[160px] truncate">{clientName}</TableCell>
                        <TableCell>{watchBrand} {watchModel}</TableCell>
                        <TableCell>{estimateNumber}</TableCell>
                        <TableCell>
                          {jobType ? (
                            <Badge variant="secondary" className="text-xs font-medium whitespace-nowrap">
                              {(() => {
                                const shortLabels: Record<string, string> = {
                                  modern_movement: "Modern",
                                  vintage_movement: "Vintage",
                                  antique_movement: "Antique",
                                  modern_lv2: "Modern LV2",
                                  vintage_lv2: "Vintage LV2",
                                  antique_lv2: "Antique LV2",
                                  chrono: "Chrono",
                                  chrono_lv2: "Chrono LV2",
                                  case_work: "Case Work",
                                  small_job: "Small Job",
                                  warranty: "Warranty",
                                  bracelet_repair: "Bracelet",
                                  gold_bracelet: "Gold Bracelet",
                                  case_restoration: "Case Restore",
                                  stretch_repair: "Stretch",
                                  partial_job: "Partial",
                                  other: "Other",
                                };
                                return shortLabels[jobType] || jobTypeLabel;
                              })()}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{statusLabel}</Badge>
                        </TableCell>
                        <TableCell>{job.intake_date ? format(parseISO(job.intake_date), "MM/dd/yy") : "—"}</TableCell>
                        <TableCell>{job.due_date ? format(parseISO(job.due_date), "MM/dd/yy") : "—"}</TableCell>
                        <TableCell>
                          {daysUntil !== null ? (
                            <span className={cn(daysUntil < 0 && "text-destructive font-medium", daysUntil <= 14 && daysUntil >= 0 && "text-amber-600")}>
                              {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
