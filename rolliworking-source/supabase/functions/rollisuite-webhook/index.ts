import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await req.json();
    console.log('Received webhook payload:', JSON.stringify(payload));

    const { eventId, eventType, jobId, salesOrderId, completedAt } = payload;

    // Validate required fields
    if (!eventType || !jobId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: eventType, jobId' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (eventType) {
      case 'WORK_COMPLETED': {
        // Find job by estimate_number (jobId from RolliSuite is the estimate number)
        const { data: job, error: findError } = await supabase
          .from('jobs')
          .select('id, status')
          .eq('estimate_number', jobId)
          .maybeSingle();

        if (findError) {
          console.error('Error finding job:', findError);
          return new Response(JSON.stringify({ error: 'Database error', details: findError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!job) {
          console.log('Job not found for estimate_number:', jobId);
          return new Response(JSON.stringify({ 
            error: 'Job not found', 
            jobId 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update job status to finished
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ 
            status: 'finished',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        if (updateError) {
          console.error('Error updating job:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update job', details: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Job marked as finished:', job.id, 'estimate_number:', jobId);

        return new Response(JSON.stringify({
          success: true,
          message: 'Job marked as finished',
          jobId: job.id,
          estimateNumber: jobId,
          eventId,
          salesOrderId,
          completedAt,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'STATUS_UPDATE': {
        // Handle status updates from RolliSuite
        const { status } = payload;
        
        const { data: job, error: findError } = await supabase
          .from('jobs')
          .select('id')
          .eq('estimate_number', jobId)
          .maybeSingle();

        if (findError || !job) {
          return new Response(JSON.stringify({ error: 'Job not found', jobId }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Map RolliSuite status to internal status if needed
        const statusMap: Record<string, string> = {
          'PENDING': 'in_queue',
          'IN_PROGRESS': 'in_progress',
          'TESTING': 'in_testing',
          'COMPLETED': 'finished',
          'WAITING_PARTS': 'parts_on_order',
        };

        const mappedStatus = statusMap[status] || status;

        await supabase
          .from('jobs')
          .update({ 
            status: mappedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        return new Response(JSON.stringify({
          success: true,
          message: 'Job status updated',
          jobId: job.id,
          status: mappedStatus,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        console.log('Unhandled event type:', eventType);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Event received but not processed',
          eventType 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
