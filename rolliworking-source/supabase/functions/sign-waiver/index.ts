import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignWaiverRequest {
  waiverId: string;
  customerName: string;
}

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

function sanitizeCustomerName(name: string): string {
  // Remove HTML/script tags, limit length, trim whitespace
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 100);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SignWaiverRequest = await req.json();
    const waiverId = String(body.waiverId || '');
    const rawName = String(body.customerName || '');

    // Validate waiver ID format
    if (!waiverId || !isValidUUID(waiverId)) {
      return new Response(
        JSON.stringify({ error: "Invalid waiver ID format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize and validate customer name
    const customerName = sanitizeCustomerName(rawName);
    if (!customerName || customerName.length < 2) {
      return new Response(
        JSON.stringify({ error: "Customer name must be at least 2 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching waiver:", waiverId);

    // Fetch the waiver
    const { data: waiver, error: fetchError } = await supabase
      .from("liability_waivers")
      .select("*")
      .eq("id", waiverId)
      .single();

    if (fetchError || !waiver) {
      console.error("Waiver not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Waiver not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (waiver.status === "completed") {
      return new Response(
        JSON.stringify({ error: "This waiver has already been signed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const completedAt = new Date().toISOString();

    // Update waiver to completed
    console.log("Updating waiver to completed");
    const { error: updateError } = await supabase
      .from("liability_waivers")
      .update({
        status: "completed",
        customer_name: customerName,
        completed_at: completedAt,
      })
      .eq("id", waiverId);

    if (updateError) {
      console.error("Error updating waiver:", updateError);
      throw updateError;
    }

    // Update job to mark waiver as signed
    if (waiver.job_id) {
      console.log("Updating job waiver status:", waiver.job_id);
      await supabase
        .from("jobs")
        .update({
          needs_liability_waiver: false,
          waiver_signed: true,
        })
        .eq("id", waiver.job_id);
    }

    console.log("Waiver signed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Waiver signed successfully",
        waiver: {
          watchBrand: waiver.watch_brand,
          watchModel: waiver.watch_model,
          serialNumber: waiver.serial_number,
          customerEmail: waiver.customer_email,
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to sign waiver";
    console.error("Error in sign-waiver function:", error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
