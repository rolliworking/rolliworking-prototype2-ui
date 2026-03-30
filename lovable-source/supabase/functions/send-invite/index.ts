import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: string;
  name?: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Rolliworks <send@quotes.rolliworks.com>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }
  
  return res.json();
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get the authorization header to verify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user's token to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify user is admin using service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Only admins can send invitations" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, role }: InviteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "A pending invitation already exists for this email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        role: role || "office",
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Invite creation error:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the production app URL for invite links
    const appUrl = "https://rollisuite.lovable.app";
    const inviteUrl = `${appUrl}/auth?invite=${invitation.token}`;

    // Get inviter's name
    const { data: inviterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "Your administrator";

    // Send invite email
    const emailResponse = await sendEmail(
      email,
      "You've been invited to RolliSuite",
      `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Welcome to RolliSuite</h1>
          
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            ${inviterName} has invited you to join RolliSuite, an Enterprise Resource Planner for watch service.
          </p>
          
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            Click the button below to create your account:
          </p>
          
          <div style="margin: 32px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #6a6a6a; font-size: 14px;">
            This invitation will expire in 7 days.
          </p>
          
          <p style="color: #6a6a6a; font-size: 14px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
          
          <p style="color: #9a9a9a; font-size: 12px;">
            RolliSuite - Enterprise Resource Planner
          </p>
        </div>
      `
    );

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, invitation: { id: invitation.id, email: invitation.email } }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
