import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wrench, Mail, ChevronDown, ChevronRight, CheckCheck, Search, X, Send,
  Inbox, MessageSquareReply, Clock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { toast } from "sonner";
import {
  getLatestMeaningfulApprovalsByInspection,
} from "@/lib/inspection-approval-utils";

/* ── Types ── */

interface PendingItem {
  approval_id: string;
  inspection_id: string;
  created_at: string;
  customer_name: string;
  customer_email: string | null;
  estimate_number: string;
  brand: string;
  model: string | null;
  job_type: string;
  days_pending: number;
}

interface RespondedItem {
  approval_id: string;
  inspection_id: string;
  responded_at: string;
  customer_name: string;
  estimate_number: string;
  brand: string;
  model: string | null;
  job_type: string;
  status: string;
}

const BAND_JOB_TYPES = ["bracelet_repair", "bracelet_work", "gold_bracelet", "stretch_repair"];

type MetricFilter = "all" | "sent" | "responded" | "outstanding";

function isBandJob(jobType: string) {
  return BAND_JOB_TYPES.includes(jobType);
}

/* ── Main Component ── */

export default function FollowUpQueue() {
  usePageMeta({ title: "Follow Up Queue" });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<MetricFilter>("all");

  // 1. All approvals — pending (outstanding / sent)
  const { data: pendingApprovals = [], isLoading: loadingPending } = useQuery({
    queryKey: ["followup-pending"],
    queryFn: async () => {
      const { data: allApprovals, error } = await supabase
        .from("inspection_approvals")
        .select("id, inspection_id, created_at, client_name, client_email, status, approved_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!allApprovals || allApprovals.length === 0) return [];

      const latestByInspection = getLatestMeaningfulApprovalsByInspection(allApprovals);
      const approvals = Array.from(latestByInspection.values())
        .filter((a) => a.status === "pending")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (approvals.length === 0) return [];

      const inspectionIds = [...new Set(approvals.map((a) => a.inspection_id))];
      const { data: inspections } = await supabase
        .from("inspections")
        .select("id, job_type, watches(estimate_number, brand, model, customers(name, email))")
        .in("id", inspectionIds);

      const inspMap = new Map<string, any>();
      if (inspections) for (const insp of inspections) inspMap.set(insp.id, insp);

      const now = new Date();
      return approvals.map((a): PendingItem => {
        const insp = inspMap.get(a.inspection_id);
        const watch = insp?.watches;
        const customer = watch?.customers;
        return {
          approval_id: a.id,
          inspection_id: a.inspection_id,
          created_at: a.created_at,
          customer_name: customer?.name || a.client_name || "Unknown",
          customer_email: customer?.email || a.client_email || null,
          estimate_number: watch?.estimate_number || "",
          brand: watch?.brand || "",
          model: watch?.model || null,
          job_type: insp?.job_type || "",
          days_pending: differenceInDays(now, new Date(a.created_at)),
        };
      });
    },
  });

  // 2. Responded approvals (approved/declined)
  const { data: respondedApprovals = [], isLoading: loadingResponded } = useQuery({
    queryKey: ["followup-responded"],
    queryFn: async () => {
      const { data: allApprovals, error } = await supabase
        .from("inspection_approvals")
        .select("id, inspection_id, created_at, approved_at, client_name, status")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!allApprovals || allApprovals.length === 0) return [];

      const latestByInspection = getLatestMeaningfulApprovalsByInspection(allApprovals);
      const responded = Array.from(latestByInspection.values())
        .filter((a) => a.status !== "pending")
        .sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());

      if (responded.length === 0) return [];

      const inspectionIds = [...new Set(responded.map((a) => a.inspection_id))];
      const { data: inspections } = await supabase
        .from("inspections")
        .select("id, job_type, watches(estimate_number, brand, model, customers(name))")
        .in("id", inspectionIds);

      const inspMap = new Map<string, any>();
      if (inspections) for (const insp of inspections) inspMap.set(insp.id, insp);

      return responded.map((a): RespondedItem => {
        const insp = inspMap.get(a.inspection_id);
        const watch = insp?.watches;
        const customer = watch?.customers;
        return {
          approval_id: a.id,
          inspection_id: a.inspection_id,
          responded_at: a.approved_at || a.created_at,
          customer_name: customer?.name || a.client_name || "Unknown",
          estimate_number: watch?.estimate_number || "",
          brand: watch?.brand || "",
          model: watch?.model || null,
          job_type: insp?.job_type || "",
          status: a.status,
        };
      });
    },
  });

  const isLoading = loadingPending || loadingResponded;

  // Metrics
  const totalSent = pendingApprovals.length + respondedApprovals.length;
  const totalResponded = respondedApprovals.length;
  const totalOutstanding = pendingApprovals.length;

  // Filter by search
  const filterBySearch = <T extends { customer_name: string; estimate_number: string }>(items: T[]) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (i) => i.customer_name.toLowerCase().includes(q) || i.estimate_number.toLowerCase().includes(q)
    );
  };

  const filteredPending = useMemo(() => filterBySearch(pendingApprovals), [pendingApprovals, searchTerm]);
  const filteredResponded = useMemo(() => filterBySearch(respondedApprovals), [respondedApprovals, searchTerm]);

  // Build display list based on active filter
  const displayItems = useMemo(() => {
    type UnifiedItem =
      | { type: "pending"; data: PendingItem }
      | { type: "responded"; data: RespondedItem };

    let items: UnifiedItem[] = [];

    if (activeFilter === "all" || activeFilter === "sent" || activeFilter === "outstanding") {
      items.push(...filteredPending.map((d) => ({ type: "pending" as const, data: d })));
    }
    if (activeFilter === "all" || activeFilter === "sent" || activeFilter === "responded") {
      items.push(...filteredResponded.map((d) => ({ type: "responded" as const, data: d })));
    }

    // Sort newest to oldest
    items.sort((a, b) => {
      const dateA = a.type === "pending" ? a.data.created_at : a.data.responded_at;
      const dateB = b.type === "pending" ? b.data.created_at : b.data.responded_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return items;
  }, [activeFilter, filteredPending, filteredResponded]);

  const metrics: { key: MetricFilter; label: string; count: number; icon: typeof Inbox; color: string; bgColor: string }[] = [
    { key: "sent", label: "Inspections Sent", count: totalSent, icon: Inbox, color: "text-foreground", bgColor: "bg-muted/50 border-border hover:bg-muted" },
    { key: "responded", label: "Responses Received", count: totalResponded, icon: MessageSquareReply, color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
    { key: "outstanding", label: "Awaiting Reply", count: totalOutstanding, icon: Clock, color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Wrench className="h-6 w-6" /> Follow Up Queue
        </h1>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 shrink-0">
          <Wrench className="h-6 w-6" /> Follow Up Queue
        </h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search estimate # or name…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Metric Boxes ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          const isActive = activeFilter === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActiveFilter(isActive ? "all" : m.key)}
              className={cn(
                "rounded-lg border p-4 text-left transition-all",
                m.bgColor,
                isActive && "ring-2 ring-primary ring-offset-1"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", m.color)} />
                  <span className={cn("text-sm font-medium", m.color)}>{m.label}</span>
                </div>
              </div>
              <p className={cn("text-3xl font-bold mt-2", m.color)}>{m.count}</p>
            </button>
          );
        })}
      </div>

      {activeFilter !== "all" && (
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            Showing: {metrics.find((m) => m.key === activeFilter)?.label}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveFilter("all")}>
            Clear filter
          </Button>
        </div>
      )}

      {/* ── Unified List ── */}
      <div className="space-y-2">
        {displayItems.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No items to display.
          </Card>
        )}
        {displayItems.map((item) => {
          if (item.type === "pending") {
            return <PendingCard key={item.data.approval_id} item={item.data} />;
          }
          return <RespondedCard key={item.data.approval_id} item={item.data} />;
        })}
      </div>
    </div>
  );
}

/* ── Color indicator for job type ── */
function JobTypeDot({ jobType }: { jobType: string }) {
  const isBand = isBandJob(jobType);
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full shrink-0",
        isBand ? "bg-emerald-500" : "bg-blue-500"
      )}
      title={isBand ? "Band Work" : "Watch Head"}
    />
  );
}

function JobTypeLabel({ jobType }: { jobType: string }) {
  const isBand = isBandJob(jobType);
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", isBand ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
      {isBand ? "Band" : "Watch Head"}
    </span>
  );
}

/* ── PendingCard ── */

function PendingCard({ item, defaultExpanded = false }: { item: PendingItem; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sentTemplateIds, setSentTemplateIds] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);
  const queryClient = useQueryClient();

  const { data: emailTemplates } = useEmailTemplates();
  const activeTemplates = useMemo(
    () => (emailTemplates || []).filter((t) => t.is_active && t.type === "follow_up"),
    [emailTemplates]
  );

  const handleMarkReplyReceived = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMarking(true);
    const { error } = await supabase
      .from("inspection_approvals")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", item.approval_id);
    setMarking(false);
    if (error) { toast.error("Failed to update: " + error.message); return; }
    toast.success(`Marked reply received for ${item.customer_name}`);
    queryClient.invalidateQueries({ queryKey: ["followup-pending"] });
    queryClient.invalidateQueries({ queryKey: ["followup-responded"] });
  };

  const handleSendFollowUp = () => {
    const template = activeTemplates.find((t) => t.id === selectedTemplate);
    if (!template) { toast.error("Select a template first"); return; }
    if (!item.customer_email) { toast.error("No email address on file for this client"); return; }

    const firstName = item.customer_name.split(" ")[0] || item.customer_name;
    const replace = (s: string) =>
      s
        .replace(/\{\{customer_first_name\}\}/g, firstName)
        .replace(/\{\{client_name\}\}/g, item.customer_name)
        .replace(/\{\{watch_brand\}\}/g, item.brand)
        .replace(/\{\{watch_model\}\}/g, item.model || "")
        .replace(/\{\{brand\}\}/g, item.brand)
        .replace(/\{\{model\}\}/g, item.model || "")
        .replace(/\{\{estimate_number\}\}/g, item.estimate_number)
        .replace(/\{\{\s*Ref_number\s*\}\}/gi, "")
        .replace(/\{\{\s*serial_number\s*\}\}/gi, "")
        .replace(/\{\{\s*Estimate No\.?\s*\}\}/gi, item.estimate_number)
        .replace(/\[\s*Estimate No\.?\s*\]/gi, item.estimate_number)
        .replace(/\{name\}/gi, item.customer_name)
        .replace(/\{estimate\}/gi, item.estimate_number)
        .replace(/\{brand\}/gi, item.brand)
        .replace(/\{model\}/gi, item.model || "");

    window.open(`mailto:${item.customer_email}?subject=${encodeURIComponent(replace(template.subject))}&body=${encodeURIComponent(replace(template.body))}`, "_blank");
    setSentTemplateIds((prev) => new Set(prev).add(selectedTemplate));
    setSelectedTemplate("");
    toast.success(`Follow-up email opened for ${item.customer_name}`);
  };

  return (
    <Card className={cn("p-3 hover:shadow-md transition-shadow border-l-4", isBandJob(item.job_type) ? "border-l-emerald-500" : "border-l-blue-500")}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/inspections/new?edit=${item.inspection_id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <JobTypeDot jobType={item.job_type} />
            <p className="font-medium text-sm truncate">{item.customer_name}</p>
            <JobTypeLabel jobType={item.job_type} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Est# {item.estimate_number}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{item.brand}{item.model ? ` ${item.model}` : ""}</span>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            Sent {format(new Date(item.created_at), "M/d/yy")}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0",
              item.days_pending >= 14 && "border-destructive text-destructive",
              item.days_pending >= 7 && item.days_pending < 14 && "border-amber-500 text-amber-600",
              item.days_pending < 7 && "border-muted-foreground text-muted-foreground"
            )}
          >
            {item.days_pending}d
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={handleMarkReplyReceived} disabled={marking}>
          <CheckCheck className="h-3 w-3" />
          {marking ? "Updating…" : "Mark Reply Received"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs gap-1 text-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!item.customer_email) { toast.error("No email address on file"); return; }
            const approvalUrl = `https://app.rolliworks.com/approve-inspection?id=${item.approval_id}`;
            const firstName = item.customer_name.split(" ")[0] || item.customer_name;
            const watchDesc = `${item.brand}${item.model ? ` ${item.model}` : ""}`;
            const subject = encodeURIComponent(`Est# ${item.estimate_number} Inspection Report for your ${watchDesc}`);
            const body = encodeURIComponent(`Dear ${firstName},\n\nPlease click the link below to review and approve your ${watchDesc} inspection:\n\n${approvalUrl}\n\nThank you,\nRolliworks`);
            window.open(`mailto:${item.customer_email}?subject=${subject}&body=${body}`, "_blank");
            toast.success(`Resend URL opened for ${item.customer_name}`);
          }}
        >
          <Send className="h-3 w-3" />
          Resend URL
        </Button>

        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={(e) => e.stopPropagation()}>
              <Mail className="h-3 w-3 mr-1" /> Follow Up
              {expanded ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map((t) => {
                    const wasSent = sentTemplateIds.has(t.id);
                    return (
                      <SelectItem key={t.id} value={t.id} className={cn("text-xs", wasSent && "opacity-40")} disabled={wasSent}>
                        {t.name}{wasSent ? " ✓ Sent" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleSendFollowUp} disabled={!selectedTemplate}>
                <Mail className="h-3 w-3 mr-1" /> Send
              </Button>
            </div>
            {item.customer_email && (
              <span className="text-[10px] text-muted-foreground mt-1 block truncate">→ {item.customer_email}</span>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}

/* ── RespondedCard ── */

function RespondedCard({ item }: { item: RespondedItem }) {
  return (
    <Card className={cn("p-3 hover:shadow-md transition-shadow border-l-4", isBandJob(item.job_type) ? "border-l-emerald-500" : "border-l-blue-500")}>
      <Link to={`/inspections/new?edit=${item.inspection_id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <JobTypeDot jobType={item.job_type} />
              <p className="font-medium text-sm truncate">{item.customer_name}</p>
              <JobTypeLabel jobType={item.job_type} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">Est# {item.estimate_number}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{item.brand}{item.model ? ` ${item.model}` : ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(item.responded_at), "M/d/yy")}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                item.status === "approved" ? "border-emerald-500 text-emerald-600" : "border-destructive text-destructive"
              )}
            >
              {item.status === "approved" ? "Approved" : "Declined"}
            </Badge>
          </div>
        </div>
      </Link>
    </Card>
  );
}
