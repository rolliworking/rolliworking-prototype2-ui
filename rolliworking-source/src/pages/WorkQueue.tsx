import * as React from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { differenceInDays, format, parseISO, addDays } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  AlertTriangle, 
  Clock, 
  FileWarning, 
  Package,
  Plus,
  Pencil,
  Search,
  Mail,
  CheckCircle2,
  Hourglass,
  Timer,
  ArrowUpDown,
  ScanLine,
  FlaskConical,
  Sparkles,
  User,
  History,
  ChevronLeft,
  ChevronRight,
  MessageSquareReply,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getLatestMeaningfulApprovalsByInspection } from "@/lib/inspection-approval-utils";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJobs, useUpdateJob, useDeleteJob, useSetJobStatus } from "@/hooks/use-jobs";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/use-email-templates";
import { useActiveWatchmakers } from "@/hooks/use-watchmakers";
import { getEmailReminderInterval } from "@/lib/job-utils";
import type { JobWithDetails } from "@/types/job";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { JobActivityTimeline } from "@/components/jobs/JobActivityTimeline";
import { useIsMobile } from "@/hooks/use-mobile";

type QuickFilter = "all" | "active" | "archived" | "waiting_approval" | "due_three_weeks" | "due_fourteen" | "warranty" | "outsourced" | "parts_approval" | "parts_on_order" | "needs_email" | "past_due" | "waiver_required" | "in_testing" | "in_progress" | "client_replies" | "no_reply_14" | "band_only_replies" | `watchmaker_${string}`;

// Check if job is a movement service type
function isMovementService(job: JobWithDetails): boolean {
  const services = job.services as string[] | null;
  if (Array.isArray(services)) {
    return services.some(s => s.includes("movement"));
  }
  const jobType = job.inspections?.job_type || "";
  const movementTypes = [
    "antique_movement", "antique_lv2",
    "vintage_movement", "vintage_lv2",
    "modern_movement", "modern_lv2",
    "chrono", "chrono_lv2",
    "movement_service"
  ];
  return movementTypes.includes(jobType);
}

function getJobAlerts(job: JobWithDetails): string[] {
  // No alert badges should show for finished jobs
  if (job.status === "finished") return [];

  const alerts: string[] = [];
  const today = new Date();

  if (job.due_date) {
    const daysUntilDue = differenceInDays(parseISO(job.due_date), today);
    
    // "Late" = movement service still in early stage with ≤21 days remaining
    const earlyStatuses = ["intake", "inspection", "waiting_approval", "in_queue"];
    if (isMovementService(job) && earlyStatuses.includes(job.status) && daysUntilDue <= 21 && daysUntilDue >= 0) {
      alerts.push("late");
    }
    
    if (isMovementService(job) && daysUntilDue <= 14 && daysUntilDue >= 0) {
      alerts.push("due_soon");
    }
  }

  if ((job.needs_liability_waiver || job.inspections?.waiver_required) && 
      !(job.waiver_signed || job.inspections?.waiver_signed)) {
    alerts.push("waiver");
  }

  const tasks = job.outsourced_tasks as any[];
  if (Array.isArray(tasks) && tasks.some((t) => t.status !== "complete")) {
    alerts.push("outsourced");
  }

  if (job.parts_approval_needed) {
    alerts.push("parts_approval");
  }

  if (job.status === "parts_on_order") {
    alerts.push("parts_on_order");
  }

  return alerts;
}


function getJobType(job: JobWithDetails): string | null {
  return job.inspections?.job_type || job.service_type || null;
}

function getNextEmailDays(job: JobWithDetails): number | null {
  // Show email countdown for all non-finished jobs
  if (job.status === "finished") return null;
  
  const interval = getEmailReminderInterval(getJobType(job));
  
  if (!job.last_update_email_sent) {
    // No email sent yet - calculate days since intake
    if (job.intake_date) {
      const intake = parseISO(job.intake_date);
      const daysSinceIntake = differenceInDays(new Date(), intake);
      return Math.max(0, interval - daysSinceIntake);
    }
    return 0; // Email due now
  }
  
  const lastSent = parseISO(job.last_update_email_sent);
  const nextDue = addDays(lastSent, interval);
  return differenceInDays(nextDue, new Date());
}

// Check if email is needed due to a status transition (in_progress, in_testing, or downgrade)
function getStatusEmailNeeded(job: JobWithDetails): "in_progress" | "in_testing" | "downgraded" | null {
  if (job.status === "finished") return null;
  
  const lastEmailSent = job.last_update_email_sent ? parseISO(job.last_update_email_sent) : null;
  
  // Detect downgrade: job was in_testing (has timestamp) but is now back in an earlier status
  if (job.in_testing_at && (job.status === "in_progress" || job.status === "in_queue" || job.status === "parts_approval" || job.status === "parts_on_order")) {
    const inTestingAt = parseISO(job.in_testing_at);
    // Job was downgraded after entering testing - need email if none sent since the downgrade
    // Check if an email was sent AFTER the in_testing timestamp (covers the downgrade)
    if (!lastEmailSent || lastEmailSent < inTestingAt) {
      return "downgraded";
    }
  }

  // Check if job moved to in_testing and no email sent since
  if ((job.status === "in_testing" || job.in_testing_at) && job.in_testing_at) {
    const inTestingAt = parseISO(job.in_testing_at);
    // Allow a 60-second grace window: status timestamp and email send can race
    const graceMs = 60 * 1000;
    const emailCoversTransition = lastEmailSent && (lastEmailSent.getTime() + graceMs) >= inTestingAt.getTime();
    // Also check if a testing template was already sent
    const sentTemplates = Array.isArray(job.sent_email_templates) ? job.sent_email_templates : [];
    const hasTestingTemplate = sentTemplates.some((t: any) =>
      typeof t === "string" && (t.toLowerCase().includes("testing") || t.toLowerCase().includes("update-3"))
    );
    if (!emailCoversTransition && !hasTestingTemplate) {
      return "in_testing";
    }
  }
  
  // Check if job is in_progress - show notification if:
  // 1. Status is in_progress AND no email sent since work started, OR
  // 2. Status is in_progress AND no timestamp exists (backfill case) AND no recent email
  if (job.status === "in_progress" || job.work_started) {
    if (job.work_started_at) {
      const workStartedAt = parseISO(job.work_started_at);
      // Allow a 5-minute grace window: if email was sent within 5 min of work starting, consider it covered
      const graceMs = 5 * 60 * 1000;
      if (!lastEmailSent || (lastEmailSent.getTime() + graceMs) < workStartedAt.getTime()) {
        return "in_progress";
      }
    } else if (job.status === "in_progress") {
      // No work_started_at timestamp but status is in_progress - show reminder
      // unless an email was sent recently (within the job-type interval)
      const interval = getEmailReminderInterval(getJobType(job));
      if (!lastEmailSent || differenceInDays(new Date(), lastEmailSent) >= interval) {
        return "in_progress";
      }
    }
  }
  
  return null;
}

const SERVICE_LABELS: Record<string, string> = {
  modern_movement_service: "Modern",
  vintage_movement_service: "Vintage",
  antique_movement_service: "Antique",
  bracelet_repair: "Bracelet",
  gold_bracelet_repair: "Gold Bracelet",
  case_restoration: "Case",
  warranty: "Warranty",
  small_job: "Small Job",
};

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

// Stages beyond waiting_approval that require periodic update emails
const EMAIL_REQUIRED_STATUSES = ["in_queue", "in_progress", "parts_approval", "in_testing"];

const WorkQueue = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialFilter = (searchParams.get("filter") as QuickFilter) || "active";
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>(initialFilter);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState<"due_date" | "intake_date" | "client_name" | "status">("due_date");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [deleteJobId, setDeleteJobId] = React.useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [timelineJob, setTimelineJob] = React.useState<JobWithDetails | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const JOBS_PER_PAGE = 50;

  const handleBarcodeScan = React.useCallback((code: string) => {
    setSearchQuery(code);
    setScannerOpen(false);
  }, []);

  usePageMeta({
    title: "Work Queue • Rolliworks",
    description: "Track watch repair jobs, due dates, and outsourced tasks",
    canonicalPath: "/work-queue",
  });

  const queryClient = useQueryClient();
  const { data: jobs, isLoading, error } = useJobs();
  const { data: emailTemplates } = useEmailTemplates();
  const { data: watchmakers } = useActiveWatchmakers();
  const updateJob = useUpdateJob();
  const setJobStatus = useSetJobStatus();
  const deleteJob = useDeleteJob();

  // Fetch inspection approvals — map inspection_id → approval data
  const [clientReplyInspectionIds, setClientReplyInspectionIds] = React.useState<Set<string>>(new Set());
  const [inspectionToApprovalMap, setInspectionToApprovalMap] = React.useState<Map<string, string>>(new Map());
  // Set of inspection_ids that have been waiting for reply ≥ 14 days
  const [noReplyInspectionIds, setNoReplyInspectionIds] = React.useState<Set<string>>(new Set());

  // Orphan inspections (no job) found via search
  interface OrphanInspection {
    id: string;
    inspection_type: string;
    status: string;
    created_at: string;
    notes: string | null;
    customer_name: string;
    customer_email: string | null;
    customer_id: string | null;
    brand: string;
    model: string | null;
    estimate_number: string;
    reference_number: string | null;
    approval_id: string | null;
    approval_status: string | null;
  }
  const [orphanInspections, setOrphanInspections] = React.useState<OrphanInspection[]>([]);

  // Band-only inspection replies (last 7 days)
  const [bandOnlyReplyInspectionIds, setBandOnlyReplyInspectionIds] = React.useState<Set<string>>(new Set());
  const [bandOnlyReplies, setBandOnlyReplies] = React.useState<OrphanInspection[]>([]);

  React.useEffect(() => {
    const fetchAllApprovals = async () => {
      const { data } = await supabase
        .from("inspection_approvals")
        .select("id, inspection_id, status, created_at, approved_at");
      if (data) {
        const latestByInspection = getLatestMeaningfulApprovalsByInspection(data);
        const latestApprovals = Array.from(latestByInspection.values());

        // Approved replies
        const approved = latestApprovals.filter(a => a.status === "approved");
        const approvedInspectionIds = approved.map(a => a.inspection_id);
        setClientReplyInspectionIds(new Set(approvedInspectionIds));
        setInspectionToApprovalMap(new Map(approved.map(a => [a.inspection_id, a.id])));

        // Fetch band-only inspections with approved replies in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentApproved = approved.filter(a => a.approved_at && new Date(a.approved_at) >= sevenDaysAgo);
        const recentApprovedInspectionIds = recentApproved.map(a => a.inspection_id);

        if (recentApprovedInspectionIds.length > 0) {
          const { data: inspections } = await supabase
            .from("inspections")
            .select(`
              id, inspection_type, status, created_at, notes,
              watches!inner(
                estimate_number, brand, model, reference_number,
                customers!inner(id, name, email)
              )
            `)
            .in("id", recentApprovedInspectionIds);

          if (inspections && inspections.length > 0) {
            const bandOnlyIds = new Set<string>(inspections.map((i: any) => i.id as string));
            setBandOnlyReplyInspectionIds(bandOnlyIds);

            const approvalMap = new Map(recentApproved.map(a => [a.inspection_id, a.id]));

            const enriched: OrphanInspection[] = inspections.map((i: any) => ({
              id: i.id,
              inspection_type: i.inspection_type,
              status: i.status,
              created_at: i.created_at,
              notes: i.notes,
              customer_name: i.watches?.customers?.name || "Unknown",
              customer_email: i.watches?.customers?.email || null,
              customer_id: i.watches?.customers?.id || null,
              brand: i.watches?.brand || "",
              model: i.watches?.model || null,
              estimate_number: i.watches?.estimate_number || "",
              reference_number: i.watches?.reference_number || null,
              approval_id: approvalMap.get(i.id) || null,
              approval_status: "approved",
            }));
            setBandOnlyReplies(enriched);
          } else {
            setBandOnlyReplyInspectionIds(new Set());
            setBandOnlyReplies([]);
          }
        } else {
          setBandOnlyReplyInspectionIds(new Set());
          setBandOnlyReplies([]);
        }

        const pending = latestApprovals.filter(a => a.status === "pending");

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const noReply = new Set<string>(
          pending
            .filter(a => new Date(a.created_at) <= fourteenDaysAgo)
            .map(a => a.inspection_id as string)
        );
        setNoReplyInspectionIds(noReply);
      }
    };
    fetchAllApprovals();

    // Subscribe to realtime changes on inspection_approvals
    const channel = supabase
      .channel('approval-replies')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inspection_approvals',
      }, () => {
        fetchAllApprovals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Search for orphan inspections (no associated job) when searching by estimate number
  React.useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setOrphanInspections([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Search inspections by estimate number or customer name that DON'T have jobs
        const [byEstimate, byName] = await Promise.all([
          supabase
            .from("inspections")
            .select(`
              id, inspection_type, status, created_at, notes,
              watches!inner(
                estimate_number, brand, model, reference_number,
              customers!inner(id, name, email)
              )
            `)
            .ilike("watches.estimate_number", `%${q}%`)
            .limit(10),
          supabase
            .from("inspections")
            .select(`
              id, inspection_type, status, created_at, notes,
              watches!inner(
                estimate_number, brand, model, reference_number,
                customers!inner(id, name, email)
              )
            `)
            .ilike("watches.customers.name", `%${q}%`)
            .limit(10),
        ]);

        // Deduplicate by id
        const allInspections = [...(byEstimate.data || []), ...(byName.data || [])];
        const seen = new Set<string>();
        const inspections = allInspections.filter((i: any) => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });

        if (!inspections || inspections.length === 0) {
          setOrphanInspections([]);
          return;
        }

        // Check which inspections have jobs
        const inspectionIds = inspections.map((i: any) => i.id);
        const { data: jobLinks } = await supabase
          .from("jobs")
          .select("inspection_id")
          .in("inspection_id", inspectionIds);

        const linkedIds = new Set((jobLinks || []).map((j: any) => j.inspection_id));

        // Also get approvals for these inspections
        const { data: approvals } = await supabase
          .from("inspection_approvals")
          .select("id, inspection_id, status")
          .in("inspection_id", inspectionIds);

        const approvalByInspection = new Map<string, { id: string; status: string }>();
        for (const a of (approvals || [])) {
          approvalByInspection.set(a.inspection_id, { id: a.id, status: a.status });
        }

        // Filter to only inspections WITHOUT a job
        const orphans: OrphanInspection[] = inspections
          .filter((i: any) => !linkedIds.has(i.id))
          .map((i: any) => {
            const approval = approvalByInspection.get(i.id);
            return {
              id: i.id,
              inspection_type: i.inspection_type,
              status: i.status,
              created_at: i.created_at,
              notes: i.notes,
              customer_name: i.watches?.customers?.name || "Unknown",
              customer_email: i.watches?.customers?.email || null,
              customer_id: i.watches?.customers?.id || null,
              brand: i.watches?.brand || "",
              model: i.watches?.model || null,
              estimate_number: i.watches?.estimate_number || "",
              reference_number: i.watches?.reference_number || null,
              approval_id: approval?.id || null,
              approval_status: approval?.status || null,
            };
          });

        setOrphanInspections(orphans);
      } catch (err) {
        console.error("Orphan inspection search error:", err);
        setOrphanInspections([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculate watchmaker stats for metric cards
  const watchmakerStats = React.useMemo(() => {
    if (!jobs || !watchmakers) return [];
    const allJobs = jobs as JobWithDetails[];
    const activeJobs = allJobs.filter(j => j.status !== "finished" && j.status !== "intake");
    
    return watchmakers.map(wm => ({
      initials: wm.initials,
      name: wm.name,
      count: activeJobs.filter(j => (j as any).assigned_watchmaker === wm.initials).length,
    }));
  }, [jobs, watchmakers]);

  // Calculate stats for metric cards
  const stats = React.useMemo(() => {
    if (!jobs) return { 
      waitingApproval: 0, dueThreeWeeks: 0, dueFourteen: 0, 
      warranty: 0, outsourced: 0, partsApproval: 0, partsOnOrder: 0, needsEmail: 0, pastDue: 0, waiverRequired: 0,
      partsNeedingAction: 0, inTesting: 0, inTestingThisWeek: 0, statusEmailNeeded: 0, inProgress: 0, clientReplies: 0, noReply14: 0, bandOnlyReplies: 0
    };
    const allJobs = (jobs as JobWithDetails[]).filter(j => {
      const isBandOnly = j.service_type === "bracelet_repair" || (j as any).inspections?.inspection_type === "bracelet_only";
      return !isBandOnly;
    });
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const activeJobs = allJobs.filter(j => j.status !== "finished");
    
    // Jobs needing update email: in email-required statuses and overdue for 14-day update
    const needsEmailJobs = activeJobs.filter(j => {
      const emailDays = getNextEmailDays(j);
      return emailDays !== null && emailDays <= 0;
    });
    
    // Jobs needing email due to status transition (in_progress or in_testing)
    const statusEmailNeededJobs = activeJobs.filter(j => getStatusEmailNeeded(j) !== null);
    
    // Jobs past due date
    const pastDueJobs = activeJobs.filter(j => {
      if (!j.due_date) return false;
      const days = differenceInDays(parseISO(j.due_date), now);
      return days < 0;
    });

    // Jobs requiring waiver that hasn't been signed
    const waiverRequiredJobs = activeJobs.filter(j => {
      const needsWaiver = j.needs_liability_waiver || j.inspections?.waiver_required;
      const signed = j.waiver_signed || j.inspections?.waiver_signed;
      return needsWaiver && !signed;
    });

    // Count parts requests needing pricing and email (new requests that haven't been priced or sent)
    const partsNeedingAction = activeJobs.filter(j => {
      const partsRequests = j.parts_requests as any[] | null;
      if (!Array.isArray(partsRequests) || partsRequests.length === 0) return false;
      // Check if any part needs pricing (no price) or hasn't been emailed yet
      return partsRequests.some(p => 
        (p.status === 'pending' || p.status === 'draft' || !p.status) && 
        (!p.price || p.price === 0 || !p.email_sent)
      );
    }).length;
    
    // Jobs in testing
    const inTestingJobs = allJobs.filter(j => j.status === "in_testing");
    
    // Jobs moved to in_testing this week
    const inTestingThisWeek = inTestingJobs.filter(j => {
      const inTestingAt = (j as any).in_testing_at;
      if (!inTestingAt) return false;
      return parseISO(inTestingAt) >= oneWeekAgo;
    }).length;

    // Jobs with approved client replies that are still waiting for approval
    const clientReplyJobs = allJobs.filter(j => {
      if (j.status !== "waiting_approval") return false;
      const inspectionId = (j as any).inspection_id || j.inspections?.id;
      return inspectionId && clientReplyInspectionIds.has(inspectionId);
    }).length;

    // Jobs with pending approval (sent but no reply) older than 14 days
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const noReply14Jobs = allJobs.filter(j => {
      if (j.status !== "waiting_approval") return false;
      const inspectionId = (j as any).inspection_id || j.inspections?.id;
      if (!inspectionId) return false;
      // Must be in noReplyInspectionIds (pending ≥ 14 days) and NOT already replied
      return noReplyInspectionIds.has(inspectionId) && !clientReplyInspectionIds.has(inspectionId);
    }).length;

    // Band-only replies count comes from the fetched enriched data, not jobs
    const bandOnlyReplyCount = bandOnlyReplies.length;

    return {
      waitingApproval: allJobs.filter(j => j.status === "waiting_approval").length,
      inProgress: allJobs.filter(j => j.status === "in_progress").length,
      dueThreeWeeks: allJobs.filter(j => {
        if (!j.due_date) return false;
        const days = differenceInDays(parseISO(j.due_date), now);
        return days >= 0 && days <= 21 && (j.status === "in_queue" || j.status === "waiting_approval");
      }).length,
      dueFourteen: activeJobs.filter(j => {
        if (!j.due_date) return false;
        const days = differenceInDays(parseISO(j.due_date), now);
        return days >= 0 && days <= 14;
      }).length,
      warranty: activeJobs.filter(j => {
        const services = j.services as string[] | null;
        return Array.isArray(services) && services.includes("warranty");
      }).length,
      outsourced: activeJobs.filter(j => {
        const tasks = j.outsourced_tasks as any[];
        return Array.isArray(tasks) && tasks.some(t => t.status === "pending" || t.status === "sent");
      }).length,
      partsApproval: allJobs.filter(j => j.status === "parts_approval").length,
      partsOnOrder: allJobs.filter(j => j.status === "parts_on_order").length,
      needsEmail: needsEmailJobs.length + statusEmailNeededJobs.length,
      pastDue: pastDueJobs.length,
      waiverRequired: waiverRequiredJobs.length,
      partsNeedingAction,
      inTesting: inTestingJobs.length,
      inTestingThisWeek,
      statusEmailNeeded: statusEmailNeededJobs.length,
      clientReplies: clientReplyJobs,
      noReply14: noReply14Jobs,
      bandOnlyReplies: bandOnlyReplyCount,
    };
  }, [jobs, clientReplyInspectionIds, noReplyInspectionIds, bandOnlyReplies]);

  // Filter and sort jobs
  const filteredJobs = React.useMemo(() => {
    if (!jobs) return [];
    let result = jobs as JobWithDetails[];

    // When searching, always include all jobs (including finished/archived) so users can find them
    const isSearching = searchQuery.trim().length > 0;

    // Search filter - searches by customer name, email, estimate number, reference number, serial number
    if (isSearching) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => {
        const clientName = j.client_name || j.inspections?.watches?.customers?.name || "";
        const clientEmail = j.client_email || j.inspections?.watches?.customers?.email || "";
        const estNum = j.estimate_number || j.inspections?.watches?.estimate_number || "";
        const refNum = j.serial_number || j.inspections?.watches?.reference_number || "";
        return clientName.toLowerCase().includes(q) ||
               clientEmail.toLowerCase().includes(q) ||
               estNum.toLowerCase().includes(q) ||
               refNum.toLowerCase().includes(q);
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(j => j.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter(j => {
        const services = j.services as string[] | null;
        return Array.isArray(services) && services.includes(typeFilter);
      });
    }

    // Quick filter — skip when searching (search shows all jobs including archived)
    if (!isSearching) {
    // Hide band-only jobs from normal workflow (they're managed via Follow Up Queue / Parts)
    result = result.filter(j => {
      const isBandOnly = j.service_type === "bracelet_repair" || j.inspections?.inspection_type === "bracelet_only";
      return !isBandOnly;
    });
    const now = new Date();
    switch (quickFilter) {
      case "active":
        result = result.filter(j => j.status !== "finished");
        break;
      case "archived":
        result = result.filter(j => j.status === "finished");
        break;
      case "waiting_approval":
        result = result.filter(j => j.status === "waiting_approval");
        break;
      case "due_three_weeks":
        result = result.filter(j => {
          if (!j.due_date) return false;
          const days = differenceInDays(parseISO(j.due_date), now);
          return days >= 0 && days <= 21 && (j.status === "in_queue" || j.status === "waiting_approval");
        });
        break;
      case "due_fourteen":
        result = result.filter(j => {
          if (!j.due_date) return false;
          const days = differenceInDays(parseISO(j.due_date), now);
          return j.status !== "finished" && days >= 0 && days <= 14;
        });
        break;
      case "warranty":
        result = result.filter(j => {
          if (j.status === "finished") return false;
          const services = j.services as string[] | null;
          return Array.isArray(services) && services.includes("warranty");
        });
        break;
      case "outsourced":
        result = result.filter(j => {
          if (j.status === "finished") return false;
          const tasks = j.outsourced_tasks as any[];
          return Array.isArray(tasks) && tasks.some(t => t.status === "pending" || t.status === "sent");
        });
        break;
      case "parts_approval":
        result = result.filter(j => j.status === "parts_approval");
        break;
      case "parts_on_order":
        result = result.filter(j => j.status === "parts_on_order");
        break;
      case "needs_email":
        result = result.filter(j => {
          if (j.status === "finished") return false;
          // Check for 14-day update email due
          const emailDays = getNextEmailDays(j);
          const regularEmailDue = emailDays !== null && emailDays <= 0;
          // Check for status transition email needed
          const statusEmail = getStatusEmailNeeded(j);
          return regularEmailDue || statusEmail !== null;
        });
        break;
      case "past_due":
        result = result.filter(j => {
          if (j.status === "finished" || !j.due_date) return false;
          const days = differenceInDays(parseISO(j.due_date), now);
          return days < 0;
        });
        break;
      case "waiver_required":
        result = result.filter(j => {
          if (j.status === "finished") return false;
          const needsWaiver = j.needs_liability_waiver || j.inspections?.waiver_required;
          const signed = j.waiver_signed || j.inspections?.waiver_signed;
          return needsWaiver && !signed;
        });
        break;
      case "in_testing":
        result = result.filter(j => j.status === "in_testing");
        break;
      case "in_progress":
        result = result.filter(j => j.status === "in_progress");
        break;
      case "client_replies":
        result = result.filter(j => {
          if (j.status !== "waiting_approval") return false;
          const inspectionId = (j as any).inspection_id || j.inspections?.id;
          return inspectionId && clientReplyInspectionIds.has(inspectionId);
        });
        break;
      case "no_reply_14":
        result = result.filter(j => {
          if (j.status !== "waiting_approval") return false;
          const inspectionId = (j as any).inspection_id || j.inspections?.id;
          if (!inspectionId) return false;
          return noReplyInspectionIds.has(inspectionId) && !clientReplyInspectionIds.has(inspectionId);
        });
        break;
      case "band_only_replies":
        result = result.filter(j => {
          const inspectionId = (j as any).inspection_id || j.inspections?.id;
          return inspectionId && bandOnlyReplyInspectionIds.has(inspectionId);
        });
        break;
      default:
        // Handle watchmaker filters (watchmaker_XX)
        if (quickFilter.startsWith("watchmaker_")) {
          const initials = quickFilter.replace("watchmaker_", "");
          result = result.filter(j => {
            if (j.status === "finished") return false;
            return (j as any).assigned_watchmaker === initials;
          });
        }
        break;
    }
    } // end !isSearching guard

    // Sort jobs
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "due_date": {
          const dateA = a.due_date ? parseISO(a.due_date).getTime() : Infinity;
          const dateB = b.due_date ? parseISO(b.due_date).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        }
        case "intake_date": {
          const dateA = a.intake_date ? parseISO(a.intake_date).getTime() : 0;
          const dateB = b.intake_date ? parseISO(b.intake_date).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
        case "client_name": {
          const nameA = (a.client_name || a.inspections?.watches?.customers?.name || "").toLowerCase();
          const nameB = (b.client_name || b.inspections?.watches?.customers?.name || "").toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "status": {
          const statusOrder = WORKFLOW_STATUSES.map(s => s.value);
          const indexA = statusOrder.indexOf(a.status as typeof statusOrder[number]);
          const indexB = statusOrder.indexOf(b.status as typeof statusOrder[number]);
          comparison = indexA - indexB;
          break;
        }
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [jobs, searchQuery, statusFilter, typeFilter, quickFilter, sortBy, sortOrder]);

  // Paginate filtered results
  const totalFilteredJobs = filteredJobs.length;
  const totalPages = Math.ceil(totalFilteredJobs / JOBS_PER_PAGE);
  const paginatedJobs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    return filteredJobs.slice(startIndex, startIndex + JOBS_PER_PAGE);
  }, [filteredJobs, currentPage, JOBS_PER_PAGE]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, quickFilter, statusFilter, typeFilter]);

  const handleUpdateStatus = async (job: JobWithDetails, newStatus: string) => {
    try {
      // Use the RPC-based hook so Staff can change status (bypasses RLS)
      await setJobStatus.mutateAsync({ id: job.id, status: newStatus });
      toast.success(`Status updated to ${WORKFLOW_STATUSES.find(s => s.value === newStatus)?.label}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update job");
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteJobId) return;
    try {
      await deleteJob.mutateAsync(deleteJobId);
      toast.success("Job removed from queue");
      setDeleteJobId(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete job");
    }
  };

  // Create a job record for a band-only inspection (to enable parts requests)
  const handleCreateBandOnlyJob = async (insp: OrphanInspection) => {
    try {
      const { data, error } = await supabase.from("jobs").insert({
        inspection_id: insp.id,
        client_name: insp.customer_name,
        client_email: insp.customer_email,
        client_id: insp.customer_id,
        watch_brand: insp.brand,
        watch_model: insp.model,
        estimate_number: insp.estimate_number,
        serial_number: insp.reference_number,
        service_type: "bracelet_repair",
        status: "in_queue",
      }).select("id").single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job created — redirecting to Parts Request");
      navigate(`/parts-request?job=${data.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create job");
    }
  };

  const totalJobs = (jobs as JobWithDetails[] | undefined)?.length || 0;
  const activeJobCount = React.useMemo(() => {
    if (!jobs) return 0;
    return (jobs as JobWithDetails[]).filter(j => {
      if (j.status === "finished") return false;
      const isBandOnly = j.service_type === "bracelet_repair" || (j as any).inspections?.inspection_type === "bracelet_only";
      return !isBandOnly;
    }).length;
  }, [jobs]);

  return (
    <main className="space-y-3">
      {/* Watchmaker Metrics - Compact Row */}
      {watchmakerStats.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {watchmakerStats.map((wm) => (
            <button
              key={wm.initials}
              onClick={() => setQuickFilter(`watchmaker_${wm.initials}` as QuickFilter)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-all hover:shadow-sm",
                quickFilter === `watchmaker_${wm.initials}`
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:bg-muted"
              )}
              title={wm.name}
            >
              <User className="h-3 w-3" />
              <span className="font-bold">{wm.initials}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px]",
                quickFilter === `watchmaker_${wm.initials}`
                  ? "bg-primary-foreground/20"
                  : "bg-muted"
              )}>
                {wm.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricCard
          label="In Progress"
          value={stats.inProgress}
          icon={<Timer className="h-5 w-5 text-indigo-600" />}
          onClick={() => setQuickFilter("in_progress")}
          active={quickFilter === "in_progress"}
        />
        <MetricCard
          label="Waiting for Approval"
          value={stats.waitingApproval}
          icon={<Hourglass className="h-5 w-5 text-amber-600" />}
          onClick={() => setQuickFilter("waiting_approval")}
          active={quickFilter === "waiting_approval"}
        />
        <MetricCard
          label="Due Within 3 Weeks"
          value={stats.dueThreeWeeks}
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          onClick={() => setQuickFilter("due_three_weeks")}
          active={quickFilter === "due_three_weeks"}
        />
        <MetricCard
          label="Due Within 14 Days"
          value={stats.dueFourteen}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          onClick={() => setQuickFilter("due_fourteen")}
          active={quickFilter === "due_fourteen"}
        />
        <MetricCard
          label="Warranty Service"
          value={stats.warranty}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          onClick={() => setQuickFilter("warranty")}
          active={quickFilter === "warranty"}
        />
        <MetricCard
          label="Outstanding Outsourced"
          value={stats.outsourced}
          icon={<Package className="h-5 w-5 text-purple-600" />}
          onClick={() => setQuickFilter("outsourced")}
          active={quickFilter === "outsourced"}
        />
        <MetricCard
          label="Awaiting Parts Approval"
          value={stats.partsApproval}
          icon={<Timer className="h-5 w-5 text-orange-600" />}
          onClick={() => setQuickFilter("parts_approval")}
          active={quickFilter === "parts_approval"}
          secondaryValue={stats.partsNeedingAction}
          secondaryLabel="need pricing"
          alertState={stats.partsNeedingAction > 0}
        />
        <MetricCard
          label="Parts On Order"
          value={stats.partsOnOrder}
          icon={<Package className="h-5 w-5 text-rose-600" />}
          onClick={() => setQuickFilter("parts_on_order")}
          active={quickFilter === "parts_on_order"}
        />
        <MetricCard
          label="Needing Update Email"
          value={stats.needsEmail}
          icon={<Mail className="h-5 w-5 text-cyan-600" />}
          onClick={() => setQuickFilter("needs_email")}
          active={quickFilter === "needs_email"}
        />
        <MetricCard
          label="Past Due Date"
          value={stats.pastDue}
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          onClick={() => setQuickFilter("past_due")}
          active={quickFilter === "past_due"}
        />
        <MetricCard
          label="Waiver Required"
          value={stats.waiverRequired}
          icon={<FileWarning className="h-5 w-5 text-amber-500" />}
          onClick={() => setQuickFilter("waiver_required")}
          active={quickFilter === "waiver_required"}
        />
        <MetricCard
          label="In Testing"
          value={stats.inTesting}
          icon={<FlaskConical className="h-5 w-5 text-teal-600" />}
          onClick={() => setQuickFilter("in_testing")}
          active={quickFilter === "in_testing"}
          secondaryValue={stats.inTestingThisWeek}
          secondaryLabel="new this week"
          alertState={stats.inTestingThisWeek > 0}
          alertIcon={<Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
        />
        <MetricCard
          label="Client Replies"
          value={stats.clientReplies}
          icon={<MessageSquareReply className="h-5 w-5 text-emerald-600" />}
          onClick={() => setQuickFilter("client_replies")}
          active={quickFilter === "client_replies"}
          alertState={stats.clientReplies > 0}
          alertIcon={<MessageSquareReply className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        />
        <MetricCard
          label="Client Replies (7d)"
          value={stats.bandOnlyReplies}
          icon={<MessageSquareReply className="h-5 w-5 text-sky-600" />}
          onClick={() => setQuickFilter("band_only_replies")}
          active={quickFilter === "band_only_replies"}
          alertState={stats.bandOnlyReplies > 0}
          alertIcon={<MessageSquareReply className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
        />
        <MetricCard
          label="No Reply (14+ Days)"
          value={stats.noReply14}
          icon={<Mail className="h-5 w-5 text-orange-600" />}
          onClick={() => setQuickFilter("no_reply_14")}
          active={quickFilter === "no_reply_14"}
          alertState={stats.noReply14 > 0}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, estimate #, reference #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine className="h-4 w-4" />
              </Button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              // Clear quick filter when selecting a specific status
              if (e.target.value !== "all") {
                setQuickFilter("all");
              }
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            {WORKFLOW_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All Types</option>
            {Object.entries(SERVICE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                <ArrowUpDown className="h-3 w-3" />
                Sort: {sortBy === "due_date" ? "Due" : sortBy === "intake_date" ? "Intake" : sortBy === "client_name" ? "Client" : "Status"}
                {sortOrder === "desc" && " ↓"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSortBy("due_date"); setSortOrder("asc"); }}>
                Due Date (earliest first)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("due_date"); setSortOrder("desc"); }}>
                Due Date (latest first)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("intake_date"); setSortOrder("desc"); }}>
                Intake Date (newest first)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("intake_date"); setSortOrder("asc"); }}>
                Intake Date (oldest first)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("client_name"); setSortOrder("asc"); }}>
                Client Name (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("client_name"); setSortOrder("desc"); }}>
                Client Name (Z-A)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy("status"); setSortOrder("asc"); }}>
                Status (workflow order)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="sm" className="ml-auto h-8">
            <Link to="/new-job">
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Job
            </Link>
          </Button>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "waiting_approval", label: "Waiting" },
            { key: "due_three_weeks", label: "3 Wks" },
            { key: "due_fourteen", label: "14 Days" },
            { key: "warranty", label: "Warranty" },
            { key: "outsourced", label: "Outsourced" },
            { key: "parts_approval", label: "Parts" },
            { key: "in_testing", label: "Testing" },
            { key: "needs_email", label: "Email" },
            { key: "past_due", label: "Past Due" },
            { key: "waiver_required", label: "Waiver" },
            { key: "no_reply_14", label: "No Reply" },
            { key: "archived", label: "Archived" },
           ].map((tab) => (
            <Button
              key={tab.key}
              variant={quickFilter === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setQuickFilter(tab.key as QuickFilter)}
              className={cn(
                "rounded-full h-7 px-2.5 text-xs",
                quickFilter === tab.key && "bg-primary text-primary-foreground"
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Results Count with Pagination Info */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">
            {totalFilteredJobs === 0 ? 0 : ((currentPage - 1) * JOBS_PER_PAGE) + 1}
          </span>
          –
          <span className="font-medium text-foreground">
            {Math.min(currentPage * JOBS_PER_PAGE, totalFilteredJobs)}
          </span> of <span className="font-medium text-foreground">{totalFilteredJobs}</span> jobs
          {totalFilteredJobs !== activeJobCount && (
            <span className="text-muted-foreground/70"> ({activeJobCount} active)</span>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Job Cards */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load jobs</p>
      ) : paginatedJobs.length === 0 && orphanInspections.length === 0 && (quickFilter !== "band_only_replies" || bandOnlyReplies.length === 0) ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No jobs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginatedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              approvalId={inspectionToApprovalMap.get((job as any).inspection_id || job.inspections?.id || "") || null}
              emailTemplates={emailTemplates || []}
              watchmakers={watchmakers?.map(w => ({ initials: w.initials, name: w.name })) || []}
              isNoReply14={(() => {
                const inspectionId = (job as any).inspection_id || job.inspections?.id;
                return inspectionId ? noReplyInspectionIds.has(inspectionId) && !clientReplyInspectionIds.has(inspectionId) : false;
              })()}
              onStatusChange={(status) => handleUpdateStatus(job, status)}
              onDelete={() => setDeleteJobId(job.id)}
              onShowTimeline={() => setTimelineJob(job)}
              onSendEmail={async (templateName) => {
                const existingSent = (job.sent_email_templates as string[]) || [];
                await updateJob.mutateAsync({
                  id: job.id,
                  sent_email_templates: [...existingSent, templateName] as any,
                  last_update_email_sent: new Date().toISOString(),
                });
                toast.success(`Email sent using "${templateName}" template`);
              }}
              onAssignWatchmaker={async (initials) => {
                try {
                  const { error } = await supabase.rpc('assign_watchmaker', {
                    _job_id: job.id,
                    _assigned_watchmaker: initials || '',
                  });
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ["jobs"] });
                  toast.success(initials ? `Assigned to ${initials}` : "Assignment removed");
                } catch (err: any) {
                  const errorMessage = typeof err === 'object' && err !== null && 'message' in err 
                    ? String(err.message) 
                    : "Failed to assign watchmaker";
                  toast.error(errorMessage);
                }
              }}
              isUpdating={setJobStatus.isPending || updateJob.isPending}
            />
          ))}
        </div>
      )}

      {/* Orphan Inspection Cards (inspections without jobs, found via search) */}
      {orphanInspections.length > 0 && (
        <div className="space-y-2">
          {paginatedJobs.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground pt-2 border-t">
              Inspections (no job record)
            </p>
          )}
          {orphanInspections.map((insp) => (
            <Card key={insp.id} className="border shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/inspections/new?edit=${insp.id}`}
                          className="text-sm font-semibold text-foreground hover:underline truncate"
                        >
                          {insp.customer_name}
                        </Link>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{insp.brand}{insp.model ? ` ${insp.model}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">Est: {insp.estimate_number}</span>
                        {insp.reference_number && (
                          <span className="text-xs text-muted-foreground">Ref #: {insp.reference_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {insp.inspection_type.replace("_", " ")}
                    </Badge>
                    {insp.approval_status === "approved" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
                        Approval Submitted
                      </Badge>
                    ) : insp.approval_status === "pending" ? (
                      <Badge variant="secondary" className="text-[10px]">Awaiting Reply</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        {insp.status === "sent" || insp.status === "approved" ? "Sent" : insp.status}
                      </Badge>
                    )}
                    {insp.approval_id && insp.approval_status === "approved" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                        <Link to={`/view-approval?id=${insp.approval_id}`}>
                          <MessageSquareReply className="h-3.5 w-3.5" />
                          View Response
                        </Link>
                      </Button>
                    )}
                    {insp.inspection_type === "bracelet_only" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCreateBandOnlyJob(insp)}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Create Job
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                      <Link to={`/inspections/new?edit=${insp.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Band-Only Replies Cards (shown when filter is active) */}
      {quickFilter === "band_only_replies" && bandOnlyReplies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground pt-2 border-t">
            Client Replies (Last 7 Days)
          </p>
          {bandOnlyReplies.map((insp) => (
            <Card key={insp.id} className="border shadow-sm">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/inspections/new?edit=${insp.id}`}
                          className="text-sm font-semibold text-foreground hover:underline truncate"
                        >
                          {insp.customer_name}
                        </Link>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{insp.brand}{insp.model ? ` ${insp.model}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">Est: {insp.estimate_number}</span>
                        {insp.reference_number && (
                          <span className="text-xs text-muted-foreground">Ref #: {insp.reference_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">bracelet only</Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
                      Approval Submitted
                    </Badge>
                    {insp.approval_id && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                        <Link to={`/view-approval?id=${insp.approval_id}`}>
                          <MessageSquareReply className="h-3.5 w-3.5" />
                          View Response
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCreateBandOnlyJob(insp)}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Create Job
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                      <Link to={`/inspections/new?edit=${insp.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Pagination */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-2 pt-2 pb-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="h-8"
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm text-muted-foreground">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (page >= 1 && page <= totalPages) {
                  setCurrentPage(page);
                }
              }}
              className="w-12 h-8 text-center text-sm border rounded-md"
            />
            <span className="text-sm text-muted-foreground">of {totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8"
          >
            Last
          </Button>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove job from queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this job. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteJob.isPending}
            >
              {deleteJob.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      <JobActivityTimeline
        job={timelineJob}
        open={!!timelineJob}
        onOpenChange={(open) => !open && setTimelineJob(null)}
      />
    </main>
  );
};

// Metric Card Component
function MetricCard({ 
  label, 
  value, 
  icon, 
  onClick,
  active,
  secondaryValue,
  secondaryLabel,
  alertState,
  alertIcon
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
  secondaryValue?: number;
  secondaryLabel?: string;
  alertState?: boolean;
  alertIcon?: React.ReactNode;
}) {
  // Use teal styling for positive alerts (like "new this week")
  const isPositiveAlert = alertState && alertIcon;
  
  return (
    <Card 
      className={cn(
        "border-0 shadow-sm cursor-pointer transition-all hover:shadow-md",
        active && "ring-2 ring-primary",
        alertState && !isPositiveAlert && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
        isPositiveAlert && "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800"
      )}
      onClick={onClick}
    >
      <CardContent className="p-2.5 flex items-center gap-2">
        <div className={cn(
          "p-1.5 rounded-md",
          alertState && !isPositiveAlert ? "bg-red-100 dark:bg-red-900/50" : isPositiveAlert ? "bg-teal-100 dark:bg-teal-900/50" : "bg-muted"
        )}>
          {alertState ? (
            alertIcon || <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          ) : (
            React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <p className={cn(
              "text-xl font-bold",
              alertState && !isPositiveAlert && "text-red-600 dark:text-red-400",
              isPositiveAlert && "text-teal-600 dark:text-teal-400"
            )}>{value}</p>
            {secondaryValue !== undefined && secondaryValue > 0 && (
              <span className={cn(
                "text-xs font-semibold",
                isPositiveAlert ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"
              )}>
                ({secondaryValue})
              </span>
            )}
          </div>
          <p className={cn(
            "text-[10px] leading-tight truncate",
            alertState && !isPositiveAlert ? "text-red-600 dark:text-red-400 font-medium" : 
            isPositiveAlert ? "text-teal-600 dark:text-teal-400 font-medium" : "text-muted-foreground"
          )}>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Job Card Component
function JobCard({ 
  job, 
  approvalId,
  emailTemplates,
  watchmakers,
  isNoReply14,
  onStatusChange, 
  onDelete,
  onShowTimeline,
  onSendEmail,
  onAssignWatchmaker,
  isUpdating 
}: { 
  job: JobWithDetails;
  approvalId: string | null;
  emailTemplates: EmailTemplate[];
  watchmakers: { initials: string; name: string }[];
  isNoReply14: boolean;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onShowTimeline: () => void;
  onSendEmail: (templateName: string) => void;
  onAssignWatchmaker: (initials: string | null) => void;
  isUpdating: boolean;
}) {
  const alerts = getJobAlerts(job);
  const nextEmailDays = getNextEmailDays(job);
  const statusEmailNeeded = getStatusEmailNeeded(job);
  
  const clientName = job.client_name || job.inspections?.watches?.customers?.name || "Unknown";
  const clientEmail = job.client_email || job.inspections?.watches?.customers?.email || "";
  const brand = job.watch_brand || job.inspections?.watches?.brand || "";
  const model = job.watch_model || job.inspections?.watches?.model || "";
  const refNum = job.inspections?.watches?.reference_number || "";
  const services = (job.services as string[]) || [];
  const sentTemplates = (job.sent_email_templates as string[]) || [];
  const estimateNum = job.estimate_number || job.inspections?.watches?.estimate_number || "";
  const serialNumber = job.serial_number || "";
  const refForEmail = serialNumber || refNum || "";

  // Parts requests that still need an approval email to be sent
  const partsRequests = job.parts_requests as any[] | null;
  const activePartsRequests = Array.isArray(partsRequests)
    ? partsRequests.filter((p) => !["approved", "on_order", "received", "declined"].includes(p?.status))
    : [];
  const unsentPartsCount = activePartsRequests.filter((p) => !p?.email_sent).length;
  
  const dueDate = job.due_date ? parseISO(job.due_date) : null;
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;
  const inTestingAt = (job as any).in_testing_at ? parseISO((job as any).in_testing_at) : null;
  // Replace placeholders in template
  const processTemplate = (text: string) => {
    const firstName = clientName.split(" ")[0] || clientName;
    const statusLabel = WORKFLOW_STATUSES.find(s => s.value === job.status)?.label || job.status;
    
    return text
      // Preferred placeholders
      .replace(/\{\{customer_first_name\}\}/g, firstName)
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{watch_brand\}\}/g, brand)
      .replace(/\{\{watch_model\}\}/g, model)
      .replace(/\{\{estimate_number\}\}/g, estimateNum)
      .replace(/\{\{\s*serial_number\s*\}\}/gi, refForEmail)
      .replace(/\{\{\s*Ref_number\s*\}\}/gi, refForEmail)
      .replace(/\{\{status\}\}/g, statusLabel)
      .replace(/\{\{due_date\}\}/g, dueDate ? format(dueDate, "MMMM d, yyyy") : "TBD")
      // Backward-compatible placeholders used in older templates
      .replace(/\{\{\s*Estimate No\.?\s*\}\}/gi, estimateNum)
      .replace(/\[\s*Estimate No\.?\s*\]/gi, estimateNum)
      // Short-form placeholders (backward compat)
      .replace(/\{\{brand\}\}/g, brand)
      .replace(/\{\{model\}\}/g, model);
  };

  // Open email client with template and track it
  const handleSelectTemplate = (template: EmailTemplate) => {
    if (!clientEmail) {
      toast.error("No email address for this client");
      return;
    }
    
    const subject = encodeURIComponent(processTemplate(template.subject));
    const body = encodeURIComponent(processTemplate(template.body));
    const mailtoUrl = `mailto:${clientEmail}?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl, "_blank");
    onSendEmail(template.name);
  };

  const activeTemplates = emailTemplates.filter(t => t.is_active);

  // estimateNum and serialNumber are now defined above with other job metadata

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        {/* Single Row Layout */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Left: Client & Watch */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{clientName}</h3>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground truncate">{brand} {model}</span>
              {refNum && <span className="text-xs text-muted-foreground hidden sm:inline">Ref: {refNum}</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {estimateNum && <span>Est: {estimateNum}</span>}
              {serialNumber && <span>Ref #: {serialNumber}</span>}
              {dueDate && (
                <span className={cn(
                  "font-medium",
                  daysUntilDue !== null && daysUntilDue < 0 && "text-destructive",
                  daysUntilDue !== null && daysUntilDue <= 14 && daysUntilDue >= 0 && "text-amber-600"
                )}>
                  Due: {format(dueDate, "MMM d")} ({daysUntilDue !== null && (daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d late` : `${daysUntilDue}d`)})
                </span>
              )}
              {job.status === "in_testing" && inTestingAt && (
                <span className="text-teal-600 font-medium">
                  <FlaskConical className="h-3 w-3 inline mr-0.5" />
                  Testing since {format(inTestingAt, "MMM d")}
                </span>
              )}
              {statusEmailNeeded && (
                <span className="text-blue-600 font-medium">
                  📧 {statusEmailNeeded === "in_testing" ? "Testing update" : statusEmailNeeded === "downgraded" ? "Status downgrade" : "Started update"} email due
                </span>
              )}
              {!statusEmailNeeded && nextEmailDays !== null && nextEmailDays <= 0 && (
                <span className="text-amber-600 font-medium">📧 Email due</span>
              )}
            </div>
          </div>

          {/* Center: Alerts & Services */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Alert Badges - Compact */}
            {alerts.includes("parts_approval") && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs py-0">
                <AlertTriangle className="h-3 w-3 mr-1" />Parts
              </Badge>
            )}
            {unsentPartsCount > 0 && (
              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs py-0">
                <Mail className="h-3 w-3 mr-1" />
                Parts email not sent{unsentPartsCount > 1 ? ` (${unsentPartsCount})` : ""}
              </Badge>
            )}
            {alerts.includes("late") && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs py-0">Late</Badge>
            )}
            {alerts.includes("due_soon") && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs py-0">Due Soon</Badge>
            )}
            {alerts.includes("waiver") && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs py-0">Waiver</Badge>
            )}
            {alerts.includes("outsourced") && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs py-0">
                <Package className="h-3 w-3 mr-1" />Outsourced
              </Badge>
            )}
            {alerts.includes("parts_on_order") && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-xs py-0">Parts Order</Badge>
            )}
            {isNoReply14 && (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs py-0">
                <Mail className="h-3 w-3 mr-1" />No Reply 14d
              </Badge>
            )}
            {/* Service badges - show first 2 */}
            {services.slice(0, 2).map((svc) => (
              <Badge key={svc} variant="secondary" className="text-xs py-0">
                {SERVICE_LABELS[svc] || svc.replace(/_/g, ' ')}
              </Badge>
            ))}
            {services.length > 2 && (
              <Badge variant="secondary" className="text-xs py-0">+{services.length - 2}</Badge>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Watchmaker Assignment */}
            <select
              value={(job as any).assigned_watchmaker || ""}
              onChange={(e) => onAssignWatchmaker(e.target.value || null)}
              disabled={isUpdating}
              className="h-7 w-14 text-xs rounded-md border border-input bg-background px-1 font-bold text-center"
              title="Assign watchmaker"
            >
              <option value="">—</option>
              {watchmakers.map(wm => (
                <option key={wm.initials} value={wm.initials} title={wm.name}>
                  {wm.initials}
                </option>
              ))}
            </select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56 max-h-[50vh] overflow-y-auto">
                {activeTemplates.length === 0 ? (
                  <DropdownMenuItem disabled>No templates</DropdownMenuItem>
                ) : (
                  activeTemplates.map((template) => {
                    const alreadySent = sentTemplates.includes(template.name);
                    return (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(alreadySent && "opacity-50")}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {template.name}
                        {alreadySent && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                      </DropdownMenuItem>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <select
              value={job.status}
              onChange={(e) => onStatusChange(e.target.value)}
              disabled={isUpdating}
              className="h-7 text-xs rounded-md border border-input bg-background px-2 font-medium"
            >
              {WORKFLOW_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2" 
              onClick={onShowTimeline}
              title="View activity"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
            {approvalId && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600" asChild title="View client response">
                <Link to={`/view-approval?id=${approvalId}`}>
                  <MessageSquareReply className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            {isNoReply14 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-orange-700 hover:bg-orange-50"
                title="Send follow-up reminder"
                onClick={() => {
                  if (!clientEmail) { toast.error("No email address on file"); return; }
                  const subject = encodeURIComponent(`Follow-up: Your ${brand} ${model} Inspection`);
                  const firstName = clientName.split(" ")[0] || clientName;
                  const body = encodeURIComponent(
                    `Hi ${firstName},\n\nWe wanted to follow up on the inspection report we sent for your ${brand}${model ? ` ${model}` : ""} (Est #${estimateNum}). We have not yet received a response.\n\nPlease take a moment to review and approve the services at your earliest convenience so we can proceed.\n\nIf you have any questions, don't hesitate to reach out.\n\nBest regards,\nRolliworks`
                  );
                  window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`, "_blank");
                  toast.success("Follow-up reminder email opened");
                }}
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link to={`/new-job?edit=${job.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default WorkQueue;
