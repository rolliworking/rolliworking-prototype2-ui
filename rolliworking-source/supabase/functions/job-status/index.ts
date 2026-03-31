import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
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

    // Parse request body
    const { estimate_number } = await req.json();

    if (!estimate_number || typeof estimate_number !== "string") {
      return new Response(
        JSON.stringify({ error: "estimate_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for unrestricted access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up job by estimate_number, join with inspection for completion date
    let { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select(`
        estimate_number,
        status,
        updated_at,
        finished_date,
        inspections (
          status,
          updated_at
        )
      `)
      .eq("estimate_number", estimate_number)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: search via watches table (estimate stored there for inspection-linked jobs)
    if (!job) {
      const { data: watchData, error: watchError } = await supabaseAdmin
        .from("watches")
        .select(`
          estimate_number,
          inspections!inner(
            id,
            status,
            updated_at,
            jobs!inner(
              estimate_number,
              status,
              updated_at,
              finished_date
            )
          )
        `)
        .eq("estimate_number", estimate_number)
        .maybeSingle();

      if (watchError) {
        console.error("Watch lookup error:", watchError);
      } else if (watchData) {
        const inspection = (watchData.inspections as any)?.[0];
        const jobFromWatch = inspection?.jobs?.[0];
        if (jobFromWatch) {
          job = {
            estimate_number: jobFromWatch.estimate_number || watchData.estimate_number,
            status: jobFromWatch.status,
            updated_at: jobFromWatch.updated_at,
            finished_date: jobFromWatch.finished_date,
            inspections: [{ status: inspection.status, updated_at: inspection.updated_at }],
          };
        }
      }
    }

    if (!job) {
      return new Response(
        JSON.stringify({
          found: false,
          estimate_number,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map internal status to external format
    const statusMap: Record<string, string> = {
      in_queue: "in_queue",
      uncased: "in_queue",
      in_progress: "in_progress",
      in_testing: "in_testing",
      finished: "complete",
    };

    const externalStatus = statusMap[job.status] || job.status;

    // Get inspection completion date if inspection exists and is completed
    let inspectionCompletedAt: string | null = null;
    const inspections = job.inspections as Array<{ status: string; updated_at: string }> | null;
    if (inspections && inspections.length > 0 && inspections[0].status === "sent") {
      inspectionCompletedAt = inspections[0].updated_at;
    }

    // Convert finished_date (date) to ISO timestamp if present
    let finishedDate: string | null = null;
    if (job.finished_date) {
      finishedDate = new Date(job.finished_date).toISOString();
    }

    return new Response(
      JSON.stringify({
        found: true,
        estimate_number: job.estimate_number,
        status: externalStatus,
        inspection_completed_at: inspectionCompletedAt,
        status_updated_at: job.updated_at,
        finished_date: finishedDate,
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
