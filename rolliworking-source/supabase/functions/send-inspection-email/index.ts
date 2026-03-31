import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildApprovalEmail(params: {
  customerName: string;
  brand: string;
  model: string;
  estimateNumber: string;
  approvalUrl: string;
}): string {
  const { customerName, brand, model, estimateNumber, approvalUrl } = params;
  const firstName = customerName.split(" ")[0] || customerName;
  const watchDesc = `${brand}${model ? ` ${model}` : ""}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rolliworks Inspection Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#c9a94e;font-size:28px;font-weight:700;letter-spacing:2px;">ROLLIWORKS</h1>
              <p style="margin:8px 0 0;color:#a0a0b0;font-size:13px;letter-spacing:1px;">INSPECTION REPORT</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
                Dear ${firstName},
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
                Your <strong>${watchDesc}</strong> (Est #${estimateNumber}) has been inspected by our team. We've prepared a detailed report of our findings for your review.
              </p>
              <p style="margin:0 0 30px;color:#333;font-size:16px;line-height:1.6;">
                Please click the button below to review our inspection findings, approve or decline optional services, and accept our Service Agreement.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:10px 0 30px;">
                    <a href="${approvalUrl}" style="display:inline-block;background-color:#c9a94e;color:#1a1a2e;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px;">
                      REVIEW &amp; APPROVE
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px;color:#666;font-size:14px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 30px;word-break:break-all;">
                <a href="${approvalUrl}" style="color:#c9a94e;font-size:13px;">${approvalUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e5e5e5;margin:30px 0;">

              <p style="margin:0 0 10px;color:#333;font-size:14px;line-height:1.6;">
                <strong>What happens next?</strong>
              </p>
              <p style="margin:0 0 8px;color:#555;font-size:14px;line-height:1.6;">
                We will be awaiting your reply before adding your job to our work queue. The target date is just a marker, not a set due date. After all work is complete, we will email an invoice via QuickBooks.
              </p>
              <p style="margin:0;color:#555;font-size:14px;line-height:1.6;">
                <strong>Pick up in person</strong> — Payment can be made during pick up time.<br>
                <strong>Shipping out</strong> — You can use the link to your invoice to pay with a Credit or Debit Card. (We will ship after payment and we will ALWAYS wait for a shipping address before shipping).
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:24px 40px;text-align:center;border-top:1px solid #e5e5e5;">
              <p style="margin:0 0 4px;color:#999;font-size:12px;">© ${new Date().getFullYear()} Rolliworks. All rights reserved.</p>
              <p style="margin:0;color:#999;font-size:12px;">
                <a href="https://www.rolliworks.com/serviceagreement" style="color:#c9a94e;text-decoration:none;">Service Agreement</a>
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, customerName, brand, model, estimateNumber, approvalUrl } = await req.json();

    if (!to || !subject || !approvalUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildApprovalEmail({
      customerName: customerName || "Valued Customer",
      brand: brand || "",
      model: model || "",
      estimateNumber: estimateNumber || "",
      approvalUrl,
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Rolliworks <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      return new Response(JSON.stringify({ error: data.message || "Failed to send email" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending email:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
