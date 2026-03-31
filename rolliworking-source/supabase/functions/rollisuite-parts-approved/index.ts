import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ApprovedPart {
  partNumber: string;
  description: string;
  quantity: number;
  price: number;
  status: string;
}

interface PartsApprovedPayload {
  eventId: string;
  eventType: "PARTS_APPROVED";
  estimateNumber: string;
  parts: ApprovedPart[];
  approvedParts: ApprovedPart[];
  declinedParts: ApprovedPart[];
  approvedAt: string;
  approvedBy?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT - required for Lovable Cloud
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("JWT validation failed:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.email);
     const body = await req.json();
     const { estimateNumber, parts, approvedBy } = body;
 
     if (!estimateNumber || !parts || !Array.isArray(parts) || parts.length === 0) {
       return new Response(
         JSON.stringify({ error: "Missing required fields: estimateNumber, parts" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Get API key from environment
     const apiKey = Deno.env.get("ROLLISUITE_API_KEY");
     if (!apiKey) {
       console.error("ROLLISUITE_API_KEY not configured");
       return new Response(
         JSON.stringify({ error: "API key not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Build payload for RolliSuite - separate approved and declined
     const allMapped = parts.map((p: { name?: string; description?: string; partNumber?: string; price?: number | null; quantity?: number; qty?: number; status?: string }) => ({
       partNumber: p.partNumber || p.name || p.description || "UNKNOWN",
       description: p.name || p.description || "Unknown Part",
       quantity: p.quantity || p.qty || 1,
       price: p.price ?? 0,
       status: p.status || "approved",
     }));

     const payload: PartsApprovedPayload = {
       eventId: crypto.randomUUID(),
       eventType: "PARTS_APPROVED",
       estimateNumber,
       parts: allMapped,
       approvedParts: allMapped.filter((p: ApprovedPart) => p.status === "approved"),
       declinedParts: allMapped.filter((p: ApprovedPart) => p.status === "declined"),
       approvedAt: new Date().toISOString(),
       approvedBy: approvedBy || undefined,
     };
 
     console.log("Sending parts approved webhook to RolliSuite:", JSON.stringify(payload));
 
     // Send to RolliSuite
     const rsUrl = "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-parts-approved";
     const response = await fetch(rsUrl, {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${apiKey}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify(payload),
     });
 
     const rsData = await response.json().catch(() => ({}));
 
     if (!response.ok) {
       console.error("RolliSuite webhook failed:", response.status, rsData);
       return new Response(
         JSON.stringify({ 
           success: false, 
           error: "RolliSuite webhook failed",
           status: response.status,
           details: rsData 
         }),
         { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("RolliSuite webhook success:", rsData);
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         eventId: payload.eventId,
         rsResponse: rsData 
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (err: unknown) {
     const message = err instanceof Error ? err.message : "Internal error";
     console.error("Error in rollisuite-parts-approved:", message);
     return new Response(
       JSON.stringify({ error: message }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });