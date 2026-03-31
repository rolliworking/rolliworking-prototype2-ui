import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ROLLISUITE_API_KEY = Deno.env.get("ROLLISUITE_API_KEY")!;
const ROLLISUITE_ANON_KEY = Deno.env.get("ROLLISUITE_ANON_KEY")!;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RS_BASE = "https://djbjwcoddddywkgljuja.supabase.co";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Rolliworks AI Assistant — a knowledgeable watch repair workshop helper.

You assist watchmakers and managers with:
- Looking up job details by estimate number, client name, or serial number
- Checking job statuses and history
- Looking up inspection photos from RolliSuite storage
- Creating parts requests
- Answering questions about watch repair workflows

Workshop statuses (in order): intake → inspection → waiting_approval → in_queue → uncased → in_progress → parts_approval → parts_on_order → in_testing → finished

When the user asks to look up a job, use the lookup_job tool.
When the user asks to see inspection photos, use the get_inspection_photos tool with the estimate number.
When the user asks to add a parts request, use the add_parts_request tool.

Always be concise and professional. Format responses with markdown when helpful.
If you show photos, describe what you found and display them.`;

const tools = [
  {
    type: "function",
    function: {
      name: "lookup_job",
      description:
        "Look up a job by estimate number, client name, or serial number. Returns job details including status, watch info, and parts requests.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Estimate number, client name, or serial number to search for",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inspection_photos",
      description:
        "Fetch inspection photos from RolliSuite storage for a given estimate number. Returns URLs of available photos.",
      parameters: {
        type: "object",
        properties: {
          estimate_number: {
            type: "string",
            description: "The estimate number to look up photos for",
          },
        },
        required: ["estimate_number"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_parts_request",
      description:
        "Add a parts request to a job. Requires the job ID (UUID) and a list of parts with descriptions and quantities.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          parts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                qty: { type: "number", default: 1 },
              },
              required: ["description"],
            },
            description: "Array of parts to request",
          },
        },
        required: ["job_id", "parts"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Tool Implementations ───

async function toolLookupJob(query: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const q = query.trim().toLowerCase();

  // 1. Search jobs table
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(`
      id, status, estimate_number, client_name, client_email, watch_brand, watch_model,
      serial_number, due_date, intake_date, parts_requests, parts_approval_status,
      assigned_watchmaker, work_started_at, in_testing_at, finished_date, notes,
      inspections(id, inspection_type, job_type, total_estimate, waiver_required, notes,
        watches(brand, model, reference_number, estimate_number,
          customers(name, email)))
    `)
    .or(
      `estimate_number.ilike.%${q}%,client_name.ilike.%${q}%,serial_number.ilike.%${q}%`
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) console.error("Job lookup error:", error.message);

  if (jobs && jobs.length > 0) {
    return {
      count: jobs.length,
      jobs: jobs.map((j: any) => ({
        id: j.id,
        status: j.status,
        estimate_number: j.estimate_number,
        client_name: j.client_name,
        watch: `${j.watch_brand || ""} ${j.watch_model || ""}`.trim(),
        serial_number: j.serial_number,
        due_date: j.due_date,
        intake_date: j.intake_date,
        assigned_watchmaker: j.assigned_watchmaker,
        parts_approval_status: j.parts_approval_status,
        parts_count: Array.isArray(j.parts_requests) ? j.parts_requests.length : 0,
        total_estimate: j.inspections?.total_estimate,
        inspection_notes: j.inspections?.notes,
        notes: j.notes,
      })),
    };
  }

  // 2. Fallback: search watches/inspections by estimate_number
  const { data: watches, error: wErr } = await supabase
    .from("watches")
    .select(`
      id, brand, model, reference_number, estimate_number,
      customers(name, email),
      inspections(id, inspection_type, job_type, status, total_estimate, notes,
        created_at, waiver_required, pricing_details,
        inspection_approvals(id, status, approved_at, approved_by_name, client_notes))
    `)
    .ilike("estimate_number", `%${q}%`)
    .limit(5);

  if (wErr) console.error("Watch lookup error:", wErr.message);

  if (watches && watches.length > 0) {
    return {
      source: "inspections_only",
      note: "No job record found, but inspection/watch data exists for this estimate.",
      count: watches.length,
      results: watches.map((w: any) => ({
        estimate_number: w.estimate_number,
        watch: `${w.brand || ""} ${w.model || ""}`.trim(),
        reference_number: w.reference_number,
        customer: w.customers?.name,
        customer_email: w.customers?.email,
        inspections: Array.isArray(w.inspections)
          ? w.inspections.map((i: any) => {
              const approvals = Array.isArray(i.inspection_approvals) ? i.inspection_approvals : [];
              const latestApproval = approvals.find((a: any) => a.status === "approved") || approvals[0];
              return {
                id: i.id,
                type: i.inspection_type,
                job_type: i.job_type,
                status: i.status,
                total_estimate: i.total_estimate,
                notes: i.notes,
                created_at: i.created_at,
                client_approved: latestApproval?.status === "approved",
                client_approved_at: latestApproval?.approved_at,
                client_approved_by: latestApproval?.approved_by_name,
                client_notes: latestApproval?.client_notes,
              };
            })
          : [],
      })),
    };
  }

  return { message: "No jobs or inspections found matching that query." };
}

async function toolGetInspectionPhotos(estimateNumber: string) {
  const normalizedEstimate = estimateNumber.trim();

  // Photos are in Cloudflare R2 (not Supabase Storage). We can't list R2 directly.
  // Correct approach: query RS database tables to get photo records, then proxy via get-photo edge function.
  //
  // Lookup chain:
  //   estimate_number → estimates.id (estimate_id)
  //   estimate_id → client_property.reference_number (via client_property.estimate_id)
  //   reference_number → inspections (inspections.reference_number)
  //   inspection.id → inspection_photos (inspection_photos.inspection_id)
  //
  // Photo proxy URL: GET {RS_BASE}/functions/v1/get-photo?path={photo.storage_path}

  if (!ROLLISUITE_ANON_KEY) {
    return { error: "ROLLISUITE_ANON_KEY is not configured" };
  }

  const rsClient = createClient(RS_BASE, ROLLISUITE_ANON_KEY);
  const getPhotoUrl = (storagePath: string) =>
    `${RS_BASE}/functions/v1/get-photo?path=${encodeURIComponent(storagePath)}`;

  // Also resolve reference_number from our local RW database as a fallback
  let localRefNumber: string | null = null;
  try {
    const rwClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: localJob } = await rwClient
      .from("jobs")
      .select("serial_number, inspections(watches(reference_number, estimate_number))")
      .eq("estimate_number", normalizedEstimate)
      .limit(1)
      .maybeSingle();

    if (localJob) {
      localRefNumber = localJob.serial_number;
      const insp = Array.isArray(localJob.inspections) ? localJob.inspections[0] : localJob.inspections;
      const watch = insp && (Array.isArray((insp as any).watches) ? (insp as any).watches[0] : (insp as any).watches);
      if (watch?.reference_number) localRefNumber = watch.reference_number;
    }

    if (!localRefNumber) {
      const { data: localWatch } = await rwClient
        .from("watches")
        .select("reference_number")
        .eq("estimate_number", normalizedEstimate)
        .limit(1)
        .maybeSingle();
      if (localWatch?.reference_number) localRefNumber = localWatch.reference_number;
    }
  } catch (err) {
    console.error("Local RW ref lookup failed:", err);
  }

  // Strategy 1: Query RS database chain (estimates → client_property → inspections → inspection_photos)
  try {
    // Step 1: Find estimate_id from estimates table
    const { data: estimateRow, error: estErr } = await rsClient
      .from("estimates")
      .select("id")
      .eq("estimate_number", normalizedEstimate)
      .limit(1)
      .maybeSingle();

    if (estErr) console.error("RS estimates lookup error:", estErr.message);

    let referenceNumber: string | null = null;

    if (estimateRow?.id) {
      // Step 2: Get reference_number from client_property
      const { data: propRow, error: propErr } = await rsClient
        .from("client_property")
        .select("reference_number")
        .eq("estimate_id", estimateRow.id)
        .limit(1)
        .maybeSingle();

      if (propErr) console.error("RS client_property lookup error:", propErr.message);
      if (propRow?.reference_number) referenceNumber = propRow.reference_number;
    }

    // Use local fallback if RS chain didn't yield a reference number
    if (!referenceNumber && localRefNumber) {
      referenceNumber = localRefNumber;
      console.log("Using local RW reference_number fallback:", referenceNumber);
    }

    if (referenceNumber) {
      // Step 3: Find inspection by reference_number
      const { data: inspRow, error: inspErr } = await rsClient
        .from("inspections")
        .select("id")
        .eq("reference_number", referenceNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (inspErr) console.error("RS inspections lookup error:", inspErr.message);

      if (inspRow?.id) {
        // Step 4: Get photos from inspection_photos
        // Columns: id, inspection_id, photo_url, photo_type, photo_order, created_at
        const { data: photos, error: photoErr } = await rsClient
          .from("inspection_photos")
          .select("id, photo_url, photo_type, photo_order")
          .eq("inspection_id", inspRow.id)
          .order("photo_type", { ascending: true })
          .order("photo_order", { ascending: true });

        if (photoErr) console.error("RS inspection_photos lookup error:", photoErr.message);

        if (photos && photos.length > 0) {
          return {
            estimate_number: normalizedEstimate,
            reference_number: referenceNumber,
            source: "rs_database",
            photo_count: photos.length,
            photos: photos.map((p: any) => ({
              name: p.photo_url?.split("/").pop() || `${p.photo_type}_${p.photo_order}.jpg`,
              type: p.photo_type,
              order: p.photo_order,
              url: getPhotoUrl(p.photo_url),
            })),
          };
        }
      }

      // Fallback: query all inspections for this reference_number
      const { data: allInspections, error: allInspErr } = await rsClient
        .from("inspections")
        .select("id")
        .eq("reference_number", referenceNumber)
        .order("created_at", { ascending: false })
        .limit(10);

      if (allInspErr) console.error("RS all inspections lookup error:", allInspErr.message);

      if (allInspections && allInspections.length > 0) {
        const inspIds = allInspections.map((i: any) => i.id);
        const { data: directPhotos, error: directErr } = await rsClient
          .from("inspection_photos")
          .select("id, photo_url, photo_type, photo_order")
          .in("inspection_id", inspIds)
          .order("photo_type", { ascending: true })
          .order("photo_order", { ascending: true })
          .limit(100);

        if (directErr) console.error("RS multi-inspection photo lookup error:", directErr.message);

        if (directPhotos && directPhotos.length > 0) {
          return {
            estimate_number: normalizedEstimate,
            reference_number: referenceNumber,
            source: "rs_database_multi_inspection",
            photo_count: directPhotos.length,
            photos: directPhotos.map((p: any) => ({
              name: p.photo_url?.split("/").pop() || `${p.photo_type}_${p.photo_order}.jpg`,
              type: p.photo_type,
              order: p.photo_order,
              url: getPhotoUrl(p.photo_url),
            })),
          };
        }
      }
    }
  } catch (err) {
    console.error("RS database photo lookup failed:", err);
  }

  // Strategy 2: If we have a reference number, construct known URL patterns as a last resort
  const refNum = localRefNumber;
  if (refNum) {
    // We know the pattern: {date}/{reference_number}/{type}_{order}.jpg
    // But without knowing the date, we can't construct exact URLs.
    return {
      message: `Found reference number ${refNum} for estimate ${normalizedEstimate}, but could not locate photo records in the RS database. Photos may exist in R2 storage but the inspection record may not be linked yet.`,
      reference_number: refNum,
      hint: "Photos are stored in R2 at path pattern: {date}/{reference_number}/{type}_{order}.jpg. The inspection_photos table in RS may not have records for this estimate yet.",
    };
  }

  return {
    message: `No inspection photos found for estimate ${normalizedEstimate}. Could not resolve a reference number to look up photos.`,
  };
}

async function toolAddPartsRequest(jobId: string, parts: Array<{ description: string; qty?: number }>) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get existing parts
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("parts_requests")
    .eq("id", jobId)
    .single();

  if (jobError || !job) return { error: "Job not found" };

  const existing = Array.isArray(job.parts_requests) ? job.parts_requests : [];

  // Generate request number
  const { data: reqNum } = await supabase.rpc("generate_parts_request_number");

  const newParts = parts.map((p) => ({
    id: crypto.randomUUID(),
    description: p.description,
    qty: p.qty || 1,
    price: null,
    status: "pending",
    request_number: reqNum || undefined,
    requested_at: new Date().toISOString(),
  }));

  const merged = [...existing, ...newParts];

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      parts_requests: merged,
      parts_approval_status: "pending",
      status: "parts_approval",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (updateError) return { error: updateError.message };

  return {
    success: true,
    request_number: reqNum,
    parts_added: newParts.length,
    total_parts: merged.length,
  };
}

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case "lookup_job":
      return await toolLookupJob(args.query);
    case "get_inspection_photos":
      return await toolGetInspectionPhotos(args.estimate_number);
    case "add_parts_request":
      return await toolAddPartsRequest(args.job_id, args.parts);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build initial request with tools
    let aiMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Tool-calling loop (max 3 iterations to prevent runaway)
    for (let i = 0; i < 5; i++) {
      const aiResponse = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools,
          stream: i > 0 ? false : false, // Non-streaming for tool calls
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        const text = await aiResponse.text();
        console.error("AI gateway error:", status, text);

        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await aiResponse.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If the model wants to call tools
      if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length > 0) {
        const toolCalls = choice.message.tool_calls;
        aiMessages.push(choice.message);

        // Execute all tool calls
        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;

          console.log(`Executing tool: ${tc.function.name}`, args);
          const toolResult = await executeTool(tc.function.name, args);
          console.log(`Tool result:`, JSON.stringify(toolResult).slice(0, 500));

          aiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Continue the loop to get the final response
        continue;
      }

      // No tool calls — return the final response directly
      const content = choice.message?.content || "I couldn't generate a response.";
      return new Response(
        JSON.stringify({ content }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback if loop exhausted
    return new Response(JSON.stringify({ error: "Too many tool calls" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
