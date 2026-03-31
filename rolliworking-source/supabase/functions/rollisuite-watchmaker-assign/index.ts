import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RS_ENDPOINT = 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/rw-watchmaker-assignment';

serve(async (req) => {
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

    if (!body.estimate_number || !body.assigned_watchmaker) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: estimate_number, assigned_watchmaker' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
    if (!apiKey) {
      console.warn('ROLLISUITE_API_KEY not configured - skipping watchmaker assignment push');
      return new Response(JSON.stringify({ 
        success: true, skipped: true, message: 'API key not configured, sync skipped' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      estimate_number: body.estimate_number,
      assigned_watchmaker: body.assigned_watchmaker,
      assigned_at: body.assigned_at || new Date().toISOString(),
      status: body.status || null,
    };

    console.log('Pushing watchmaker assignment to RolliSuite:', payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(RS_ENDPOINT, {
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
      console.warn('RS watchmaker assignment push returned non-2xx:', response.status, data);
      return new Response(JSON.stringify({ 
        success: true, skipped: true, 
        message: `External sync unavailable (${response.status})` 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('RS watchmaker assignment push successful:', data);
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.warn('Error pushing watchmaker assignment to RS (non-blocking):', error);
    return new Response(JSON.stringify({ 
      success: true, skipped: true, 
      message: 'External sync unavailable, assignment recorded locally' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
