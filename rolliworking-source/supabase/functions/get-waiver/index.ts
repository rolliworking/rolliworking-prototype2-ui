import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GetWaiverRequest {
  waiverIdentifier: string; // Can be UUID or waiver_number (e.g., LW-00001)
  waiverId?: string; // Legacy support
}

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Waiver number pattern: LW-XXXXX
const WAIVER_NUMBER_REGEX = /^LW-\d{5}$/;

function isValidIdentifier(identifier: string): boolean {
  return UUID_REGEX.test(identifier) || WAIVER_NUMBER_REGEX.test(identifier);
}

function sanitizeInput(input: string): string {
  // Remove any potentially dangerous characters, keep only alphanumeric, hyphen
  return input.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 50);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GetWaiverRequest = await req.json();
    const rawIdentifier = body.waiverIdentifier || body.waiverId;

    if (!rawIdentifier) {
      return new Response(
        JSON.stringify({ error: "Waiver identifier is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize and validate the identifier
    const identifier = sanitizeInput(String(rawIdentifier));
    
    if (!isValidIdentifier(identifier)) {
      console.warn("Invalid waiver identifier format:", identifier);
      return new Response(
        JSON.stringify({ error: "Invalid waiver identifier format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching waiver by identifier:", identifier);

    // Try to find by waiver_number first (e.g., LW-00001), then by UUID
    let query = supabase.from("liability_waivers").select("*");
    
    if (identifier.startsWith("LW-")) {
      query = query.eq("waiver_number", identifier);
    } else {
      query = query.eq("id", identifier);
    }

    const { data: waiver, error: fetchError } = await query.single();

    if (fetchError || !waiver) {
      console.error("Waiver not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Waiver not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Waiver found:", waiver.waiver_number || waiver.id);

    return new Response(
      JSON.stringify({ waiver }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch waiver";
    console.error("Error in get-waiver function:", error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
