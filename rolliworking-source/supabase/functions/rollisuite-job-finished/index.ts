import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Parse caret-delimited payload: estimate_number^reference_number^finished_date
    const text = await req.text();
    const [estimateNumber, referenceNumber, finishedDate] = text.split('^');

    console.log('[rollisuite-job-finished] Received:', { estimateNumber, referenceNumber, finishedDate });

    if (!estimateNumber) {
      return new Response(JSON.stringify({ error: 'Missing estimate_number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role for DB updates
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First try to find job directly by estimate_number on jobs table
    let jobId: string | null = null;

    const { data: directJob, error: directError } = await supabase
      .from('jobs')
      .select('id')
      .eq('estimate_number', estimateNumber)
      .maybeSingle();

    if (directError) {
      console.error('[rollisuite-job-finished] Direct find error:', directError);
    }

    if (directJob) {
      jobId = directJob.id;
      console.log('[rollisuite-job-finished] Found job directly:', jobId);
    } else {
      // Fallback: find via watches -> inspections -> jobs chain
      const { data: watchData, error: watchError } = await supabase
        .from('watches')
        .select(`
          id,
          inspections(
            id,
            jobs(id)
          )
        `)
        .eq('estimate_number', estimateNumber)
        .maybeSingle();

      if (watchError) {
        console.error('[rollisuite-job-finished] Watch find error:', watchError);
      }

      if (watchData) {
        const inspections = watchData.inspections as any[];
        if (inspections?.length > 0) {
          const jobs = inspections[0]?.jobs as any[];
          if (jobs?.length > 0) {
            jobId = jobs[0].id;
            console.log('[rollisuite-job-finished] Found job via watch chain:', jobId);
          }
        }
      }
    }

    if (!jobId) {
      console.log('[rollisuite-job-finished] Job not found for estimate:', estimateNumber);
      return new Response(JSON.stringify({ ok: true, message: 'Job not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update job status to finished with finished_date
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ 
        status: 'finished',
        finished_date: finishedDate || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[rollisuite-job-finished] Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[rollisuite-job-finished] Job updated to finished:', jobId);

    return new Response(JSON.stringify({ ok: true, jobId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[rollisuite-job-finished] Error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
