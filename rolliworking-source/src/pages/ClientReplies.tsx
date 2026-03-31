import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, startOfDay } from "date-fns";
import { toast } from "sonner";
import {
  MessageSquare,
  Package,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Star,
  CalendarIcon,
  CheckSquare,
  Send,
  Loader2,
  Eye,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface ReplyItem {
  id: string;
  type: "inspection" | "parts";
  status: string;
  clientName: string | null;
  clientEmail: string | null;
  clientNotes: string | null;
  respondedAt: string;
  estimateNumber: string | null;
  watchDesc: string;
  watchBrand: string | null;
  watchModel: string | null;
  navigateTo: string;
  confirmationSentAt: string | null;
  // inspection-specific
  approvalItems?: Array<{ label: string; choice: string; price?: number }>;
  polishAnswers?: Record<string, string | null> | null;
  questionAnswers?: Record<string, string | null> | null;
  inspectionType?: string;
  // parts-specific
  partsItems?: Array<{ description: string; qty: number; price: number | null; answer?: string }>;
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-600 text-white text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    case "declined":
      return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  }
}

// ── Main Component ─────────────────────────────────────────────

export default function ClientReplies() {
  usePageMeta({ title: "Client Replies • WatchFlow", description: "Summary of all client replies" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);

  // Get current user
  const { data: sessionData } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: 1000 * 60 * 5,
  });
  const userId = sessionData?.user?.id;

  // Fetch inspection approvals with full detail
  const { data: inspectionApprovals, isLoading: loadingInsp } = useQuery({
    queryKey: ["client-replies", "inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_approvals")
        .select(`
          id, status, approved_at, approved_by_name, client_name, client_email,
          client_notes, created_at, updated_at, inspection_id,
          approval_items, polish_answers, question_answers, confirmation_sent_at,
          inspections(id, inspection_number, inspection_type, watches(brand, model, estimate_number))
        `)
        .in("status", ["approved", "declined"])
        .order("approved_at", { ascending: false, nullsFirst: false })
        .limit(250);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 1000 * 60 * 60, // 1 hour
    staleTime: 1000 * 60 * 30,
  });

  // Fetch inspection questions (for mapping keys to full labels)
  const { data: questionLabels } = useQuery({
    queryKey: ["inspection-questions-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_questions")
        .select("key, label")
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((q) => { map[q.key] = q.label; });
      return map;
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch parts approvals
  const { data: partsApprovals, isLoading: loadingParts } = useQuery({
    queryKey: ["client-replies", "parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_approvals")
        .select(`
          id, status, approved_at, approved_by_name, client_name, client_email,
          client_notes, created_at, updated_at, job_id, parts_items,
          jobs(id, estimate_number, watch_brand, watch_model, status)
        `)
        .in("status", ["approved", "declined"])
        .order("approved_at", { ascending: false, nullsFirst: false })
        .limit(250);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 1000 * 60 * 60,
    staleTime: 1000 * 60 * 30,
  });

  // Fetch read statuses
  const { data: readStatuses } = useQuery({
    queryKey: ["client-replies-read", userId],
    queryFn: async () => {
      if (!userId) return {};
      const { data, error } = await supabase
        .from("approval_read_status")
        .select("approval_id, is_read")
        .eq("user_id", userId)
        .eq("is_read", true);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((r) => { map[r.approval_id] = r.is_read; });
      return map;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const toggleRead = React.useCallback(async (approvalId: string) => {
    if (!userId) return;
    const currentlyRead = readStatuses?.[approvalId] ?? false;
    if (currentlyRead) {
      // Mark unread - delete the row
      await supabase
        .from("approval_read_status")
        .delete()
        .eq("approval_id", approvalId)
        .eq("user_id", userId);
    } else {
      // Mark read - upsert
      await supabase
        .from("approval_read_status")
        .upsert({
          approval_id: approvalId,
          user_id: userId,
          is_read: true,
          read_at: new Date().toISOString(),
        }, { onConflict: "approval_id,user_id" });
    }
    queryClient.invalidateQueries({ queryKey: ["client-replies-read", userId] });
  }, [userId, readStatuses, queryClient]);

  const isLoading = loadingInsp || loadingParts;

  // Build unified reply list
  const allReplies = React.useMemo(() => {
    const items: ReplyItem[] = [];

    (inspectionApprovals || []).forEach((a: any) => {
      const w = a.inspections?.watches;
      items.push({
        id: a.id,
        type: "inspection",
        status: a.status,
        clientName: a.approved_by_name || a.client_name,
        clientEmail: a.client_email || null,
        clientNotes: a.client_notes,
        respondedAt: a.approved_at || a.updated_at,
        estimateNumber: w?.estimate_number || null,
        watchDesc: w ? `${w.brand} ${w.model || ""}`.trim() : "Unknown",
        watchBrand: w?.brand || null,
        watchModel: w?.model || null,
        navigateTo: `/view-approval?id=${a.id}`,
        confirmationSentAt: a.confirmation_sent_at || null,
        approvalItems: Array.isArray(a.approval_items) ? a.approval_items : [],
        polishAnswers: a.polish_answers || null,
        questionAnswers: a.question_answers || null,
        inspectionType: a.inspections?.inspection_type || "",
      });
    });

    (partsApprovals || []).forEach((p: any) => {
      const j = p.jobs;
      const rawParts = Array.isArray(p.parts_items) ? p.parts_items : [];
      const parts = rawParts.map((pt: any) => ({
        description: pt.description || pt.name || "",
        qty: pt.qty || 1,
        price: pt.price != null ? pt.price : null,
        answer: pt.answer || pt.choice || undefined,
      }));
      items.push({
        id: p.id,
        type: "parts",
        status: p.status,
        clientName: p.approved_by_name || p.client_name,
        clientEmail: p.client_email || null,
        clientNotes: p.client_notes,
        respondedAt: p.approved_at || p.updated_at,
        estimateNumber: j?.estimate_number || null,
        watchDesc: j ? `${j.watch_brand || ""} ${j.watch_model || ""}`.trim() : "Unknown",
        watchBrand: j?.watch_brand || null,
        watchModel: j?.watch_model || null,
        navigateTo: j ? `/new-job?edit=${j.id}` : "#",
        confirmationSentAt: null,
        partsItems: parts,
      });
    });

    items.sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime());
    return items;
  }, [inspectionApprovals, partsApprovals]);

  // Dates that have replies (for calendar dots)
  const replyDates = React.useMemo(() => {
    const dates = new Set<string>();
    allReplies.forEach((r) => {
      dates.add(format(new Date(r.respondedAt), "yyyy-MM-dd"));
    });
    return dates;
  }, [allReplies]);

  // Filter by selected date
  const filteredReplies = React.useMemo(() => {
    if (!selectedDate) return allReplies;
    return allReplies.filter((r) => isSameDay(new Date(r.respondedAt), selectedDate));
  }, [allReplies, selectedDate]);

  // Group by day
  const groupedByDay = React.useMemo(() => {
    const groups: Array<{ date: Date; label: string; replies: ReplyItem[] }> = [];
    const map = new Map<string, ReplyItem[]>();

    filteredReplies.forEach((r) => {
      const key = format(new Date(r.respondedAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    map.forEach((replies, key) => {
      const date = startOfDay(new Date(key + "T00:00:00"));
      groups.push({
        date,
        label: format(date, "EEEE, MMMM d, yyyy"),
        replies,
      });
    });

    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [filteredReplies]);

  // Stats for selected view
  const approvedCount = filteredReplies.filter((r) => r.status === "approved").length;
  const declinedCount = filteredReplies.filter((r) => r.status === "declined").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client Replies</h1>
        <p className="text-muted-foreground text-sm">
          Inspection &amp; parts approval responses · Auto-refreshes every hour
        </p>
      </div>

      {/* Calendar + Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
        <Card className="w-fit">
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => setSelectedDate(d === selectedDate ? undefined : d)}
              modifiers={{ hasReply: (date) => replyDates.has(format(date, "yyyy-MM-dd")) }}
              modifiersClassNames={{ hasReply: "bg-green-100 dark:bg-green-900/30 font-bold" }}
              className="rounded-md"
            />
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => setSelectedDate(undefined)}
              >
                Clear filter · Show all
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold">{filteredReplies.length}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedDate ? format(selectedDate, "MMM d") : "All"} Replies
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <div className="text-2xl font-bold text-destructive">{declinedCount}</div>
                <div className="text-xs text-muted-foreground">Declined</div>
              </CardContent>
            </Card>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5 text-blue-500" /> Inspection</span>
            <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 text-amber-500" /> Parts</span>
            <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Green = has replies</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Day-grouped timeline */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
        </div>
      ) : groupedByDay.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {selectedDate
              ? `No replies on ${format(selectedDate, "MMMM d, yyyy")}.`
              : "No client replies yet."}
          </CardContent>
        </Card>
      ) : (
        groupedByDay.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
              <Badge variant="outline" className="text-[10px]">{group.replies.length}</Badge>
            </div>

            <div className="space-y-2">
              {group.replies.map((reply) => (
                <ReplyCard key={`${reply.type}-${reply.id}`} reply={reply} onNavigate={navigate} questionLabels={questionLabels || {}} isRead={readStatuses?.[reply.id] ?? false} onToggleRead={toggleRead} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Reply Card ─────────────────────────────────────────────────

function ReplyCard({ reply, onNavigate, questionLabels, isRead, onToggleRead }: { reply: ReplyItem; onNavigate: (to: string) => void; questionLabels: Record<string, string>; isRead: boolean; onToggleRead: (id: string) => void }) {
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(!!reply.confirmationSentAt);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const isBandOnly = reply.type === "inspection" && reply.inspectionType === "bracelet_only";

  const firstName = (reply.clientName || "Valued Customer").split(" ")[0];
  const watchDesc = `${reply.watchBrand || ""}${reply.watchModel ? ` ${reply.watchModel}` : ""}`.trim() || "bracelet";

  const sendCourtesyEmail = async () => {
    if (!reply.clientEmail) {
      toast.error("No email address on file for this client");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-courtesy-email", {
        body: {
          to: reply.clientEmail,
          customerName: reply.clientName || "Valued Customer",
          brand: reply.watchBrand || "",
          model: reply.watchModel || "",
          estimateNumber: reply.estimateNumber || "",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Confirmation email sent");
      setSent(true);
      setPreviewOpen(false);
      // Persist sent status
      if (reply.type === "inspection") {
        await supabase
          .from("inspection_approvals")
          .update({ confirmation_sent_at: new Date().toISOString() } as any)
          .eq("id", reply.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="py-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleRead(reply.id); }}
            className="mt-0.5 shrink-0 focus:outline-none"
            title={isRead ? "Mark as unread" : "Mark as read"}
          >
            <CheckSquare className={`h-5 w-5 transition-colors ${isRead ? "text-emerald-500" : "text-muted-foreground/30"}`} />
          </button>
          <div className="mt-0.5">
            {reply.type === "inspection" ? (
              <ClipboardCheck className="h-5 w-5 text-blue-500" />
            ) : (
              <Package className="h-5 w-5 text-amber-500" />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {statusBadge(reply.status)}
              <Badge variant="outline" className="text-[10px]">
                {reply.type === "inspection" ? (reply.inspectionType?.replace(/_/g, " ") || "Inspection") : "Parts"}
              </Badge>
              {reply.estimateNumber && (
                <span className="text-xs font-mono text-muted-foreground">#{reply.estimateNumber}</span>
              )}
            </div>
            <div className="font-medium text-sm">{reply.watchDesc}</div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {reply.clientName && <span>Signed by: <span className="font-medium text-foreground">{reply.clientName}</span></span>}
              <span>{format(new Date(reply.respondedAt), "h:mm a")}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate(reply.navigateTo)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Inspection detail: approval items */}
        {reply.type === "inspection" && reply.approvalItems && reply.approvalItems.length > 0 && (
          <div className="ml-8 space-y-1">
            {reply.approvalItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {item.choice === "yes" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                <span className={item.choice === "no" ? "line-through text-muted-foreground" : ""}>
                  {item.label}
                </span>
                {item.price != null && item.price > 0 && (
                  <span className="text-muted-foreground text-xs">(${item.price})</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Inspection detail: polish answers */}
        {reply.type === "inspection" && reply.polishAnswers && Object.keys(reply.polishAnswers).length > 0 && (
          <div className="ml-8 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" /> Polish
            </p>
            {Object.entries(reply.polishAnswers).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {key === "bracelet_polish_scale" ? "Bracelet:" : key === "courtesy_polish" ? "Courtesy:" : `${key}:`}
                </span>
                <span className="font-semibold">
                  {val === "no_polish"
                    ? "No Polish"
                    : val === "yes"
                    ? "Yes"
                    : val === "no"
                    ? "No"
                    : Number(val) >= 8
                    ? `Level ${val} (+$250)`
                    : `Level ${val}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Inspection detail: question answers */}
        {reply.type === "inspection" && reply.questionAnswers && Object.keys(reply.questionAnswers).length > 0 && (
          <div className="ml-8 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Questions</p>
            {Object.entries(reply.questionAnswers).map(([key, val]) => {
              const fullLabel = questionLabels[key];
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{key}:</span>
                    <span className="font-semibold">
                      {val === "yes" ? "✅ Yes" : val === "no" ? "❌ No" : String(val || "—")}
                    </span>
                  </div>
                  {fullLabel && (
                    <p className="text-xs text-muted-foreground italic ml-1">"{fullLabel}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Parts detail: individual items */}
        {reply.type === "parts" && reply.partsItems && reply.partsItems.length > 0 && (
          <div className="ml-8 space-y-1">
            {reply.partsItems.map((part, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {part.answer === "yes" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : part.answer === "no" ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                {part.price != null && (
                  <span className="text-muted-foreground text-xs">(${(part.price * (part.qty || 1)).toLocaleString()})</span>
                )}
                {part.description && (
                  <span className={`text-xs truncate ${part.answer === "no" ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>
                    {part.description}{part.qty > 1 ? ` ×${part.qty}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Client notes */}
        {reply.clientNotes && (
          <div className="ml-8">
            <div className="text-xs rounded border bg-muted/40 px-3 py-2 italic">
              "{reply.clientNotes}"
            </div>
          </div>
        )}

        {/* Send courtesy email button — band only */}
        {isBandOnly && reply.status === "approved" && (
          <div className="ml-8 pt-1 flex items-center gap-2">
            {sent ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Confirmation sent {reply.confirmationSentAt && format(new Date(reply.confirmationSentAt), "M/d h:mm a")}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={sending}
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3 w-3" />
                Preview & Send Confirmation
              </Button>
            )}
          </div>
        )}

        {/* Email Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Confirmation Email Preview
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-[60px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground font-medium">To:</span>
                <span>{reply.clientEmail || "No email on file"}</span>
                <span className="text-muted-foreground font-medium">From:</span>
                <span className="text-muted-foreground">noreply@quotes.rolliworks.com</span>
                <span className="text-muted-foreground font-medium">Subject:</span>
                <span>Rolliworks – Thank You for Your Reply (Est #{reply.estimateNumber || ""})</span>
              </div>
              <Separator />
              <div className="rounded-md border bg-muted/20 p-4 space-y-3 text-sm">
                <p>Dear {firstName},</p>
                <p>
                  Thank you for your reply regarding your <strong>{watchDesc}</strong> (Est #{reply.estimateNumber || ""}). 
                  We have received your selections and your bracelet has been added to our work queue.
                </p>
                <p>
                  We appreciate your prompt response. If you have any questions or need to make changes, 
                  please don't hesitate to reach out.
                </p>
                <p>Thank you for trusting Rolliworks with your timepiece.</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is a preview of the default template. If you have a custom "Bracelet Reply Confirmation" 
                template active in Email Templates, that will be used instead.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
              <Button
                onClick={sendCourtesyEmail}
                disabled={sending || !reply.clientEmail}
                className="gap-1.5"
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {sending ? "Sending…" : "Send Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
