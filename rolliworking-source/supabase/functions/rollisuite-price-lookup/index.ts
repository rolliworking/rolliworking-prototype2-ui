import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RolliSuite parts pricing endpoint
const ROLLISUITE_PARTS_URL = 'https://djbjwcoddddywkgljuja.supabase.co/functions/v1/parts-pricing';

interface PartPriceResult {
  part_number: string;
  description?: string;
  price?: number;
  found: boolean;
}

interface LookupResponse {
  success: boolean;
  results?: PartPriceResult[];
  error?: string;
}

/**
 * Lookup part pricing from RolliSuite
 */
async function lookupPartPrices(partNumbers: string[]): Promise<LookupResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    console.error('ROLLISUITE_API_KEY not configured');
    return { success: false, error: 'ROLLISUITE_API_KEY not configured' };
  }

  console.log('Looking up prices for:', partNumbers);

  try {
    const response = await fetch(ROLLISUITE_PARTS_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ part_numbers: partNumbers }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('RolliSuite price lookup failed:', response.status, data);
      return { success: false, error: data.error || 'Lookup failed' };
    }

    console.log('RolliSuite price lookup successful:', data);
    return { success: true, results: data.results || data };
  } catch (error) {
    console.error('Error looking up prices from RolliSuite:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Search parts by description/name from RolliSuite
 */
async function searchParts(query: string): Promise<LookupResponse> {
  const apiKey = Deno.env.get('ROLLISUITE_API_KEY');
  
  if (!apiKey) {
    return { success: false, error: 'ROLLISUITE_API_KEY not configured' };
  }

  console.log('Searching parts for:', query);

  try {
    const response = await fetch(`${ROLLISUITE_PARTS_URL}?search=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('RolliSuite search failed:', response.status, data);
      return { success: false, error: data.error || 'Search failed' };
    }

    return { success: true, results: data.results || data };
  } catch (error) {
    console.error('Error searching RolliSuite:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // GET - Search by query string
    if (req.method === 'GET') {
      const searchQuery = url.searchParams.get('search');
      
      if (!searchQuery) {
        return new Response(JSON.stringify({ 
          error: 'Provide search query parameter' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await searchParts(searchQuery);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST - Lookup by part numbers
    if (req.method === 'POST') {
      const body = await req.json();
      
      let partNumbers: string[] = [];
      
      if (body.part_numbers && Array.isArray(body.part_numbers)) {
        partNumbers = body.part_numbers;
      } else if (body.part_number) {
        partNumbers = [body.part_number];
      } else if (body.search) {
        // Search by description/name
        const result = await searchParts(body.search);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ 
          error: 'Provide part_numbers array, part_number, or search query' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (partNumbers.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No part numbers provided' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await lookupPartPrices(partNumbers);

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
    console.error('Error in rollisuite-price-lookup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
