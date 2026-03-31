 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 // Map RS status values to internal status values
 const statusMap: Record<string, string> = {
   uncased: "uncased",
   in_progress: "in_progress",
   parts_pending_approval: "parts_approval",
   parts_on_order: "parts_on_order",
   complete: "finished",
 };
 
 interface StatusUpdatePayload {
   estimate_number: string;
   status?: string;
   status_updated_at?: string;
   email_sent_type?: string;
   email_sent_at?: string;
   email_subject?: string;
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   if (req.method !== "POST") {
     return new Response(
       JSON.stringify({ error: "Method not allowed" }),
       { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 
   try {
     // Validate Bearer token
     const authHeader = req.headers.get("Authorization");
     const expectedKey = Deno.env.get("ROLLISUITE_API_KEY");
 
     if (!authHeader || !authHeader.startsWith("Bearer ")) {
       return new Response(
         JSON.stringify({ error: "Missing authorization header" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const providedKey = authHeader.replace("Bearer ", "");
     if (providedKey !== expectedKey) {
       return new Response(
         JSON.stringify({ error: "Invalid API key" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const payload: StatusUpdatePayload = await req.json();
     console.log("Received status update from RolliSuite:", JSON.stringify(payload));
 
     // Validate required field
     if (!payload.estimate_number) {
       return new Response(
         JSON.stringify({ error: "estimate_number is required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Create Supabase client with service role
     const supabaseAdmin = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
     // Find job by estimate_number (check both jobs table and watches table)
     let jobId: string | null = null;
     
     // Try direct lookup first
     const { data: directJob } = await supabaseAdmin
       .from("jobs")
       .select("id")
       .eq("estimate_number", payload.estimate_number)
       .maybeSingle();
 
     if (directJob) {
       jobId = directJob.id;
     } else {
       // Fallback: lookup via watches table
       const { data: watchJob } = await supabaseAdmin
         .from("watches")
         .select(`
           inspections!inner(
             jobs!inner(id)
           )
         `)
         .eq("estimate_number", payload.estimate_number)
         .maybeSingle();
 
       if (watchJob?.inspections) {
         const inspection = (watchJob.inspections as any)?.[0];
         const job = inspection?.jobs?.[0];
         if (job) {
           jobId = job.id;
         }
       }
     }
 
     if (!jobId) {
       return new Response(
         JSON.stringify({ 
           error: "Job not found", 
           estimate_number: payload.estimate_number 
         }),
         { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Build update object
     const updateData: Record<string, any> = {
       updated_at: new Date().toISOString(),
     };
 
     // Handle status update
     if (payload.status) {
       const mappedStatus = statusMap[payload.status] || payload.status;
       updateData.status = mappedStatus;
 
       // Set timestamp fields based on status
       if (mappedStatus === "uncased" && !updateData.uncased_at) {
         updateData.uncased_at = payload.status_updated_at || new Date().toISOString();
       }
       if (mappedStatus === "in_progress") {
         updateData.work_started = true;
         updateData.work_started_at = payload.status_updated_at || new Date().toISOString();
       }
       if (mappedStatus === "finished") {
         updateData.finished_date = payload.status_updated_at 
           ? new Date(payload.status_updated_at).toISOString().split("T")[0]
           : new Date().toISOString().split("T")[0];
       }
     }
 
     // Handle email event tracking
     if (payload.email_sent_type) {
       // Fetch current sent_email_templates to append
       const { data: currentJob } = await supabaseAdmin
         .from("jobs")
         .select("sent_email_templates")
         .eq("id", jobId)
         .single();
 
       const existingTemplates = (currentJob?.sent_email_templates as any[]) || [];
       
       existingTemplates.push({
         type: payload.email_sent_type,
         sent_at: payload.email_sent_at || new Date().toISOString(),
         subject: payload.email_subject || null,
         source: "rollisuite",
       });
 
       updateData.sent_email_templates = existingTemplates;
       updateData.last_update_email_sent = payload.email_sent_at || new Date().toISOString();
     }
 
     // Update the job
     const { error: updateError } = await supabaseAdmin
       .from("jobs")
       .update(updateData)
       .eq("id", jobId);
 
     if (updateError) {
       console.error("Error updating job:", updateError);
       return new Response(
         JSON.stringify({ error: "Failed to update job", details: updateError.message }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log("Job updated successfully:", jobId, updateData);
 
     return new Response(
       JSON.stringify({
         success: true,
         job_id: jobId,
         estimate_number: payload.estimate_number,
         status_updated: !!payload.status,
         email_logged: !!payload.email_sent_type,
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (err) {
     console.error("Unexpected error:", err);
     return new Response(
       JSON.stringify({ error: "Internal server error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });