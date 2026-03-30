import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ModelReferenceInput {
  part_number: string;
  brand: string;
  model?: string | null;
  caliber?: string | null;
  notes?: string | null;
  source?: string;
}

// Normalize part number: strip serial suffix (e.g., "16613-Y831963" -> "16613")
function normalizePartNumber(partNumber: string): string {
  const trimmed = partNumber.trim();
  // Match pattern: base reference followed by dash and alphanumeric serial
  // Examples: 16613-Y831963, 1803-3924796, 79173-P820625
  const match = trimmed.match(/^(\d+)(?:-[A-Z]?\d+)?$/i);
  if (match) {
    return match[1];
  }
  // If no serial pattern, just return as-is (could be plain reference like "16613")
  return trimmed;
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

    // Verify API key
    const providedApiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!rolliworkingApiKey || providedApiKey !== rolliworkingApiKey) {
      console.error('Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received model references sync request:', JSON.stringify(body).substring(0, 500));

      // Support both single record and batch
      const records: ModelReferenceInput[] = Array.isArray(body) ? body : (body.records || [body]);

      if (!records.length) {
        return new Response(
          JSON.stringify({ error: 'No records provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate required fields
      const validRecords = records.filter(r => r.part_number && r.brand);
      const invalidCount = records.length - validRecords.length;

      if (validRecords.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid records (part_number and brand required)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalize and deduplicate records by base part_number
      // Use a Map to keep only the first occurrence of each normalized part_number
      const deduplicatedMap = new Map<string, {
        part_number: string;
        brand: string;
        model: string | null;
        caliber: string | null;
        notes: string | null;
        source: string;
      }>();

      for (const r of validRecords) {
        const normalizedPartNumber = normalizePartNumber(r.part_number);
        
        // Only add if we haven't seen this normalized part_number yet
        if (!deduplicatedMap.has(normalizedPartNumber)) {
          deduplicatedMap.set(normalizedPartNumber, {
            part_number: normalizedPartNumber,
            brand: r.brand.trim(),
            model: r.model?.trim() || null,
            caliber: r.caliber?.trim() || null,
            notes: r.notes?.trim() || null,
            source: r.source || 'rolliworking',
          });
        }
      }

      const deduplicatedRecords = Array.from(deduplicatedMap.values());
      const duplicatesRemoved = validRecords.length - deduplicatedRecords.length;

      console.log(`Processing ${deduplicatedRecords.length} unique records (${duplicatesRemoved} duplicates removed)`);

      // Upsert records (update if part_number exists, insert if not)
      const { data, error } = await supabase
        .from('model_references')
        .upsert(deduplicatedRecords, { onConflict: 'part_number' })
        .select();

      if (error) {
        console.error('Database error:', error);
        return new Response(
          JSON.stringify({ error: 'Database error', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully synced ${data?.length || 0} model references`);

      return new Response(
        JSON.stringify({
          success: true,
          synced: data?.length || 0,
          skipped: invalidCount,
          duplicates_removed: duplicatesRemoved,
          message: `Synced ${data?.length || 0} records${invalidCount > 0 ? `, skipped ${invalidCount} invalid` : ''}${duplicatesRemoved > 0 ? `, removed ${duplicatesRemoved} duplicates` : ''}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Allow fetching current count/stats
      const { count, error } = await supabase
        .from('model_references')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Database error', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ total_records: count }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
