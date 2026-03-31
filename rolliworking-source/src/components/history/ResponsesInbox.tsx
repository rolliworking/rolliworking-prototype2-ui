import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import {
  Loader2,
  Mail,
  MailOpen,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface ApprovalResponse {
  id: string;
  inspection_id: string;
  status: string;
  approved_at: string | null;
  approved_by_name: string | null;
  client_name: string | null;
  approval_items: any[];
  polish_answers: Record<string, string | null> | null;
  question_answers: Record<string, string | null> | null;
  client_notes: string | null;
  created_at: string;
  // enriched
  customer_name: string;
  estimate_number: string;
  brand: string;
  model: string | null;
  inspection_type: string;
  // job info (may be null for orphan inspections)
  job_id: string | null;
  job_status: string | null;
  service_type: string | null;
  // read status
  is_read: boolean;
  is_archived: boolean;
  read_status_id: string | null;
}

type InboxFilter = "all" | "archived";

const JOB_STATUSES = [
  { value: "waiting_approval", label: "Awaiting Approval" },
  { value: "in_queue", label: "In Queue" },
  { value: "uncased", label: "Uncased" },
  { value: "in_progress", label: "In Progress" },
  { value: "parts_approval", label: "Parts Approval" },
  { value: "parts_on_order", label: "Parts On Order" },
  { value: "in_testing", label: "In Testing" },
  { value: "finished", label: "Finished" },
];

interface ResponsesInboxProps {
  searchTerm: string;
  onUnreadCountChange?: (count: number) => void;
}

export function ResponsesInbox({ searchTerm, onUnreadCountChange }: ResponsesInboxProps) {
  const [responses, setResponses] = useState<ApprovalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Fetch all approved/declined approvals
    const { data: approvals } = await supabase
      .from("inspection_approvals")
      .select("id, inspection_id, status, approved_at, approved_by_name, client_name, approval_items, polish_answers, question_answers, client_notes, created_at")
      .in("status", ["approved", "declined"])
      .order("approved_at", { ascending: false, nullsFirst: false });

    if (!approvals || approvals.length === 0) {
      setResponses([]);
      setLoading(false);
      return;
    }

    // Fetch read statuses for this user
    const { data: readStatuses } = await supabase
      .from("approval_read_status")
      .select("id, approval_id, is_read, is_archived")
      .eq("user_id", user.id);

    const readMap = new Map(
      (readStatuses || []).map(rs => [rs.approval_id, rs])
    );

    // Fetch inspection details
    const inspectionIds = [...new Set(approvals.map(a => a.inspection_id))];
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, inspection_type, watches!inner(estimate_number, brand, model, customers!inner(name))")
      .in("id", inspectionIds);

    const inspMap = new Map((inspections || []).map((i: any) => [i.id, i]));

    // Fetch jobs linked to these inspections
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, inspection_id, status, service_type")
      .in("inspection_id", inspectionIds);

    const jobMap = new Map((jobs || []).map((j: any) => [j.inspection_id, j]));

    const enriched: ApprovalResponse[] = approvals.map(a => {
      const insp = inspMap.get(a.inspection_id) as any;
      const job = jobMap.get(a.inspection_id) as any;
      const rs = readMap.get(a.id);
      return {
        ...a,
        approval_items: Array.isArray(a.approval_items) ? a.approval_items : [],
        polish_answers: (a as any).polish_answers || null,
        question_answers: (a as any).question_answers || null,
        client_notes: (a as any).client_notes || null,
        customer_name: insp?.watches?.customers?.name || a.client_name || "Unknown",
        estimate_number: insp?.watches?.estimate_number || "",
        brand: insp?.watches?.brand || "",
        model: insp?.watches?.model || null,
        inspection_type: insp?.inspection_type || "",
        job_id: job?.id || null,
        job_status: job?.status || null,
        service_type: job?.service_type || null,
        is_read: rs?.is_read || false,
        is_archived: rs?.is_archived || false,
        read_status_id: rs?.id || null,
      };
    });

    setResponses(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  const filtered = useMemo(() => {
    let list = responses;

    // Filter by inbox state — keep the currently expanded item visible
    if (filter === "all") {
      list = list.filter(r => !r.is_archived || r.id === expandedId);
    } else if (filter === "archived") {
      list = list.filter(r => r.is_archived || r.id === expandedId);
    }

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.customer_name.toLowerCase().includes(term) ||
        r.estimate_number.toLowerCase().includes(term) ||
        r.brand.toLowerCase().includes(term) ||
        (r.approved_by_name || "").toLowerCase().includes(term)
      );
    }

    return list;
  }, [responses, filter, searchTerm, expandedId]);

  const unreadCount = useMemo(() =>
    responses.filter(r => !r.is_read && !r.is_archived).length,
    [responses]
  );

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  const markRead = async (response: ApprovalResponse, read: boolean) => {
    if (!userId) return;
    try {
      if (response.read_status_id) {
        await supabase
          .from("approval_read_status")
          .update({ is_read: read, read_at: read ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
          .eq("id", response.read_status_id);
      } else {
        await supabase
          .from("approval_read_status")
          .insert({ approval_id: response.id, user_id: userId, is_read: read, read_at: read ? new Date().toISOString() : null });
      }
      setResponses(prev => prev.map(r =>
        r.id === response.id ? { ...r, is_read: read, read_status_id: r.read_status_id || "pending" } : r
      ));
    } catch { toast.error("Failed to update read status"); }
  };

  const toggleArchive = async (response: ApprovalResponse) => {
    if (!userId) return;
    const newArchived = !response.is_archived;
    try {
      if (response.read_status_id) {
        await supabase
          .from("approval_read_status")
          .update({ is_archived: newArchived, archived_at: newArchived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
          .eq("id", response.read_status_id);
      } else {
        await supabase
          .from("approval_read_status")
          .insert({ approval_id: response.id, user_id: userId, is_read: true, is_archived: newArchived, read_at: new Date().toISOString(), archived_at: newArchived ? new Date().toISOString() : null });
      }
      setResponses(prev => prev.map(r =>
        r.id === response.id ? { ...r, is_archived: newArchived, is_read: true, read_status_id: r.read_status_id || "pending" } : r
      ));
      toast.success(newArchived ? "Archived" : "Unarchived");
    } catch { toast.error("Failed to update archive status"); }
  };

  const handleExpand = (response: ApprovalResponse) => {
    setExpandedId(expandedId !== response.id ? response.id : null);
  };

  const changeJobStatus = async (response: ApprovalResponse, newStatus: string) => {
    if (!response.job_id) return;
    try {
      const { error } = await supabase.rpc("set_job_status", {
        job_id: response.job_id,
        new_status: newStatus,
      });
      if (error) throw error;
      setResponses(prev => prev.map(r =>
        r.id === response.id ? { ...r, job_status: newStatus } : r
      ));
      toast.success(`Job status updated to ${newStatus.replace(/_/g, " ")}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update job status");
    }
  };

  const isBandOnly = (r: ApprovalResponse) => r.inspection_type === "bracelet_only";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setFilter("all")}
        >
          <MailOpen className="h-3.5 w-3.5" />
          All
        </Button>
        <Button
          variant={filter === "archived" ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setFilter("archived")}
        >
          <Archive className="h-3.5 w-3.5" />
          Archived
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No replies found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filtered.map(response => (
            <Collapsible
              key={response.id}
              open={expandedId === response.id}
              onOpenChange={() => handleExpand(response)}
            >
              <Card className={`transition-colors ${!response.is_read ? "border-primary/40 bg-primary/[0.03]" : ""}`}>
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                    {/* Unread dot */}
                    <div className="w-2 shrink-0">
                      {!response.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>

                    {/* Chevron */}
                    {expandedId === response.id ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}

                    {/* Main info */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`text-sm truncate max-w-[140px] ${!response.is_read ? "font-semibold" : "font-medium"}`}>
                        {response.customer_name}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        #{response.estimate_number}
                      </span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        {response.brand}{response.model ? ` ${response.model}` : ""}
                      </span>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {response.inspection_type.replace(/_/g, " ")}
                      </Badge>
                      {response.approval_items.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {response.approval_items.filter((i: any) => i.choice === "yes").length}/{response.approval_items.length} approved
                        </span>
                      )}
                      {response.approved_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(response.approved_at), "M/d h:mm a")}
                        </span>
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-3 pt-1 border-t space-y-3">
                    {/* Client signature */}
                    <div className="text-xs text-muted-foreground">
                      Signed by: <span className="font-medium text-foreground">{response.approved_by_name || "—"}</span>
                    </div>

                    {/* Approval items */}
                    <div className="space-y-1.5">
                      {response.approval_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          {item.choice === "yes" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className={item.choice === "no" ? "line-through text-muted-foreground" : ""}>
                              {item.label}
                            </span>
                            {item.price > 0 && (
                              <span className="text-muted-foreground ml-1">(${item.price})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Polish answers */}
                    {response.polish_answers && Object.keys(response.polish_answers).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">⭐ Polish</p>
                        {Object.entries(response.polish_answers).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              {key === "bracelet_polish_scale" ? "Bracelet:" : key === "courtesy_polish" ? "Courtesy:" : `${key}:`}
                            </span>
                            <span className="font-semibold">
                              {val === "no_polish" ? "No Polish" : val === "yes" ? "Yes" : val === "no" ? "No" : Number(val) >= 8 ? `Level ${val} (+$250)` : `Level ${val}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Question answers */}
                    {response.question_answers && Object.keys(response.question_answers).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questions</p>
                        {Object.entries(response.question_answers).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-semibold">{val === "yes" ? "✅ Yes" : val === "no" ? "❌ No" : String(val || "—")}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Client Notes */}
                    {response.client_notes && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📝 Client Notes</p>
                        <div className="rounded border bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                          <p className="text-sm whitespace-pre-wrap">{response.client_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                      {/* Job status controls — only for non-band-only with linked jobs */}
                      {!isBandOnly(response) && response.job_id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Job:</span>
                          <Select
                            value={response.job_status || ""}
                            onValueChange={(v) => changeJobStatus(response, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[160px]">
                              <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                              {JOB_STATUSES.map(s => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* View full response */}
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                        <Link to={`/view-approval?id=${response.id}`}>
                          <Eye className="h-3 w-3" />
                          Full View
                        </Link>
                      </Button>

                      {/* Mark unread */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); markRead(response, !response.is_read); }}
                      >
                        {response.is_read ? <Mail className="h-3 w-3" /> : <MailOpen className="h-3 w-3" />}
                        {response.is_read ? "Mark Unread" : "Mark Read"}
                      </Button>

                      {/* Archive */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => { e.stopPropagation(); toggleArchive(response); }}
                      >
                        {response.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                        {response.is_archived ? "Unarchive" : "Archive"}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
