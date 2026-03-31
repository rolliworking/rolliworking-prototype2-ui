import * as React from "react";
import { format } from "date-fns";
import { Save, Mail, Printer, FileText, Download, Globe, Send, Languages } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { generateHtmlInspectionEmail, collectYesNoItems, countYesNoFlags } from "@/lib/html-email-generator";
import type { ExpandedInspectionFormData } from "./InspectionForm";
import type { BraceletRepairData } from "./BraceletRepairOptions";
import type { SectionConditionData, AdditionalNote } from "./InspectionSection";

interface InspectionReportProps {
  customerName: string;
  customerEmail: string;
  brand: string;
  model: string;
  referenceNumber: string;
  estimateNumber: string;
  targetDate: Date | null;
  inspection: ExpandedInspectionFormData;
  className?: string;
  onEmailSent?: () => void;
  onSaveForApproval?: () => Promise<string>;
  onResetAfterApproval?: () => void;
  useHtmlEmail?: boolean;
  inspectionId?: string | null;
}

const HOURLY_RATE = 98;

function formatCondition(condition: string): string {
  if (!condition) return "Not inspected";
  return condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helper to build notes array with additional notes formatted inline
function buildNotesWithAdditional(
  data: SectionConditionData,
  extraNotes: string[] = []
): { notes: string[]; additionalNotesTotal: number } {
  const notes: string[] = [];
  if (data.waiverRequired) notes.push("⚠️ Waiver Required");
  notes.push(...data.selectedNotes);
  if (data.customNote) notes.push(data.customNote);
  if (data.customNotePrice && data.customNotePrice > 0) {
    notes.push(`$${data.customNotePrice}`);
  }
  if (data.customNoteAddYesNo) notes.push("Yes / No?");
  notes.push(...extraNotes);
  // Add additional notes with inline pricing
  let additionalNotesTotal = 0;
  if (data.additionalNotes && data.additionalNotes.length > 0) {
    data.additionalNotes.forEach((an) => {
      if (an.note) {
        let noteText = an.note;
        if (an.price && an.price > 0) {
          noteText += ` $${an.price}`;
          additionalNotesTotal += an.price;
        }
        if (an.addYesNo) noteText += " Yes / No?";
        notes.push(noteText);
      }
    });
  }
  return { notes: notes.filter(Boolean), additionalNotesTotal };
}

function ConditionBadge({ condition }: { condition: string }) {
  if (!condition || condition === "none") {
    return <Badge variant="destructive">NONE</Badge>;
  }
  
  const colors: Record<string, string> = {
    excellent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    very_good: "bg-green-500/10 text-green-600 border-green-500/30",
    good: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    fair: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    poor: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  };

  return (
    <Badge variant="outline" className={cn(colors[condition] || "")}>
      {formatCondition(condition)}
    </Badge>
  );
}

function ReportSection({ 
  title, 
  condition, 
  notes, 
  price 
}: { 
  title: string; 
  condition: string; 
  notes: string[]; 
  price?: number;
}) {
  if (!condition && notes.length === 0) return null;
  
  return (
    <div className="grid grid-cols-[1fr,auto,auto] items-start gap-4 py-2 border-b border-border/50 last:border-0">
      <div>
        <p className="font-medium">{title}</p>
        {notes.length > 0 && (
          <p className="text-sm text-muted-foreground">{notes.join(", ")}</p>
        )}
      </div>
      <ConditionBadge condition={condition} />
      {price && price > 0 ? (
        <p className="text-right font-medium">${price.toLocaleString()}</p>
      ) : (
        <p className="text-right text-muted-foreground">—</p>
      )}
    </div>
  );
}

export function InspectionReport({
  customerName,
  customerEmail,
  brand,
  model,
  referenceNumber,
  estimateNumber,
  targetDate,
  inspection,
  className,
  onEmailSent,
  onSaveForApproval,
  onResetAfterApproval,
  useHtmlEmail = false,
  inspectionId,
}: InspectionReportProps) {
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [approvalLang, setApprovalLang] = React.useState<"en" | "es">("en");
  
  const isBraceletOnly = inspection.inspectionType === "bracelet_only";

  // Calculate bracelet repair total
  const braceletRepairTotal = React.useMemo(() => {
    const br = inspection.braceletRepair;
    let total = 0;
    if (br.steelSideShowYesNo) total += (parseFloat(br.steelSideHours) || 0) * HOURLY_RATE;
    if (br.steelCenterShowYesNo) total += (parseFloat(br.steelCenterHours) || 0) * HOURLY_RATE;
    if (br.goldCenterShowYesNo) total += br.goldCenterPieces * br.goldCenterPricePerPiece;
    if (br.shorterLinksShowYesNo) total += br.shorterLinksQty * br.shorterLinksPrice;
    if (br.invertPiecesShowYesNo) total += br.invertPiecesQty * br.invertPricePerPiece;
    return total;
  }, [inspection.braceletRepair]);

  const generatePlainTextReport = (): string => {
    const lines: string[] = [];
    
    // Extract first name from customer name
    const firstName = customerName.split(" ")[0];
    
    lines.push("**ROLLIWORKS**");
    lines.push("**INSPECTION NOTES**");
    lines.push("");
    
    // Add intro text based on inspection type
    lines.push(`Dear ${firstName},`);
    lines.push("");
    lines.push("Here are our inspection notes. We will be awaiting your reply before adding your jobs to our work queue. The target date is just a marker not a set due date. After all work is complete, we will email an invoice via QuickBooks.");
    lines.push("");
    lines.push("Pick up in person- Payment can be made during pick up time.");
    lines.push("");
    lines.push("Shipping out- You can use the link to your invoice to either pay with a Credit or Debit Card. (We will ship after payment and we will ALWAYS wait for a shipping address before shipping).");
    lines.push("");
    
    lines.push(`Date: ${format(new Date(), "MMMM d, yyyy")}`);
    lines.push(`Estimate #: ${estimateNumber}`);
    lines.push("");
    lines.push("─── CUSTOMER INFORMATION ───");
    lines.push(`Name: ${customerName}`);
    if (customerEmail) lines.push(`Email: ${customerEmail}`);
    lines.push("");
    lines.push(`─── ${isBraceletOnly ? "REPAIR DETAILS" : "WATCH DETAILS"} ───`);
    lines.push(`Brand: ${brand}`);
    if (model) lines.push(`${isBraceletOnly ? "Bracelet Model" : "Model"}: ${model}`);
    if (referenceNumber && !isBraceletOnly) lines.push(`Reference #: ${referenceNumber}`);
    lines.push(`Inspection Type: ${isBraceletOnly ? "Bracelet Only" : "Complete Watch"}`);
    if (targetDate) lines.push(`Target Completion: ${format(targetDate, "MMMM d, yyyy")}`);
    lines.push("");
    lines.push("─── INSPECTION FINDINGS ───");
    
    const addSection = (title: string, data: typeof inspection.dialCondition, extraPriceItems?: { label: string; value: number }[]) => {
      const hasNotes = data.selectedNotes.length > 0 || data.customNote || (data.additionalNotes && data.additionalNotes.length > 0);
      if (!data.condition && !hasNotes) return;
      const notes: string[] = [];
      if (data.waiverRequired) notes.push("⚠️ Waiver Required");
      notes.push(...data.selectedNotes, data.customNote);
      if (data.customNotePrice && data.customNotePrice > 0) {
        notes.push(`$${data.customNotePrice}`);
      }
      if (data.customNoteAddYesNo) {
        notes.push(">>> YES  /  NO <<<");
      }
      // Add additional notes with inline pricing
      if (data.additionalNotes && data.additionalNotes.length > 0) {
        data.additionalNotes.forEach((an) => {
          if (an.note) {
            let noteText = an.note;
            if (an.price && an.price > 0) noteText += ` $${an.price}`;
            if (an.addYesNo) noteText += " >>> YES  /  NO <<<";
            notes.push(noteText);
          }
        });
      }
      // Add extra price items (e.g., Case Restore, Welding)
      if (extraPriceItems && extraPriceItems.length > 0) {
        extraPriceItems.forEach((item) => {
          if (item.value && item.value > 0) {
            notes.push(`${item.label}: $${item.value}`);
          }
        });
      }
      const filteredNotes = notes.filter(Boolean);
      const additionalNotesTotal = (data.additionalNotes || []).reduce((sum, n) => sum + (n.price || 0), 0);
      const extraPriceTotal = (extraPriceItems || []).reduce((sum, item) => sum + (item.value || 0), 0);
      const totalPrice = (data.price || 0) + (data.customNotePrice || 0) + extraPriceTotal + additionalNotesTotal;
      lines.push(`**${title.toUpperCase()}**: ${formatCondition(data.condition)}${totalPrice > 0 ? ` - $${totalPrice}` : ""}`);
      if (filteredNotes.length > 0) lines.push(`  Notes: ${filteredNotes.join(", ")}`);
      lines.push(""); // Add spacing between sections
    };

    if (!isBraceletOnly) {
      addSection("Dial", inspection.dialCondition);
      addSection("Hands", inspection.handsCondition);
      addSection("Bezel", inspection.bezelCondition);
      addSection("Crown", inspection.crownCondition);
      addSection("Case", inspection.caseCondition, [
        { label: "Retail Case Restoration", value: inspection.caseRestorePrice || 0 },
        { label: "Welding", value: inspection.weldingPrice || 0 },
      ]);
      addSection("Crystal", inspection.crystalCondition);
      
      // Crystal polish option
      if (inspection.crystalPolishPrice !== undefined) {
        lines.push(`  Polish Up: $${inspection.crystalPolishPrice} - ${inspection.crystalPolishApproved ? "YES" : "NO"}`);
      }
    }
    
    addSection("Bracelet", inspection.braceletCondition);
    
    // Bracelet repair details
    const br = inspection.braceletRepair;
    const steelSideHoursNum = parseFloat(br.steelSideHours) || 0;
    const steelCenterHoursNum = parseFloat(br.steelCenterHours) || 0;
    const hasBraceletRepair = br.steelSideHours || br.steelCenterHours || br.goldCenterPieces > 0 || br.shorterLinksQty > 0 || br.invertPiecesQty > 0;
    
    if (hasBraceletRepair) {
      lines.push("");
      lines.push("─── OPTIONAL BRACELET REPAIRS ───");
      
      if (br.steelSideHours) {
        lines.push(`OPTIONAL: Steel missing on inner corners of STEEL SIDE pieces:`);
        lines.push(`  ${br.steelSideHours} hrs @ $${HOURLY_RATE}/hr`);
        if (br.steelSideShowYesNo) {
          lines.push(`  ▶▶▶  PLEASE SELECT:  [ ] YES   [ ] NO  ◀◀◀`);
        }
      }
      
      if (br.steelCenterHours) {
        const recText = br.steelCenterRecommendation === "recommended" ? " (Recommended)" : br.steelCenterRecommendation === "not_recommended" ? " (Not Recommended)" : "";
        lines.push(`OPTIONAL: Steel missing on inner corners of STEEL CENTER pieces${recText}:`);
        lines.push(`  ${br.steelCenterHours} hrs @ $${HOURLY_RATE}/hr`);
        if (br.steelCenterShowYesNo) {
          lines.push(`  ▶▶▶  PLEASE SELECT:  [ ] YES   [ ] NO  ◀◀◀`);
        }
      }
      
      if (br.goldCenterPieces > 0 && br.goldCenterPricePerPiece > 0) {
        lines.push(`OPTIONAL: Gold missing on inner corners of GOLD CENTER pieces:`);
        lines.push(`  ${br.goldCenterPieces} pcs × $${br.goldCenterPricePerPiece}`);
        if (br.goldCenterShowYesNo) {
          lines.push(`  ▶▶▶  PLEASE SELECT:  [ ] YES   [ ] NO  ◀◀◀`);
        }
      }
      
      if (br.shorterLinksQty > 0 && br.shorterLinksPrice > 0) {
        lines.push(`Might be shorter than arrival length:`);
        lines.push(`  ${br.shorterLinksQty} links @ $${br.shorterLinksPrice}`);
        if (br.shorterLinksShowYesNo) {
          lines.push(`  ▶▶▶  PLEASE SELECT:  [ ] YES   [ ] NO  ◀◀◀`);
        }
      }
      
      if (br.invertPiecesQty > 0 && br.invertPricePerPiece > 0) {
        lines.push(`Center pieces foil thin - invert with thick side out:`);
        lines.push(`  ${br.invertPiecesQty} pcs × $${br.invertPricePerPiece}`);
        lines.push(`  Note: Center piece is foil thin and might break if we try to open it up. If we can open it up w/o breaking we can invert it and will be fine in the future. We cannot attempt work unless we have preapproval for replacement for attempting work.`);
        if (br.invertPiecesShowYesNo) {
          lines.push(`  ▶▶▶  PLEASE SELECT:  [ ] YES   [ ] NO  ◀◀◀`);
        }
      }
    }

    if (isBraceletOnly) {
      if (inspection.watchHeadRestorePrice) {
        const yesNoSuffix = inspection.watchHeadRestoreAddYesNo ? " >>> YES / NO <<<" : "";
        lines.push(`Watch Head Restore: $${inspection.watchHeadRestorePrice}${yesNoSuffix}`);
      }
      if (inspection.gasketsPrice) {
        const yesNoSuffix = inspection.gasketsAddYesNo ? " >>> YES / NO <<<" : "";
        lines.push(`Gaskets: $${inspection.gasketsPrice}${yesNoSuffix}`);
      }
    }

    if (inspection.miscNotes || (inspection.miscNotesPrice && inspection.miscNotesPrice > 0)) {
      lines.push("");
      lines.push("─── ADDITIONAL NOTES ───");
      let miscLine = inspection.miscNotes || "";
      if (inspection.miscNotesPrice && inspection.miscNotesPrice > 0) {
        miscLine += (miscLine ? " " : "") + `$${inspection.miscNotesPrice}`;
      }
      if (inspection.miscNotesAddYesNo) {
        miscLine += " >>> YES  /  NO <<<";
      }
      if (miscLine) lines.push(miscLine);
    }

    // Add polish question based on settings
    const includeBandPolishQuestion = !!inspection.braceletRepair?.includeBandPolishQuestion;
    const jobTypesArr: string[] = Array.isArray(inspection.jobTypes) && inspection.jobTypes.length > 0
      ? inspection.jobTypes
      : [inspection.jobType || ""];
    const isMovementService = jobTypesArr.some(jt => ["antique_movement", "modern_movement", "vintage_movement", "antique_lv2", "modern_lv2", "vintage_lv2", "chrono", "chrono_lv2"].includes(jt));
    const isCaseWork = jobTypesArr.some(jt => jt === "case_work" || jt === "case_restoration");
    const hasRetailPolish = !!inspection.retailPolish;

    if (includeBandPolishQuestion) {
      if (!isBraceletOnly && isMovementService) {
        // Complete watch with movement service - show BOTH questions
        lines.push("");
        lines.push('⭐ **Question: Polish or No Polish for "BRACELET"** ⭐');
        lines.push("");
        lines.push("0 = No polish");
        lines.push("1-2 = Vintage looking");
        lines.push("3-5 = Freshened up a bit but vintage");
        lines.push("7 = New-ish");
        lines.push("8 to 10 = As new as possible. This becomes a Retail polish at a cost of $250");
        lines.push("");
        lines.push("Please provide us a number between 0 to 10.");
        
        // Only show watch head polish question if retail polish is NOT selected
        if (!hasRetailPolish) {
          lines.push("");
          lines.push('⭐ **Question: Polish or No Polish "WATCH HEAD"** ⭐');
          lines.push("");
          lines.push(
            "Included with movement service work is our NO-COST light courtesy polish of the case and bracelet. Please let us know if you'd like us to perform. YES/NO"
          );
        }
      } else if (!isBraceletOnly && isCaseWork) {
        // Complete watch with case work - show ONLY bracelet polish question
        lines.push("");
        lines.push('⭐ **Question: Polish or No Polish for "BRACELET"** ⭐');
        lines.push("");
        lines.push("0 = No polish");
        lines.push("1-2 = Vintage looking");
        lines.push("3-5 = Freshened up a bit but vintage");
        lines.push("7 = New-ish");
        lines.push("8 to 10 = As new as possible. This becomes a Retail polish at a cost of $250");
        lines.push("");
        lines.push("Please provide us a number between 0 to 10.");
      } else {
        // Bracelet only - show original band polish question
        lines.push("");
        lines.push("Please answer the following BAND polishing question:");
        lines.push("");
        lines.push("BAND Polish or No Polish");
        lines.push("");
        lines.push(
          "Each band rebuild comes with 30 mins courtesy polish in our polish room at no cost. If you'd like to take advantage of this, please let us know how do you expect the polish to look on a scale of 0-10 (10 being new)"
        );
        lines.push("");
        lines.push("0 = No polish");
        lines.push("1-2 = Vintage looking");
        lines.push("3-5 = Freshened up a bit but vintage");
        lines.push("7 = New-ish");
        lines.push("8 to 10 = As new as possible. This becomes a Retail polish at a cost of $250");
        lines.push("");
        lines.push("Please provide us a number between 0 to 10.");
      }
    } else if (!isBraceletOnly && !isCaseWork && !hasRetailPolish) {
      // Courtesy polish question for complete watch (when band polish question NOT included) - exclude case work and retail polish
      lines.push("");
      lines.push(
        "Included with movement service work is our NO-COST light courtesy polish of the case and bracelet. Please let us know if you'd like us to perform. YES/NO"
      );
    }

    lines.push("");
    lines.push("Thank you!");
    lines.push("Best Ivy P.");
    lines.push("Rolliworks");
    lines.push("14 N.E. 1st Ave Ste 403");
    lines.push("Miami FL 33132");
    lines.push("408-800-3244");
    lines.push("");
    lines.push("M-F 9am to 5pm");
    lines.push("Sat-Sun: Closed");
    lines.push("");
    lines.push("IG:@mikerolliworks");
    
    return lines.join("\n");
  };

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!onSaveForApproval) {
      toast.error("Save not available");
      return;
    }
    setIsSaving(true);
    try {
      await onSaveForApproval();
      toast.success("Inspection saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Rolliworks Inspection Report - ${brand} ${model || ""} - Est #${estimateNumber}`);
    const body = encodeURIComponent(generatePlainTextReport());
    const mailtoUrl = `mailto:${customerEmail}?subject=${subject}&body=${body}`;
    // Use location.href for better compatibility (window.open can be blocked)
    try {
      window.location.href = mailtoUrl;
    } catch {
      window.open(mailtoUrl, "_blank");
    }
    // Notify parent that email was sent
    onEmailSent?.();
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char] || char);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    // Helper to render a section for print
    const renderPrintSection = (title: string, data: typeof inspection.dialCondition, extraPrice?: number) => {
      if (!data.condition) return "";
      const notes: string[] = [];
      if (data.waiverRequired) notes.push("⚠️ Waiver Required");
      notes.push(...data.selectedNotes);
      if (data.customNote) notes.push(data.customNote);
      if (data.customNotePrice && data.customNotePrice > 0) {
        notes.push(`$${data.customNotePrice}`);
      }
      if (data.customNoteAddYesNo) notes.push("Yes / No?");
      if (data.additionalNotes && data.additionalNotes.length > 0) {
        data.additionalNotes.forEach((an) => {
          if (an.note) {
            let noteText = an.note;
            if (an.price && an.price > 0) noteText += ` $${an.price}`;
            if (an.addYesNo) noteText += " Yes / No?";
            notes.push(noteText);
          }
        });
      }
      const filteredNotes = notes.filter(Boolean);
      const additionalNotesTotal = (data.additionalNotes || []).reduce((sum, n) => sum + (n.price || 0), 0);
      const totalPrice = (data.price || 0) + (data.customNotePrice || 0) + (extraPrice || 0) + additionalNotesTotal;
      return `
        <div class="item">
          <div>
            <div class="item-title">${escapeHtml(title)}</div>
            ${filteredNotes.length > 0 ? `<div class="item-notes">${escapeHtml(filteredNotes.join(", "))}</div>` : ""}
          </div>
          <span class="item-condition">${escapeHtml(formatCondition(data.condition))}</span>
          <span class="item-price">${totalPrice > 0 ? "$" + totalPrice.toLocaleString() : "—"}</span>
        </div>
      `;
    };

    // Build sections HTML
    const sectionsHtml = isBraceletOnly 
      ? renderPrintSection("Bracelet", inspection.braceletCondition)
      : [
          renderPrintSection("Dial", inspection.dialCondition),
          renderPrintSection("Hands", inspection.handsCondition),
          renderPrintSection("Bezel", inspection.bezelCondition),
          renderPrintSection("Crown", inspection.crownCondition),
          renderPrintSection("Case", inspection.caseCondition, (inspection.caseRestorePrice || 0) + (inspection.weldingPrice || 0)),
          renderPrintSection("Crystal", inspection.crystalCondition),
          renderPrintSection("Bracelet", inspection.braceletCondition),
        ].join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inspection Report - ${estimateNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              color: #1a1a1a;
            }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #047857; padding-bottom: 20px; }
            .header h1 { font-size: 28px; color: #047857; margin-bottom: 5px; }
            .header p { color: #666; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .meta-section { background: #f9fafb; padding: 15px; border-radius: 8px; }
            .meta-section h3 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 10px; }
            .meta-section p { margin: 5px 0; }
            .section { margin-bottom: 25px; }
            .section h2 { font-size: 14px; text-transform: uppercase; color: #047857; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; }
            .item { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f3f4f6; gap: 12px; }
            .item:last-child { border-bottom: none; }
            .item-title { font-weight: 500; }
            .item-notes { font-size: 12px; color: #666; margin-top: 4px; }
            .item-condition { 
              display: inline-block; 
              padding: 2px 8px; 
              border-radius: 4px; 
              font-size: 12px;
              background: #f3f4f6;
              white-space: nowrap;
            }
            .item-price { font-weight: 600; min-width: 80px; text-align: right; }
            .total { 
              background: #047857; 
              color: white; 
              padding: 20px; 
              border-radius: 8px; 
              text-align: center;
              margin-top: 30px;
            }
            .total h3 { font-size: 24px; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ROLLIWORKS</h1>
            <p>Inspection Notes</p>
          </div>
          
          <div class="meta">
            <div class="meta-section">
              <h3>Customer</h3>
              <p><strong>${escapeHtml(customerName)}</strong></p>
              ${customerEmail ? `<p>${escapeHtml(customerEmail)}</p>` : ""}
            </div>
            <div class="meta-section">
              <h3>Watch Details</h3>
              <p><strong>${escapeHtml(brand)}</strong> ${escapeHtml(model || "")}</p>
              ${referenceNumber ? `<p>Ref: ${escapeHtml(referenceNumber)}</p>` : ""}
              <p>Est #: ${escapeHtml(estimateNumber)}</p>
              ${targetDate ? `<p>Target: ${format(targetDate, "MMM d, yyyy")}</p>` : ""}
            </div>
          </div>

          <div class="section">
            <h2>Inspection Findings - ${isBraceletOnly ? "Bracelet Only" : "Complete Watch"}</h2>
            ${sectionsHtml}
          </div>

          <div class="footer">
            <p>Thank you for choosing Rolliworks</p>
            <p>Report generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper for line height
    const lineHeight = 6;
    const sectionGap = 10;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(4, 120, 87); // Primary green
    doc.text("ROLLIWORKS", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("Inspection Notes", pageWidth / 2, y, { align: "center" });
    y += 12;

    // Divider
    doc.setDrawColor(4, 120, 87);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += sectionGap;

    // Customer Info
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("CUSTOMER", margin, y);
    y += lineHeight;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(customerName, margin, y);
    y += lineHeight;
    if (customerEmail) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(customerEmail, margin, y);
      y += lineHeight;
    }
    y += 4;

    // Watch Details
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(isBraceletOnly ? "REPAIR DETAILS" : "WATCH DETAILS", margin, y);
    y += lineHeight;
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`${brand} ${model || ""}`, margin, y);
    y += lineHeight;
    if (referenceNumber && !isBraceletOnly) {
      doc.setFontSize(10);
      doc.text(`Ref: ${referenceNumber}`, margin, y);
      y += lineHeight;
    }
    doc.setFontSize(10);
    doc.text(`Est #: ${estimateNumber}`, margin, y);
    y += lineHeight;
    if (targetDate) {
      doc.text(`Target: ${format(targetDate, "MMM d, yyyy")}`, margin, y);
      y += lineHeight;
    }
    y += sectionGap;

    // Divider
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += sectionGap;

    // Inspection Findings Header
    doc.setFontSize(10);
    doc.setTextColor(4, 120, 87);
    doc.text(`INSPECTION FINDINGS - ${isBraceletOnly ? "BRACELET ONLY" : "COMPLETE WATCH"}`, margin, y);
    y += sectionGap;

    // Helper to add section
    const addPdfSection = (title: string, data: typeof inspection.dialCondition, extraPrice?: number) => {
      if (!data.condition) return;
      
      // Check if we need a new page
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      const notes: string[] = [];
      if (data.waiverRequired) notes.push("⚠️ Waiver Required");
      notes.push(...data.selectedNotes);
      if (data.customNote) notes.push(data.customNote);
      if (data.customNotePrice && data.customNotePrice > 0) {
        notes.push(`$${data.customNotePrice}`);
      }
      if (data.customNoteAddYesNo) notes.push("Yes / No?");
      if (data.additionalNotes && data.additionalNotes.length > 0) {
        data.additionalNotes.forEach((an) => {
          if (an.note) {
            let noteText = an.note;
            if (an.price && an.price > 0) noteText += ` $${an.price}`;
            if (an.addYesNo) noteText += " Yes / No?";
            notes.push(noteText);
          }
        });
      }
      const additionalNotesTotal = (data.additionalNotes || []).reduce((sum, n) => sum + (n.price || 0), 0);
      const totalPrice = (data.price || 0) + (data.customNotePrice || 0) + (extraPrice || 0) + additionalNotesTotal;

      // Title and condition
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin, y);
      
      // Condition badge
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const conditionText = formatCondition(data.condition);
      doc.text(conditionText, margin + 50, y);
      
      // Price
      if (totalPrice > 0) {
        doc.setTextColor(0, 0, 0);
        doc.text(`$${totalPrice.toLocaleString()}`, pageWidth - margin, y, { align: "right" });
      }
      y += lineHeight;

      // Notes
      if (notes.filter(Boolean).length > 0) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const notesText = notes.filter(Boolean).join(", ");
        const splitNotes = doc.splitTextToSize(notesText, contentWidth - 10);
        doc.text(splitNotes, margin + 5, y);
        y += splitNotes.length * 4 + 2;
      }
      y += 4;
    };

    // Add sections
    if (!isBraceletOnly) {
      addPdfSection("Dial", inspection.dialCondition);
      addPdfSection("Hands", inspection.handsCondition);
      addPdfSection("Bezel", inspection.bezelCondition);
      addPdfSection("Crown", inspection.crownCondition);
      addPdfSection("Case", inspection.caseCondition, (inspection.caseRestorePrice || 0) + (inspection.weldingPrice || 0));
      addPdfSection("Crystal", inspection.crystalCondition);
    }
    addPdfSection("Bracelet", inspection.braceletCondition);

    // Bracelet repair details
    const br = inspection.braceletRepair;
    const hasBraceletRepair = br.steelSideHours || br.steelCenterHours || br.goldCenterPieces > 0 || br.shorterLinksQty > 0 || br.invertPiecesQty > 0;
    
    if (hasBraceletRepair) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(4, 120, 87);
      doc.text("BRACELET REPAIR OPTIONS", margin, y);
      y += lineHeight + 2;

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      if (br.steelSideHours) {
        doc.text(`Steel SIDE pieces: ${br.steelSideHours} hrs @ $${HOURLY_RATE}/hr`, margin + 5, y);
        if (br.steelSideShowYesNo) doc.text("Yes / No?", pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }
      if (br.steelCenterHours) {
        doc.text(`Steel CENTER pieces: ${br.steelCenterHours} hrs @ $${HOURLY_RATE}/hr`, margin + 5, y);
        if (br.steelCenterShowYesNo) doc.text("Yes / No?", pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }
      if (br.goldCenterPieces > 0 && br.goldCenterPricePerPiece > 0) {
        doc.text(`Gold CENTER pieces: ${br.goldCenterPieces} × $${br.goldCenterPricePerPiece}`, margin + 5, y);
        if (br.goldCenterShowYesNo) doc.text("Yes / No?", pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }
      if (br.shorterLinksQty > 0 && br.shorterLinksPrice > 0) {
        doc.text(`Shorter links: ${br.shorterLinksQty} @ $${br.shorterLinksPrice}`, margin + 5, y);
        if (br.shorterLinksShowYesNo) doc.text("Yes / No?", pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }
      if (br.invertPiecesQty > 0 && br.invertPricePerPiece > 0) {
        doc.text(`Invert pieces: ${br.invertPiecesQty} × $${br.invertPricePerPiece}`, margin + 5, y);
        if (br.invertPiecesShowYesNo) doc.text("Yes / No?", pageWidth - margin, y, { align: "right" });
        y += lineHeight;
      }
    }

    // Additional notes
    if (inspection.miscNotes) {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
      y += sectionGap;
      doc.setFontSize(10);
      doc.setTextColor(4, 120, 87);
      doc.text("ADDITIONAL NOTES", margin, y);
      y += lineHeight;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const splitNotes = doc.splitTextToSize(inspection.miscNotes, contentWidth);
      doc.text(splitNotes, margin, y);
      y += splitNotes.length * 4;
    }

    // Footer
    y = Math.max(y + 20, 260);
    if (y > 270) {
      doc.addPage();
      y = 250;
    }
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for choosing Rolliworks", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Report generated on ${format(new Date(), "MMMM d, yyyy")}`, pageWidth / 2, y, { align: "center" });

    // Save the PDF
    doc.save(`Rolliworks-Inspection-${estimateNumber}.pdf`);
    toast.success("PDF exported successfully");
  };

  if (!inspection.inspectionType) {
    return null;
  }

  return (
    <Card className={cn("border-primary/20 overflow-hidden", className)}>
      <CardHeader className="bg-primary/5 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Inspection Report Preview
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {customerEmail && (
              <Button size="sm" variant="outline" onClick={handleEmail}>
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            )}
            {customerEmail && (
              <Button
                size="sm"
                variant={approvalLang === "es" ? "default" : "outline"}
                onClick={() => setApprovalLang((prev) => (prev === "en" ? "es" : "en"))}
                className={approvalLang === "es" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                title={approvalLang === "es" ? "Spanish mode — client page will be in Spanish" : "Click to send in Spanish"}
              >
                <Languages className="mr-1.5 h-4 w-4" />
                {approvalLang === "es" ? "ES" : "EN"}
              </Button>
            )}
            {customerEmail && (
              <Button
                onClick={async () => {
                   try {
                    // Always save current form state before creating approval
                    let savedInspectionId: string | undefined;
                    if (onSaveForApproval) {
                      savedInspectionId = await onSaveForApproval();
                    }
                    // Fallback to existing inspectionId if save not available
                    if (!savedInspectionId) {
                      savedInspectionId = inspectionId;
                    }
                    if (!savedInspectionId) {
                      toast.error("Could not save inspection. Please try again.");
                      return;
                    }

                    // ─── RESOLVE CANONICAL CUSTOMER FROM DB ───
                    // Never trust form props for customer data — always use the
                    // inspection → watch → customer chain as the source of truth.
                    let canonicalName = customerName;
                    let canonicalEmail = customerEmail;
                    let canonicalEstimate = estimateNumber;
                    let canonicalBrand = brand;
                    let canonicalModel = model;
                    let canonicalRef = referenceNumber;
                    try {
                      const { data: inspRow } = await supabase
                        .from("inspections")
                        .select("watches(estimate_number, brand, model, reference_number, customers(name, email))")
                        .eq("id", savedInspectionId)
                        .maybeSingle();
                      const w = inspRow?.watches as any;
                      if (w?.customers?.name) {
                        if (w.customers.name !== customerName) {
                          console.warn(
                            `[SendURL] Customer mismatch: form="${customerName}" vs DB="${w.customers.name}". Using DB value.`
                          );
                        }
                        canonicalName = w.customers.name;
                        canonicalEmail = w.customers.email || customerEmail;
                        canonicalEstimate = w.estimate_number || estimateNumber;
                        canonicalBrand = w.brand || brand;
                        canonicalModel = w.model || model;
                        canonicalRef = w.reference_number || referenceNumber;
                      }
                    } catch (lookupErr) {
                      console.warn("[SendURL] Could not resolve canonical customer, using form props", lookupErr);
                    }

                    // ─── PRE-SEND VALIDATION ───
                    const flagCount = countYesNoFlags(inspection);
                    const preCheckItems = collectYesNoItems(inspection);
                    if (flagCount > 0 && preCheckItems.length === 0) {
                      toast.error(
                        `${flagCount} Yes/No flag(s) are checked but no items could be collected. Check that notes are filled in for flagged sections.`,
                        { duration: 8000 }
                      );
                      return;
                    }
                    if (flagCount > preCheckItems.length) {
                      toast.warning(
                        `${flagCount} Yes/No flag(s) set but only ${preCheckItems.length} item(s) collected. Some may be missing note text.`,
                        { duration: 6000 }
                      );
                    }

                    const isMultiItem = inspection.braceletItems && inspection.braceletItems.length > 1;
                    let approvalUrl: string;
                    if (isMultiItem) {
                      // ─── MULTI-ITEM: Create grouped approvals ───
                      const groupId = crypto.randomUUID();
                      
                      // Find all inspections for this estimate number
                      const { data: relatedWatches } = await supabase
                        .from("watches")
                        .select("id, model")
                        .eq("estimate_number", inspection.braceletItems![0]?.model ? 
                          // Use estimate from watch data prop
                          estimateNumber : estimateNumber)
                        .order("model", { ascending: true });

                      // Get inspections for these watches
                      const watchIds = (relatedWatches || []).map((w: any) => w.id);
                      let inspectionIds: string[] = [];
                      
                      if (watchIds.length > 0) {
                        const { data: relatedInspections } = await supabase
                          .from("inspections")
                          .select("id, watch_id")
                          .in("watch_id", watchIds)
                          .eq("status", "sent")
                          .order("created_at", { ascending: true });
                        
                        inspectionIds = (relatedInspections || []).map((i: any) => i.id);
                      }

                      // Fallback: if we only have the first inspection ID
                      if (inspectionIds.length === 0) {
                        inspectionIds = [savedInspectionId];
                      }

                      // Create one approval per inspection, each with its OWN yes/no items
                      const braceletItems = inspection.braceletItems || [];
                      for (let idx = 0; idx < inspectionIds.length; idx++) {
                        const inspId = inspectionIds[idx];
                        const braceletItem = braceletItems[idx];
                        
                        // Build a per-item inspection-like object for collectYesNoItems
                        let itemYesNoItems;
                        if (braceletItem) {
                          const perItemInspection = {
                            ...inspection,
                            braceletCondition: braceletItem.braceletCondition,
                            braceletRepair: braceletItem.braceletRepair,
                            watchHeadRestorePrice: braceletItem.watchHeadRestorePrice,
                            watchHeadRestoreAddYesNo: braceletItem.watchHeadRestoreAddYesNo,
                            gasketsPrice: braceletItem.gasketsPrice,
                            gasketsAddYesNo: braceletItem.gasketsAddYesNo,
                          };
                          itemYesNoItems = collectYesNoItems(perItemInspection);
                        } else {
                          itemYesNoItems = collectYesNoItems(inspection);
                        }
                        
                        await supabase
                          .from("inspection_approvals")
                          .insert({
                            inspection_id: inspId,
                            client_name: canonicalName,
                            client_email: canonicalEmail,
                            group_id: groupId,
                            approval_items: itemYesNoItems.map(item => ({
                              id: item.id,
                              label: item.label,
                              price: item.price,
                              description: item.description || null,
                              choice: null,
                            })),
                            status: "pending",
                          });
                      }

                      const baseUrl = "https://app.rolliworks.com";
                      const langParam = approvalLang === "es" ? "&lang=es" : "";
                      approvalUrl = `${baseUrl}/approve-inspection?group=${groupId}${langParam}`;
                    } else {
                      // ─── SINGLE ITEM: Original behavior ───
                      const yesNoItems = collectYesNoItems(inspection);
                      const { data: insertedRows, error } = await supabase
                        .from("inspection_approvals")
                        .insert({
                          inspection_id: savedInspectionId,
                          client_name: canonicalName,
                          client_email: canonicalEmail,
                          approval_items: yesNoItems.map(item => ({
                            id: item.id,
                            label: item.label,
                            price: item.price,
                            description: item.description || null,
                            choice: null,
                          })),
                          status: "pending",
                        })
                        .select();

                      if (error) throw error;
                      const data = insertedRows?.[0];
                      if (!data) throw new Error("Failed to create approval record");

                      const baseUrl = "https://app.rolliworks.com";
                      const langParam = approvalLang === "es" ? "&lang=es" : "";
                      approvalUrl = `${baseUrl}/approve-inspection?id=${data.id}${langParam}`;
                    }

                    // Fetch the inspection_approval email template
                    const { data: templateRows } = await supabase
                      .from("email_templates")
                      .select("subject, body")
                      .eq("type", "inspection_approval")
                      .eq("is_active", true)
                      .limit(1);
                    const template = templateRows?.[0] || null;

                    const firstName = canonicalName.split(" ")[0] || canonicalName;

                    // Build help email mailto link with estimate # in subject
                    const helpMailtoUrl = `mailto:help@rolliworks.com?subject=${encodeURIComponent(`Est# ${canonicalEstimate} - Question`)}`;

                    // Replace placeholders in template
                    const replacePlaceholders = (text: string) =>
                      text
                        .replace(/\{\{customer_first_name\}\}/g, firstName)
                        .replace(/\{\{customer_name\}\}/g, canonicalName)
                        .replace(/\{\{watch_brand\}\}/g, canonicalBrand)
                        .replace(/\{\{watch_model\}\}/g, canonicalModel || "")
                        .replace(/\{\{estimate_number\}\}/g, canonicalEstimate)
                        .replace(/\{\{approval_url\}\}/g, approvalUrl)
                        .replace(/\{\{Ref_number\}\}/g, canonicalRef || "")
                        .replace(/\{\{help_email_link\}\}/g, helpMailtoUrl)
                        .replace(/\{\{brand\}\}/g, canonicalBrand)
                        .replace(/\{\{model\}\}/g, canonicalModel || "");

                    const emailSubject = template
                      ? replacePlaceholders(template.subject)
                      : `Est# ${canonicalEstimate} Inspection Report for your ${canonicalBrand} ${canonicalModel || ""}`;

                    const emailBody = template
                      ? replacePlaceholders(template.body)
                      : `Hi ${firstName},\n\nPlease review your inspection findings and approve services here:\n\n${approvalUrl}\n\nBest,\nRolliworks`;

                    // Open mail client via temporary anchor (most reliable cross-browser)
                    const mailtoUrl = `mailto:${encodeURIComponent(canonicalEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                    const a = document.createElement("a");
                    a.href = mailtoUrl;
                    a.style.display = "none";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => document.body.removeChild(a), 100);

                    toast.success("Mail client opened with approval URL!", { duration: 5000 });
                    
                    // Reset form after successful send
                    onResetAfterApproval?.();
                  } catch (err: any) {
                    console.error("Failed to create approval URL:", err);
                    toast.error(err?.message || "Failed to create approval URL");
                  }
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send URL
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Live Preview */}
        <div ref={reportRef} className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center border-b border-primary pb-4">
            <h2 className="text-2xl font-bold text-primary">ROLLIWORKS</h2>
            <p className="text-sm text-muted-foreground">Inspection Notes</p>
          </div>

          {/* Meta Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">Customer</h3>
              <p className="font-semibold">{customerName}</p>
              {customerEmail && <p className="text-sm text-muted-foreground">{customerEmail}</p>}
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">Watch Details</h3>
              <p className="font-semibold">{brand} {model}</p>
              {referenceNumber && <p className="text-sm text-muted-foreground">Ref: {referenceNumber}</p>}
              <p className="text-sm">Est #: {estimateNumber}</p>
              {targetDate && <p className="text-sm">Target: {format(targetDate, "MMM d, yyyy")}</p>}
            </div>
          </div>

          <Separator />

          {/* Inspection Type */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase text-muted-foreground">
              Inspection Findings
            </h3>
            <Badge variant="outline" className="text-primary border-primary">
              {isBraceletOnly ? "Bracelet Only" : "Complete Watch"}
            </Badge>
          </div>

          {/* Findings */}
          <div className="space-y-1">
            {!isBraceletOnly && (
              <>
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.dialCondition);
                  return (
                    <ReportSection
                      title="Dial"
                      condition={inspection.dialCondition.condition}
                      notes={notes}
                      price={(inspection.dialCondition.price || 0) + (inspection.dialCondition.customNotePrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.handsCondition);
                  return (
                    <ReportSection
                      title="Hands"
                      condition={inspection.handsCondition.condition}
                      notes={notes}
                      price={(inspection.handsCondition.price || 0) + (inspection.handsCondition.customNotePrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.bezelCondition);
                  return (
                    <ReportSection
                      title="Bezel"
                      condition={inspection.bezelCondition.condition}
                      notes={notes}
                      price={(inspection.bezelCondition.price || 0) + (inspection.bezelCondition.customNotePrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.crownCondition);
                  return (
                    <ReportSection
                      title="Crown"
                      condition={inspection.crownCondition.condition}
                      notes={notes}
                      price={(inspection.crownCondition.price || 0) + (inspection.crownCondition.customNotePrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.caseCondition);
                  return (
                    <ReportSection
                      title="Case"
                      condition={inspection.caseCondition.condition}
                      notes={notes}
                      price={(inspection.caseCondition.price || 0) + (inspection.caseCondition.customNotePrice || 0) + (inspection.caseRestorePrice || 0) + (inspection.weldingPrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {(() => {
                  const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.crystalCondition);
                  return (
                    <ReportSection
                      title="Crystal"
                      condition={inspection.crystalCondition.condition}
                      notes={notes}
                      price={(inspection.crystalCondition.price || 0) + (inspection.crystalCondition.customNotePrice || 0) + additionalNotesTotal}
                    />
                  );
                })()}
                {/* Crystal Polish Option */}
                {inspection.crystalPolishPrice !== undefined && (
                  <div className="grid grid-cols-[1fr,auto,auto] items-start gap-4 py-2 border-b border-border/50 ml-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Polish Up</p>
                    </div>
                    <Badge variant={inspection.crystalPolishApproved ? "default" : "outline"} className="text-xs">
                      {inspection.crystalPolishApproved ? "YES" : "NO"}
                    </Badge>
                    <p className="text-right font-medium">${inspection.crystalPolishPrice}</p>
                  </div>
                )}
              </>
            )}
            {(() => {
              const { notes, additionalNotesTotal } = buildNotesWithAdditional(inspection.braceletCondition);
              return (
                <ReportSection
                  title="Bracelet"
                  condition={inspection.braceletCondition.condition}
                  notes={notes}
                  price={(inspection.braceletCondition.price || 0) + braceletRepairTotal + additionalNotesTotal}
                />
              );
            })()}
          </div>

          {/* Bracelet Repair Details */}
          {(() => {
            const br = inspection.braceletRepair;
            const steelSideHoursNum = parseFloat(br.steelSideHours) || 0;
            const steelCenterHoursNum = parseFloat(br.steelCenterHours) || 0;
            const hasBraceletRepair = steelSideHoursNum > 0 || steelCenterHoursNum > 0 || br.goldCenterPieces > 0 || br.shorterLinksQty > 0 || br.invertPiecesQty > 0;
            if (!hasBraceletRepair) return null;
            
            return (
              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <h4 className="text-sm font-medium mb-2">Bracelet Repair Details</h4>
                <div className="text-sm space-y-2">
                  {br.steelSideHours && (
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span>OPTIONAL: Steel SIDE pieces ({br.steelSideHours} hrs @ ${HOURLY_RATE}/hr)</span>
                      </div>
                      <div className="text-right">
                        {br.steelSideShowYesNo && (
                          <Badge variant="outline" className="text-xs">Yes / No?</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {br.steelCenterHours && (
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span>OPTIONAL: Steel CENTER pieces ({br.steelCenterHours} hrs @ ${HOURLY_RATE}/hr)</span>
                        {br.steelCenterRecommendation && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {br.steelCenterRecommendation === "recommended" ? "Recommended" : "Not Recommended"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        {br.steelCenterShowYesNo && (
                          <Badge variant="outline" className="text-xs">Yes / No?</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {br.goldCenterPieces > 0 && br.goldCenterPricePerPiece > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span>OPTIONAL: Gold CENTER pieces ({br.goldCenterPieces} × ${br.goldCenterPricePerPiece})</span>
                      <div className="text-right">
                        {br.goldCenterShowYesNo && (
                          <Badge variant="outline" className="text-xs">Yes / No?</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {br.shorterLinksQty > 0 && br.shorterLinksPrice > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span>Might be shorter than arrival ({br.shorterLinksQty} links @ ${br.shorterLinksPrice})</span>
                      <div className="text-right">
                        {br.shorterLinksShowYesNo && (
                          <Badge variant="outline" className="text-xs">Yes / No?</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {br.invertPiecesQty > 0 && br.invertPricePerPiece > 0 && (
                    <div className="flex justify-between items-start gap-2">
                      <span>Invert center pieces ({br.invertPiecesQty} × ${br.invertPricePerPiece})</span>
                      <div className="text-right">
                        {br.invertPiecesShowYesNo && (
                          <Badge variant="outline" className="text-xs">Yes / No?</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Additional Notes */}
          {inspection.miscNotes && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-sm font-medium mb-2">Additional Notes</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inspection.miscNotes}</p>
            </div>
          )}


          {/* Footer */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">Thank you for choosing Rolliworks</p>
            <p className="text-xs text-muted-foreground">
              Report generated on {format(new Date(), "MMMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
