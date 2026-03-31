import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { approvalId } = body;

    if (!approvalId || !UUID_REGEX.test(String(approvalId))) {
      return new Response(
        JSON.stringify({ error: "Invalid approval ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the parts approval record
    const { data: approval, error: approvalError } = await supabase
      .from("parts_approvals")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (approvalError || !approval) {
      return new Response(
        JSON.stringify({ error: "Approval not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get job details with watch info
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id, estimate_number, watch_brand, watch_model, serial_number,
        client_name, client_email, status,
        inspections(
          watches(
            brand, model, reference_number, estimate_number,
            customers(name, email)
          )
        )
      `)
      .eq("id", approval.job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ approval, job }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch parts approval";
    console.error("Error in get-parts-approval:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
