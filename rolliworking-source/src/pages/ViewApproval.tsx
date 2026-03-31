import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, AlertCircle, CheckCircle2, XCircle, ArrowLeft, ExternalLink, Archive, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { toast } from "sonner";

interface ApprovalItemData {
  id: string;
  label: string;
  price: number | null;
  choice: "yes" | "no" | null;
}

interface ApprovalRecord {
  id: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  approved_by_name: string | null;
  tc_agreed: boolean;
  tc_ip_address: string | null;
  tc_user_agent: string | null;
  approved_at: string | null;
  created_at: string;
  approval_items: ApprovalItemData[];
  polish_answers: Record<string, string | null> | null;
  question_answers: Record<string, string | null> | null;
}

interface InspectionRecord {
  id: string;
  inspection_type: string;
  job_type: string;
  notes: string | null;
  dial_condition: any;
  hands_condition: any;
  bezel_condition: any;
  crown_condition: any;
  case_condition: any;
  crystal_condition: any;
  bracelet_condition: any;
  watches: {
    brand: string;
    model: string | null;
    reference_number: string | null;
    estimate_number: string;
    target_date: string | null;
    customers: {
      name: string;
      email: string | null;
    };
  };
}

function buildSectionNotes(data: any): string[] {
  if (!data) return [];
  const notes: string[] = [];
  if (data.waiverRequired) notes.push("⚠ Waiver Required");
  if (Array.isArray(data.selectedNotes)) notes.push(...data.selectedNotes);
  if (data.customNote) notes.push(data.customNote);
  if (data.additionalNotes && Array.isArray(data.additionalNotes)) {
    data.additionalNotes.forEach((an: any) => {
      if (an.note) notes.push(an.note);
    });
  }
  return notes.filter(Boolean);
}

function sectionHasContent(data: any): boolean {
  if (!data) return false;
  const hasCondition = data.condition && data.condition !== "";
  const hasNotes = buildSectionNotes(data).length > 0;
  return hasCondition || hasNotes;
}

function formatCondition(condition: string): string {
  if (!condition) return "";
  return condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function ViewApproval() {
  usePageMeta({ title: "Approval Details • WatchFlow" });

  const [searchParams] = useSearchParams();
  const approvalId = searchParams.get("id");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  
  const [readStatusId, setReadStatusId] = useState<string | null>(null);
  const [editingPolish, setEditingPolish] = useState(false);
  const [editPolishValues, setEditPolishValues] = useState<Record<string, string | null>>({});
  const [savingPolish, setSavingPolish] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!approvalId) {
        setError("No approval ID provided");
        setLoading(false);
        return;
      }

      try {
        // Fetch approval record
        const { data: approvalData, error: approvalError } = await supabase
          .from("inspection_approvals")
          .select("*")
          .eq("id", approvalId)
          .single();

        if (approvalError || !approvalData) {
          setError("Approval not found");
          setLoading(false);
          return;
        }

        setApproval(approvalData as unknown as ApprovalRecord);

        // Fetch linked inspection with watch + customer
        const { data: inspectionData, error: inspectionError } = await supabase
          .from("inspections")
          .select(`
            *,
            watches!inner(
              *,
              customers!inner(*)
            )
          `)
          .eq("id", approvalData.inspection_id)
          .single();

        if (inspectionError || !inspectionData) {
          setError("Inspection not found");
          setLoading(false);
          return;
        }

        setInspection(inspectionData as unknown as InspectionRecord);

        // Fetch read/archive status for current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: rs } = await supabase
            .from("approval_read_status")
            .select("id, is_read, is_archived")
            .eq("approval_id", approvalId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (rs) {
            setReadStatusId(rs.id);
            if (rs.is_archived) setIsArchived(true);
          }
        }
      } catch (err: any) {
        console.error("Error fetching approval:", err);
        setError("Failed to load approval details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [approvalId]);

  const [isArchived, setIsArchived] = useState(false);

  const handleArchive = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !approvalId) return;
    try {
      const now = new Date().toISOString();
      if (readStatusId) {
        await supabase
          .from("approval_read_status")
          .update({ is_archived: true, archived_at: now, is_read: true, read_at: now, updated_at: now })
          .eq("id", readStatusId);
      } else {
        const { data } = await supabase
          .from("approval_read_status")
          .insert({ approval_id: approvalId, user_id: user.id, is_archived: true, archived_at: now, is_read: true, read_at: now })
          .select("id")
          .single();
        if (data) setReadStatusId(data.id);
      }
      setIsArchived(true);
      toast.success("Archived");
      navigate(-1);
    } catch {
      toast.error("Failed to archive");
    }
  };

  const handleStartEditPolish = () => {
    const current = approval?.polish_answers || {};
    // Pre-populate with existing values or defaults based on inspection
    const defaults: Record<string, string | null> = { ...current as Record<string, string | null> };
    const braceletRepair = inspection?.bracelet_condition?.repair_details;
    if (braceletRepair?.includeBandPolishQuestion && !defaults["bracelet_polish_scale"]) {
      defaults["bracelet_polish_scale"] = null;
    }
    setEditPolishValues(defaults);
    setEditingPolish(true);
  };

  const handleSavePolish = async () => {
    if (!approval || !approvalId) return;
    setSavingPolish(true);
    try {
      const { error: updateError } = await supabase
        .from("inspection_approvals")
        .update({ polish_answers: editPolishValues } as any)
        .eq("id", approvalId);
      if (updateError) throw updateError;
      setApproval({ ...approval, polish_answers: editPolishValues });
      setEditingPolish(false);
      toast.success("Polish preferences saved");
    } catch (err: any) {
      toast.error("Failed to save polish preferences");
    } finally {
      setSavingPolish(false);
    }
  };

  const renderSectionNotes = (title: string, data: any) => {
    if (!sectionHasContent(data)) return null;
    const notes = buildSectionNotes(data);
    const condition = data?.condition ? formatCondition(data.condition) : null;
    const price = data?.price || 0;
    const customNotePrice = data?.customNotePrice || 0;
    const additionalNotesTotal = (data?.additionalNotes || []).reduce(
      (sum: number, n: any) => sum + (n.price || 0),
      0
    );
    const totalPrice = price + customNotePrice + additionalNotesTotal;

    return (
      <tr key={title} className="border-b border-border last:border-0">
        <td className="py-3 pr-4 align-top">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </td>
        <td className="py-3 pr-4 align-top">
          {condition && (
            <span className="text-sm text-foreground font-medium">{condition}</span>
          )}
          {notes.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {notes.map((note, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {note.startsWith("⚠") ? (
                    <span className="text-amber-600 font-medium">{note}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground/50 mr-1.5">—</span>
                      {note}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </td>
        <td className="py-3 align-top text-right">
          {totalPrice > 0 && (
            <span className="text-sm font-semibold tabular-nums">
              ${totalPrice.toLocaleString()}
            </span>
          )}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !approval || !inspection) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-muted-foreground">{error || "Approval not found"}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/work-queue">← Back to Work Queue</Link>
          </Button>
        </div>
      </div>
    );
  }

  const watch = inspection.watches;
  const isBraceletOnly = inspection.inspection_type === "bracelet_only";
  const approvalItems = (approval.approval_items || []) as ApprovalItemData[];
  const approvedCount = approvalItems.filter(i => i.choice === "yes").length;
  const declinedCount = approvalItems.filter(i => i.choice === "no").length;
  const polishAnswers = approval.polish_answers || {};
  const questionAnswers = approval.question_answers || {};
  const braceletRepair = inspection.bracelet_condition?.repair_details;
  const hasPolishQuestion = braceletRepair?.includeBandPolishQuestion === true;
  const polishIsMissing = hasPolishQuestion && Object.keys(polishAnswers).length === 0;
  const isPreciousMetal = inspection.job_type === "gold_bracelet" ||
    (Array.isArray((inspection as any).job_types) && (inspection as any).job_types.includes("gold_bracelet"));
  const formatPolishLabel = (key: string) => {
    if (key === "bracelet_polish_scale") return "Bracelet Polish Scale";
    if (key === "courtesy_polish") return "Courtesy Polish";
    return key;
  };

  const formatPolishValue = (val: string | null) => {
    if (!val) return "—";
    if (val === "no_polish") return "No Polish — Clean Only";
    if (val === "yes") return "Yes";
    if (val === "no") return "No";
    const num = Number(val);
    if (!isNaN(num)) return `Level ${val}${num >= 8 ? " (+$250 Retail Polish)" : ""}`;
    return val;
  };

  const polishMin = isPreciousMetal ? 5 : 1;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Client Approval Details</h1>
          <p className="text-sm text-muted-foreground">
            Est# {watch.estimate_number} · {watch.brand} {watch.model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isArchived && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleArchive}>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          )}
          <Badge
            variant={approval.status === "approved" ? "default" : "secondary"}
            className={
              approval.status === "approved"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                : ""
            }
          >
            {approval.status === "approved" ? "Submitted" : approval.status}
          </Badge>
        </div>
      </div>

      {/* Approval Summary */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Submission Details
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Customer</p>
            <p className="font-medium">{watch.customers.name}</p>
            {watch.customers.email && (
              <p className="text-xs text-muted-foreground">{watch.customers.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved By</p>
            <p className="font-medium">{approval.approved_by_name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted At</p>
            <p className="font-medium">
              {approval.approved_at
                ? format(new Date(approval.approved_at), "MMM d, yyyy h:mm a")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">T&C Accepted</p>
            <p className="font-medium">{approval.tc_agreed ? "✅ Yes" : "❌ No"}</p>
          </div>
        </div>

        {/* Audit trail */}
        {(approval.tc_ip_address || approval.tc_user_agent) && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Audit Trail</summary>
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
              {approval.tc_ip_address && <p>IP: {approval.tc_ip_address}</p>}
              {approval.tc_user_agent && <p className="truncate">UA: {approval.tc_user_agent}</p>}
            </div>
          </details>
        )}
      </div>

      {/* Client Responses */}
      {approvalItems.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Client Responses
            </h2>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                {approvedCount} Approved
              </Badge>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                {declinedCount} Declined
              </Badge>
            </div>
          </div>
          <div className="divide-y">
            {approvalItems.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.label}</p>
                  {item.price !== null && item.price > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ${item.price.toLocaleString()}
                    </p>
                  )}
                </div>
                <div>
                  {item.choice === "yes" ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase">Yes</span>
                    </div>
                  ) : item.choice === "no" ? (
                    <div className="flex items-center gap-1.5 text-red-500">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase">No</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Polish Preferences — editable */}
      {(Object.keys(polishAnswers).length > 0 || hasPolishQuestion) && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              ⭐ Polish Preferences
            </h2>
            {!editingPolish ? (
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleStartEditPolish}>
                <Pencil className="h-3 w-3" />
                {Object.keys(polishAnswers).length > 0 ? "Edit" : "Add Polish"}
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingPolish(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSavePolish} disabled={savingPolish}>
                  {savingPolish ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            )}
          </div>

          {!editingPolish ? (
            /* Read-only view */
            <div className="divide-y">
              {Object.keys(polishAnswers).length > 0 ? (
                Object.entries(polishAnswers).map(([key, val]) => (
                  <div key={key} className="px-5 py-3 flex items-center justify-between gap-4">
                    <span className="text-sm">{formatPolishLabel(key)}</span>
                    <span className="text-sm font-semibold">{formatPolishValue(val)}</span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-amber-600 font-medium">⚠ Polish question was shown to client but no answer was recorded.</p>
                </div>
              )}
            </div>
          ) : (
            /* Edit mode — polish scale */
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bracelet Polish Scale</p>
                <div className="space-y-2">
                  {!isPreciousMetal && (
                    <button
                      type="button"
                      onClick={() => setEditPolishValues(prev => ({ ...prev, bracelet_polish_scale: "no_polish" }))}
                      className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                        editPolishValues.bracelet_polish_scale === "no_polish"
                          ? "bg-muted border-foreground/30 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/20"
                      }`}
                    >
                      No Polish — Clean Only
                    </button>
                  )}
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${10 - polishMin + 1}, minmax(0, 1fr))` }}>
                    {Array.from({ length: 10 - polishMin + 1 }, (_, i) => i + polishMin).map((num) => {
                      const isSelected = editPolishValues.bracelet_polish_scale === String(num);
                      const isPaid = num >= 8;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setEditPolishValues(prev => ({ ...prev, bracelet_polish_scale: String(num) }))}
                          className={`py-3 rounded text-sm font-bold border transition-all ${
                            isSelected
                              ? isPaid
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "bg-primary border-primary text-primary-foreground"
                              : isPaid
                                ? "border-amber-200 text-amber-700 hover:border-amber-400 dark:border-amber-800 dark:text-amber-400"
                                : "border-border text-muted-foreground hover:border-foreground/30"
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                    <span>{polishMin <= 2 ? "Vintage" : ""}</span>
                    <span>Free ({polishMin}-7)</span>
                    <span className="text-amber-600 font-medium">+$250 (8-10)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Client Question Answers — only show questions that were actually answered */}
      {Object.entries(questionAnswers).filter(([, val]) => val !== null && val !== undefined).length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Client Questions
            </h2>
          </div>
          <div className="divide-y">
            {Object.entries(questionAnswers)
              .filter(([, val]) => val !== null && val !== undefined)
              .map(([key, val]) => (
              <div key={key} className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-sm">{key}</span>
                <span className="text-sm font-semibold">
                  {val === "yes" ? "✅ Yes" : val === "no" ? "❌ No" : String(val || "—")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Notes */}
      {(approval as any).client_notes && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b bg-amber-50/30 dark:bg-amber-900/10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              📝 Client Notes & Requests
            </h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{(approval as any).client_notes}</p>
          </div>
        </div>
      )}

      {/* Inspection Findings */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Inspection Findings — {isBraceletOnly ? "Bracelet Only" : "Complete Watch"}
          </h2>
        </div>
        <div className="px-5 py-3">
          <table className="w-full">
            <tbody>
              {!isBraceletOnly && (
                <>
                  {renderSectionNotes("Dial", inspection.dial_condition)}
                  {renderSectionNotes("Hands", inspection.hands_condition)}
                  {renderSectionNotes("Bezel", inspection.bezel_condition)}
                  {renderSectionNotes("Crown", inspection.crown_condition)}
                  {renderSectionNotes("Case", inspection.case_condition)}
                  {renderSectionNotes("Crystal", inspection.crystal_condition)}
                </>
              )}
              {renderSectionNotes("Bracelet", inspection.bracelet_condition)}
            </tbody>
          </table>

          {inspection.notes && (
            <div className="mt-4 p-4 bg-muted/50 rounded border">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">
                Additional Notes
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {inspection.notes}
              </p>
            </div>
          )}

          {!sectionHasContent(inspection.dial_condition) &&
           !sectionHasContent(inspection.hands_condition) &&
           !sectionHasContent(inspection.bezel_condition) &&
           !sectionHasContent(inspection.crown_condition) &&
           !sectionHasContent(inspection.case_condition) &&
           !sectionHasContent(inspection.crystal_condition) &&
           !sectionHasContent(inspection.bracelet_condition) &&
           !inspection.notes && (
            <p className="text-sm text-muted-foreground py-4">No inspection findings recorded.</p>
          )}
        </div>
      </div>

      {/* Link to public approval page */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://app.rolliworks.com/approve-inspection?id=${approval.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View Client Page
          </a>
        </Button>
      </div>
    </div>
  );
}
