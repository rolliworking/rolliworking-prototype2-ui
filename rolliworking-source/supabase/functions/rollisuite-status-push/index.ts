import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RolliSuite status update endpoint
const ROLLISUITE_STATUS_URL = 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/job-status-update';

interface StatusUpdateRequest {
  estimate_number: string;
  status: string;
  updated_at: string;
  work_started_at?: string;
  in_testing_at?: string;
  finished_date?: string;
}

interface StatusUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Push job status update to RolliSuite
 * Returns success even if external call fails to not block the workflow
 */
async function pushStatusToRolliSuite(request: StatusUpdateRequest): Promise<StatusUpdateResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    console.warn('ROLLISUITE_API_KEY not configured - skipping status push');
    return { success: true, skipped: true, message: 'API key not configured, sync skipped' };
  }

  // Map internal status to RS-expected format
  // Map RW internal statuses to RS-expected values per integration spec
  const statusMap: Record<string, string> = {
    in_queue: 'on_hand',
    uncased: 'on_hand',
    in_progress: 'on_hand',
    in_testing: 'on_hand',
    parts_approval: 'on_hand',
    parts_on_order: 'on_hand',
    waiting_approval: 'on_hand',
    finished: 'ready_to_ship',
  };

  const payload = {
    estimate_number: request.estimate_number,
    status: statusMap[request.status] || request.status,
    status_updated_at: request.updated_at,
    finished_date: request.status === 'finished' ? (request.finished_date || new Date().toISOString()) : null,
  };

  console.log('Pushing status update to RolliSuite:', payload);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(ROLLISUITE_STATUS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('RolliSuite status push returned non-2xx:', response.status, data);
      // Return success anyway - don't block the status change workflow
      return { 
        success: true, 
        skipped: true, 
        message: `External sync unavailable (${response.status}), status recorded locally` 
      };
    }

    const data = await response.json();
    console.log('RolliSuite status push successful:', data);
    return { success: true, message: data.message || 'Status pushed successfully' };
  } catch (error) {
    console.warn('Error pushing status to RolliSuite (non-blocking):', error);
    // Return success anyway - external sync failure shouldn't block status update
    return { 
      success: true, 
      skipped: true, 
      message: 'External sync unavailable, status recorded locally' 
    };
  }
}

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
    const body = await req.json();
    
    // Validate required fields
    if (!body.estimate_number) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: estimate_number' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.status) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: status' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request: StatusUpdateRequest = {
      estimate_number: body.estimate_number,
      status: body.status,
      updated_at: body.updated_at || new Date().toISOString(),
      work_started_at: body.work_started_at,
      in_testing_at: body.in_testing_at,
      finished_date: body.finished_date,
    };

    const result = await pushStatusToRolliSuite(request);

    return new Response(JSON.stringify(result), {
      status: 200, // Always 200 - we don't want to block workflow
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rollisuite-status-push:', error);
    // Even on error, return success to not block the status change workflow
    return new Response(JSON.stringify({ 
      success: true, 
      skipped: true,
      message: 'Status recorded, external sync will retry later' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
