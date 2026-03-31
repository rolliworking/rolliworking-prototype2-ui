import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLLISUITE_HIT_LIST_URL =
  "https://djbjwcoddddywkgljuja.supabase.co/functions/v1/hit-list";

const STATUS_MAP: Record<string, string> = {
  intake: "intake",
  inspection: "inspection",
  waiting_approval: "waiting_approval",
  in_queue: "in_queue",
  uncased: "uncased",
  in_progress: "in_progress",
  parts_approval: "parts_pending_approval",
  parts_on_order: "parts_on_order",
  in_testing: "in_testing",
  finished: "complete",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ROLLISUITE_API_KEY");
    if (!apiKey) {
      console.warn("ROLLISUITE_API_KEY not configured — skipping hit-list push");
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    const now = new Date(dateStr + "T12:00:00Z");

    // ── Fetch active jobs ──
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(
        `*, inspections(job_type, watches(brand, model, estimate_number, target_date, customers(name)))`
      )
      .neq("status", "finished")
      .limit(1000);

    if (error) throw error;

    // ── Fetch jobs finished today ──
    const { data: finishedToday, error: finErr } = await supabase
      .from("jobs")
      .select(
        `*, inspections(job_type, watches(brand, model, estimate_number, target_date, customers(name)))`
      )
      .eq("status", "finished")
      .gte("finished_date", dateStr)
      .lte("finished_date", dateStr)
      .limit(500);

    if (finErr) throw finErr;

    // ── Helpers ──
    function getEstimate(job: any): string {
      return job.estimate_number || job.inspections?.watches?.estimate_number || "—";
    }
    function getCustomerName(job: any): string | undefined {
      return job.client_name || job.inspections?.watches?.customers?.name || undefined;
    }
    function getDescription(job: any): string {
      const brand = job.watch_brand || job.inspections?.watches?.brand || "Unknown";
      const model = job.watch_model || job.inspections?.watches?.model || "";
      return `${brand}${model ? " " + model : ""}`;
    }
    function daysDiff(a: Date, b: Date): number {
      return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
    }

    const items: any[] = [];

    for (const job of jobs ?? []) {
      const est = getEstimate(job);
      const desc = getDescription(job);
      const cust = getCustomerName(job);
      const targetDate = job.due_date || job.inspections?.watches?.target_date || null;
      const externalStatus = STATUS_MAP[job.status] || job.status;

      // Overdue / due today / due this week
      if (targetDate) {
        const target = new Date(targetDate + "T12:00:00Z");
        const diff = daysDiff(now, target);

        if (diff > 0) {
          items.push({
            category: "overdue",
            estimate_number: est,
            customer_name: cust,
            description: `${desc} - ${diff} day${diff !== 1 ? "s" : ""} past target`,
            priority: diff >= 14 ? "urgent" : diff >= 7 ? "high" : "medium",
            status: externalStatus,
            target_date: targetDate,
            days_overdue: diff,
            technician: job.assigned_watchmaker || undefined,
          });
        } else if (diff === 0) {
          items.push({
            category: "due_today",
            estimate_number: est,
            customer_name: cust,
            description: `${desc} - target completion today`,
            priority: "high",
            status: externalStatus,
            target_date: targetDate,
            technician: job.assigned_watchmaker || undefined,
          });
        } else if (diff >= -7) {
          items.push({
            category: "due_this_week",
            estimate_number: est,
            customer_name: cust,
            description: `${desc} - due in ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? "s" : ""}`,
            priority: Math.abs(diff) <= 3 ? "high" : "medium",
            status: externalStatus,
            target_date: targetDate,
            technician: job.assigned_watchmaker || undefined,
          });
        }
      }

      // Parts pending
      if (job.status === "parts_approval" || job.status === "parts_on_order") {
        const waitingSince = job.updated_at || job.created_at;
        const daysWaiting = waitingSince ? daysDiff(now, new Date(waitingSince)) : 0;
        items.push({
          category: "parts_pending",
          estimate_number: est,
          customer_name: cust,
          description: `${desc} - ${job.status === "parts_approval" ? "awaiting parts approval" : "parts on order"}`,
          priority: daysWaiting >= 7 ? "high" : "medium",
          status: externalStatus,
          days_waiting: Math.max(0, daysWaiting),
        });
      }

      // Long approval waits
      if (job.status === "waiting_approval") {
        const intakeDate = job.intake_date || job.created_at?.slice(0, 10);
        const daysWaiting = intakeDate ? daysDiff(now, new Date(intakeDate + "T12:00:00Z")) : 0;
        if (daysWaiting >= 7) {
          items.push({
            category: "attention",
            estimate_number: est,
            customer_name: cust,
            description: `${desc} - waiting for approval ${daysWaiting} days`,
            priority: daysWaiting >= 14 ? "high" : "medium",
            status: externalStatus,
            days_waiting: daysWaiting,
            notes: `Waiting on customer approval since ${intakeDate}`,
          });
        }
      }

      // Email overdue
      if (job.status !== "finished") {
        let emailOverdue = false;
        if (!job.last_update_email_sent) {
          if (job.intake_date) {
            emailOverdue = daysDiff(now, new Date(job.intake_date + "T12:00:00Z")) >= 14;
          }
        } else {
          emailOverdue = daysDiff(now, new Date(job.last_update_email_sent)) >= 14;
        }
        if (emailOverdue) {
          items.push({
            category: "attention",
            estimate_number: est,
            customer_name: cust,
            description: `${desc} - overdue for client update email`,
            priority: "low",
            status: externalStatus,
            notes: job.last_update_email_sent
              ? `Last email sent ${job.last_update_email_sent.slice(0, 10)}`
              : `No update email sent since intake ${job.intake_date}`,
          });
        }
      }
    }

    // Completed today
    for (const job of finishedToday ?? []) {
      items.push({
        category: "completed_today",
        estimate_number: getEstimate(job),
        customer_name: getCustomerName(job),
        description: `${getDescription(job)} - completed`,
        priority: "low",
        status: "complete",
        target_date: job.due_date || undefined,
        technician: job.assigned_watchmaker || undefined,
      });
    }

    // Map priority: RS uses "normal" instead of "medium", and doesn't use "low"
    const priorityMap: Record<string, string> = { urgent: "urgent", high: "high", medium: "normal", low: "normal" };
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    for (const item of items) {
      item.priority = priorityMap[item.priority] || "normal";
    }
    items.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

    // Strip undefined fields
    const cleanItems = items.map((item) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined) clean[k] = v;
      }
      return clean;
    });

    const payload = {
      date: dateStr,
      items: cleanItems,
    };

    console.log(`Pushing ${cleanItems.length} hit-list items to RolliSuite`);

    // ── Push to RS ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(ROLLISUITE_HIT_LIST_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(`RS hit-list push returned ${response.status}:`, responseData);
    } else {
      console.log("RS hit-list push successful:", responseData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pushed: cleanItems.length,
        rs_status: response.status,
        rs_response: responseData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("hit-list-push error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
