import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ShippingLabelEmailRequest = {
  toEmail: string;
  subject: string;
  body: string;
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType?: string;
  };
};

async function sendEmail(params: {
  toEmail: string;
  subject: string;
  html: string;
  bcc?: string[];
  attachment?: { filename: string; content: string; contentType?: string };
}) {
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

  const bccList = params.bcc?.filter(Boolean) || [];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Rolliworks <send@quotes.rolliworks.com>",
      to: [params.toEmail],
      subject: params.subject,
      html: params.html,
      ...(bccList.length > 0 ? { bcc: bccList } : {}),
      ...(params.attachment
        ? {
            attachments: [
              {
                filename: params.attachment.filename,
                content: params.attachment.content,
                contentType: params.attachment.contentType,
              },
            ],
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to send email: ${errorText}`);
  }

  return await res.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userEmail = user.email;

    const { toEmail, subject, body, attachment }: ShippingLabelEmailRequest = await req.json();
    
    console.log("Received request:", {
      toEmail,
      subject,
      bodyLength: body?.length || 0,
      hasAttachment: !!attachment,
      attachmentFilename: attachment?.filename,
      attachmentContentLength: attachment?.contentBase64?.length || 0,
      attachmentContentType: attachment?.contentType,
    });

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "toEmail is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px 0; border-bottom: 2px solid #0077c5;">
          <h1 style="margin: 0; font-size: 22px; color: #111;">Rolliworks</h1>
        </div>
        <div style="padding: 24px 0;">
          <p style="white-space: pre-wrap; line-height: 1.6; color: #222; margin: 0;">${(body || "").replace(/\n/g, "<br>")}</p>
        </div>
      </div>
    `;

    // Build BCC list: help@rolliworks.com + logged-in user
    const bccList = ["help@rolliworks.com"];
    if (userEmail && userEmail !== toEmail) {
      bccList.push(userEmail);
    }

    const emailResponse = await sendEmail({
      toEmail,
      subject: subject || "Your shipping label",
      html: htmlBody,
      bcc: bccList,
      ...(attachment?.contentBase64
        ? {
            attachment: {
              filename: attachment.filename || "shipping-label.pdf",
              content: attachment.contentBase64,
              contentType: attachment.contentType,
            },
          }
        : {}),
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-shipping-label-email:", error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
