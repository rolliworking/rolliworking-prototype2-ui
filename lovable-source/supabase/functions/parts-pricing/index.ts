import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

interface PartResult {
  part_number: string;
  description?: string;
  price: number | null;
  brand?: string | null;
  found: boolean;
}

interface PartRow {
  part_number: string;
  description: string;
  default_sell_price: number | null;
  brand: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const rollisuiteApiKey = Deno.env.get('ROLLISUITE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key
    const providedApiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!rollisuiteApiKey || providedApiKey !== rollisuiteApiKey) {
      console.error('Invalid or missing API key');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);

    // Handle GET requests
    if (req.method === 'GET') {
      const searchQuery = url.searchParams.get('search');
      const countOnly = url.searchParams.get('count');

      // GET ?count=true — Return total parts count
      if (countOnly === 'true') {
        const { count, error } = await supabase
          .from('parts')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (error) {
          console.error('Database error:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ total_records: count }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET ?search=<query> — Search parts by description
      if (searchQuery) {
        const results = await searchParts(supabase, searchQuery);
        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Missing search query or count parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle POST requests
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received parts-pricing request:', JSON.stringify(body).substring(0, 500));

      // POST with { "search": "<query>" } — Alternative search method
      if (body.search) {
        const results = await searchParts(supabase, body.search);
        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST with { "part_numbers": ["24-7030", "B315-1"] } — Lookup specific parts
      if (body.part_numbers && Array.isArray(body.part_numbers)) {
        const results = await lookupPartNumbers(supabase, body.part_numbers);
        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST with { "part_number": "24-7030" } — Single part lookup
      if (body.part_number) {
        const results = await lookupPartNumbers(supabase, [body.part_number]);
        return new Response(
          JSON.stringify({ success: true, results }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Missing search query or part_numbers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Search parts by description (case-insensitive partial match)
// deno-lint-ignore no-explicit-any
async function searchParts(supabase: any, query: string): Promise<PartResult[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('part_number, description, default_sell_price, brand')
    .eq('is_active', true)
    .ilike('description', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return (data as PartRow[] || []).map((part: PartRow) => ({
    part_number: part.part_number,
    description: part.description,
    price: part.default_sell_price,
    brand: part.brand,
    found: true,
  }));
}

// Lookup specific part numbers (exact match)
// deno-lint-ignore no-explicit-any
async function lookupPartNumbers(supabase: any, partNumbers: string[]): Promise<PartResult[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('part_number, description, default_sell_price, brand')
    .eq('is_active', true)
    .in('part_number', partNumbers);

  if (error) {
    console.error('Lookup error:', error);
    return partNumbers.map(pn => ({ part_number: pn, price: null, found: false }));
  }

  const foundParts = new Map((data as PartRow[] || []).map((p: PartRow) => [p.part_number, p]));

  return partNumbers.map(pn => {
    const part = foundParts.get(pn) as PartRow | undefined;
    if (part) {
      return {
        part_number: part.part_number,
        description: part.description,
        price: part.default_sell_price,
        brand: part.brand,
        found: true,
      };
    }
    return { part_number: pn, price: null, found: false };
  });
}
