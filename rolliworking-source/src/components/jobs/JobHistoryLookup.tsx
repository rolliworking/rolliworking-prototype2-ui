import * as React from "react";
import { useState } from "react";
import { ReadOnlyInspectionNotes } from "@/components/inspection/ReadOnlyInspectionNotes";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  Mail,
  Package,
  PlayCircle,
  FlaskConical,
  CheckCircle2,
  FileText,
  Clock,
  History,
  Search,
  Loader2,
  ClipboardCheck,
  ChevronRight,
  BoxSelect,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getLatestMeaningfulApproval } from "@/lib/inspection-approval-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TimelineEvent {
  date: Date;
  type: "created" | "intake" | "uncased" | "work_started" | "in_testing" | "finished" | "email" | "part_request" | "part_priced" | "part_status" | "inspection" | "client_reply";
  label: string;
  detail?: string;
  onClick?: () => void;
}

interface InspectionData {
  id: string;
  inspection_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  inspection_type: string;
  job_type: string;
  dial_condition: any;
  hands_condition: any;
  bezel_condition: any;
  crown_condition: any;
  case_condition: any;
  crystal_condition: any;
  bracelet_condition: any;
}

interface JobData {
  id: string;
  estimate_number: string | null;
  client_name: string | null;
  watch_brand: string | null;
  watch_model: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  intake_date: string | null;
  work_started_at: string | null;
  in_testing_at: string | null;
  finished_date: string | null;
  uncased_at: string | null;
  services: any;
  service_type: string | null;
  last_update_email_sent: string | null;
  parts_requests: any;
  assigned_watchmaker: string | null;
  sent_email_templates: any;
  inspection_id: string | null;
  serial_number?: string | null;
}

interface ClientReply {
  id: string;
  type: "inspection" | "parts";
  status: string;
  client_name: string | null;
  approved_at: string | null;
  created_at: string;
  client_notes: string | null;
  items: any[];
  polish_answers?: any;
  question_answers?: any;
}

function buildTimeline(job: JobData, inspection: InspectionData | null, clientReplies: ClientReply[], onInspectionClick?: () => void): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (job.created_at) {
    events.push({ date: parseISO(job.created_at), type: "created", label: "Job Created" });
  }

  if (inspection) {
    events.push({
      date: parseISO(inspection.created_at),
      type: "inspection",
      label: inspection.status === "sent" ? "Inspection Completed" : "Inspection",
      detail: `${inspection.inspection_number || inspection.inspection_type.replace(/_/g, " ")} • ${inspection.status}`,
      onClick: onInspectionClick,
    });
  }

  if (job.intake_date) events.push({ date: parseISO(job.intake_date), type: "intake", label: "Intake" });
  if (job.uncased_at) events.push({ date: parseISO(job.uncased_at), type: "uncased", label: "Watch Uncased" });
  if (job.work_started_at) events.push({ date: parseISO(job.work_started_at), type: "work_started", label: "Work Started" });
  if (job.in_testing_at) events.push({ date: parseISO(job.in_testing_at), type: "in_testing", label: "Moved to Testing" });
  if (job.finished_date) events.push({ date: parseISO(job.finished_date), type: "finished", label: "Job Finished" });

  // Client replies
  for (const reply of clientReplies) {
    const replyDate = reply.approved_at || reply.created_at;
    const statusLabel = reply.status === "approved" ? "Approved" : reply.status === "declined" ? "Declined" : "Pending";
    events.push({
      date: parseISO(replyDate),
      type: "client_reply",
      label: `Client ${statusLabel} (${reply.type === "inspection" ? "Inspection" : "Parts"})`,
      detail: reply.client_name
        ? `by ${reply.client_name}${reply.client_notes ? ` — "${reply.client_notes.slice(0, 60)}${reply.client_notes.length > 60 ? "…" : ""}"` : ""}`
        : undefined,
    });
  }

  const partsRequests = job.parts_requests as any[] | null;
  if (Array.isArray(partsRequests)) {
    partsRequests.forEach((part) => {
      if (part.requested_at) {
        events.push({ date: parseISO(part.requested_at), type: "part_request", label: "Part Requested", detail: part.description || part.request_number });
      }
      if (part.priced_at) {
        events.push({ date: parseISO(part.priced_at), type: "part_priced", label: "Part Priced", detail: `${part.description || part.request_number}${part.price ? ` - $${part.price}` : ""}` });
      }
    });
  }

  const sentEmails = job.sent_email_templates as any[] | null;
  if (Array.isArray(sentEmails)) {
    sentEmails.forEach((email) => {
      if (typeof email === "string") {
        const emailDate = job.last_update_email_sent ? parseISO(job.last_update_email_sent) : parseISO(job.created_at);
        events.push({ date: emailDate, type: "email", label: "Email Sent", detail: email });
      } else if (email.sent_at) {
        events.push({ date: parseISO(email.sent_at), type: "email", label: "Email Sent", detail: email.template_name || email.name || "Update" });
      }
    });
  }

  if (job.last_update_email_sent && (!Array.isArray(sentEmails) || sentEmails.length === 0)) {
    events.push({ date: parseISO(job.last_update_email_sent), type: "email", label: "Update Email Sent" });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  return events;
}

const EVENT_ICONS: Record<TimelineEvent["type"], React.ReactNode> = {
  created: <FileText className="h-3.5 w-3.5" />,
  intake: <Calendar className="h-3.5 w-3.5" />,
  uncased: <BoxSelect className="h-3.5 w-3.5" />,
  work_started: <PlayCircle className="h-3.5 w-3.5" />,
  in_testing: <FlaskConical className="h-3.5 w-3.5" />,
  finished: <CheckCircle2 className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  part_request: <Package className="h-3.5 w-3.5" />,
  part_priced: <Package className="h-3.5 w-3.5" />,
  part_status: <Package className="h-3.5 w-3.5" />,
  inspection: <ClipboardCheck className="h-3.5 w-3.5" />,
  client_reply: <MessageSquare className="h-3.5 w-3.5" />,
};

const EVENT_COLORS: Record<TimelineEvent["type"], string> = {
  created: "bg-muted text-muted-foreground",
  intake: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  uncased: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  work_started: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  in_testing: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  finished: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  email: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  part_request: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  part_priced: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  part_status: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  inspection: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  client_reply: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface JobHistoryLookupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ClientReplyDetails({ reply }: { reply: ClientReply }) {
  const items = reply.items as any[];
  const approvedItems = items.filter((i) => i.answer === "yes" || i.choice === "yes");
  const declinedItems = items.filter((i) => i.answer === "no" || i.choice === "no");

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px]",
            reply.status === "approved" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            reply.status === "declined" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            reply.status === "pending" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          )}
        >
          {reply.type === "inspection" ? "Inspection Approval" : "Parts Approval"} — {reply.status}
        </Badge>
        {reply.client_name && <span className="text-muted-foreground">by {reply.client_name}</span>}
      </div>

      {approvedItems.length > 0 && (
        <div>
          <span className="font-medium text-green-700 dark:text-green-400">Approved ({approvedItems.length}):</span>
          <ul className="ml-3 mt-0.5 space-y-0.5">
            {approvedItems.map((item, i) => (
              <li key={i} className="text-muted-foreground">
                • {item.description || item.name || item.label || "Item"}
                {item.price != null && ` — $${Number(item.price).toFixed(2)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {declinedItems.length > 0 && (
        <div>
          <span className="font-medium text-red-600 dark:text-red-400">Declined ({declinedItems.length}):</span>
          <ul className="ml-3 mt-0.5 space-y-0.5">
            {declinedItems.map((item, i) => (
              <li key={i} className="text-muted-foreground line-through">
                • {item.description || item.name || item.label || "Item"}
                {item.price != null && ` — $${Number(item.price).toFixed(2)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reply.client_notes && (
        <div className="bg-muted/50 rounded p-2 mt-1">
          <span className="font-medium">Client Notes:</span>
          <p className="text-muted-foreground mt-0.5">{reply.client_notes}</p>
        </div>
      )}

      {reply.question_answers && typeof reply.question_answers === "object" && Object.keys(reply.question_answers).length > 0 && (
        <div className="bg-muted/50 rounded p-2 mt-1">
          <span className="font-medium">Answers:</span>
          <ul className="ml-3 mt-0.5 space-y-0.5">
            {Object.entries(reply.question_answers).map(([key, val]) => (
              <li key={key} className="text-muted-foreground">• {key.replace(/_/g, " ")}: <span className="font-medium">{String(val)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function JobHistoryLookup({ open, onOpenChange }: JobHistoryLookupProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobData[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [clientReplies, setClientReplies] = useState<ClientReply[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleInspectionClick = () => {
    if (inspection) {
      onOpenChange(false);
      navigate(`/inspections/new?edit=${inspection.id}`);
    }
  };

  const selectJob = async (job: JobData) => {
    setSelectedJob(job);
    setInspection(null);
    setClientReplies([]);

    const isOrphan = job.id.startsWith("orphan-");

    // Fetch inspection
    let inspData: InspectionData | null = null;
    if (job.inspection_id) {
      const { data: linkedInsp } = await supabase
        .from("inspections")
        .select("id, inspection_number, status, notes, created_at, inspection_type, job_type, dial_condition, hands_condition, bezel_condition, crown_condition, case_condition, crystal_condition, bracelet_condition")
        .eq("id", job.inspection_id)
        .maybeSingle();
      inspData = linkedInsp;
    }
    if (!inspData && job.estimate_number) {
      const { data: byEstimate } = await supabase
        .from("inspections")
        .select(`id, inspection_number, status, notes, created_at, inspection_type, job_type, dial_condition, hands_condition, bezel_condition, crown_condition, case_condition, crystal_condition, bracelet_condition, watches!inner(estimate_number)`)
        .eq("watches.estimate_number", job.estimate_number)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      inspData = byEstimate;
    }
    if (inspData) setInspection(inspData);

    // Fetch client replies
    const replies: ClientReply[] = [];

    // Inspection approvals
    if (inspData) {
      const { data: inspApprovals } = await supabase
        .from("inspection_approvals")
        .select("id, status, client_name, approved_at, created_at, client_notes, approval_items, polish_answers, question_answers")
        .eq("inspection_id", inspData.id)
        .order("created_at", { ascending: false });

      const latestInspectionReply = getLatestMeaningfulApproval(inspApprovals || []);
      if (latestInspectionReply) {
        replies.push({
          id: latestInspectionReply.id,
          type: "inspection",
          status: latestInspectionReply.status,
          client_name: latestInspectionReply.client_name,
          approved_at: latestInspectionReply.approved_at,
          created_at: latestInspectionReply.created_at,
          client_notes: latestInspectionReply.client_notes,
          items: Array.isArray(latestInspectionReply.approval_items) ? (latestInspectionReply.approval_items as any[]) : [],
          polish_answers: latestInspectionReply.polish_answers,
          question_answers: latestInspectionReply.question_answers,
        });
      }
    }

    // Parts approvals (skip for orphans — no real job id)
    if (!isOrphan) {
      const { data: partsApprovals } = await supabase
        .from("parts_approvals")
        .select("id, status, client_name, approved_at, created_at, client_notes, parts_items")
        .eq("job_id", job.id)
        .order("created_at", { ascending: false });

      if (partsApprovals) {
        for (const pa of partsApprovals) {
          replies.push({
            id: pa.id,
            type: "parts",
            status: pa.status,
            client_name: pa.client_name,
            approved_at: pa.approved_at,
            created_at: pa.created_at,
            client_notes: pa.client_notes,
            items: Array.isArray(pa.parts_items) ? (pa.parts_items as any[]) : [],
          });
        }
      }
    }

    setClientReplies(replies);
  };

  const handleSearch = async () => {
    if (!search.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedJob(null);
    setInspection(null);
    setClientReplies([]);

    try {
      const searchTerm = search.trim();

      const { data: jobResults, error: fetchError } = await supabase
        .from("jobs")
        .select("id, estimate_number, client_name, watch_brand, watch_model, serial_number, status, due_date, created_at, intake_date, uncased_at, work_started_at, in_testing_at, finished_date, last_update_email_sent, parts_requests, assigned_watchmaker, sent_email_templates, services, service_type, inspection_id")
        .or(`estimate_number.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%,serial_number.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      const { data: watchData } = await supabase
        .from("watches")
        .select(`
          estimate_number, brand, model,
          inspections!inner(
            id,
            jobs!inner(
              id, estimate_number, client_name, watch_brand, watch_model, serial_number,
              status, due_date, created_at, intake_date, uncased_at, work_started_at, in_testing_at,
              finished_date, last_update_email_sent, parts_requests, assigned_watchmaker,
              sent_email_templates, services, service_type, inspection_id
            )
          )
        `)
        .ilike("estimate_number", `%${searchTerm}%`)
        .limit(20);

      const allJobs = new Map<string, JobData>();

      if (jobResults) {
        jobResults.forEach((j) => allJobs.set(j.id, j));
      }

      if (watchData) {
        watchData.forEach((w) => {
          const insp = (w.inspections as any)?.[0];
          const jobFromWatch = insp?.jobs?.[0];
          if (jobFromWatch && !allJobs.has(jobFromWatch.id)) {
            allJobs.set(jobFromWatch.id, {
              ...jobFromWatch,
              estimate_number: jobFromWatch.estimate_number || w.estimate_number,
              watch_brand: jobFromWatch.watch_brand || w.brand,
              watch_model: jobFromWatch.watch_model || w.model,
            });
          }
        });
      }

      const merged = Array.from(allJobs.values());

      if (merged.length === 0) {
        // Fallback: search watches/inspections that have no job yet (orphan inspections)
        const { data: orphanWatches } = await supabase
          .from("watches")
          .select(`
            id, estimate_number, brand, model, reference_number,
            customers(name, email),
            inspections(
              id, inspection_number, status, notes, created_at, inspection_type, job_type,
              dial_condition, hands_condition, bezel_condition, crown_condition,
              case_condition, crystal_condition, bracelet_condition
            )
          `)
          .ilike("estimate_number", `%${searchTerm}%`)
          .limit(10);

        if (orphanWatches && orphanWatches.length > 0) {
          const syntheticJobs: JobData[] = [];
          for (const w of orphanWatches) {
            const customer = w.customers as any;
            const inspList = w.inspections as any[];
            const insp = inspList?.[0];
            syntheticJobs.push({
              id: `orphan-${w.id}`,
              estimate_number: w.estimate_number,
              client_name: customer?.name || null,
              watch_brand: w.brand,
              watch_model: w.model,
              status: "no_job",
              due_date: null,
              created_at: insp?.created_at || new Date().toISOString(),
              intake_date: null,
              work_started_at: null,
              in_testing_at: null,
              finished_date: null,
              uncased_at: null,
              services: null,
              service_type: null,
              last_update_email_sent: null,
              parts_requests: null,
              assigned_watchmaker: null,
              sent_email_templates: null,
              inspection_id: insp?.id || null,
              serial_number: null,
            });
          }
          if (syntheticJobs.length === 1) {
            setResults(syntheticJobs);
            selectJob(syntheticJobs[0]);
          } else {
            setResults(syntheticJobs);
          }
        } else {
          setError("No jobs found");
        }
      } else if (merged.length === 1) {
        setResults(merged);
        selectJob(merged[0]);
      } else {
        setResults(merged);
      }
    } catch (err: any) {
      setError(err.message || "Failed to search");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleBack = () => {
    setSelectedJob(null);
    setInspection(null);
    setClientReplies([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch("");
      setResults([]);
      setSelectedJob(null);
      setInspection(null);
      setClientReplies([]);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const job = selectedJob;
  const events = job ? buildTimeline(job, inspection, clientReplies, handleInspectionClick) : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Job History Lookup
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Estimate #, client name, or serial #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleSearch} disabled={loading} className="h-8 px-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Multiple results list */}
        {results.length > 1 && !selectedJob && (
          <ScrollArea className="max-h-[350px]">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{results.length} results found</p>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectJob(r)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.client_name || "Unknown"}</span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Est# {r.estimate_number || "-"}
                    {r.watch_brand && ` • ${r.watch_brand}`}
                    {r.watch_model && ` ${r.watch_model}`}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Single job detail view */}
        {job && (
          <>
            {results.length > 1 && (
              <button
                onClick={handleBack}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Back to results
              </button>
            )}
            <div className="text-xs text-muted-foreground space-y-0.5 pt-2 border-t">
              <div className="font-medium text-foreground">{job.client_name || "Unknown"}</div>
              <div>
                Est# {job.estimate_number || "-"}
                {job.watch_brand && ` • ${job.watch_brand}`}
                {job.watch_model && ` ${job.watch_model}`}
              </div>
              {(job.service_type || (Array.isArray(job.services) && job.services.length > 0)) && (
                <div className="text-muted-foreground pt-0.5">
                  {job.service_type?.replace(/_/g, " ") || (Array.isArray(job.services) ? job.services.map((s: string) => s.replace(/_/g, " ")).join(", ") : "")}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pb-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {job.status === "no_job" ? "Inspection Only (No Job)" : job.status.replace(/_/g, " ")}
              </Badge>
              {job.assigned_watchmaker && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {job.assigned_watchmaker}
                </Badge>
              )}
              {job.due_date && (
                <Badge variant="secondary" className="text-xs">
                  Due: {format(parseISO(job.due_date), "MMM d, yyyy")}
                </Badge>
              )}
              {inspection && (
                <Badge
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-secondary/80"
                  onClick={handleInspectionClick}
                >
                  <ClipboardCheck className="h-3 w-3 mr-1" />
                  {inspection.status === "sent" ? "Inspected" : `Inspection: ${inspection.status}`}
                </Badge>
              )}
            </div>

            <ScrollArea className="max-h-[300px] pr-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="relative pl-4 space-y-3">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                  {events.map((event, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "relative flex gap-3",
                        event.onClick && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
                      )}
                      onClick={event.onClick}
                    >
                      <div
                        className={cn(
                          "absolute -left-4 top-0.5 h-4 w-4 rounded-full flex items-center justify-center border-2 border-background",
                          EVENT_COLORS[event.type]
                        )}
                      >
                        {EVENT_ICONS[event.type]}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">{event.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(event.date, "MMM d, yyyy")}
                          </span>
                          {event.onClick && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto" />
                          )}
                        </div>
                        {event.detail && (
                          <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Client Replies Section */}
            {clientReplies.length > 0 && (
              <div className="border-t pt-3 mt-2 space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Client Replies ({clientReplies.length})
                </h4>
                {clientReplies.map((reply) => (
                  <ClientReplyDetails key={reply.id} reply={reply} />
                ))}
              </div>
            )}

            {/* Read-only inspection notes */}
            <div className="border-t pt-3 mt-2">
              {inspection ? (
                <ReadOnlyInspectionNotes inspection={inspection} />
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">
                  No inspection on file
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
