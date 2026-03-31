import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLLISUITE_SYNC_URL = 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/model-references-sync';

interface ModelReference {
  part_number: string;
  brand: string;
  model?: string;
  caliber?: string;
  notes?: string;
}

interface SyncResponse {
  success: boolean;
  synced?: number;
  skipped?: number;
  message?: string;
  error?: string;
}

/**
 * Sends model reference records to RolliSuite
 */
async function syncToRolliSuite(records: ModelReference[]): Promise<SyncResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    console.error('ROLLISUITE_API_KEY not configured');
    return { success: false, error: 'ROLLISUITE_API_KEY not configured' };
  }

  console.log('Syncing to RolliSuite:', JSON.stringify(records, null, 2));

  try {
    const response = await fetch(ROLLISUITE_SYNC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('RolliSuite sync failed:', response.status, data);
      return { success: false, error: data.error || 'Sync failed' };
    }

    console.log('RolliSuite sync successful:', data);
    return data as SyncResponse;
  } catch (error) {
    console.error('Error syncing to RolliSuite:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Gets the total record count from RolliSuite
 */
async function getRecordCount(): Promise<{ total_records: number } | { error: string }> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    return { error: 'ROLLISUITE_API_KEY not configured' };
  }

  try {
    const response = await fetch(ROLLISUITE_SYNC_URL, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET - Check record count
    if (req.method === 'GET') {
      const result = await getRecordCount();
      return new Response(JSON.stringify(result), {
        status: 'error' in result ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Sync records
    if (req.method === 'POST') {
      const body = await req.json();
      
      // Support both single record and array of records
      let records: ModelReference[];
      
      if (body.records && Array.isArray(body.records)) {
        records = body.records;
      } else if (body.part_number && body.brand) {
        // Legacy single record format
        records = [{
          part_number: body.part_number || body.partNumber,
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

      // Validate required fields
      const validRecords = records.filter(r => r.part_number && r.brand);
      if (validRecords.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No valid records: each record requires part_number and brand' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await syncToRolliSuite(validRecords);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rollisuite-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});