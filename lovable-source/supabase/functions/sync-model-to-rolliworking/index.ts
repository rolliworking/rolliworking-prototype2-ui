import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModelReferencePayload {
  part_number: string;
  brand: string;
  model?: string | null;
  caliber?: string | null;
  notes?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const rolliworkingApiKey = Deno.env.get('ROLLIWORKING_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rolliworkingApiKey) {
      console.error('Missing ROLLIWORKING_API_KEY');
      return new Response(
        JSON.stringify({ error: 'RolliWorking API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const records: ModelReferencePayload[] = Array.isArray(body) ? body : (body.records || [body]);

    if (!records.length) {
      return new Response(
        JSON.stringify({ error: 'No records provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    const validRecords = records.filter(r => r.part_number && r.brand);
    
    if (validRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid records (part_number and brand required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing ${validRecords.length} model reference(s) to RolliWorking`);

    // First, save to local model_references table
    const localRecords = validRecords.map(r => ({
      part_number: r.part_number.trim(),
      brand: r.brand.trim(),
      model: r.model?.trim() || null,
      caliber: r.caliber?.trim() || null,
      notes: r.notes?.trim() || null,
      source: 'rollisuite',
    }));

    const { data: savedData, error: saveError } = await supabase
      .from('model_references')
      .upsert(localRecords, { onConflict: 'part_number' })
      .select();

    if (saveError) {
      console.error('Error saving locally:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save locally', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Push to RolliWorking's endpoint
    const rolliworkingEndpoint = 'https://pkgnrcfqrldwjibghefm.supabase.co/functions/v1/rollisuite-model-sync';
    
    const payload = {
      records: validRecords.map(r => ({
        part_number: r.part_number.trim(),
        brand: r.brand.trim(),
        model: r.model?.trim() || null,
        caliber: r.caliber?.trim() || null,
        notes: r.notes?.trim() || null,
      })),
    };

    console.log('Pushing to RolliWorking:', JSON.stringify(payload));

    const rolliworkingResponse = await fetch(rolliworkingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': rolliworkingApiKey,
      },
      body: JSON.stringify(payload),
    });

    const rolliworkingResult = await rolliworkingResponse.json();
    console.log('RolliWorking response:', JSON.stringify(rolliworkingResult));

    if (!rolliworkingResponse.ok) {
      console.error('RolliWorking sync failed:', rolliworkingResult);
      // Still return success for local save, but note the sync failure
      return new Response(
        JSON.stringify({
          success: true,
          saved_locally: savedData?.length || 0,
          synced_to_rolliworking: false,
          rolliworking_error: rolliworkingResult.error || 'Sync failed',
          message: `Saved ${savedData?.length || 0} records locally, but RolliWorking sync failed`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        saved_locally: savedData?.length || 0,
        synced_to_rolliworking: true,
        rolliworking_response: rolliworkingResult,
        message: `Saved ${savedData?.length || 0} records and synced to RolliWorking`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
