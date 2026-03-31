import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, MessageSquareReply, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ApprovalItem {
  id: string;
  label: string;
  price: number | null;
  choice: "yes" | "no" | null;
}

interface ApprovalData {
  id: string;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  tc_agreed: boolean;
  approval_items: ApprovalItem[];
  client_name: string | null;
  question_answers: Record<string, string | null> | null;
  polish_answers: Record<string, any> | null;
  client_notes: string | null;
}

interface ClientApprovalPanelProps {
  inspectionId: string;
}

export function ClientApprovalPanel({ inspectionId }: ClientApprovalPanelProps) {
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("inspection_approvals")
        .select("id, status, approved_by_name, approved_at, created_at, tc_agreed, approval_items, client_name, question_answers, polish_answers, client_notes")
        .eq("inspection_id", inspectionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setApproval(data as unknown as ApprovalData);
      }
      setLoading(false);
    };
    fetch();
  }, [inspectionId]);

  if (loading) return null;
  if (!approval) return null;

  const items = (approval.approval_items || []) as ApprovalItem[];
  const approvedCount = items.filter(i => i.choice === "yes").length;
  const declinedCount = items.filter(i => i.choice === "no").length;
  const isApproved = approval.status === "approved";
  const isPending = approval.status === "pending";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MessageSquareReply className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Client Approval</span>
          {isApproved ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
              Submitted
            </Badge>
          ) : isPending ? (
            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{approval.status}</Badge>
          )}
          {isApproved && items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {approvedCount} yes · {declinedCount} no
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Submission info */}
          {isApproved && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Approved By</p>
                <p className="font-medium">{approval.approved_by_name || approval.client_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted At</p>
                <p className="font-medium">
                  {approval.approved_at
                    ? format(new Date(approval.approved_at), "MMM d, yyyy h:mm a")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">T&C Accepted</p>
                <p className="font-medium">{approval.tc_agreed ? "✅ Yes" : "❌ No"}</p>
              </div>
            </div>
          )}

          {isPending && (
            <p className="text-xs text-muted-foreground italic">Waiting for client to respond…</p>
          )}

          {/* Approval items */}
          {isApproved && items.length > 0 && (
            <div className="divide-y rounded border">
              {items.map((item) => (
                <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">{item.label}</p>
                    {item.price != null && item.price > 0 && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">${item.price.toLocaleString()}</p>
                    )}
                  </div>
                  {item.choice === "yes" ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase">Yes</span>
                    </div>
                  ) : item.choice === "no" ? (
                    <div className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase">No</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Client Question Answers */}
          {isApproved && approval.question_answers && (() => {
            const answered = Object.entries(approval.question_answers).filter(([, v]) => v !== null && v !== undefined);
            if (answered.length === 0) return null;
            return (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client Questions</p>
                <div className="divide-y rounded border">
                  {answered.map(([key, val]) => (
                    <div key={key} className="px-3 py-2 flex items-center justify-between gap-3">
                      <span className="text-xs">{key}</span>
                      <span className={`text-[10px] font-bold uppercase ${val === "yes" ? "text-emerald-600" : val === "no" ? "text-red-500" : "text-muted-foreground"}`}>
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Polish Answers */}
          {isApproved && approval.polish_answers && (() => {
            const entries = Object.entries(approval.polish_answers).filter(([, v]) => v !== null && v !== undefined);
            if (entries.length === 0) return null;
            return (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Polish Preferences</p>
                <div className="divide-y rounded border">
                  {entries.map(([key, val]) => (
                    <div key={key} className="px-3 py-2 flex items-center justify-between gap-3">
                      <span className="text-xs">{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <span className="text-xs font-semibold">{String(val)} / 10</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Client Notes */}
          {isApproved && approval.client_notes && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client Notes</p>
              <div className="rounded border bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                <p className="text-xs whitespace-pre-wrap">{approval.client_notes}</p>
              </div>
            </div>
          )}

          {/* Link to full view */}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link to={`/view-approval?id=${approval.id}`}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Full Details
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
