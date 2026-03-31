import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Loader2, AlertCircle, ClipboardCheck, Shield, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApprovalTranslations, translateCondition, translateSectionTitle, translateNote, getHardcodedNoteKeys, type ApprovalLang } from "@/lib/approval-translations";

interface ApprovalItemData {
  id: string;
  label: string;
  price: number | null;
  description?: string | null;
  choice: "yes" | "no" | null;
}

interface ClientQuestion {
  key: string;
  label: string;
  description: string | null;
  required_for_submission: boolean;
  render_as_scale: boolean;
}

interface InspectionData {
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

interface ApprovalData {
  id: string;
  status: string;
  client_name: string | null;
  approval_items: ApprovalItemData[];
  approved_by_name: string | null;
  tc_agreed: boolean;
}

// A grouped inspection entry
interface GroupedInspection {
  approval: ApprovalData;
  inspection: InspectionData;
}

const WELDING_WARNING = "⚠ POLISHING WILL BE REQUIRED IF WELDING IS DONE — selecting YES means polish cannot be declined.";

function getApprovalItemDescription(item: Partial<ApprovalItemData> & { label?: string | null; description?: string | null }) {
  if (item.description) return item.description;
  const label = item.label?.toUpperCase() || "";
  if (label.includes("STEEL SIDE") || label.includes("STEEL CENTER") || label.includes("GOLD CENTER")) {
    return WELDING_WARNING;
  }
  return null;
}

function formatCondition(condition: string, lang: ApprovalLang = "en"): string {
  if (!condition) return "";
  return translateCondition(condition, lang);
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

export default function ApproveInspection() {
  usePageMeta({ title: "Inspection Report | Rolliworks" });

  const [searchParams] = useSearchParams();
  const approvalId = searchParams.get("id");
  const groupId = searchParams.get("group");
  const langParam = (searchParams.get("lang") || "en") as ApprovalLang;
  const lang = langParam === "es" ? "es" : "en";
  const t = getApprovalTranslations(lang);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [approvalItems, setApprovalItems] = useState<ApprovalItemData[]>([]);
  const [approvedByName, setApprovedByName] = useState("");
  const [tcAgreed, setTcAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [waiverData, setWaiverData] = useState<any>(null);
  const [waiverAcknowledged, setWaiverAcknowledged] = useState(false);
  
  const [clientQuestions, setClientQuestions] = useState<ClientQuestion[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, "yes" | "no" | null>>({});
  const [clientNotes, setClientNotes] = useState("");
  
  // Group mode state
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupedInspections, setGroupedInspections] = useState<GroupedInspection[]>([]);
  
  // AI-powered translation map for custom notes (lang=es only)
  const [noteTranslations, setNoteTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchApproval = async () => {
      if (!approvalId && !groupId) {
        setError("Invalid approval link");
        setLoading(false);
        return;
      }

      try {
        const body: any = {};
        if (groupId) {
          body.groupId = groupId;
        } else {
          body.approvalId = approvalId;
        }

        const { data, error: fetchError } = await supabase.functions.invoke(
          "get-inspection-approval",
          { body }
        );

        if (fetchError) throw fetchError;
        if (!data?.approval) {
          setError("Approval not found");
          setLoading(false);
          return;
        }

        // Handle group mode
        if (data.isGroup && Array.isArray(data.inspections) && data.inspections.length > 0) {
          setIsGroupMode(true);
          setGroupedInspections(data.inspections);
          
          // Check if all are already completed
          const allApprovals = data.approvals || [];
          const allCompleted = allApprovals.every((a: any) => a.status !== "pending");
          if (allCompleted) {
            setCompleted(true);
            setApproval(data.approval);
            setInspection(data.inspections[0]?.inspection || data.inspection);
            setLoading(false);
            return;
          }
        }

        if (!data.isGroup && data.approval.status !== "pending") {
          setCompleted(true);
          setApproval(data.approval);
          setInspection(data.inspection);
          setLoading(false);
          return;
        }

        setApproval(data.approval);
        setInspection(data.inspection);
        if (data.waiver) {
          setWaiverData(data.waiver);
        }

        // Load client-facing questions from DB
        if (Array.isArray(data.clientQuestions)) {
          setClientQuestions(data.clientQuestions);
          const initialAnswers: Record<string, "yes" | "no" | null> = {};
          data.clientQuestions.forEach((q: ClientQuestion) => {
            // In group mode, scale questions get per-item keys
            if (q.render_as_scale && data.isGroup && data.inspections?.length > 1) {
              data.inspections.forEach((gi: any) => {
                initialAnswers[`${q.key}__${gi.approval.id}`] = null;
              });
            } else {
              initialAnswers[q.key] = null;
            }
          });
          setQuestionAnswers(initialAnswers);
        }

        // For group mode, collect approval items from all inspections
        if (data.isGroup && data.inspections) {
          const allItems: ApprovalItemData[] = [];
          data.inspections.forEach((gi: any, idx: number) => {
            const items = gi.approval?.approval_items || [];
            const braceletModel = gi.inspection?.watches?.model || `Bracelet ${idx + 1}`;
            items.forEach((item: any) => {
              allItems.push({
                ...item,
                description: getApprovalItemDescription(item),
                // Prefix item label with bracelet identifier for clarity
                label: data.inspections.length > 1 ? `[${braceletModel}] ${item.label}` : item.label,
                choice: item.choice || null,
                // Tag with source approval ID so submission can filter per-approval
                _approvalId: gi.approval.id,
              });
            });
          });
          setApprovalItems(allItems);
        } else if (Array.isArray(data.approval.approval_items) && data.approval.approval_items.length > 0) {
          setApprovalItems(
            data.approval.approval_items.map((item: any) => ({
              ...item,
              description: getApprovalItemDescription(item),
              choice: item.choice || null,
            }))
          );
        }
      } catch (err: any) {
        console.error("Error fetching approval:", err);
        setError("Failed to load approval");
      } finally {
        setLoading(false);
      }
    };

    fetchApproval();
  }, [approvalId, groupId]);

  // AI-translate custom notes when lang=es
  useEffect(() => {
    if (lang !== "es" || !inspection) return;

    const hardcoded = getHardcodedNoteKeys();
    const allNotes: string[] = [];

    const collectNotes = (data: any) => {
      if (!data) return;
      if (data.customNote) allNotes.push(data.customNote);
      if (Array.isArray(data.additionalNotes)) {
        data.additionalNotes.forEach((an: any) => {
          if (an.note) allNotes.push(an.note);
        });
      }
      // selectedNotes that aren't in the hardcoded map
      if (Array.isArray(data.selectedNotes)) {
        data.selectedNotes.forEach((n: string) => {
          if (!hardcoded.has(n)) allNotes.push(n);
        });
      }
    };

    const sections = [
      inspection.dial_condition, inspection.hands_condition,
      inspection.bezel_condition, inspection.crown_condition,
      inspection.case_condition, inspection.crystal_condition,
      inspection.bracelet_condition,
    ];
    sections.forEach(collectNotes);

    // Also collect from grouped inspections
    if (groupedInspections.length > 0) {
      groupedInspections.forEach((gi) => {
        const insp = gi.inspection;
        [insp.dial_condition, insp.hands_condition, insp.bezel_condition,
         insp.crown_condition, insp.case_condition, insp.crystal_condition,
         insp.bracelet_condition].forEach(collectNotes);
      });
    }

    // Also the general notes field
    if (inspection.notes) allNotes.push(inspection.notes);

    // De-duplicate and filter out empties
    const unique = [...new Set(allNotes.filter(Boolean))];
    if (unique.length === 0) return;

    const doTranslate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("translate-notes", {
          body: { notes: unique, targetLang: "es" },
        });
        if (error || !data?.translations) return;
        const map: Record<string, string> = {};
        unique.forEach((note, i) => {
          if (data.translations[i] && data.translations[i] !== note) {
            map[note] = data.translations[i];
          }
        });
        if (Object.keys(map).length > 0) {
          setNoteTranslations(map);
        }
      } catch (err) {
        console.warn("Note translation failed, showing originals:", err);
      }
    };

    doTranslate();
  }, [lang, inspection, groupedInspections]);

  const handleItemChoice = (itemId: string, choice: "yes" | "no") => {
    setApprovalItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, choice } : item
      )
    );
  };

  // All questions come from rules engine — no hardcoded filtering
  const filteredClientQuestions = clientQuestions;

  const allItemsAnswered = approvalItems.every((item) => item.choice !== null);
  // For group mode scale questions, check per-item required answers
  const requiredQuestionsAnswered = filteredClientQuestions
    .filter((q) => q.required_for_submission)
    .every((q) => {
      if (q.render_as_scale && isGroupMode && groupedInspections.length > 1) {
        // Every per-item key must be answered
        return groupedInspections.every((gi) => {
          const key = `${q.key}__${gi.approval.id}`;
          return questionAnswers[key] !== null && questionAnswers[key] !== undefined;
        });
      }
      return questionAnswers[q.key] !== null && questionAnswers[q.key] !== undefined;
    });
  const waiverRequired = !!waiverData && waiverData.status !== "completed";
  const canSubmit = tcAgreed && approvedByName.trim().length >= 2 && allItemsAnswered && requiredQuestionsAnswered && (!waiverRequired || waiverAcknowledged);

  /** Build dynamic waiver concern details from inspection condition sections */
  const getWaiverSections = () => {
    if (!inspection) return [];
    const sections: { title: string; condition: string | null; notes: string[] }[] = [];
    
    const checkSection = (title: string, data: any) => {
      if (!data || !data.waiverRequired) return;
      const rawNotes = buildSectionNotes(data);
      const condition = data.condition ? formatCondition(data.condition) : null;
      const notes = rawNotes.filter(n => !n.startsWith("⚠"));
      sections.push({ title, condition, notes });
    };

    checkSection("Dial", inspection.dial_condition);
    checkSection("Hands", inspection.hands_condition);
    return sections;
  };

  const waiverSections = waiverRequired ? getWaiverSections() : [];
  const waiverPartsLabel = waiverSections.map(s => s.title).join(" & ");

  const handleSubmit = async () => {
    if (!canSubmit || !approval) return;

    setSubmitting(true);

    try {
      // Only submit question answers for questions that were actually shown to the client
      const filteredKeys = new Set(filteredClientQuestions.map((q) => q.key));
      const cleanedQuestionAnswers: Record<string, "yes" | "no" | null> = {};
      Object.entries(questionAnswers).forEach(([key, val]) => {
        // Include both base keys and per-item keys (Q2__uuid format)
        const baseKey = key.split("__")[0];
        if (filteredKeys.has(key) || filteredKeys.has(baseKey)) cleanedQuestionAnswers[key] = val;
      });

      // Extract scale answers into polishAnswers for backward compat
      const derivedPolishAnswers: Record<string, string | null> = {};
      Object.entries(cleanedQuestionAnswers).forEach(([key, val]) => {
        const baseKey = key.split("__")[0];
        const q = filteredClientQuestions.find((cq) => cq.key === baseKey);
        if (q?.render_as_scale && val != null) {
          derivedPolishAnswers[key] = String(val);
        }
      });

      const submitBody: any = {
        approvedByName: approvedByName.trim(),
        tcAgreed: true,
        waiverAcknowledged: waiverRequired && waiverAcknowledged,
        approvalItems,
        polishAnswers: derivedPolishAnswers,
        questionAnswers: cleanedQuestionAnswers,
        clientNotes: clientNotes.trim() || null,
      };

      // Use groupId for group mode, approvalId for single mode
      if (isGroupMode && groupId) {
        submitBody.groupId = groupId;
      } else {
        submitBody.approvalId = approval.id;
      }

      const { data, error: submitError } = await supabase.functions.invoke(
        "submit-inspection-approval",
        { body: submitBody }
      );

      if (submitError) throw submitError;
      if (data?.error) throw new Error(data.error);

      setCompleted(true);
      toast.success("Approval submitted successfully!");
    } catch (err: any) {
      console.error("Error submitting approval:", err);
      toast.error(err.message || "Failed to submit approval");
    } finally {
      setSubmitting(false);
    }
  };

  /** Render a single inspection section row */
  const renderSectionNotes = (title: string, data: any) => {
    if (!sectionHasContent(data)) return null;
    const notes = buildSectionNotes(data).map((n) => translateNote(n, lang, noteTranslations));
    const condition = data?.condition ? formatCondition(data.condition, lang) : null;
    const translatedTitle = translateSectionTitle(title, lang);
    const price = data?.price || 0;
    const customNotePrice = data?.customNotePrice || 0;
    const additionalNotesTotal = (data?.additionalNotes || []).reduce(
      (sum: number, n: any) => sum + (n.price || 0),
      0
    );
    const restorePrice = data?.restore_price || 0;
    const totalPrice = price + customNotePrice + additionalNotesTotal + restorePrice;

    const extraNotes = [...notes];
    if (restorePrice > 0) {
      extraNotes.push(`${lang === "es" ? "Restauración de Caja Retail" : "Retail Case Restoration"}: $${restorePrice.toLocaleString()}`);
    }

    return (
      <tr key={title} className="border-b border-stone-200 last:border-0">
        <td className="py-3 pr-4 align-top">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {translatedTitle}
          </span>
        </td>
        <td className="py-3 pr-4 align-top">
          {condition && (
            <span className="text-sm text-stone-700 font-medium">{condition}</span>
          )}
          {extraNotes.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {extraNotes.map((note, i) => (
                <li key={i} className="text-sm text-stone-600 leading-relaxed">
                  {note.startsWith("⚠") ? (
                    <span className="text-amber-700 font-medium">{note}</span>
                  ) : (
                    <>
                      <span className="text-stone-400 mr-1.5">—</span>
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
            <span className="text-sm font-semibold text-stone-800 tabular-nums">
              ${totalPrice.toLocaleString()}
            </span>
          )}
        </td>
      </tr>
    );
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400 mx-auto" />
          <p className="mt-3 text-sm text-stone-500 tracking-wide">{t.loadingReport}</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error || !approval || !inspection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-stone-200 p-8 text-center shadow-sm">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-stone-800">{t.unableToLoad}</h2>
          <p className="text-stone-500">{error || t.approvalNotFound}</p>
        </div>
      </div>
    );
  }

  // ─── Completed ───
  if (completed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="bg-[#1a1a2e] px-8 py-6 text-center">
            <h1 className="text-xl font-bold text-[#c9a94e] tracking-[0.2em]">ROLLIWORKS</h1>
          </div>
          <div className="p-8 text-center">
            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-stone-800">{t.approvalReceived}</h2>
            <p className="text-stone-500 mb-6">
              {t.thankYouText(isGroupMode, groupedInspections.length)}
            </p>
            <div className="text-sm text-stone-500 space-y-1">
              <p className="font-medium text-stone-700">
                {inspection.watches.brand} {inspection.watches.model}
              </p>
              <p>Estimate #{inspection.watches.estimate_number}</p>
              {isGroupMode && (
                <p className="text-xs text-stone-400">{t.itemsApproved(groupedInspections.length)}</p>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isBraceletOnly = inspection.inspection_type === "bracelet_only";
  const watch = inspection.watches;
  const customerFirstName = watch.customers.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Branded Header ─── */}
      <header className="bg-[#1a1a2e] text-center py-8">
        <h1 className="text-2xl font-bold text-[#c9a94e] tracking-[0.25em]">ROLLIWORKS</h1>
        <div className="mt-2 flex items-center justify-center gap-8 text-[11px] text-stone-400 tracking-wider uppercase">
          <span>Est. Miami, FL</span>
          <span className="w-px h-3 bg-stone-600" />
          <span>{t.horologicalServices}</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* ─── Greeting & Watch Info ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="border-b border-stone-100 px-6 py-5">
            <p className="text-stone-700 leading-relaxed">
              {t.dear} {customerFirstName},
            </p>
            <p className="text-stone-600 mt-2 leading-relaxed text-sm">
              {t.greetingText(isGroupMode)}
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-stone-100">
            <div className="px-6 py-4">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">
                {isGroupMode ? t.items : t.timepiece}
              </p>
              {isGroupMode ? (
                <div className="space-y-1">
                  {groupedInspections.map((gi, idx) => (
                    <p key={idx} className="text-sm font-semibold text-stone-800">
                      {gi.inspection.watches.model || `Bracelet ${idx + 1}`}
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-stone-800">
                    {watch.brand} {watch.model}
                  </p>
                  {watch.reference_number && (
                    <p className="text-xs text-stone-500 mt-0.5">Ref. {watch.reference_number}</p>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4">
              <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">{t.estimateNo}</p>
              <p className="text-sm font-semibold text-stone-800">{watch.estimate_number}</p>
              {watch.target_date && (
                <p className="text-xs text-stone-500 mt-0.5">
                  {t.target}: {format((() => { const [y,m,d] = watch.target_date!.split("-").map(Number); return new Date(y, m-1, d); })(), "MMMM d, yyyy")}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ─── Inspection Findings ─── */}
        {isGroupMode && groupedInspections.length > 1 ? (
          // GROUP MODE: Show each bracelet's findings separately
          groupedInspections.map((gi, idx) => (
            <section key={idx} className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
                  {gi.inspection.watches.model || `${t.bracelet} ${idx + 1}`} — {t.findings}
                </h2>
              </div>
              <div className="px-6 py-2">
                <table className="w-full">
                  <tbody>
                    {renderSectionNotes("Bracelet", gi.inspection.bracelet_condition)}
                  </tbody>
                </table>
                {gi.inspection.notes && (
                  <div className="mt-4 mb-4 p-4 bg-stone-50 rounded border border-stone-100">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1.5">
                      {t.additionalNotes}
                    </p>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                      {noteTranslations[gi.inspection.notes] || gi.inspection.notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))
        ) : (
          // SINGLE MODE: Original findings display
          <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
                {t.inspectionFindings} — {isBraceletOnly ? t.braceletOnly : t.completeWatch}
              </h2>
            </div>
            <div className="px-6 py-2">
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
                <div className="mt-4 mb-4 p-4 bg-stone-50 rounded border border-stone-100">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1.5">
                    {t.additionalNotes}
                  </p>
                  <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {noteTranslations[inspection.notes!] || inspection.notes}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── Approval Survey ─── */}
        {approvalItems.length > 0 && (
          <section className="bg-white rounded-lg border-2 border-[#c9a94e]/40 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#c9a94e]/20 bg-[#c9a94e]/5">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-[#c9a94e]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-700">
                  {t.yourResponseRequired}
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {t.selectYesOrNo}
              </p>
            </div>
            <div className="divide-y divide-stone-100">
              {approvalItems.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="text-sm text-stone-800 flex-1 leading-relaxed">
                      {item.label}
                    </p>
                    {item.price !== null && item.price > 0 && (
                      <span className="text-xs font-semibold text-stone-500 tabular-nums whitespace-nowrap">
                        ${item.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-amber-800 italic leading-relaxed mb-3 bg-amber-50 border border-amber-200 rounded p-2">
                      {item.description}
                    </p>
                  )}
                  {!item.description && <div className="mb-2" />}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleItemChoice(item.id, "yes")}
                      className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                        item.choice === "yes"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600"
                      }`}
                    >
                      {t.yesApprove}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleItemChoice(item.id, "no")}
                      className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                        item.choice === "no"
                          ? "bg-stone-700 border-stone-700 text-white shadow-sm"
                          : "border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700"
                      }`}
                    >
                      {t.noDecline}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Client Questions (Yes/No) ─── */}
        {filteredClientQuestions.length > 0 && (
          <section className="bg-white rounded-lg border-2 border-[#c9a94e]/40 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#c9a94e]/20 bg-[#c9a94e]/5">
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-[#c9a94e]" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-700">
                  {t.yourPreferences}
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {t.selectYesOrNoQuestion}
              </p>
            </div>
            <div className="divide-y divide-stone-100">
              {filteredClientQuestions.map((q) => {
                // In group mode with multiple items, scale questions render per-item
                const isPerItemScale = q.render_as_scale && isGroupMode && groupedInspections.length > 1;

                const renderScale = (answerKey: string, itemLabel?: string) => {
                  const qScaleMin = q.key === "Q4" ? 5 : 1;
                  return (
                    <div className="space-y-3" key={answerKey}>
                      {itemLabel && (
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-500 bg-stone-50 rounded px-3 py-1.5 border border-stone-100">
                          {itemLabel}
                        </p>
                      )}
                      {q.description && !itemLabel && (
                        <p className="text-xs text-stone-500 leading-relaxed mb-1">
                          {q.key === "Q4"
                            ? "Each band rebuild comes with 30 mins courtesy polish in our polish room at no cost. Please let us know how you expect the polish to look on a scale of 5-10 (10 being new). 5 = Freshened up a bit · 7 = New-ish · 8-10 = As new as possible (Retail polish at $250)"
                            : q.description}
                        </p>
                      )}
                      {qScaleMin <= 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setQuestionAnswers((prev) => ({ ...prev, [answerKey]: "no" as const }))}
                            className={`w-full py-3 rounded text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                              questionAnswers[answerKey] === "no"
                                ? "bg-stone-700 border-stone-700 text-white shadow-sm"
                                : "border-stone-300 text-stone-600 hover:border-stone-500 hover:text-stone-800"
                            }`}
                          >
                            {t.noPolishCleanOnly}
                          </button>
                          <div className="relative flex items-center gap-2">
                            <div className="flex-1 border-t border-stone-200" />
                            <span className="text-[10px] text-stone-400 uppercase tracking-wider">{t.orSelectLevel}</span>
                            <div className="flex-1 border-t border-stone-200" />
                          </div>
                        </>
                      )}
                      {!itemLabel && (
                        <div className="text-[11px] text-stone-500 leading-relaxed px-1 space-y-0.5">
                          {qScaleMin <= 1 && <p><span className="font-semibold text-stone-600">1–2</span> = Vintage looking</p>}
                          {qScaleMin <= 3 && <p><span className="font-semibold text-stone-600">{qScaleMin >= 3 ? `${qScaleMin}–5` : "3–5"}</span> = Freshened up a bit{qScaleMin <= 1 ? " but vintage" : ""}</p>}
                          {qScaleMin >= 5 && <p><span className="font-semibold text-stone-600">5</span> = Freshened up a bit</p>}
                          <p><span className="font-semibold text-stone-600">7</span> = New-ish</p>
                          <p><span className="font-semibold text-amber-600">8–10</span> = As new as possible. <span className="text-amber-600 font-medium">This becomes a Retail polish at a cost of $250</span></p>
                        </div>
                      )}
                      <div className={`grid gap-1 ${qScaleMin >= 5 ? "grid-cols-6" : "grid-cols-10"}`}>
                        {Array.from({ length: 10 - qScaleMin + 1 }, (_, i) => i + qScaleMin).map((num) => {
                          const isSelected = questionAnswers[answerKey] === String(num);
                          const isPaid = num >= 8;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setQuestionAnswers((prev) => ({ ...prev, [answerKey]: String(num) as any }))}
                              className={`py-2.5 rounded text-xs font-bold border transition-all ${
                                isSelected
                                  ? isPaid
                                    ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                                    : "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                  : isPaid
                                    ? "border-amber-200 text-amber-600 hover:border-amber-400"
                                    : "border-stone-200 text-stone-600 hover:border-stone-400"
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400 px-1">
                        <span>{qScaleMin >= 5 ? "Freshened up" : "Vintage look"}</span>
                        <span>Free ({qScaleMin}-7)</span>
                        <span className="text-amber-600 font-medium">+$250 (8-10)</span>
                      </div>
                      {questionAnswers[answerKey] !== undefined && questionAnswers[answerKey] !== null && (
                        <p className="text-xs text-stone-600 mt-1 font-medium">
                          Selected: <strong>{questionAnswers[answerKey] === "no" ? "No Polish — Clean Only" : questionAnswers[answerKey]}</strong>
                          {Number(questionAnswers[answerKey]) >= 8 && (
                            <span className="text-amber-600 ml-1">(+$250 Retail Polish)</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                };

                return (
                  <div key={q.key} className="px-6 py-5">
                    <div className="flex items-start gap-2 mb-1">
                      <p className="text-sm font-semibold text-stone-800">{q.label}</p>
                      {q.required_for_submission && (
                        <span className="text-red-400 text-xs font-bold">*</span>
                      )}
                    </div>
                    {q.description && !q.render_as_scale && (
                      <p className="text-xs text-stone-500 leading-relaxed mb-4">{q.description}</p>
                    )}

                    {isPerItemScale ? (
                      <div className="space-y-6">
                        {q.description && (
                          <p className="text-xs text-stone-500 leading-relaxed mb-1">
                            {q.key === "Q4"
                              ? "Each band rebuild comes with 30 mins courtesy polish in our polish room at no cost. Please let us know how you expect the polish to look on a scale of 5-10 (10 being new). 5 = Freshened up a bit · 7 = New-ish · 8-10 = As new as possible (Retail polish at $250)"
                              : q.description}
                          </p>
                        )}
                        <div className="text-[11px] text-stone-500 leading-relaxed px-1 space-y-0.5">
                          {q.key !== "Q4" && <p><span className="font-semibold text-stone-600">1–2</span> = Vintage looking</p>}
                          {q.key !== "Q4" && <p><span className="font-semibold text-stone-600">3–5</span> = Freshened up a bit but vintage</p>}
                          {q.key === "Q4" && <p><span className="font-semibold text-stone-600">5</span> = Freshened up a bit</p>}
                          <p><span className="font-semibold text-stone-600">7</span> = New-ish</p>
                          <p><span className="font-semibold text-amber-600">8–10</span> = As new as possible. <span className="text-amber-600 font-medium">This becomes a Retail polish at a cost of $250</span></p>
                        </div>
                        {groupedInspections.map((gi, idx) => {
                          const answerKey = `${q.key}__${gi.approval.id}`;
                          const itemLabel = gi.inspection.watches.model || `Bracelet ${idx + 1}`;
                          return renderScale(answerKey, itemLabel);
                        })}
                      </div>
                    ) : q.render_as_scale ? (
                      renderScale(q.key)
                    ) : (
                      /* Standard Yes/No */
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.key]: "yes" }))}
                          className={`flex-1 py-2.5 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                            questionAnswers[q.key] === "yes"
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : "border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600"
                          }`}
                        >
                          {t.yes}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.key]: "no" }))}
                          className={`flex-1 py-2.5 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                            questionAnswers[q.key] === "no"
                              ? "bg-stone-700 border-stone-700 text-white shadow-sm"
                              : "border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700"
                          }`}
                        >
                          {t.no}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}



        {waiverRequired && (
          <section className="bg-white rounded-lg border-2 border-amber-400/50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <FileWarning className="h-4 w-4 text-amber-600" />
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-700">
                  {t.liabilityWaiver}
                </h2>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {t.waiverIntro(waiverPartsLabel)}
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {waiverSections.map((section) => (
                <div key={section.title} className="bg-amber-50/70 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-700">{section.title}</p>
                    {section.condition && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                        Condition: {section.condition}
                      </span>
                    )}
                  </div>
                  {section.notes.length > 0 ? (
                    <ul className="space-y-1.5">
                      {section.notes.map((note, i) => (
                        <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5 shrink-0">—</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-800">Pre-existing condition noted</p>
                  )}
                </div>
              ))}

              {waiverSections.length === 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-amber-800">Pre-existing condition</p>
                </div>
              )}

              <div className="rounded border border-stone-200 p-4 space-y-3 bg-stone-50/50 text-sm text-stone-700">
                <p>{t.waiverUnderstand(waiverPartsLabel)}</p>
                <p className="font-medium">{t.waiverFurtherUnderstand}</p>
                <ol className="space-y-2 list-decimal list-inside text-stone-600">
                  <li><strong>{t.waiverPreExisting}</strong> — The damage to the {waiverPartsLabel || "noted part(s)"} has been disclosed and acknowledged by both the customer and Rolliworks.</li>
                  <li><strong>{t.waiverLimitationOfLiability}</strong> — Rolliworks will take reasonable care during the repair process, but due to the fragile nature of the {waiverPartsLabel || "above noted part(s)"} and its existing damage, the company will not be held responsible for any additional cracking, chipping, fading, scratching, or other damage that may occur during a responsible and careful service process.</li>
                  <li><strong>{t.waiverCustomerAcceptance}</strong> — I accept full responsibility for the pre-existing condition of the {waiverPartsLabel || "above noted part(s)"} and release Rolliworks, its employees, and representatives from any liability relating to the condition during or after service.</li>
                </ol>
              </div>

              <div className="flex items-start space-x-3 rounded border-2 border-amber-300 p-4 bg-amber-50/30">
                <Checkbox
                  id="waiver-acknowledge"
                  checked={waiverAcknowledged}
                  onCheckedChange={(checked) => setWaiverAcknowledged(checked === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="waiver-acknowledge"
                  className="text-sm cursor-pointer leading-relaxed text-stone-700 font-medium"
                >
                  {t.waiverAcknowledgeText(waiverPartsLabel)}{" "}
                  <span className="text-red-400">*</span>
                </Label>
              </div>
            </div>
          </section>
        )}

        {/* ─── Client Notes & Requests ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="h-4 w-4 text-stone-400" />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
                {t.notesAndRequests}
              </h2>
              <span className="text-[10px] text-stone-400 italic">{t.optional}</span>
            </div>
          </div>
          <div className="px-6 py-5">
            <textarea
              placeholder={t.notesPlaceholder}
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value.slice(0, 1000))}
              rows={4}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-[#c9a94e] focus:ring-1 focus:ring-[#c9a94e]/20 focus:outline-none resize-y"
            />
            <p className="text-[10px] text-stone-400 mt-1 text-right">{clientNotes.length}/1000</p>
          </div>
        </section>

        {/* ─── Authorization & Submit ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-stone-400" />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">
                {t.authorization}
              </h2>
            </div>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="approve-name" className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {t.fullName} <span className="text-red-400">*</span>
              </Label>
              <Input
                id="approve-name"
                placeholder={t.typeFullLegalName}
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                className="h-12 text-base border-stone-300 focus:border-[#c9a94e] focus:ring-[#c9a94e]/20"
              />
            </div>

            <div className="flex items-start space-x-3 rounded border border-stone-200 p-4 bg-stone-50/50">
              <Checkbox
                id="tc-agree"
                checked={tcAgreed}
                onCheckedChange={(checked) => setTcAgreed(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="tc-agree"
                className="text-sm cursor-pointer leading-relaxed text-stone-700"
              >
                {t.serviceAgreementText}{" "}
                <a
                  href="https://www.rolliworks.com/serviceagreement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c9a94e] underline underline-offset-2 hover:text-[#b89840] font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t.serviceAgreement}
                </a>
                . <span className="text-red-400">*</span>
              </Label>
            </div>

            {!allItemsAnswered && (
              <p className="text-xs text-amber-600 font-medium tracking-wide">
                {t.answerAllQuestions}
              </p>
            )}




            {clientQuestions.some((q) => q.required_for_submission) && !requiredQuestionsAnswered && (
              <p className="text-xs text-amber-600 font-medium tracking-wide">
                {t.answerRequiredPreferences}
              </p>
            )}

            {waiverRequired && !waiverAcknowledged && (
              <p className="text-xs text-amber-600 font-medium tracking-wide">
                {t.acknowledgeWaiver}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full h-12 bg-[#1a1a2e] hover:bg-[#2a2a3e] text-white font-semibold tracking-wider uppercase text-xs disabled:opacity-40"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.processing}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t.approveAndSubmit}
                </>
              )}
            </Button>

            {!canSubmit && !submitting && (
              <p className="text-[11px] text-stone-400 text-center tracking-wide">
                {t.completeAllFields}
              </p>
            )}
          </div>
        </section>

        {/* ─── What Happens Next ─── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm px-6 py-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500 mb-3">
            {t.whatHappensNext}
          </h3>
          <div className="text-sm text-stone-600 leading-relaxed space-y-2">
            <p>{t.whatHappensNextText(isGroupMode)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded bg-stone-50 border border-stone-100">
                <p className="text-xs font-semibold text-stone-700 mb-1">{t.pickUpInPerson}</p>
                <p className="text-xs text-stone-500">{t.pickUpText}</p>
              </div>
              <div className="p-3 rounded bg-stone-50 border border-stone-100">
                <p className="text-xs font-semibold text-stone-700 mb-1">{t.shipping}</p>
                <p className="text-xs text-stone-500">{t.shippingText}</p>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-8 text-center space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Rolliworks</p>
      <p className="text-[11px] text-stone-400">14 N.E. 1st Ave, Suite 403 · Miami, FL 33132</p>
      <p className="text-[11px] text-stone-400">408-800-3244 · Mon–Fri 9am–5pm</p>
      <p className="text-[11px] text-stone-300 mt-2">
        © {new Date().getFullYear()} Rolliworks. All rights reserved.
      </p>
    </footer>
  );
}
