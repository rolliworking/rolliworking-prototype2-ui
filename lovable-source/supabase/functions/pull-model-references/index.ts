import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PORTAL_ENDPOINT = 'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1/rollisuite-model-sync';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rolliworkingApiKey = Deno.env.get('ROLLIWORKING_API_KEY');

    if (!rolliworkingApiKey) {
      return new Response(
        JSON.stringify({ error: 'ROLLIWORKING_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the since parameter from request body if provided
    const url = new URL(req.url);
    const since = url.searchParams.get('since');
    const countOnly = url.searchParams.get('count') === 'true';

    // First, get count from Portal to compare
    console.log('Fetching count from Portal...');
    const countResponse = await fetch(`${PORTAL_ENDPOINT}?count=true`, {
      method: 'GET',
      headers: {
        'x-api-key': rolliworkingApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!countResponse.ok) {
      const errorText = await countResponse.text();
      console.error('Portal count request failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch count from Portal', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const countData = await countResponse.json();
    const portalCount = countData.total_records || 0;

    // Get local count
    const { count: localCount, error: localCountError } = await supabase
      .from('model_references')
      .select('*', { count: 'exact', head: true });

    if (localCountError) {
      console.error('Failed to get local count:', localCountError);
    }

    console.log(`Portal has ${portalCount} records, local has ${localCount || 0} records`);

    if (countOnly) {
      return new Response(
        JSON.stringify({
          portal_count: portalCount,
          local_count: localCount || 0,
          difference: portalCount - (localCount || 0),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all records from Portal
    let fetchUrl = PORTAL_ENDPOINT;
    if (since) {
      fetchUrl += `?since=${encodeURIComponent(since)}`;
    }

    console.log('Fetching records from Portal...');
    const recordsResponse = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'x-api-key': rolliworkingApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!recordsResponse.ok) {
      const errorText = await recordsResponse.text();
      console.error('Portal fetch failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch records from Portal', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recordsData = await recordsResponse.json();
    const records = recordsData.records || [];

    console.log(`Received ${records.length} records from Portal`);

    if (records.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          message: 'No new records to sync',
          portal_count: portalCount,
          local_count: localCount || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform records for upsert (map to local schema)
    const transformedRecords = records.map((record: any) => ({
      part_number: record.part_number,
      brand: record.brand,
      model: record.model || null,
      caliber: record.caliber || null,
      notes: record.notes || null,
      source: record.source || 'portal',
    }));

    // Upsert in batches of 100
    const batchSize = 100;
    let totalSynced = 0;
    let totalErrors = 0;

    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('model_references')
        .upsert(batch, { 
          onConflict: 'part_number',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} error:`, error);
        totalErrors += batch.length;
      } else {
        totalSynced += batch.length;
        console.log(`Batch ${i / batchSize + 1}: synced ${batch.length} records`);
      }
    }

    // Get updated local count
    const { count: newLocalCount } = await supabase
      .from('model_references')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        errors: totalErrors,
        portal_count: portalCount,
        local_count: newLocalCount || 0,
        message: `Synced ${totalSynced} records from Portal`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pull-model-references:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
