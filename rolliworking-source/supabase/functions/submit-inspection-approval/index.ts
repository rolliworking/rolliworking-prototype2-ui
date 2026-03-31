import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 100);
}

interface ApprovalItem {
  id: string;
  label: string;
  choice: "yes" | "no";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const rawName = String(body.approvedByName || '');
    const tcAgreed = Boolean(body.tcAgreed);
    const approvalItems: ApprovalItem[] = Array.isArray(body.approvalItems) ? body.approvalItems : [];
    const groupId = body.groupId ? String(body.groupId) : null;
    const approvalId = body.approvalId ? String(body.approvalId) : null;
    const polishAnswers = body.polishAnswers && typeof body.polishAnswers === "object" ? body.polishAnswers : {};
    const questionAnswers = body.questionAnswers && typeof body.questionAnswers === "object" ? body.questionAnswers : {};
    const clientNotes = typeof body.clientNotes === "string" ? body.clientNotes.trim().slice(0, 1000) : null;

    // Must have either approvalId or groupId
    if (!approvalId && !groupId) {
      return new Response(
        JSON.stringify({ error: "Missing approval or group ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate name
    const approvedByName = sanitizeName(rawName);
    if (!approvedByName || approvedByName.length < 2) {
      return new Response(
        JSON.stringify({ error: "Name must be at least 2 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!tcAgreed) {
      return new Response(
        JSON.stringify({ error: "Terms and conditions must be accepted" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate approval items
    for (const item of approvalItems) {
      if (!item.id || !item.label || !["yes", "no"].includes(item.choice)) {
        return new Response(
          JSON.stringify({ error: "Invalid approval item format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Capture legal audit trail
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const tcVersionUrl = "https://www.rolliworks.com/serviceagreement";

    // Determine which approvals to update
    let approvalIds: string[] = [];

    if (groupId && UUID_REGEX.test(groupId)) {
      // GROUP MODE: fetch all pending approvals in this group
      const { data: groupApprovals, error: groupError } = await supabase
        .from("inspection_approvals")
        .select("id, status, inspection_id")
        .eq("group_id", groupId)
        .eq("status", "pending");

      if (groupError || !groupApprovals || groupApprovals.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pending approvals found in group" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      approvalIds = groupApprovals.map((a: any) => a.id);

      // For group mode, each approval gets its own subset of items and per-item answers
      for (const approval of groupApprovals) {
        // Filter approval items that belong to THIS specific approval
        // Items are tagged with _approvalId by the frontend
        const perApprovalItems = approvalItems.filter(
          (item: any) => !item._approvalId || item._approvalId === approval.id
        );

        // Extract per-item polish/scale answers keyed as Q2__approvalId
        const perItemPolish: Record<string, any> = {};
        const perItemQuestionAnswers: Record<string, any> = {};
        for (const [key, val] of Object.entries(polishAnswers)) {
          // Check for per-item key format: key__approvalId
          const parts = key.split("__");
          if (parts.length === 2 && parts[1] === approval.id) {
            // Store with the base key for this approval's record
            perItemPolish[parts[0]] = val;
          } else if (parts.length === 1) {
            // Shared/non-per-item answers
            perItemPolish[key] = val;
          }
        }
        for (const [key, val] of Object.entries(questionAnswers)) {
          const parts = key.split("__");
          if (parts.length === 2 && parts[1] === approval.id) {
            perItemQuestionAnswers[parts[0]] = val;
          } else if (parts.length === 1) {
            perItemQuestionAnswers[key] = val;
          }
        }

        // Clean _approvalId from stored items
        const cleanedItems = perApprovalItems.map((item: any) => {
          const { _approvalId, ...rest } = item;
          return rest;
        });

        const { error: updateError } = await supabase
          .from("inspection_approvals")
          .update({
            status: "approved",
            approved_by_name: approvedByName,
            tc_agreed: true,
            approval_items: cleanedItems,
            polish_answers: Object.keys(perItemPolish).length > 0 ? perItemPolish : polishAnswers,
            question_answers: Object.keys(perItemQuestionAnswers).length > 0 ? perItemQuestionAnswers : questionAnswers,
            client_notes: clientNotes,
            approved_at: new Date().toISOString(),
            tc_ip_address: clientIp,
            tc_user_agent: userAgent,
            tc_version_url: tcVersionUrl,
          })
          .eq("id", approval.id);
        const waiverAcknowledged = Boolean(body.waiverAcknowledged);
        if (waiverAcknowledged && approval.inspection_id) {
          try {
            const { data: job } = await supabase
              .from("jobs")
              .select("id")
              .eq("inspection_id", approval.inspection_id)
              .single();

            if (job) {
              await supabase
                .from("liability_waivers")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                  customer_name: approvedByName,
                })
                .eq("job_id", job.id)
                .eq("status", "pending");

              await supabase
                .from("jobs")
                .update({ waiver_signed: true })
                .eq("id", job.id);

              await supabase
                .from("inspections")
                .update({ waiver_signed: true })
                .eq("id", approval.inspection_id);
            }
          } catch (waiverErr) {
            console.error("Error updating waiver for grouped approval:", waiverErr);
          }
        }
      }

      console.log(`Group approval submitted: ${groupId}, ${groupApprovals.length} approvals by ${approvedByName}`);
    } else if (approvalId && UUID_REGEX.test(approvalId)) {
      // SINGLE MODE (original behavior)
      const { data: approval, error: fetchError } = await supabase
        .from("inspection_approvals")
        .select("*")
        .eq("id", approvalId)
        .single();

      if (fetchError || !approval) {
        return new Response(
          JSON.stringify({ error: "Approval not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (approval.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "This approval has already been submitted" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: updateError } = await supabase
        .from("inspection_approvals")
        .update({
          status: "approved",
          approved_by_name: approvedByName,
          tc_agreed: true,
          approval_items: approvalItems,
          polish_answers: polishAnswers,
          question_answers: questionAnswers,
          client_notes: clientNotes,
          approved_at: new Date().toISOString(),
          tc_ip_address: clientIp,
          tc_user_agent: userAgent,
          tc_version_url: tcVersionUrl,
        })
        .eq("id", approvalId);

      if (updateError) {
        console.error("Error updating approval:", updateError);
        throw updateError;
      }

      approvalIds = [approvalId];
      console.log("Inspection approval submitted:", approvalId, "by", approvedByName);

      // Waiver handling for single mode
      const waiverAcknowledged = Boolean(body.waiverAcknowledged);
      if (waiverAcknowledged) {
        try {
          const { data: approvalForWaiver } = await supabase
            .from("inspection_approvals")
            .select("inspection_id")
            .eq("id", approvalId)
            .single();

          if (approvalForWaiver?.inspection_id) {
            const { data: job } = await supabase
              .from("jobs")
              .select("id")
              .eq("inspection_id", approvalForWaiver.inspection_id)
              .single();

            if (job) {
              await supabase
                .from("liability_waivers")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                  customer_name: approvedByName,
                })
                .eq("job_id", job.id)
                .eq("status", "pending");

              await supabase
                .from("jobs")
                .update({ waiver_signed: true })
                .eq("id", job.id);

              await supabase
                .from("inspections")
                .update({ waiver_signed: true })
                .eq("id", approvalForWaiver.inspection_id);
            }
          }
        } catch (waiverErr) {
          console.error("Error updating waiver status:", waiverErr);
        }
      }
    }

    // ─── RS Push & Internal Email (use first approval's inspection) ───
    const firstApprovalId = approvalIds[0];
    let estimateNumber: string | null = null;
    let inspectionType: string | null = null;
    let fullInspection: any = null;
    let customerName: string | null = null;
    let watchBrand: string | null = null;
    let watchModel: string | null = null;

    try {
      const { data: inspectionData } = await supabase
        .from("inspection_approvals")
        .select("inspection_id")
        .eq("id", firstApprovalId)
        .single();

      if (inspectionData?.inspection_id) {
        const { data: inspection } = await supabase
          .from("inspections")
          .select("*, watches(estimate_number, brand, model, customers(name, email))")
          .eq("id", inspectionData.inspection_id)
          .single();

        fullInspection = inspection;
        inspectionType = inspection?.inspection_type || null;
        estimateNumber = (inspection?.watches as any)?.estimate_number || null;
        watchBrand = (inspection?.watches as any)?.brand || null;
        watchModel = (inspection?.watches as any)?.model || null;
        customerName = (inspection?.watches as any)?.customers?.name || null;
      }
    } catch (e) {
      console.error("Failed to fetch inspection data for RS push:", e);
    }

    // Send internal email notification
    if (estimateNumber) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const approvedCount = approvalItems.filter((i: ApprovalItem) => i.choice === "yes").length;
          const declinedCount = approvalItems.filter((i: ApprovalItem) => i.choice === "no").length;

          const responsesHtml = approvalItems.map((item: ApprovalItem) => {
            const icon = item.choice === "yes" ? "✅" : "❌";
            const price = (item as any).price ? ` ($${(item as any).price})` : "";
            return `${icon} ${item.label}${price} — <strong>${item.choice.toUpperCase()}</strong>`;
          }).join("<br/>");

          const typeLabel = inspectionType === "bracelet_only" ? "Band Only" : "Inspection";
          const groupLabel = groupId ? ` (${approvalIds.length} items)` : "";
          const summaryBadge = `${approvedCount} approved, ${declinedCount} declined`;

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #1a1a2e;">${typeLabel}${groupLabel} — Client Response</h2>
              <p><strong>Estimate #:</strong> ${estimateNumber}</p>
              <p><strong>Customer:</strong> ${customerName || approvedByName}</p>
              <p><strong>Watch:</strong> ${watchBrand || "N/A"} ${watchModel || ""}</p>
              <p><strong>Approved by:</strong> ${approvedByName}</p>
              <p><strong>Submitted at:</strong> ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
              <p style="background: #f0f4ff; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                <strong>Summary:</strong> ${summaryBadge}
              </p>
              <hr style="border: 1px solid #e0e0e0; margin: 16px 0;" />
              <h3 style="color: #1a1a2e;">Client Responses</h3>
              <p>${responsesHtml || "No items to approve."}</p>
              ${Object.keys(polishAnswers).length > 0 ? `
                <hr style="border: 1px solid #e0e0e0; margin: 16px 0;" />
                <h3 style="color: #1a1a2e;">Polish Preferences</h3>
                <p>${Object.entries(polishAnswers).map(([key, val]) => {
                  const label = key === "bracelet_polish_scale" ? "Bracelet Polish" : key === "courtesy_polish" ? "Courtesy Polish" : key;
                  const display = val === "no_polish" ? "No Polish" : val === "yes" ? "Yes" : val === "no" ? "No" : `Level ${val}`;
                  return `<strong>${label}:</strong> ${display}`;
                }).join("<br/>")}</p>
              ` : ""}
              ${Object.keys(questionAnswers).length > 0 ? `
                <h3 style="color: #1a1a2e;">Additional Questions</h3>
                <p>${Object.entries(questionAnswers).map(([key, val]) => `<strong>${key}:</strong> ${val === "yes" ? "✅ Yes" : val === "no" ? "❌ No" : String(val)}`).join("<br/>")}</p>
              ` : ""}
              ${clientNotes ? `
                <hr style="border: 1px solid #e0e0e0; margin: 16px 0;" />
                <h3 style="color: #1a1a2e;">📝 Client Notes & Requests</h3>
                <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 8px;">
                  <p style="margin: 0; white-space: pre-wrap;">${clientNotes.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                </div>
              ` : ""}
            </div>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Rolliworks <noreply@rolliworks.com>",
              to: ["help@rolliworks.com"],
              subject: `📩 Client Reply — Est# ${estimateNumber} — ${approvedByName} (${summaryBadge})${groupLabel}`,
              html: emailHtml,
            }),
          });

          console.log("Internal approval email sent for", estimateNumber);
        } catch (emailErr) {
          console.error("Error sending internal approval email:", emailErr);
        }
      }
    }

    // Push T&C acceptance to RolliSuite
    if (estimateNumber) {
      const rsApiKey = Deno.env.get("ROLLISUITE_API_KEY");
      if (rsApiKey) {
        try {
          const rsPayload = {
            estimate_number: estimateNumber,
            client_name: customerName || approvedByName,
            approved_by_name: approvedByName,
            tc_agreed: true,
            tc_version_url: tcVersionUrl,
            tc_accepted_at: new Date().toISOString(),
            tc_ip_address: clientIp,
            tc_user_agent: userAgent,
            approval_items: approvalItems.map((item: ApprovalItem) => ({
              id: item.id,
              label: item.label,
              price: (item as any).price || 0,
              choice: item.choice,
            })),
          };

          await fetch(
            "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-tc-acceptance",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${rsApiKey}`,
              },
              body: JSON.stringify(rsPayload),
            }
          );
          console.log("RS T&C push successful for", estimateNumber);
        } catch (rsErr) {
          console.error("RS T&C push error:", rsErr);
        }

        // Push approval choices memo
        try {
          const approvedItems = approvalItems.filter((item: ApprovalItem) => item.choice === "yes" || item.choice === "no");
          if (approvedItems.length > 0) {
            const memoPayload = {
              eventId: crypto.randomUUID(),
              eventType: "PARTS_APPROVED",
              estimateNumber,
              parts: approvedItems.map((item: ApprovalItem) => ({
                partNumber: item.choice === "yes" ? "APPROVED" : "DECLINED",
                description: `${item.choice === "yes" ? "✓" : "✗"} ${item.label}`,
                quantity: 1,
                price: (item as any).price || 0,
              })),
              approvedAt: new Date().toISOString(),
              approvedBy: approvedByName,
            };

            await fetch(
              "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-parts-approved",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${rsApiKey}`,
                },
                body: JSON.stringify(memoPayload),
              }
            );
            console.log("RS approval memo push successful for", estimateNumber);
          }
        } catch (memoErr) {
          console.error("RS approval memo push error:", memoErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Approval submitted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit approval";
    console.error("Error in submit-inspection-approval:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
