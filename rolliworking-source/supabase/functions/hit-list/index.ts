import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    // Auth check
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const apiKey = Deno.env.get("ROLLISUITE_API_KEY");
    if (!apiKey || token !== apiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dateStr =
      body.date || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all active (non-finished) jobs with relations
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(
        `*, inspections(job_type, watches(brand, model, estimate_number, target_date, customers(name)))`
      )
      .neq("status", "finished")
      .limit(1000);

    if (error) throw error;

    // Also fetch jobs finished today
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

    const now = new Date(dateStr + "T12:00:00Z"); // noon to avoid timezone edge cases
    const items: any[] = [];

    function getEstimate(job: any): string {
      return (
        job.estimate_number ||
        job.inspections?.watches?.estimate_number ||
        "—"
      );
    }

    function getCustomerName(job: any): string | undefined {
      return (
        job.client_name ||
        job.inspections?.watches?.customers?.name ||
        undefined
      );
    }

    function getDescription(job: any): string {
      const brand =
        job.watch_brand || job.inspections?.watches?.brand || "Unknown";
      const model =
        job.watch_model || job.inspections?.watches?.model || "";
      return `${brand}${model ? " " + model : ""}`;
    }

    function daysDiff(a: Date, b: Date): number {
      return Math.floor(
        (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    for (const job of jobs ?? []) {
      const est = getEstimate(job);
      const desc = getDescription(job);
      const cust = getCustomerName(job);
      const targetDate =
        job.due_date || job.inspections?.watches?.target_date || null;
      const externalStatus = STATUS_MAP[job.status] || job.status;

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

      if (
        job.status === "parts_approval" ||
        job.status === "parts_on_order"
      ) {
        const waitingSince = job.updated_at || job.created_at;
        const daysWaiting = waitingSince
          ? daysDiff(now, new Date(waitingSince))
          : 0;

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

      if (job.status === "waiting_approval") {
        const intakeDate = job.intake_date || job.created_at?.slice(0, 10);
        const daysWaiting = intakeDate
          ? daysDiff(now, new Date(intakeDate + "T12:00:00Z"))
          : 0;

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

      if (job.status !== "finished") {
        let emailOverdue = false;
        if (!job.last_update_email_sent) {
          if (job.intake_date) {
            const daysSince = daysDiff(now, new Date(job.intake_date + "T12:00:00Z"));
            emailOverdue = daysSince >= 14;
          }
        } else {
          const lastSent = new Date(job.last_update_email_sent);
          const daysSince = daysDiff(now, lastSent);
          emailOverdue = daysSince >= 14;
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
      const est = getEstimate(job);
      const desc = getDescription(job);
      const cust = getCustomerName(job);
      items.push({
        category: "completed_today",
        estimate_number: est,
        customer_name: cust,
        description: `${desc} - completed`,
        priority: "low",
        status: "complete",
        target_date: job.due_date || undefined,
        technician: job.assigned_watchmaker || undefined,
      });
    }

    // Sort: urgent first, then high, medium, low
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    items.sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    );

    // Strip undefined fields
    const cleanItems = items.map((item) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined) clean[k] = v;
      }
      return clean;
    });

    return new Response(
      JSON.stringify({
        found: cleanItems.length > 0,
        date: dateStr,
        items: cleanItems,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("hit-list error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
