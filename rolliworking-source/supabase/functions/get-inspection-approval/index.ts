import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchInspectionForApproval(supabase: any, approvalRecord: any) {
  // Get the inspection with watch and customer details
  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .select(`
      *,
      watches!inner(
        *,
        customers!inner(*)
      )
    `)
    .eq("id", approvalRecord.inspection_id)
    .single();

  if (inspectionError || !inspection) {
    return null;
  }

  // If waiver is required, build waiver info
  let waiver = null;
  if (inspection.waiver_required) {
    const dialData = inspection.dial_condition || {};
    const handsData = inspection.hands_condition || {};
    const dialDefects = dialData.waiverRequired === true;
    const handDefects = handsData.waiverRequired === true;

    let existingWaiver = null;
    try {
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("inspection_id", inspection.id)
        .single();

      if (job) {
        const { data: waiverData } = await supabase
          .from("liability_waivers")
          .select("*")
          .eq("job_id", job.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        existingWaiver = waiverData;
      }
    } catch (_e) {
      // No waiver record
    }

    waiver = existingWaiver || {
      id: null,
      status: "pending",
      dial_defects: dialDefects,
      hand_defects: handDefects,
      additional_components: null,
      additional_info: null,
    };
  }

  return { inspection, waiver };
}

async function fetchClientQuestions(supabase: any, inspection: any) {
  // Fetch ALL active inspection questions
  const { data: allQuestions } = await supabase
    .from("inspection_questions")
    .select("key, label, description, required_for_submission, render_as_scale, show_on_client")
    .eq("is_active", true)
    .order("key");

  // Fetch active inspection rules
  const { data: activeRules } = await supabase
    .from("inspection_rules")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const inspectionJobTypes: string[] = 
    (Array.isArray(inspection.job_types) && inspection.job_types.length > 0)
      ? inspection.job_types
      : [inspection.job_type || "general_repair"];

  // Determine active sections from the department_tag saved on the inspection
  // department_tag is comma-separated (e.g. "W,B,P") — supports multi-select
  const deptTagRaw: string | null = inspection.department_tag || null;
  
  // If department_tag is set, split and add each section
  // If not set (legacy data), fall back to deriving from service_codes
  let activeSections = new Set<string>();
  
  if (deptTagRaw) {
    for (const t of deptTagRaw.split(",").map((s: string) => s.trim()).filter(Boolean)) {
      activeSections.add(t);
    }
  } else {
    // Legacy fallback: derive from service_codes flags
    const { data: serviceCodes } = await supabase
      .from("service_codes")
      .select("job_type, is_movement_service, is_bracelet")
      .eq("is_active", true);

    const matchedCodes = (serviceCodes || []).filter((sc: any) => 
      inspectionJobTypes.includes(sc.job_type)
    );

    for (const sc of matchedCodes) {
      if (sc.is_movement_service) activeSections.add("W");
      if (sc.is_bracelet) activeSections.add("B");
    }

    const pmTypes = ["gold_bracelet", "gold_bracelet_repair"];
    if (inspectionJobTypes.some((jt: string) => pmTypes.includes(jt))) {
      activeSections.add("PM");
    }

    // Small job section
    if (inspectionJobTypes.includes("small_job")) {
      activeSections.add("SJ");
    }

    const isSmallJob = inspectionJobTypes.every((jt: string) => jt === "small_job");
    if (!isSmallJob) activeSections.add("P");

    // If nothing matched, default all active
    if (activeSections.size === 0) {
      activeSections.add("W").add("B").add("P").add("PM");
    }
  }

  // For each question, find the first matching rule WHERE section is active
  // Also track which questions have ANY rules at all (even if section doesn't match)
  const questionActions: Record<string, string> = {};
  const questionsWithRules = new Set<string>();
  if (activeRules && activeRules.length > 0) {
    for (const rule of activeRules) {
      const qKey = rule.target_question;
      questionsWithRules.add(qKey);
      if (questionActions[qKey]) continue;

      // Section must be active for this inspection
      if (rule.section && !activeSections.has(rule.section)) continue;

      const jobTypeMatches = !rule.job_types || rule.job_types.length === 0 || 
        rule.job_types.some((rt: string) => inspectionJobTypes.includes(rt));

      if (jobTypeMatches) {
        questionActions[qKey] = rule.action;
      }
    }
  }

  // Filter questions
  // If a question has rules but none matched the current section, hide it (don't fall through to show_on_client)
  const filteredQuestions = (allQuestions || []).filter((q: any) => {
    const action = questionActions[q.key];
    if (action === "hide" || action === "suppress") return false;
    if (action === "show" || action === "require") return true;
    // If rules exist for this question but none matched → hide it
    if (questionsWithRules.has(q.key)) return false;
    return q.show_on_client === true;
  });

  // Mark required questions
  const finalQuestions = filteredQuestions.map((q: any) => ({
    ...q,
    required_for_submission: questionActions[q.key] === "require" ? true : q.required_for_submission,
  }));

  return finalQuestions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { approvalId, groupId } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── GROUP MODE: fetch all approvals in a group ───
    if (groupId && UUID_REGEX.test(String(groupId))) {
      const { data: groupApprovals, error: groupError } = await supabase
        .from("inspection_approvals")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (groupError || !groupApprovals || groupApprovals.length === 0) {
        return new Response(
          JSON.stringify({ error: "Group not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if any are already submitted
      const allCompleted = groupApprovals.every((a: any) => a.status !== "pending");
      if (allCompleted) {
        // Return the first approval + inspection for the completed view
        const firstResult = await fetchInspectionForApproval(supabase, groupApprovals[0]);
        return new Response(
          JSON.stringify({
            isGroup: true,
            groupId,
            approval: groupApprovals[0],
            approvals: groupApprovals,
            inspection: firstResult?.inspection || null,
            inspections: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Fetch all inspections for the group
      const inspections: any[] = [];
      let clientQuestions: any[] = [];
      let waiver = null;

      for (const approval of groupApprovals) {
        const result = await fetchInspectionForApproval(supabase, approval);
        if (result) {
          inspections.push({
            approval,
            inspection: result.inspection,
            waiver: result.waiver,
          });
          if (result.waiver) waiver = result.waiver;
        }
      }

      // Use the first inspection for client questions (all should share the same job type rules)
      if (inspections.length > 0) {
        clientQuestions = await fetchClientQuestions(supabase, inspections[0].inspection);
      }

      return new Response(
        JSON.stringify({
          isGroup: true,
          groupId,
          approval: groupApprovals[0], // Primary approval for backward compat
          approvals: groupApprovals,
          inspection: inspections[0]?.inspection || null,
          inspections: inspections.map(i => ({
            approval: i.approval,
            inspection: i.inspection,
          })),
          waiver,
          clientQuestions,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ─── SINGLE MODE (original behavior) ───
    if (!approvalId || !UUID_REGEX.test(String(approvalId))) {
      return new Response(
        JSON.stringify({ error: "Invalid approval ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the approval record
    const { data: approval, error: approvalError } = await supabase
      .from("inspection_approvals")
      .select("*")
      .eq("id", approvalId)
      .single();

    if (approvalError || !approval) {
      return new Response(
        JSON.stringify({ error: "Approval not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = await fetchInspectionForApproval(supabase, approval);
    if (!result) {
      return new Response(
        JSON.stringify({ error: "Inspection not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientQuestions = await fetchClientQuestions(supabase, result.inspection);

    return new Response(
      JSON.stringify({
        approval,
        inspection: result.inspection,
        waiver: result.waiver,
        clientQuestions,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch approval";
    console.error("Error in get-inspection-approval:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
