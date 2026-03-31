import { format } from "date-fns";
import type { ExpandedInspectionFormData } from "@/components/inspection/InspectionForm";
import type { SectionConditionData } from "@/components/inspection/InspectionSection";

const HOURLY_RATE = 98;

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

function formatCondition(condition: string): string {
  if (!condition) return "";
  return condition.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

interface SectionRenderData {
  title: string;
  condition: string;
  notes: string[];
  price: number;
  waiverRequired?: boolean;
}

interface YesNoItem {
  id: string;
  label: string;
  price: number;
  description?: string;
}

function buildSectionData(
  title: string,
  data: SectionConditionData,
  extraPrice = 0
): SectionRenderData | null {
  const hasNotes =
    data.selectedNotes.length > 0 ||
    data.customNote ||
    (data.additionalNotes && data.additionalNotes.length > 0);
  if (!data.condition && !hasNotes) return null;

  const notes: string[] = [];
  notes.push(...data.selectedNotes);
  if (data.customNote) notes.push(data.customNote);
  if (data.additionalNotes) {
    data.additionalNotes.forEach((an) => {
      if (an.note) notes.push(an.note);
    });
  }

  const additionalNotesTotal = (data.additionalNotes || []).reduce(
    (sum, n) => sum + (n.price || 0),
    0
  );
  const totalPrice =
    (data.price || 0) +
    (data.customNotePrice || 0) +
    extraPrice +
    additionalNotesTotal;

  return {
    title,
    condition: data.condition,
    notes: notes.filter(Boolean),
    price: totalPrice,
    waiverRequired: data.waiverRequired,
  };
}

function collectYesNoItems(inspection: ExpandedInspectionFormData): YesNoItem[] {
  const items: YesNoItem[] = [];
  const isBraceletOnly = inspection.inspectionType === "bracelet_only";

  // Custom note yes/no from each section
  const sections: { key: string; data: SectionConditionData }[] = isBraceletOnly
    ? [{ key: "bracelet", data: inspection.braceletCondition }]
    : [
        { key: "dial", data: inspection.dialCondition },
        { key: "hands", data: inspection.handsCondition },
        { key: "bezel", data: inspection.bezelCondition },
        { key: "crown", data: inspection.crownCondition },
        { key: "case", data: inspection.caseCondition },
        { key: "crystal", data: inspection.crystalCondition },
        { key: "bracelet", data: inspection.braceletCondition },
      ];

  for (const { key, data } of sections) {
    if (data.customNoteAddYesNo) {
      // Use customNote if present; otherwise fall back to the last selected quick note
      const noteText = data.customNote
        || (data.selectedNotes && data.selectedNotes.length > 0
            ? data.selectedNotes[data.selectedNotes.length - 1]
            : null);
      if (noteText) {
        items.push({
          id: `${key}_custom`,
          label: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${noteText}`,
          price: data.customNotePrice || 0,
        });
      }
    }
    if (data.additionalNotes) {
      data.additionalNotes.forEach((an, i) => {
        if (an.addYesNo && an.note) {
          items.push({
            id: `${key}_additional_${i}`,
            label: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${an.note}`,
            price: an.price || 0,
          });
        }
      });
    }
  }

  // Bracelet repair yes/no items
  const br = inspection.braceletRepair;
  const WELDING_WARNING = "⚠ POLISHING WILL BE REQUIRED IF WELDING IS DONE — selecting YES means polish cannot be declined.";
  if (br.steelSideHours && br.steelSideShowYesNo) {
    items.push({
      id: "bracelet_steel_side",
      label: `OPTIONAL: Steel missing on inner corners of STEEL SIDE pieces — ${br.steelSideHours} hrs @ $${HOURLY_RATE}/hr`,
      price: (parseFloat(br.steelSideHours) || 0) * HOURLY_RATE,
      description: WELDING_WARNING,
    });
  }
  if (br.steelCenterHours && br.steelCenterShowYesNo) {
    const rec = br.steelCenterRecommendation === "recommended" ? " (Recommended)" : br.steelCenterRecommendation === "not_recommended" ? " (Not Recommended)" : "";
    items.push({
      id: "bracelet_steel_center",
      label: `OPTIONAL: Steel missing on inner corners of STEEL CENTER pieces${rec} — ${br.steelCenterHours} hrs @ $${HOURLY_RATE}/hr`,
      price: (parseFloat(br.steelCenterHours) || 0) * HOURLY_RATE,
      description: WELDING_WARNING,
    });
  }
  if (br.goldCenterPieces > 0 && br.goldCenterPricePerPiece > 0 && br.goldCenterShowYesNo) {
    items.push({
      id: "bracelet_gold_center",
      label: `OPTIONAL: Gold missing on inner corners of GOLD CENTER pieces — ${br.goldCenterPieces} pcs × $${br.goldCenterPricePerPiece}`,
      price: br.goldCenterPieces * br.goldCenterPricePerPiece,
      description: WELDING_WARNING,
    });
  }
  if (br.shorterLinksQty > 0 && br.shorterLinksPrice > 0 && br.shorterLinksShowYesNo) {
    items.push({
      id: "bracelet_shorter_links",
      label: `Might be shorter than arrival length — ${br.shorterLinksQty} links @ $${br.shorterLinksPrice}`,
      price: br.shorterLinksQty * br.shorterLinksPrice,
    });
  }
  if (br.invertPiecesQty > 0 && br.invertPricePerPiece > 0 && br.invertPiecesShowYesNo) {
    items.push({
      id: "bracelet_invert",
      label: `Center pieces foil thin — invert with thick side out — ${br.invertPiecesQty} pcs × $${br.invertPricePerPiece}`,
      price: br.invertPiecesQty * br.invertPricePerPiece,
      description: "Center piece is foil thin and might break if we try to open it up. If we can open it up w/o breaking we can invert it and will be fine in the future. We cannot attempt work unless we have preapproval for replacement for attempting work.",
    });
  }

  // Bracelet-only specific
  if (isBraceletOnly) {
    if (inspection.watchHeadRestorePrice && inspection.watchHeadRestoreAddYesNo) {
      items.push({
        id: "watch_head_restore",
        label: "Watch Head Restore",
        price: inspection.watchHeadRestorePrice,
      });
    }
    if (inspection.gasketsPrice && inspection.gasketsAddYesNo) {
      items.push({
        id: "gaskets",
        label: "Gaskets",
        price: inspection.gasketsPrice,
      });
    }
  }

  // Retail Case Restoration yes/no
  if (inspection.caseRestorePrice && inspection.caseRestoreAddYesNo) {
    items.push({
      id: "case_restore",
      label: "Retail Case Restoration",
      price: inspection.caseRestorePrice,
    });
  }


  // Misc notes yes/no
  if (inspection.miscNotesAddYesNo && inspection.miscNotes) {
    items.push({
      id: "misc_notes",
      label: inspection.miscNotes,
      price: inspection.miscNotesPrice || 0,
    });
  }

  return items;
}

export interface HtmlEmailData {
  approvalUrl: string;
  sections: SectionRenderData[];
  yesNoItems: YesNoItem[];
}

/**
 * Generate the HTML email string for an inspection approval.
 */
export function generateHtmlInspectionEmail({
  customerName,
  customerEmail,
  brand,
  model,
  referenceNumber,
  estimateNumber,
  targetDate,
  inspection,
  approvalUrl,
}: {
  customerName: string;
  customerEmail: string;
  brand: string;
  model: string;
  referenceNumber: string;
  estimateNumber: string;
  targetDate: Date | null;
  inspection: ExpandedInspectionFormData;
  approvalUrl: string;
}): string {
  const firstName = escapeHtml(customerName.split(" ")[0]);
  const isBraceletOnly = inspection.inspectionType === "bracelet_only";

  // Build sections
  const sections: SectionRenderData[] = [];
  if (!isBraceletOnly) {
    const dial = buildSectionData("Dial", inspection.dialCondition);
    if (dial) sections.push(dial);
    const hands = buildSectionData("Hands", inspection.handsCondition);
    if (hands) sections.push(hands);
    const bezel = buildSectionData("Bezel", inspection.bezelCondition);
    if (bezel) sections.push(bezel);
    const crown = buildSectionData("Crown", inspection.crownCondition);
    if (crown) sections.push(crown);
    const caseSection = buildSectionData(
      "Case",
      inspection.caseCondition,
      (inspection.caseRestorePrice || 0) + (inspection.weldingPrice || 0)
    );
    if (caseSection) sections.push(caseSection);
    const crystal = buildSectionData("Crystal", inspection.crystalCondition);
    if (crystal) sections.push(crystal);
  }
  const bracelet = buildSectionData("Bracelet", inspection.braceletCondition);
  if (bracelet) sections.push(bracelet);

  const yesNoItems = collectYesNoItems(inspection);

  // Build plain-text notes for the email top section
  const notesLines: string[] = [];
  for (const section of sections) {
    let line = `**${escapeHtml(section.title.toUpperCase())}**: ${escapeHtml(formatCondition(section.condition))}`;
    if (section.price > 0) line += ` — $${section.price.toLocaleString()}`;
    notesLines.push(line);
    if (section.waiverRequired) notesLines.push("  ⚠️ Waiver Required");
    if (section.notes.length > 0) {
      notesLines.push(`  ${section.notes.map(escapeHtml).join(", ")}`);
    }
    notesLines.push("");
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Rolliworks Inspection Notes</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f4f4f5;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#047857;padding:28px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0;letter-spacing:1px;">ROLLIWORKS</h1>
              <p style="color:#a7f3d0;font-size:13px;margin:6px 0 0;">Inspection Notes</p>
            </td>
          </tr>

          <!-- Greeting & Preamble -->
          <tr>
            <td style="padding:28px 40px 16px;">
              <p style="font-size:15px;color:#1a1a1a;margin:0;">Dear ${firstName},</p>
              <p style="font-size:14px;color:#52525b;margin:12px 0 0;line-height:1.6;">
                Here are our inspection notes. We will be awaiting your approval before adding your job to our work queue. The target date is a marker, not a set due date.
              </p>
              <p style="font-size:14px;color:#52525b;margin:10px 0 0;line-height:1.6;">
                After all work is complete, we will email an invoice via QuickBooks.
              </p>
              <p style="font-size:14px;color:#52525b;margin:10px 0 0;line-height:1.6;">
                <strong>Pick up in person</strong> — Payment during pick up.<br>
                <strong>Shipping out</strong> — Pay via invoice link. We ship after payment and ALWAYS wait for a shipping address.
              </p>
            </td>
          </tr>

          <!-- Watch Details -->
          <tr>
            <td style="padding:8px 40px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f9fafb;border-radius:8px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:14px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                      <tr>
                        <td style="width:50%;vertical-align:top;">
                          <p style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Watch</p>
                          <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">${escapeHtml(brand)} ${escapeHtml(model || "")}</p>
                          ${referenceNumber ? `<p style="font-size:12px;color:#52525b;margin:2px 0 0;">Ref: ${escapeHtml(referenceNumber)}</p>` : ""}
                        </td>
                        <td style="width:50%;vertical-align:top;text-align:right;">
                          <p style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Estimate</p>
                          <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">${escapeHtml(estimateNumber)}</p>
                          ${targetDate ? `<p style="font-size:12px;color:#52525b;margin:2px 0 0;">Target: ${format(targetDate, "MMM d, yyyy")}</p>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Findings Header -->
          <tr>
            <td style="padding:8px 40px;">
              <p style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0;border-bottom:2px solid #047857;padding-bottom:6px;">
                Inspection Findings — ${isBraceletOnly ? "Bracelet Only" : "Complete Watch"}
              </p>
            </td>
          </tr>

          <!-- Findings List -->
          ${sections.map(section => `
          <tr>
            <td style="padding:4px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #f4f4f5;">
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">
                      ${section.waiverRequired ? '⚠️ ' : ''}${escapeHtml(section.title)}
                      ${section.condition ? `<span style="font-size:11px;font-weight:400;color:#71717a;margin-left:6px;padding:2px 6px;background:#f4f4f5;border-radius:4px;">${escapeHtml(formatCondition(section.condition))}</span>` : ''}
                    </p>
                    ${section.notes.length > 0 ? `<p style="font-size:13px;color:#52525b;margin:4px 0 0;line-height:1.4;">${section.notes.map(escapeHtml).join(' · ')}</p>` : ''}
                    ${section.waiverRequired ? '<p style="font-size:11px;color:#dc2626;margin:3px 0 0;font-weight:500;">⚠️ Waiver Required</p>' : ''}
                  </td>
                  <td style="padding:10px 0;text-align:right;vertical-align:top;white-space:nowrap;">
                    ${section.price > 0 ? `<p style="font-size:14px;font-weight:600;color:#1a1a1a;margin:0;">$${section.price.toLocaleString()}</p>` : '<p style="font-size:14px;color:#a1a1aa;margin:0;">—</p>'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}

          ${yesNoItems.length > 0 ? `
          <!-- Yes/No Section Header -->
          <tr>
            <td style="padding:24px 40px 8px;">
              <p style="font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0;border-bottom:2px solid #f59e0b;padding-bottom:6px;">
                ⬇ Your Response Required — Please Click Yes or No ⬇
              </p>
            </td>
          </tr>
          ${yesNoItems.map(item => `
          <tr>
            <td style="padding:6px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                <tr>
                  <td style="padding:14px;">
                    <p style="font-size:13px;color:#1a1a1a;margin:0 0 4px;font-weight:500;">${escapeHtml(item.label)}</p>
                    ${item.description ? `<p style="font-size:12px;color:#92400e;margin:0 0 8px;line-height:1.5;font-style:italic;">${escapeHtml(item.description)}</p>` : ''}
                    ${item.price > 0 ? `<p style="font-size:12px;color:#71717a;margin:0 0 10px;">Cost: <strong>$${item.price.toLocaleString()}</strong></p>` : '<p style="margin:0 0 10px;"></p>'}
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:8px;">
                          <a href="${approvalUrl}&item=${item.id}&choice=yes" style="display:inline-block;padding:8px 22px;background-color:#047857;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">✓ YES</a>
                        </td>
                        <td>
                          <a href="${approvalUrl}&item=${item.id}&choice=no" style="display:inline-block;padding:8px 22px;background-color:#ffffff;color:#dc2626;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;border:2px solid #dc2626;">✗ NO</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}
          ` : ''}

          ${(() => {
            const includeBandPolishQuestion = !!inspection.braceletRepair?.includeBandPolishQuestion;
            const jobTypesArr: string[] = Array.isArray(inspection.jobTypes) && inspection.jobTypes.length > 0
              ? inspection.jobTypes
              : [inspection.jobType || ""];
            const isMovementService = jobTypesArr.some((jt: string) => ["antique_movement", "modern_movement", "vintage_movement", "antique_lv2", "modern_lv2", "vintage_lv2", "chrono", "chrono_lv2"].includes(jt));
            const isCaseWork = jobTypesArr.some((jt: string) => jt === "case_work" || jt === "case_restoration");
            const hasRetailPolish = !!inspection.retailPolish;
            const isPreciousMetal = jobTypesArr.some((jt: string) => jt === "gold_bracelet");
            const polishBlocks: string[] = [];

            const braceletScaleHtml = isPreciousMetal ? `
              <tr>
                <td style="padding:8px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                    <tr>
                      <td style="padding:16px;">
                        <p style="font-size:14px;font-weight:600;color:#1e40af;margin:0 0 8px;">⭐ Question: Polish or No Polish for "BRACELET"</p>
                        <p style="font-size:13px;color:#1e3a5f;margin:0;line-height:1.6;">
                          5 = Freshened up a bit<br>
                          7 = New-ish<br>
                          8-10 = As new as possible (Retail polish at $250)<br><br>
                          <strong>Please reply with a number between 5 to 10.</strong>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>` : `
              <tr>
                <td style="padding:8px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                    <tr>
                      <td style="padding:16px;">
                        <p style="font-size:14px;font-weight:600;color:#1e40af;margin:0 0 8px;">⭐ Question: Polish or No Polish for "BRACELET"</p>
                        <p style="font-size:13px;color:#1e3a5f;margin:0;line-height:1.6;">
                          0 = No polish<br>
                          1-2 = Vintage looking<br>
                          3-5 = Freshened up a bit but vintage<br>
                          7 = New-ish<br>
                          8-10 = As new as possible (Retail polish at $250)<br><br>
                          <strong>Please reply with a number between 0 to 10.</strong>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;

            const courtesyPolishHtml = `
              <tr>
                <td style="padding:8px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
                    <tr>
                      <td style="padding:16px;">
                        <p style="font-size:14px;font-weight:600;color:#1e40af;margin:0 0 8px;">⭐ Question: Polish or No Polish "WATCH HEAD"</p>
                        <p style="font-size:13px;color:#1e3a5f;margin:0;line-height:1.6;">
                          Included with movement service work is our NO-COST light courtesy polish of the case and bracelet. Please let us know if you'd like us to perform. <strong>YES / NO</strong>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`;

            if (includeBandPolishQuestion) {
              if (!isBraceletOnly && isMovementService) {
                polishBlocks.push(braceletScaleHtml);
                if (!hasRetailPolish) polishBlocks.push(courtesyPolishHtml);
              } else if (!isBraceletOnly && isCaseWork) {
                polishBlocks.push(braceletScaleHtml);
              } else {
                // Bracelet only
                polishBlocks.push(braceletScaleHtml);
              }
            } else if (!isBraceletOnly && !isCaseWork && !hasRetailPolish) {
              polishBlocks.push(courtesyPolishHtml);
            }

            return polishBlocks.join('');
          })()}

          <!-- T&C + Approve CTA -->
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;text-align:center;">
                <tr>
                  <td>
                    <p style="font-size:13px;color:#52525b;margin:0 0 12px;">
                      By approving, you agree to our
                      <a href="https://www.rolliworks.com/serviceagreement" target="_blank" rel="noopener noreferrer" style="color:#047857;text-decoration:underline;font-weight:500;">Terms &amp; Conditions</a>.
                    </p>
                    <a href="${approvalUrl}" style="display:inline-block;padding:14px 40px;background-color:#047857;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      Review &amp; Approve Work →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e4e4e7;">
              <p style="font-size:14px;color:#1a1a1a;margin:0;">Thank you!</p>
              <p style="font-size:14px;color:#1a1a1a;margin:2px 0;font-weight:600;">Best, Ivy P.</p>
              <p style="font-size:12px;color:#71717a;margin:8px 0 0;line-height:1.5;">
                Rolliworks · 14 N.E. 1st Ave Ste 403 · Miami FL 33132 · 408-800-3244
              </p>
              <p style="font-size:11px;color:#a1a1aa;margin:4px 0 0;">
                M-F 9am to 5pm · Sat-Sun: Closed · IG: @mikerolliworks
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Count how many yes/no flags are set in the form — used for pre-send validation */
function countYesNoFlags(inspection: ExpandedInspectionFormData): number {
  let count = 0;
  const isBraceletOnly = inspection.inspectionType === "bracelet_only";

  const sections: { data: SectionConditionData }[] = isBraceletOnly
    ? [{ data: inspection.braceletCondition }]
    : [
        { data: inspection.dialCondition },
        { data: inspection.handsCondition },
        { data: inspection.bezelCondition },
        { data: inspection.crownCondition },
        { data: inspection.caseCondition },
        { data: inspection.crystalCondition },
        { data: inspection.braceletCondition },
      ];

  for (const { data } of sections) {
    if (data.customNoteAddYesNo) count++;
    if (data.additionalNotes) {
      count += data.additionalNotes.filter(an => an.addYesNo).length;
    }
  }

  const br = inspection.braceletRepair;
  if (br.steelSideShowYesNo) count++;
  if (br.steelCenterShowYesNo) count++;
  if (br.goldCenterShowYesNo) count++;
  if (br.shorterLinksShowYesNo) count++;
  if (br.invertPiecesShowYesNo) count++;
  if (isBraceletOnly) {
    if (inspection.watchHeadRestoreAddYesNo) count++;
    if (inspection.gasketsAddYesNo) count++;
  }

  return count;
}

export { collectYesNoItems, countYesNoFlags };
export type { YesNoItem, SectionRenderData };
