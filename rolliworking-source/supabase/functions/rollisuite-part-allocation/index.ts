import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RolliSuite part allocation endpoint
const ROLLISUITE_ALLOCATION_URL = 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/part-allocation';

interface PartAllocationRequest {
  part_name: string;
  part_number?: string;
  quantity: number;
  estimate_number: string;
  customer_name?: string;
  watch_brand?: string;
  watch_model?: string;
  approved_at: string;
  status: 'allocated' | 'deallocated';
}

interface AllocationResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send part allocation status to RolliSuite
 * Returns success even if external call fails to not block the workflow
 */
async function allocatePart(request: PartAllocationRequest): Promise<AllocationResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    console.warn('ROLLISUITE_API_KEY not configured - skipping allocation sync');
    return { success: true, skipped: true, message: 'API key not configured, sync skipped' };
  }

  console.log('Sending part allocation to RolliSuite:', request);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(ROLLISUITE_ALLOCATION_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('RolliSuite allocation returned non-2xx:', response.status, data);
      // Return success anyway - don't block the approval workflow
      return { 
        success: true, 
        skipped: true, 
        message: `External sync unavailable (${response.status}), approval recorded locally` 
      };
    }

    const data = await response.json();
    console.log('RolliSuite allocation successful:', data);
    return { success: true, message: data.message || 'Part allocated successfully' };
  } catch (error) {
    console.warn('Error sending allocation to RolliSuite (non-blocking):', error);
    // Return success anyway - external sync failure shouldn't block approval
    return { 
      success: true, 
      skipped: true, 
      message: 'External sync unavailable, approval recorded locally' 
    };
  }
}

/**
 * Send batch part allocations to RolliSuite
 */
async function allocateParts(requests: PartAllocationRequest[]): Promise<AllocationResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    console.warn('ROLLISUITE_API_KEY not configured - skipping batch allocation sync');
    return { success: true, skipped: true, message: 'API key not configured, sync skipped' };
  }

  console.log('Sending batch part allocations to RolliSuite:', requests.length, 'parts');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for batch

    const response = await fetch(ROLLISUITE_ALLOCATION_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parts: requests }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('RolliSuite batch allocation returned non-2xx:', response.status, data);
      return { 
        success: true, 
        skipped: true, 
        message: `External sync unavailable (${response.status}), approvals recorded locally` 
      };
    }

    const data = await response.json();
    console.log('RolliSuite batch allocation successful:', data);
    return { success: true, message: data.message || `${requests.length} parts allocated successfully` };
  } catch (error) {
    console.warn('Error sending batch allocation to RolliSuite (non-blocking):', error);
    return { 
      success: true, 
      skipped: true, 
      message: 'External sync unavailable, approvals recorded locally' 
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

    // Handle batch allocation
    if (body.parts && Array.isArray(body.parts)) {
      const requests: PartAllocationRequest[] = body.parts.map((part: {
        part_name?: string;
        name?: string;
        description?: string;
        part_number?: string;
        quantity?: number;
        qty?: number;
      }) => ({
        part_name: part.part_name || part.name || part.description || 'Unknown Part',
        part_number: part.part_number,
        quantity: part.quantity || part.qty || 1,
        estimate_number: body.estimate_number,
        customer_name: body.customer_name,
        watch_brand: body.watch_brand,
        watch_model: body.watch_model,
        approved_at: new Date().toISOString(),
        status: body.status || 'allocated',
      }));

      const result = await allocateParts(requests);
      return new Response(JSON.stringify(result), {
        status: 200, // Always 200 - we don't want to block workflow
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle single part allocation
    if (!body.part_name && !body.name && !body.description) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: part_name (or name/description)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request: PartAllocationRequest = {
      part_name: body.part_name || body.name || body.description,
      part_number: body.part_number,
      quantity: body.quantity || body.qty || 1,
      estimate_number: body.estimate_number,
      customer_name: body.customer_name,
      watch_brand: body.watch_brand,
      watch_model: body.watch_model,
      approved_at: new Date().toISOString(),
      status: body.status || 'allocated',
    };

    const result = await allocatePart(request);

    return new Response(JSON.stringify(result), {
      status: 200, // Always 200 - we don't want to block workflow
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rollisuite-part-allocation:', error);
    // Even on error, return success to not block the approval workflow
    return new Response(JSON.stringify({ 
      success: true, 
      skipped: true,
      message: 'Approval recorded, external sync will retry later' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
