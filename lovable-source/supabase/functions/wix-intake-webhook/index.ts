import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wix-webhook-secret',
};

interface WixIntakePayload {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  lastname?: string; // Alternative casing from Wix
  email?: string;
  phone?: string;
  reference?: string;
  watchReference?: string;
  watch_reference?: string;
  serial?: string;
  watchSerial?: string;
  watch_serial?: string;
  description?: string;
  comments?: string;
  notes?: string;
  message?: string;
  itemType?: string;
  item_type?: string;
  serviceRequested?: string;
  service_requested?: string;
  services?: string;
  serviceType?: string;
  service_type?: string;
  insuredValue?: number;
  insured_value?: number;
  submittedAt?: string;
  [key: string]: unknown;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Parse payload first so we can optionally read the secret from body params
  let payload: WixIntakePayload;
  let rawBody = "";
  try {
    rawBody = await req.text();
    let parsed = JSON.parse(rawBody);
    
    // Wix wraps custom body params in a "data" object - unwrap it
    if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
      console.log("Detected Wix 'data' wrapper, unwrapping payload");
      payload = parsed.data as WixIntakePayload;
    } else {
      payload = parsed as WixIntakePayload;
    }
  } catch {
    console.error("Failed to parse JSON payload. Raw body:", rawBody.substring(0, 500));
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  // Log all payload keys for debugging
  console.log("Payload keys received:", Object.keys(payload));
  console.log("Full payload:", JSON.stringify(payload).substring(0, 1000));

  // Validate webhook secret (accept either header or body param)
  const expected = (Deno.env.get("WIX_WEBHOOK_SECRET") ?? "").trim();
  const headerSecret = (req.headers.get("x-wix-webhook-secret") ?? "").trim();

  // Check multiple possible key variations
  const bodySecretRaw =
    typeof payload["x-wix-webhook-secret"] === "string"
      ? (payload["x-wix-webhook-secret"] as string)
      : typeof payload["x_wix_webhook_secret"] === "string"
        ? (payload["x_wix_webhook_secret"] as string)
        : typeof payload["WIX_WEBHOOK_SECRET"] === "string"
          ? (payload["WIX_WEBHOOK_SECRET"] as string)
          : "";

  const bodySecret = (bodySecretRaw ?? "").toString().trim();
  const secret = headerSecret || bodySecret;

  console.log("Secret validation:", {
    expectedLength: expected.length,
    headerSecretLength: headerSecret.length,
    bodySecretLength: bodySecret.length,
    secretMatch: secret === expected,
  });

  if (!expected || !secret || secret !== expected) {
    console.error("Webhook secret validation failed", {
      hasHeaderSecret: Boolean(headerSecret),
      hasBodySecret: Boolean(bodySecret),
      expectedSet: Boolean(expected),
    });
    return jsonResponse(401, { error: "Unauthorized" });
  }

  console.log("Received Wix intake payload:", JSON.stringify(payload));

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse fields from payload - support both fullName and firstName/lastName
    const payloadFirstName = (payload.firstName ?? "").trim();
    const payloadLastName = (payload.lastName ?? payload.lastname ?? "").trim();
    const payloadFullName = (payload.fullName ?? "").trim();
    
    // Build full name from parts or use provided fullName
    let firstName: string;
    let lastName: string;
    let fullName: string;
    
    if (payloadFirstName && payloadLastName) {
      // Both first and last name provided separately
      firstName = payloadFirstName;
      lastName = payloadLastName;
      fullName = `${firstName} ${lastName}`.trim();
    } else if (payloadFirstName && !payloadLastName) {
      // Only firstName provided - check if it contains multiple words (full name)
      const nameParts = payloadFirstName.split(" ").filter(p => p.length > 0);
      if (nameParts.length > 1) {
        // Split "Michael Hui" into first: "Michael", last: "Hui"
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
        fullName = payloadFirstName;
      } else {
        firstName = payloadFirstName;
        lastName = "Customer";
        fullName = payloadFirstName;
      }
    } else if (payloadFullName) {
      // Parse fullName into parts
      const nameParts = payloadFullName.split(" ").filter(p => p.length > 0);
      firstName = nameParts[0] || "Unknown";
      lastName = nameParts.slice(1).join(" ") || "Customer";
      fullName = payloadFullName;
    } else {
      firstName = "Unknown";
      lastName = "Customer";
      fullName = "Unknown Customer";
    }

    const email = (payload.email ?? "").trim();
    const phone = (payload.phone ?? "").trim();
    const watchReference = (payload.reference ?? payload.watchReference ?? payload.watch_reference ?? "").trim();
    const watchSerial = (payload.serial ?? payload.watchSerial ?? payload.watch_serial ?? "").trim();
    
    // Support multiple field name variations for service/item type
    const itemTypeRaw = (
      payload.itemType ?? 
      payload.item_type ?? 
      payload.serviceRequested ?? 
      payload.service_requested ?? 
      payload.services ?? 
      payload.serviceType ?? 
      payload.service_type ?? 
      ""
    );
    const itemType = typeof itemTypeRaw === 'string' ? itemTypeRaw.trim() : "";
    
    // Support multiple field name variations for notes/comments
    const notesRaw = (
      payload.description ?? 
      payload.comments ?? 
      payload.notes ?? 
      payload.message ?? 
      ""
    );
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() : "";
    
    const insuredValue = payload.insuredValue ?? payload.insured_value ?? null;
    const now = new Date().toISOString();

    console.log("Parsed fields:", { 
      firstName, lastName, fullName, email, phone, 
      watchReference, watchSerial, itemType, notes, insuredValue 
    });

    // Check for existing customer by email
    let customerId: string | null = null;
    let isExistingCustomer = false;
    
    if (email) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email_normalized', email.toLowerCase())
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        isExistingCustomer = true;
        console.log("Found existing customer:", customerId);
      }
    }

    // Create customer if not found
    if (!customerId) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          notes: `Created from Wix intake form on ${now}`,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error("Error creating customer:", customerError);
        throw new Error(`Failed to create customer: ${customerError.message}`);
      }

      customerId = newCustomer.id;
      console.log("Created new customer:", customerId);
    }

    let jobId: string | null = null;
    let jobNumber: string | null = null;

    // Only create watch and job for NEW customers
    // Existing customers just get an intake lead for staff review
    if (!isExistingCustomer) {
      // Get next job ID using database function
      const { data: nextJobIdData, error: jobIdError } = await supabase
        .rpc('get_next_job_id');

      if (jobIdError) {
        console.error("Error getting next job ID:", jobIdError);
        throw new Error(`Failed to get next job ID: ${jobIdError.message}`);
      }

      jobNumber = nextJobIdData as string;
      console.log("Generated job number:", jobNumber);

      // Create watch record
      const { data: watch, error: watchError } = await supabase
        .from('watches')
        .insert({
          customer_id: customerId,
          brand: 'TBD',
          model: watchReference || null,
          serial_number: watchSerial || null,
          reference_number: watchReference || null,
          notes: `Item type: ${itemType}. ${notes}`,
        })
        .select('id')
        .single();

      if (watchError) {
        console.error("Error creating watch:", watchError);
        throw new Error(`Failed to create watch: ${watchError.message}`);
      }

      console.log("Created watch:", watch.id);

      // Create job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          job_id: jobNumber,
          customer_id: customerId,
          watch_id: watch.id,
          status: 'intake',
          priority: 'normal',
          intake_notes: notes,
          intake_date: now,
        })
        .select('id')
        .single();

      if (jobError) {
        console.error("Error creating job:", jobError);
        throw new Error(`Failed to create job: ${jobError.message}`);
      }

      jobId = job.id;
      console.log("Created job:", job.id);

      // Log activity for new job
      await supabase
        .from('job_activity_log')
        .insert({
          job_id: job.id,
          action_type: 'webhook_intake',
          message: `Job created from Wix intake form. Customer: ${fullName}, Item: ${itemType}`,
        });
    } else {
      console.log("Existing customer - creating intake lead only (no auto job/watch)");
    }

    // Create intake lead record (always created) - ALL leads start as 'new'
    // They only become 'done' when an estimate email is sent
    const { data: lead, error: leadError } = await supabase
      .from('intake_leads')
      .insert({
        source: 'wix',
        received_at: now,
        payload_json: payload,
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        watch_reference: watchReference || null,
        watch_serial: watchSerial || null,
        item_type: itemType,
        notes: notes || null,
        insured_value: insuredValue,
        status: 'new',
        job_id: jobId,
        customer_id: customerId,
        processed_at: null,
      })
      .select('id')
      .single();

    if (leadError) {
      console.error("Error creating intake lead:", leadError);
      throw new Error(`Failed to create intake lead: ${leadError.message}`);
    }

    console.log("Created intake lead:", lead.id);

    return jsonResponse(200, {
      ok: true,
      leadId: lead.id,
      jobId: jobId,
      jobNumber: jobNumber,
      customerId: customerId,
      isExistingCustomer: isExistingCustomer,
    });

  } catch (error) {
    console.error("Error processing Wix intake:", error);
    return jsonResponse(500, { 
      error: "Internal server error", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});
