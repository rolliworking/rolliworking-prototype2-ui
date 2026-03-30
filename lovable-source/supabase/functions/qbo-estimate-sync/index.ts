import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intuit endpoints
const DISCOVERY_DOC_URL = 'https://developer.api.intuit.com/.well-known/openid_configuration';
const FALLBACK_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_API_PRODUCTION = 'https://quickbooks.api.intuit.com/v3/company';
const FALLBACK_API_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

type QBOErrorType = 
  | 'expired_access_token' 
  | 'expired_refresh_token' 
  | 'invalid_grant' 
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

interface QBOEstimate {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  ExpirationDate?: string;
  CustomerRef?: { value: string; name?: string };
  TotalAmt?: number;
  Line?: Array<{
    Id?: string;
    LineNum?: number;
    Description?: string;
    Amount?: number;
    DetailType?: string;
    SalesItemLineDetail?: {
      ItemRef?: { value: string; name?: string };
      Qty?: number;
      UnitPrice?: number;
      TaxCodeRef?: { value: string };
    };
  }>;
  TxnTaxDetail?: {
    TotalTax?: number;
  };
  CustomerMemo?: { value: string };
  PrivateNote?: string;
  PrintStatus?: string;
  EmailStatus?: string;
}

interface QBOCustomer {
  Id: string;
  DisplayName?: string;
  GivenName?: string;
  MiddleName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  Mobile?: { FreeFormNumber: string };
  WebAddr?: { URI: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  total: number;
  customersCreated: number;
  intuit_tids: string[];
}

interface DiscoveryDocument {
  token_endpoint: string;
}

let cachedDiscovery: DiscoveryDocument | null = null;
let discoveryFetchedAt: number = 0;
const DISCOVERY_CACHE_MS = 24 * 60 * 60 * 1000;

async function getDiscoveryDocument(): Promise<DiscoveryDocument> {
  const now = Date.now();
  if (cachedDiscovery && (now - discoveryFetchedAt) < DISCOVERY_CACHE_MS) {
    return cachedDiscovery;
  }
  try {
    const response = await fetch(DISCOVERY_DOC_URL);
    if (response.ok) {
      cachedDiscovery = await response.json();
      discoveryFetchedAt = now;
      return cachedDiscovery!;
    }
  } catch (e) {
    console.warn('[QBO Estimate Sync] Failed to fetch discovery document:', e);
  }
  return { token_endpoint: FALLBACK_TOKEN_URL };
}

function classifyError(status: number, errorBody: string): QBOErrorType {
  const lowerBody = errorBody.toLowerCase();
  if (status === 401) {
    if (lowerBody.includes('token expired') || lowerBody.includes('access_token')) {
      return 'expired_access_token';
    }
    if (lowerBody.includes('refresh_token') || lowerBody.includes('invalid_grant')) {
      return 'invalid_grant';
    }
    return 'expired_access_token';
  }
  if (status === 400) {
    if (lowerBody.includes('invalid_grant')) return 'invalid_grant';
    if (lowerBody.includes('expired')) return 'expired_refresh_token';
  }
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'network_error';
  return 'unknown';
}

function isRetryableError(errorType: QBOErrorType): boolean {
  return ['rate_limited', 'network_error'].includes(errorType);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  context: string
): Promise<{ response: Response; errorType?: QBOErrorType; intuit_tid?: string }> {
  let lastError: Error | null = null;
  let lastErrorType: QBOErrorType = 'unknown';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      const intuit_tid = response.headers.get('intuit_tid') || undefined;
      if (intuit_tid) {
        console.log(`[QBO Estimate Sync] ${context} intuit_tid: ${intuit_tid}`);
      }
      if (response.ok) {
        return { response, intuit_tid };
      }
      const errorText = await response.clone().text();
      lastErrorType = classifyError(response.status, errorText);
      console.log(`[QBO Estimate Sync] ${context} failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${response.status}`);
      if (!isRetryableError(lastErrorType)) {
        return { response, errorType: lastErrorType, intuit_tid };
      }
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      lastErrorType = 'network_error';
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }
  throw new Error(`${context} failed after ${MAX_RETRIES} attempts: ${lastError?.message || lastErrorType}`);
}

// Map QBO estimate status
function mapEstimateStatus(qboEstimate: QBOEstimate): 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted' {
  // QBO uses PrintStatus and EmailStatus
  if (qboEstimate.EmailStatus === 'EmailSent') return 'sent';
  if (qboEstimate.PrintStatus === 'PrintComplete') return 'sent';
  return 'draft';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const use_sandbox = Boolean((body as any)?.use_sandbox);
    const start_date = typeof (body as any)?.start_date === 'string' ? (body as any).start_date : '';
    const end_date = typeof (body as any)?.end_date === 'string' ? (body as any).end_date : '';

    const rawRefreshToken = typeof (body as any)?.refresh_token === 'string' ? (body as any).refresh_token : '';
    const refreshToken = rawRefreshToken.replace(/\s+/g, '');

    if (!refreshToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing refresh token',
          errorType: 'invalid_grant',
          requiresReconnect: true,
          message: 'Please paste the QuickBooks refresh token (starts with RT1-...).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (refreshToken.startsWith('eyJ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid token type',
          errorType: 'invalid_grant',
          requiresReconnect: true,
          message: 'You pasted an access/id token. Please paste the Refresh Token (starts with RT1-...).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const discovery = await getDiscoveryDocument();
    const tokenUrl = discovery.token_endpoint;
    const QBO_API_BASE = use_sandbox ? FALLBACK_API_SANDBOX : FALLBACK_API_PRODUCTION;

    console.log(`[QBO Estimate Sync] Using ${use_sandbox ? 'SANDBOX' : 'PRODUCTION'} environment`);

    const clientId = Deno.env.get('QBO_CLIENT_ID');
    const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
    const realmId = Deno.env.get('QBO_REALM_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret || !realmId) {
      throw new Error('QBO credentials not configured');
    }
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Exchange refresh token for access token
    console.log('[QBO Estimate Sync] Exchanging refresh token...');
    const { response: tokenResponse, errorType: tokenErrorType } = await fetchWithRetry(
      tokenUrl,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      },
      'Token exchange'
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[QBO Estimate Sync] Token exchange failed:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `Token exchange failed: ${tokenResponse.status}`,
        errorType: tokenErrorType,
        requiresReconnect: true,
        message: 'Authentication failed. Please reconnect to QuickBooks with a new refresh token.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const newRefreshToken = tokenData.refresh_token;

    console.log('[QBO Estimate Sync] Access token obtained');

    // Save token to database for cron sync
    const environment = use_sandbox ? 'sandbox' : 'production';
    await supabase
      .from('qbo_tokens')
      .upsert({
        realm_id: realmId,
        environment,
        refresh_token: newRefreshToken,
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        last_sync_at: new Date().toISOString(),
        last_sync_type: 'estimate',
      }, { onConflict: 'realm_id,environment' });

    console.log('[QBO Estimate Sync] Token saved for future cron syncs');

    // Calculate date range - use provided dates or default to last 6 months
    let startDateStr: string;
    let endDateStr: string;
    
    if (start_date && end_date) {
      startDateStr = start_date;
      endDateStr = end_date;
    } else {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 6);
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = today.toISOString().split('T')[0];
    }

    console.log(`[QBO Estimate Sync] Fetching estimates from ${startDateStr} to ${endDateStr}`);

    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      total: 0,
      customersCreated: 0,
      intuit_tids: [],
    };

    // Fetch estimates with pagination
    const pageSize = 1000;
    let startPosition = 1;
    let allEstimates: QBOEstimate[] = [];
    let hasMore = true;

    while (hasMore) {
      const query = encodeURIComponent(
        `SELECT * FROM Estimate WHERE TxnDate >= '${startDateStr}' AND TxnDate <= '${endDateStr}' STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`
      );
      const queryUrl = `${QBO_API_BASE}/${realmId}/query?query=${query}`;

      const { response: queryResponse, intuit_tid } = await fetchWithRetry(
        queryUrl,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        },
        `Estimate fetch (page ${startPosition})`
      );

      if (intuit_tid) result.intuit_tids.push(intuit_tid);

      if (!queryResponse.ok) {
        const errText = await queryResponse.text();
        result.errors.push(`Failed to fetch estimates: ${errText}`);
        break;
      }

      const queryData = await queryResponse.json();
      const estimates = queryData.QueryResponse?.Estimate || [];
      
      if (estimates.length === 0) {
        hasMore = false;
      } else {
        allEstimates = allEstimates.concat(estimates);
        startPosition += pageSize;
        if (estimates.length < pageSize) hasMore = false;
      }

      await sleep(100);
    }

    result.total = allEstimates.length;
    console.log(`[QBO Estimate Sync] Fetched ${allEstimates.length} estimates`);

    if (allEstimates.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: `No estimates found between ${startDateStr} and ${endDateStr}`,
        result,
        newRefreshToken,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique customer IDs from estimates
    const qboCustomerIds = [...new Set(allEstimates.map(e => e.CustomerRef?.value).filter(Boolean))] as string[];

    // Check which customers exist locally
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, qbo_customer_id')
      .in('qbo_customer_id', qboCustomerIds);

    const customerMap = new Map<string, string>();
    (existingCustomers || []).forEach(c => {
      if (c.qbo_customer_id) customerMap.set(c.qbo_customer_id, c.id);
    });

    console.log(`[QBO Estimate Sync] Found ${customerMap.size}/${qboCustomerIds.length} customers locally`);

    // Fetch and create missing customers from QBO
    const missingCustomerIds = qboCustomerIds.filter(id => !customerMap.has(id));

    if (missingCustomerIds.length > 0) {
      console.log(`[QBO Estimate Sync] Fetching ${missingCustomerIds.length} missing customers from QBO...`);

      // Batch fetch customers (QBO allows up to 1000 in a query)
      for (let i = 0; i < missingCustomerIds.length; i += 100) {
        const batch = missingCustomerIds.slice(i, i + 100);
        const idList = batch.map(id => `'${id}'`).join(',');
        const customerQuery = encodeURIComponent(`SELECT * FROM Customer WHERE Id IN (${idList})`);
        const customerUrl = `${QBO_API_BASE}/${realmId}/query?query=${customerQuery}`;

        const { response: custResponse, intuit_tid: custTid } = await fetchWithRetry(
          customerUrl,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          },
          `Customer fetch batch`
        );

        if (custTid) result.intuit_tids.push(custTid);

        if (custResponse.ok) {
          const custData = await custResponse.json();
          const customers: QBOCustomer[] = custData.QueryResponse?.Customer || [];

          // Insert customers
          const customersToInsert = customers.map(c => ({
            qbo_customer_id: c.Id,
            first_name: c.GivenName || c.DisplayName?.split(' ')[0] || 'Unknown',
            last_name: c.FamilyName || c.DisplayName?.split(' ').slice(1).join(' ') || '',
            display_name: c.DisplayName || '',
            company_name: c.CompanyName || null,
            email: c.PrimaryEmailAddr?.Address || null,
            phone: c.PrimaryPhone?.FreeFormNumber || null,
            mobile_phone: c.Mobile?.FreeFormNumber || null,
            address: c.BillAddr?.Line1 || null,
            city: c.BillAddr?.City || null,
            state: c.BillAddr?.CountrySubDivisionCode || null,
            zip: c.BillAddr?.PostalCode || null,
          }));

          const { data: insertedCustomers, error: insertError } = await supabase
            .from('customers')
            .upsert(customersToInsert, { onConflict: 'qbo_customer_id' })
            .select('id, qbo_customer_id');

          if (insertError) {
            result.errors.push(`Customer insert error: ${insertError.message}`);
          } else if (insertedCustomers) {
            insertedCustomers.forEach(c => {
              if (c.qbo_customer_id) {
                customerMap.set(c.qbo_customer_id, c.id);
                result.customersCreated++;
              }
            });
          }
        }

        await sleep(100);
      }
    }

    console.log(`[QBO Estimate Sync] Customer map now has ${customerMap.size} entries`);

    // Get existing estimates by estimate_number for upsert logic
    const qboDocNumbers = allEstimates.map(e => e.DocNumber).filter(Boolean) as string[];
    const { data: existingEstimates } = await supabase
      .from('estimates')
      .select('id, estimate_number')
      .in('estimate_number', qboDocNumbers);

    const estimateMap = new Map<string, string>();
    (existingEstimates || []).forEach(e => {
      estimateMap.set(e.estimate_number, e.id);
    });

    console.log(`[QBO Estimate Sync] Found ${estimateMap.size} existing estimates to update`);

    // Process estimates
    const BATCH_SIZE = 100;
    for (let i = 0; i < allEstimates.length; i += BATCH_SIZE) {
      const batch = allEstimates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`[QBO Estimate Sync] Processing batch ${batchNum}...`);

      for (const qboEst of batch) {
        const customerId = customerMap.get(qboEst.CustomerRef?.value || '');
        
        if (!customerId) {
          result.errors.push(`Estimate ${qboEst.DocNumber}: Customer not found (QBO ID: ${qboEst.CustomerRef?.value})`);
          result.skipped++;
          continue;
        }

        const estimateNumber = qboEst.DocNumber || `QBO-${qboEst.Id}`;
        const existingId = estimateMap.get(estimateNumber);

        // Calculate line items
        const serviceLines = (qboEst.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail');
        const subtotal = serviceLines.reduce((sum, l) => sum + (l.Amount || 0), 0);
        const taxAmount = qboEst.TxnTaxDetail?.TotalTax || 0;

        const estimateData = {
          estimate_number: estimateNumber,
          customer_id: customerId,
          status: mapEstimateStatus(qboEst),
          subtotal,
          tax_amount: taxAmount,
          total_amount: qboEst.TotalAmt || 0,
          valid_until: qboEst.ExpirationDate || null,
          notes: qboEst.CustomerMemo?.value || null,
          internal_notes: qboEst.PrivateNote || null,
          created_at: qboEst.TxnDate ? new Date(qboEst.TxnDate).toISOString() : new Date().toISOString(),
        };

        if (existingId) {
          // Update existing estimate
          const { error: updateError } = await supabase
            .from('estimates')
            .update(estimateData)
            .eq('id', existingId);

          if (updateError) {
            result.errors.push(`Update ${estimateNumber}: ${updateError.message}`);
          } else {
            result.updated++;

            // Delete and re-insert line items
            await supabase.from('estimate_line_items').delete().eq('estimate_id', existingId);
            
            const lineItems = serviceLines.map((line, idx) => ({
              estimate_id: existingId,
              description: line.Description || line.SalesItemLineDetail?.ItemRef?.name || 'Item',
              quantity: line.SalesItemLineDetail?.Qty || 1,
              unit_price: line.SalesItemLineDetail?.UnitPrice || line.Amount || 0,
              extended_price: line.Amount || 0,
              taxable: line.SalesItemLineDetail?.TaxCodeRef?.value !== 'NON',
              sort_order: line.LineNum || idx,
              line_type: 'service',
            }));

            if (lineItems.length > 0) {
              await supabase.from('estimate_line_items').insert(lineItems);
            }
          }
        } else {
          // Create new estimate
          const { data: newEstimate, error: insertError } = await supabase
            .from('estimates')
            .insert(estimateData)
            .select('id')
            .single();

          if (insertError) {
            result.errors.push(`Insert ${estimateNumber}: ${insertError.message}`);
          } else if (newEstimate) {
            result.created++;
            estimateMap.set(estimateNumber, newEstimate.id);

            // Insert line items
            const lineItems = serviceLines.map((line, idx) => ({
              estimate_id: newEstimate.id,
              description: line.Description || line.SalesItemLineDetail?.ItemRef?.name || 'Item',
              quantity: line.SalesItemLineDetail?.Qty || 1,
              unit_price: line.SalesItemLineDetail?.UnitPrice || line.Amount || 0,
              extended_price: line.Amount || 0,
              taxable: line.SalesItemLineDetail?.TaxCodeRef?.value !== 'NON',
              sort_order: line.LineNum || idx,
              line_type: 'service',
            }));

            if (lineItems.length > 0) {
              await supabase.from('estimate_line_items').insert(lineItems);
            }
          }
        }
      }
    }

    console.log(`[QBO Estimate Sync] Complete! Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${result.created} new, ${result.updated} updated estimates. ${result.customersCreated} customers auto-created.`,
      result,
      newRefreshToken,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[QBO Estimate Sync] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
