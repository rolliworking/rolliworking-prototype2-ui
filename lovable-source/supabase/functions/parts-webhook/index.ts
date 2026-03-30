import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method_not_allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- AUTH ----
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '').trim();

    // Load stored API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('incoming_webhook_api_key')
      .limit(1)
      .single();

    if (settingsError || !settings?.incoming_webhook_api_key) {
      console.error('Failed to load webhook API key from settings:', settingsError);
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKey !== settings.incoming_webhook_api_key) {
      console.log('Invalid API key provided');
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- PARSE BODY ----
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('Failed to parse JSON body:', e);
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { eventId, eventType, jobId, salesOrderId, completedAt } = body;

    // ---- VALIDATION ----
    if (!eventId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'eventId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!eventType || eventType !== 'WORK_COMPLETED') {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'eventType must be WORK_COMPLETED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobId || !/^E\d+$/.test(jobId)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'jobId must match ^E\\d+$' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!salesOrderId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'salesOrderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!completedAt) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'completedAt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate completedAt is a valid ISO date
    const completedAtDate = new Date(completedAt);
    if (isNaN(completedAtDate.getTime())) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_payload', details: 'completedAt must be valid ISO8601' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing WORK_COMPLETED webhook for jobId: ${jobId}, eventId: ${eventId}`);

    // ---- IDEMPOTENCY CHECK ----
    const { data: existingEvent } = await supabase
      .from('received_webhook_events')
      .select('id, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Duplicate event received: ${eventId}`);
      return new Response(
        JSON.stringify({ ok: true, received: true, duplicate: true, eventId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- STORE EVENT ----
    const { error: insertError } = await supabase
      .from('received_webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        raw_payload: body,
        status: 'received'
      });

    if (insertError) {
      // Check if it's a unique constraint violation (race condition)
      if (insertError.code === '23505') {
        console.log(`Duplicate event (race condition): ${eventId}`);
        return new Response(
          JSON.stringify({ ok: true, received: true, duplicate: true, eventId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Failed to insert webhook event:', insertError);
      throw insertError;
    }

    // ---- FIND JOB BY job_id field ----
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_id, status')
      .eq('job_id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('Error finding job:', jobError);
    }

    if (!job) {
      console.log(`Job not found: ${jobId}`);
      // Mark event as failed
      await supabase
        .from('received_webhook_events')
        .update({
          status: 'failed',
          error: 'job_not_found',
          processed_at: new Date().toISOString()
        })
        .eq('event_id', eventId);

      return new Response(
        JSON.stringify({ ok: true, received: true, queued: true, reason: 'job_not_found' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found job: ${job.id} (${job.job_id}), current status: ${job.status}`);

    // ---- UPDATE JOB STATUS to "ready_to_ship" ----
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'ready_to_ship',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('Failed to update job status:', updateError);
      await supabase
        .from('received_webhook_events')
        .update({
          status: 'failed',
          error: `Failed to update job: ${updateError.message}`,
          processed_at: new Date().toISOString()
        })
        .eq('event_id', eventId);

      throw updateError;
    }

    // ---- AUDIT LOG ----
    const { error: logError } = await supabase
      .from('job_activity_log')
      .insert({
        job_id: job.id,
        action_type: 'webhook_received',
        message: `Parts app signaled WORK_COMPLETED at ${completedAt}. Job status updated to Ready To Ship.`
      });

    if (logError) {
      console.error('Failed to create audit log:', logError);
      // Don't fail the webhook for audit log issues
    }

    // ---- MARK EVENT PROCESSED ----
    await supabase
      .from('received_webhook_events')
      .update({
        job_id: job.id,
        sales_order_id: salesOrderId,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('event_id', eventId);

    console.log(`Successfully processed WORK_COMPLETED for job ${jobId}`);

    return new Response(
      JSON.stringify({ ok: true, received: true, eventId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
