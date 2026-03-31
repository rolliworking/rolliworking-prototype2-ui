import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeName(name: string): string {
  return name.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, 100);
}

interface PartItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  choice: "yes" | "no";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const approvalId = body.approvalId ? String(body.approvalId) : null;
    const rawName = String(body.approvedByName || "");
    const partsItems: PartItem[] = Array.isArray(body.partsItems) ? body.partsItems : [];
    const clientNotes = typeof body.clientNotes === "string" ? body.clientNotes.trim().slice(0, 1000) : null;

    if (!approvalId || !UUID_REGEX.test(approvalId)) {
      return new Response(
        JSON.stringify({ error: "Missing approval ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const approvedByName = sanitizeName(rawName);
    if (!approvedByName || approvedByName.length < 2) {
      return new Response(
        JSON.stringify({ error: "Name must be at least 2 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate all items have a choice
    for (const item of partsItems) {
      if (!["yes", "no"].includes(item.choice)) {
        return new Response(
          JSON.stringify({ error: "All parts must be approved or declined" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the approval
    const { data: approval, error: fetchError } = await supabase
      .from("parts_approvals")
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

    // Capture audit trail
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Update the approval record
    const { error: updateError } = await supabase
      .from("parts_approvals")
      .update({
        status: "approved",
        approved_by_name: approvedByName,
        tc_agreed: true,
        parts_items: partsItems,
        client_notes: clientNotes,
        approved_at: new Date().toISOString(),
        tc_ip_address: clientIp,
        tc_user_agent: userAgent,
      })
      .eq("id", approvalId);

    if (updateError) {
      console.error("Error updating parts approval:", updateError);
      throw updateError;
    }

    // Now update the job's parts_requests based on client choices
    const jobId = approval.job_id;
    const { data: job } = await supabase
      .from("jobs")
      .select("parts_requests, estimate_number, watch_brand, watch_model, client_name")
      .eq("id", jobId)
      .single();

    if (job) {
      const existingParts = Array.isArray(job.parts_requests) ? job.parts_requests : [];

      // Map client choices to existing parts
      const updatedParts = existingParts.map((p: any) => {
        const clientChoice = partsItems.find((ci) => ci.id === p.id);
        if (clientChoice) {
          return {
            ...p,
            status: clientChoice.choice === "yes" ? "approved" : "declined",
          };
        }
        return p;
      });

      // Update job: set parts, status to in_progress, parts_approval_status
      const allAnswered = partsItems.length > 0;
      const hasApproved = partsItems.some((p) => p.choice === "yes");

      await supabase
        .from("jobs")
        .update({
          parts_requests: updatedParts,
          parts_approval_status: hasApproved ? "approved" : "declined",
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`Parts approval submitted for job ${jobId}, status → in_progress`);

      // Send internal notification email
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey && job.estimate_number) {
        try {
          const approvedCount = partsItems.filter((i) => i.choice === "yes").length;
          const declinedCount = partsItems.filter((i) => i.choice === "no").length;
          const summaryBadge = `${approvedCount} approved, ${declinedCount} declined`;

          const responsesHtml = partsItems.map((item) => {
            const icon = item.choice === "yes" ? "✅" : "❌";
            return `${icon} ${item.name} (Qty: ${item.qty}) — $${(item.price * item.qty).toFixed(2)} — <strong>${item.choice.toUpperCase()}</strong>`;
          }).join("<br/>");

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #1a1a2e;">Parts Approval — Client Response</h2>
              <p><strong>Estimate #:</strong> ${job.estimate_number}</p>
              <p><strong>Customer:</strong> ${job.client_name || approvedByName}</p>
              <p><strong>Watch:</strong> ${job.watch_brand || "N/A"} ${job.watch_model || ""}</p>
              <p><strong>Approved by:</strong> ${approvedByName}</p>
              <p><strong>Submitted at:</strong> ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</p>
              <p style="background: #f0f4ff; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                <strong>Summary:</strong> ${summaryBadge}
              </p>
              <hr style="border: 1px solid #e0e0e0; margin: 16px 0;" />
              <h3 style="color: #1a1a2e;">Client Responses</h3>
              <p>${responsesHtml}</p>
              ${clientNotes ? `
                <hr style="border: 1px solid #e0e0e0; margin: 16px 0;" />
                <h3 style="color: #1a1a2e;">📝 Client Notes</h3>
                <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 8px;">
                  <p style="margin: 0; white-space: pre-wrap;">${clientNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
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
              subject: `📩 Parts Reply — Est# ${job.estimate_number} — ${approvedByName} (${summaryBadge})`,
              html: emailHtml,
            }),
          });

          console.log("Internal parts approval email sent for", job.estimate_number);
        } catch (emailErr) {
          console.error("Error sending internal parts approval email:", emailErr);
        }
      }

      // Push to RolliSuite
      const rsApiKey = Deno.env.get("ROLLISUITE_API_KEY");
      if (rsApiKey && job.estimate_number) {
        try {
          const approvedParts = partsItems.filter((p) => p.choice === "yes");
          if (approvedParts.length > 0) {
            await fetch(
              "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-parts-approved",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${rsApiKey}`,
                },
                body: JSON.stringify({
                  eventId: crypto.randomUUID(),
                  eventType: "PARTS_APPROVED",
                  estimateNumber: job.estimate_number,
                  parts: approvedParts.map((p) => ({
                    partNumber: "APPROVED",
                    description: `✓ ${p.name}`,
                    quantity: p.qty,
                    price: p.price,
                  })),
                  approvedAt: new Date().toISOString(),
                  approvedBy: approvedByName,
                }),
              }
            );
            console.log("RS parts approval push sent for", job.estimate_number);
          }
        } catch (rsErr) {
          console.error("RS parts approval push error:", rsErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit parts approval";
    console.error("Error in submit-parts-approval:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
