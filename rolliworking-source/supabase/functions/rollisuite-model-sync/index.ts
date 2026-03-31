import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface ModelReference {
  part_number: string;
  brand: string;
  model?: string;
  caliber?: string;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key for external requests
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('ROLLISUITE_API_KEY');
    
    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('Invalid or missing API key');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET - Return reference library
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const countOnly = url.searchParams.get('count') === 'true';
      const source = url.searchParams.get('source'); // Filter by source: 'portal', 'rollisuite', or omit for all
      const since = url.searchParams.get('since'); // ISO timestamp to get records updated after this date

      let query = supabase.from('model_references').select('*', { count: 'exact' });
      
      if (source) {
        query = query.eq('source', source);
      }
      
      if (since) {
        query = query.gte('updated_at', since);
      }

      if (countOnly) {
        const { count, error } = await query;
        
        if (error) {
          console.error('Error counting references:', error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ total_records: count || 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Return full data
      const { data, count, error } = await query.order('brand').order('part_number');

      if (error) {
        console.error('Error fetching references:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Returning ${data?.length || 0} model references`);

      return new Response(JSON.stringify({ 
        total_records: count || 0,
        records: data || []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Receive model references from RolliSuite
    if (req.method === 'POST') {
      const body = await req.json();
      
      let records: ModelReference[];
      
      if (body.records && Array.isArray(body.records)) {
        records = body.records;
      } else if (body.part_number && body.brand) {
        records = [{
          part_number: body.part_number,
          brand: body.brand,
          model: body.model,
          caliber: body.caliber,
          notes: body.notes,
        }];
      } else {
        return new Response(JSON.stringify({ 
          error: 'Invalid request: provide records array or single record with part_number and brand' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter valid records
      const validRecords = records.filter(r => r.part_number && r.brand);
      
      if (validRecords.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No valid records: each record requires part_number and brand' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Receiving ${validRecords.length} model references from RolliSuite`);

      let synced = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Upsert each record
      for (const record of validRecords) {
        const { error } = await supabase
          .from('model_references')
          .upsert({
            part_number: record.part_number,
            brand: record.brand,
            model: record.model || null,
            caliber: record.caliber || null,
            notes: record.notes || null,
            source: 'rollisuite',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'part_number',
          });

        if (error) {
          console.error(`Error upserting ${record.part_number}:`, error);
          errors.push(`${record.part_number}: ${error.message}`);
          skipped++;
        } else {
          synced++;
        }
      }

      console.log(`Sync complete: ${synced} synced, ${skipped} skipped`);

      return new Response(JSON.stringify({
        success: true,
        synced,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rollisuite-model-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
