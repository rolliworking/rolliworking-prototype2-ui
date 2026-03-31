import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Hardcoded fallback service code map (used if DB fetch fails)
 */
const FALLBACK_SERVICE_CODE_MAP: Record<string, { jobType: string; weeks: number; isBracelet?: boolean; isMovementService?: boolean }> = {
  'M': { jobType: 'modern_movement', weeks: 4, isMovementService: true },
  'M2': { jobType: 'modern_lv2', weeks: 4, isMovementService: true },
  'V': { jobType: 'vintage_movement', weeks: 12, isMovementService: true },
  'V2': { jobType: 'vintage_lv2', weeks: 12, isMovementService: true },
  'A': { jobType: 'antique_movement', weeks: 27, isMovementService: true },
  'A2': { jobType: 'antique_lv2', weeks: 27, isMovementService: true },
  'C': { jobType: 'chrono', weeks: 8, isMovementService: true },
  'C2': { jobType: 'chrono_lv2', weeks: 12, isMovementService: true },
  'CW': { jobType: 'case_work', weeks: 4 },
  'P': { jobType: 'case_work', weeks: 4 },
  'WR': { jobType: 'warranty', weeks: 4, isMovementService: true },
  'W': { jobType: '', weeks: 0, isMovementService: false },
  'B': { jobType: 'bracelet_work', weeks: 3, isBracelet: true },
  'BR': { jobType: 'bracelet_repair', weeks: 3, isBracelet: true },
  'GB': { jobType: 'gold_bracelet', weeks: 6, isBracelet: true },
  'SR': { jobType: 'stretch_repair', weeks: 3, isBracelet: true },
};

/**
 * Load service codes from DB, fall back to hardcoded
 */
async function loadServiceCodeMap(supabase: any): Promise<Record<string, { jobType: string; weeks: number; isBracelet?: boolean; isMovementService?: boolean }>> {
  try {
    const { data, error } = await supabase
      .from("service_codes")
      .select("code, job_type, weeks, is_bracelet, is_movement_service")
      .eq("is_active", true);
    if (error || !data || data.length === 0) throw error || new Error("No data");
    const map: Record<string, any> = {};
    for (const row of data) {
      map[row.code] = {
        jobType: row.job_type,
        weeks: row.weeks,
        isBracelet: row.is_bracelet,
        isMovementService: row.is_movement_service,
      };
    }
    return map;
  } catch (e) {
    console.warn("Failed to load service codes from DB, using fallback:", e);
    return FALLBACK_SERVICE_CODE_MAP;
  }
}

/**
 * Parse service codes and return mapped services with longest duration
 */
function parseServiceCodes(serviceCodes: string, codeMap: Record<string, { jobType: string; weeks: number; isBracelet?: boolean; isMovementService?: boolean }>): {
  services: string[];
  primaryJobType: string | null;
  targetWeeks: number;
} {
  if (!serviceCodes?.trim()) {
    return { services: [], primaryJobType: null, targetWeeks: 4 };
  }

  const codes = serviceCodes.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  const services: string[] = [];
  let maxWeeks = 0;
  let primaryJobType: string | null = null;

  for (const code of codes) {
    // Bare "W" = Watchmaker dept routing only — skip for job type determination
    if (code === 'W') continue;
    const mapping = codeMap[code];
    if (mapping && mapping.jobType) {
      services.push(mapping.jobType);
      if (mapping.weeks > maxWeeks) {
        maxWeeks = mapping.weeks;
        primaryJobType = mapping.jobType;
      }
    } else if (!mapping) {
      services.push(code);
    }
  }

  return {
    services,
    primaryJobType,
    targetWeeks: maxWeeks || 4,
  };
}

/**
 * Normalize date from MM/DD/YY or YYYY-MM-DD to YYYY-MM-DD
 */
function normalizeDateField(val: string): string {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const m = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (m) {
    const year = parseInt(m[3], 10) + 2000;
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const m2 = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m2) {
    return `${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  }
  return val;
}

/**
 * Calculate due date from intake date and weeks
 */
function calculateDueDate(intakeDate: string, weeks: number): string {
  const normalized = normalizeDateField(intakeDate);
  const date = new Date(normalized || new Date().toISOString().split('T')[0]);
  date.setDate(date.getDate() + (weeks * 7));
  return date.toISOString().split('T')[0];
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
    const body = await req.text();
    console.log('Received intake data:', body);

    let fullName: string;
    let email: string;
    let phone: string;
    let partNumber: string;
    let serialNumber: string;
    let date: string;
    let estimateNumber: string;
    let serviceCodes: string;
    let serviceType: string;
    let brand = '';
    let model = '';
    let braceletModel = '';

    // Check if it's the new newline-delimited format (no carets, has newlines)
    const hasCarets = body.includes('^');
    const hasNewlines = body.includes('\n') || body.includes('\r');

    if (!hasCarets && hasNewlines) {
      // New 9-line newline-delimited format
      const lines = body.split(/[\r\n]+/).map((line: string) => line.trim());
      
      if (lines.length < 7) {
        return new Response(JSON.stringify({ 
          error: 'Invalid newline format. Expected at least 7 lines.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      [fullName, email, phone, partNumber, serialNumber, date, estimateNumber, serviceCodes = '', serviceType = '', braceletModel = ''] = lines;
      // If braceletModel is provided and no model set, use it
      if (braceletModel && !model) model = braceletModel;
      console.log('Parsed newline format:', { fullName, email, phone, partNumber, serialNumber, date, estimateNumber, serviceCodes, serviceType, braceletModel });
    } else {
      // Legacy caret-delimited format
      // Format: full_name^email^phone^part_number^date^brand^model^estimate_number
      const parts = body.split('^');
      
      if (parts.length < 7) {
        return new Response(JSON.stringify({ 
          error: 'Invalid format. Expected at least 7 caret-delimited fields.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      [fullName, email, phone, partNumber, date, brand, model, estimateNumber = ''] = parts;
      serialNumber = '';
      serviceCodes = '';
      serviceType = '';
      console.log('Parsed caret format:', { fullName, email, phone, partNumber, date, brand, model, estimateNumber });
    }

    // Validate required fields
    if (!fullName || !estimateNumber) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: full_name and estimate_number are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load service code map from DB (falls back to hardcoded)
    const serviceCodeMap = await loadServiceCodeMap(supabase);

    // Parse service codes to get job types and target duration
    const { services, primaryJobType, targetWeeks } = parseServiceCodes(serviceCodes, serviceCodeMap);
    
    // Calculate due date based on longest service duration
    const intakeDate = date || new Date().toISOString().split('T')[0];
    const dueDate = calculateDueDate(intakeDate, targetWeeks);

    // Check if customer exists or create new one
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('name', fullName)
      .eq('email', email || '')
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log('Found existing customer:', customerId);
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: fullName,
          email: email || null,
          phone: phone || null,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        return new Response(JSON.stringify({ error: 'Failed to create customer', details: customerError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      customerId = newCustomer.id;
      console.log('Created new customer:', customerId);
    }

    // Check if watch with this estimate number AND model already exists
    // Support multi-item estimates: same est# but different models = different watches
    let existingWatch = null;
    if (model) {
      // If we have a model/description, match on both estimate + model
      const { data: exactMatch } = await supabase
        .from('watches')
        .select('id')
        .eq('estimate_number', estimateNumber)
        .eq('model', model)
        .maybeSingle();
      existingWatch = exactMatch;
    }
    
    // If no model provided, fall back to estimate-only match
    if (!existingWatch && !model) {
      const { data: estMatch } = await supabase
        .from('watches')
        .select('id')
        .eq('estimate_number', estimateNumber)
        .maybeSingle();
      existingWatch = estMatch;
    }

    let watchId: string;
    if (existingWatch) {
      watchId = existingWatch.id;
      console.log('Found existing watch:', watchId);
      
      // Update watch details
      await supabase
        .from('watches')
        .update({
          brand: brand || undefined,
          model: model || undefined,
          reference_number: partNumber || undefined,
          target_date: dueDate,
        })
        .eq('id', watchId);
    } else {
      // Create new watch record
      const { data: newWatch, error: watchError } = await supabase
        .from('watches')
        .insert({
          customer_id: customerId,
          brand: brand || 'Unknown',
          model: model || null,
          reference_number: partNumber || null,
          estimate_number: estimateNumber,
          target_date: dueDate,
        })
        .select('id')
        .single();

      if (watchError) {
        console.error('Error creating watch:', watchError);
        return new Response(JSON.stringify({ error: 'Failed to create watch', details: watchError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      watchId = newWatch.id;
      console.log('Created new watch:', watchId);
    }

    // Check if job exists for this estimate number or serial number
    let existingJob = null;
    
    // First check by estimate number
    const { data: jobByEstimate } = await supabase
      .from('jobs')
      .select('id')
      .eq('estimate_number', estimateNumber)
      .maybeSingle();
    
    existingJob = jobByEstimate;
    
    // If no match by estimate, check by serial number
    if (!existingJob && (serialNumber || partNumber)) {
      const serialToCheck = serialNumber || partNumber;
      const { data: jobBySerial } = await supabase
        .from('jobs')
        .select('id')
        .eq('serial_number', serialToCheck)
        .maybeSingle();
      
      existingJob = jobBySerial;
    }

    let jobId: string;
    if (existingJob) {
      jobId = existingJob.id;
      console.log('Found existing job:', jobId);
      
      // Update job with new service info
      await supabase
        .from('jobs')
        .update({
          services: services.length > 0 ? services : undefined,
          service_type: primaryJobType || serviceType || (partNumber ? 'modern_movement' : 'other'),
          due_date: dueDate,
          serial_number: serialNumber || partNumber || undefined,
          estimate_number: estimateNumber,
        })
        .eq('id', jobId);
    } else {
      // Create job record with all services
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          client_id: customerId,
          client_name: fullName,
          client_email: email || null,
          watch_brand: brand || null,
          watch_model: model || null,
          serial_number: serialNumber || partNumber,
          estimate_number: estimateNumber,
          intake_date: intakeDate,
          due_date: dueDate,
          status: 'waiting_approval',
          services: services.length > 0 ? services : null,
          service_type: primaryJobType || serviceType || (partNumber ? 'modern_movement' : 'other'),
        })
        .select('id')
        .single();

      if (jobError) {
        console.error('Error creating job:', jobError);
        return new Response(JSON.stringify({ error: 'Failed to create job', details: jobError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      jobId = newJob.id;
      console.log('Created new job:', jobId);
    }

    return new Response(JSON.stringify({
      success: true,
      customerId,
      watchId,
      jobId,
      services,
      serviceType: primaryJobType || serviceType,
      targetWeeks,
      dueDate,
      message: 'Intake data processed successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing intake:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
