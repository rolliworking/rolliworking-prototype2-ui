import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function buildDefaultHtml(params: {
  customerName: string;
  watchDesc: string;
  estimateNumber: string;
}): string {
  const { customerName, watchDesc, estimateNumber } = params;
  const firstName = customerName.split(" ")[0] || customerName;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rolliworks – Thank You</title>
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
              <p style="margin:8px 0 0;color:#a0a0b0;font-size:13px;letter-spacing:1px;">CONFIRMATION</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
                Dear ${firstName},
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
                Thank you for your reply regarding your <strong>${watchDesc}</strong> (Est #${estimateNumber}). We have received your selections and your bracelet has been added to our work queue.
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:16px;line-height:1.6;">
                We appreciate your prompt response. If you have any questions or need to make changes, please don't hesitate to reach out.
              </p>
              <p style="margin:0;color:#333;font-size:16px;line-height:1.6;">
                Thank you for trusting Rolliworks with your timepiece.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:24px 40px;text-align:center;border-top:1px solid #e5e5e5;">
              <p style="margin:0 0 4px;color:#999;font-size:12px;">© ${new Date().getFullYear()} Rolliworks. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function applyPlaceholders(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{\{customer_name\}\}/g, vars.customer_name || "")
    .replace(/\{\{first_name\}\}/g, vars.first_name || "")
    .replace(/\{\{brand\}\}/g, vars.brand || "")
    .replace(/\{\{model\}\}/g, vars.model || "")
    .replace(/\{\{watch_brand\}\}/g, vars.brand || "")
    .replace(/\{\{watch_model\}\}/g, vars.model || "")
    .replace(/\{\{estimate_number\}\}/g, vars.estimate_number || "")
    .replace(/\{\{watch_desc\}\}/g, vars.watch_desc || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, customerName, brand, model, estimateNumber } = await req.json();

    if (!to || !customerName) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, customerName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const watchDesc = `${brand || ""}${model ? ` ${model}` : ""}`.trim() || "bracelet";
    const firstName = customerName.split(" ")[0] || customerName;

    // Try to load custom template from DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("type", "bracelet_reply_confirmation")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    let subject: string;
    let html: string;

    const vars: Record<string, string> = {
      customer_name: customerName,
      first_name: firstName,
      brand: brand || "",
      model: model || "",
      estimate_number: estimateNumber || "",
      watch_desc: watchDesc,
    };

    if (template) {
      subject = applyPlaceholders(template.subject, vars);
      // If the body looks like HTML, use it directly; otherwise wrap in basic template
      const body = applyPlaceholders(template.body, vars);
      if (body.trim().startsWith("<!DOCTYPE") || body.trim().startsWith("<html")) {
        html = body;
      } else {
        // Wrap plain text body in the branded template shell
        html = buildDefaultHtml({ customerName, watchDesc, estimateNumber: estimateNumber || "" })
          .replace(
            /<td style="padding:40px;">[\s\S]*?<\/td>\s*<\/tr>\s*<!-- Footer -->/,
            `<td style="padding:40px;">${body.replace(/\n/g, "<br>")}</td></tr><!-- Footer -->`
          );
      }
    } else {
      subject = `Rolliworks – Thank You for Your Reply (Est #${estimateNumber || ""})`;
      html = buildDefaultHtml({ customerName, watchDesc, estimateNumber: estimateNumber || "" });
    }

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
        from: "Rolliworks <noreply@quotes.rolliworks.com>",
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
    console.error("Error sending courtesy email:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
