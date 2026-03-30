import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intuit Discovery Document URL (as recommended by Intuit)
const DISCOVERY_DOC_URL = 'https://developer.api.intuit.com/.well-known/openid_configuration';

// Fallback URLs if discovery fails
const FALLBACK_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FALLBACK_API_PRODUCTION = 'https://quickbooks.api.intuit.com/v3/company';
const FALLBACK_API_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// Error types for proper handling
type QBOErrorType = 
  | 'expired_access_token' 
  | 'expired_refresh_token' 
  | 'invalid_grant' 
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

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
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Notes?: string;
  Active?: boolean;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  total: number;
  intuit_tids: string[]; // Capture transaction IDs for debugging/support
}

interface DiscoveryDocument {
  token_endpoint: string;
  userinfo_endpoint?: string;
  revocation_endpoint?: string;
}

// Fetch and cache discovery document
let cachedDiscovery: DiscoveryDocument | null = null;
let discoveryFetchedAt: number = 0;
const DISCOVERY_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getDiscoveryDocument(): Promise<DiscoveryDocument> {
  const now = Date.now();
  
  if (cachedDiscovery && (now - discoveryFetchedAt) < DISCOVERY_CACHE_MS) {
    return cachedDiscovery;
  }
  
  try {
    console.log('[QBO Sync] Fetching Intuit discovery document...');
    const response = await fetch(DISCOVERY_DOC_URL);
    
    if (response.ok) {
      cachedDiscovery = await response.json();
      discoveryFetchedAt = now;
      console.log('[QBO Sync] Discovery document fetched successfully');
      return cachedDiscovery!;
    }
  } catch (e) {
    console.warn('[QBO Sync] Failed to fetch discovery document, using fallbacks:', e);
  }
  
  // Return fallback
  return {
    token_endpoint: FALLBACK_TOKEN_URL,
  };
}

// Classify error type from response
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
    if (lowerBody.includes('invalid_grant')) {
      return 'invalid_grant';
    }
    if (lowerBody.includes('expired')) {
      return 'expired_refresh_token';
    }
  }
  
  if (status === 429) {
    return 'rate_limited';
  }
  
  if (status >= 500) {
    return 'network_error';
  }
  
  return 'unknown';
}

// Check if error is retryable
function isRetryableError(errorType: QBOErrorType): boolean {
  return ['rate_limited', 'network_error'].includes(errorType);
}

// Sleep with exponential backoff
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for fetch requests - now returns intuit_tid
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
      
      // Capture intuit_tid from response headers
      const intuit_tid = response.headers.get('intuit_tid') || undefined;
      if (intuit_tid) {
        console.log(`[QBO Sync] ${context} intuit_tid: ${intuit_tid}`);
      }
      
      if (response.ok) {
        return { response, intuit_tid };
      }
      
      const errorText = await response.clone().text();
      lastErrorType = classifyError(response.status, errorText);
      
      console.log(`[QBO Sync] ${context} failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${response.status} - ${lastErrorType}${intuit_tid ? ` [tid: ${intuit_tid}]` : ''}`);
      
      // Don't retry non-retryable errors
      if (!isRetryableError(lastErrorType)) {
        return { response, errorType: lastErrorType, intuit_tid };
      }
      
      // Exponential backoff
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`[QBO Sync] Retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
      
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.log(`[QBO Sync] ${context} network error (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}`);
      
      lastErrorType = 'network_error';
      
      // Exponential backoff for network errors
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }
  
  // All retries exhausted
  throw new Error(`${context} failed after ${MAX_RETRIES} attempts: ${lastError?.message || lastErrorType}`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const use_sandbox = Boolean((body as any)?.use_sandbox);

    const rawRefreshToken =
      typeof (body as any)?.refresh_token === 'string' ? (body as any).refresh_token : '';
    const refreshToken = rawRefreshToken.replace(/\s+/g, '');

    if (!refreshToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing refresh token',
          errorType: 'invalid_grant',
          requiresReconnect: true,
          message: 'Please paste the QuickBooks refresh token (it usually starts with RT1-...).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Common mistake: user pastes accessToken/idToken ("eyJ...") instead of refreshToken ("RT1-...")
    if (refreshToken.startsWith('eyJ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid token type',
          errorType: 'invalid_grant',
          requiresReconnect: true,
          message:
            'You pasted an access token/id token. Please paste the Refresh Token from the OAuth response (starts with RT1-...).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get endpoints from discovery document
    const discovery = await getDiscoveryDocument();
    const tokenUrl = discovery.token_endpoint;

    // Select API base URL based on environment
    const QBO_API_BASE = use_sandbox ? FALLBACK_API_SANDBOX : FALLBACK_API_PRODUCTION;
    console.log(`[QBO Sync] Using ${use_sandbox ? 'SANDBOX' : 'PRODUCTION'} environment`);
    console.log(`[QBO Sync] Token endpoint: ${tokenUrl}`);

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

    // Step 1: Get access token using refresh token (with retry)
    console.log('[QBO Sync] Exchanging refresh token for access token...');

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
      console.error('[QBO Sync] Token exchange failed:', errorText);
      
      // Any token exchange failure requires reconnection
      // This includes: invalid_grant, expired tokens, wrong credentials, etc.
      return new Response(JSON.stringify({
        success: false,
        error: `Token exchange failed: ${tokenResponse.status}`,
        errorType: tokenErrorType,
        requiresReconnect: true, // Always require reconnect on token exchange failure
        message: tokenErrorType === 'invalid_grant' 
          ? 'Your refresh token has expired or been revoked. Please reconnect to QuickBooks.'
          : tokenErrorType === 'expired_refresh_token'
          ? 'Your refresh token has expired. Please obtain a new one from the OAuth Playground.'
          : 'Authentication failed. Your stored token is invalid for the current credentials. Please reconnect to QuickBooks with a new refresh token.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const newRefreshToken = tokenData.refresh_token;

    console.log('[QBO Sync] Access token obtained successfully');

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
        last_sync_type: 'customer',
      }, { onConflict: 'realm_id,environment' });

    console.log('[QBO Sync] Token saved for future cron syncs');

    // Step 2: Count total customers (with retry)
    const countQuery = encodeURIComponent("SELECT COUNT(*) FROM Customer");
    const countUrl = `${QBO_API_BASE}/${realmId}/query?query=${countQuery}`;
    
    const { response: countResponse, errorType: countErrorType, intuit_tid: countTid } = await fetchWithRetry(
      countUrl,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      },
      'Customer count'
    );

    // Collect intuit_tids for debugging/support
    const collectedTids: string[] = [];
    if (countTid) collectedTids.push(countTid);

    if (!countResponse.ok) {
      // Check if access token expired during sync
      if (countErrorType === 'expired_access_token') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access token expired during sync',
          errorType: countErrorType,
          requiresReconnect: false,
          message: 'Your access token expired. Please try again with a fresh refresh token.',
          newRefreshToken, // Still return new token if we got one
          intuit_tid: countTid,
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Failed to count customers: ${countResponse.status}${countTid ? ` [tid: ${countTid}]` : ''}`);
    }

    const countData = await countResponse.json();
    const totalCustomers = countData.QueryResponse?.totalCount || 0;
    console.log(`[QBO Sync] Total customers to sync: ${totalCustomers}`);

    // Step 3: Fetch all customers with pagination (with retry per page)
    const result: SyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      total: totalCustomers,
      intuit_tids: [],
    };

    const pageSize = 1000;
    let startPosition = 1;
    let allCustomers: QBOCustomer[] = [];

    while (startPosition <= totalCustomers) {
      console.log(`[QBO Sync] Fetching customers ${startPosition} to ${startPosition + pageSize - 1}...`);
      
      const query = encodeURIComponent(
        `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`
      );
      const queryUrl = `${QBO_API_BASE}/${realmId}/query?query=${query}`;

      try {
        const { response: queryResponse, errorType: queryErrorType, intuit_tid: queryTid } = await fetchWithRetry(
          queryUrl,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          },
          `Customer fetch (page ${startPosition})`
        );

        // Collect intuit_tid
        if (queryTid) collectedTids.push(queryTid);

        if (!queryResponse.ok) {
          if (queryErrorType === 'expired_access_token') {
            // Partial success - return what we have
            console.log('[QBO Sync] Access token expired mid-sync, returning partial results');
            break;
          }
          result.errors.push(`Failed to fetch page starting at ${startPosition}${queryTid ? ` [tid: ${queryTid}]` : ''}`);
          break;
        }

        const queryData = await queryResponse.json();
        const customers = queryData.QueryResponse?.Customer || [];
        allCustomers = allCustomers.concat(customers);

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        result.errors.push(`Error fetching page ${startPosition}: ${errorMessage}`);
        break;
      }

      startPosition += pageSize;

      // Small delay to avoid rate limiting
      await sleep(100);
    }

    console.log(`[QBO Sync] Fetched ${allCustomers.length} customers, now upserting...`);

    // Step 4: Batch upsert customers for performance (process in chunks of 500)
    const BATCH_SIZE = 500;
    
    // First, get all existing customers by qbo_customer_id in one query
    const qboIds = allCustomers.map(c => c.Id);
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, qbo_customer_id')
      .in('qbo_customer_id', qboIds);
    
    const existingMap = new Map<string, string>();
    (existingCustomers || []).forEach(c => {
      if (c.qbo_customer_id) existingMap.set(c.qbo_customer_id, c.id);
    });
    
    console.log(`[QBO Sync] Found ${existingMap.size} existing customers to update`);

    // Split into batches for upsert
    for (let i = 0; i < allCustomers.length; i += BATCH_SIZE) {
      const batch = allCustomers.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allCustomers.length / BATCH_SIZE);
      
      console.log(`[QBO Sync] Processing batch ${batchNum}/${totalBatches} (${batch.length} customers)...`);
      
      // Prepare customer data for batch upsert
      const customersToUpsert = batch.map(qboCustomer => ({
        qbo_customer_id: qboCustomer.Id,
        first_name: qboCustomer.GivenName || qboCustomer.DisplayName?.split(' ')[0] || 'Unknown',
        middle_name: qboCustomer.MiddleName || null,
        last_name: qboCustomer.FamilyName || qboCustomer.DisplayName?.split(' ').slice(1).join(' ') || '',
        display_name: qboCustomer.DisplayName || `${qboCustomer.GivenName || ''} ${qboCustomer.FamilyName || ''}`.trim(),
        company_name: qboCustomer.CompanyName || null,
        email: qboCustomer.PrimaryEmailAddr?.Address || null,
        phone: qboCustomer.PrimaryPhone?.FreeFormNumber || null,
        mobile_phone: qboCustomer.Mobile?.FreeFormNumber || null,
        website: qboCustomer.WebAddr?.URI || null,
        address: qboCustomer.BillAddr?.Line1 || null,
        city: qboCustomer.BillAddr?.City || null,
        state: qboCustomer.BillAddr?.CountrySubDivisionCode || null,
        zip: qboCustomer.BillAddr?.PostalCode || null,
        notes: qboCustomer.Notes || null,
      }));

      // Use upsert with onConflict for efficient batch processing
      const { error: upsertError } = await supabase
        .from('customers')
        .upsert(customersToUpsert, { 
          onConflict: 'qbo_customer_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        result.errors.push(`Batch ${batchNum} upsert failed: ${upsertError.message}`);
        console.error(`[QBO Sync] Batch ${batchNum} error:`, upsertError.message);
      } else {
        // Count created vs updated based on pre-existing map
        batch.forEach(c => {
          if (existingMap.has(c.Id)) {
            result.updated++;
          } else {
            result.created++;
          }
        });
      }
    }

    console.log(`[QBO Sync] Customer upsert complete. Now processing addresses...`);

    // Step 5: Batch upsert addresses
    // First, get all customer IDs we just upserted
    const { data: allDbCustomers } = await supabase
      .from('customers')
      .select('id, qbo_customer_id')
      .in('qbo_customer_id', qboIds);
    
    const customerIdMap = new Map<string, string>();
    (allDbCustomers || []).forEach(c => {
      if (c.qbo_customer_id) customerIdMap.set(c.qbo_customer_id, c.id);
    });

    // Prepare all addresses for batch upsert
    const billingAddresses: any[] = [];
    const shippingAddresses: any[] = [];

    for (const qboCustomer of allCustomers) {
      const customerId = customerIdMap.get(qboCustomer.Id);
      if (!customerId) continue;

      if (qboCustomer.BillAddr) {
        billingAddresses.push({
          customer_id: customerId,
          address_type: 'billing',
          street1: qboCustomer.BillAddr.Line1 || null,
          street2: qboCustomer.BillAddr.Line2 || null,
          city: qboCustomer.BillAddr.City || null,
          state: qboCustomer.BillAddr.CountrySubDivisionCode || null,
          zip: qboCustomer.BillAddr.PostalCode || null,
          country: qboCustomer.BillAddr.Country || 'US',
        });
      }

      if (qboCustomer.ShipAddr) {
        const isSameAsBilling = 
          qboCustomer.ShipAddr.Line1 === qboCustomer.BillAddr?.Line1 &&
          qboCustomer.ShipAddr.City === qboCustomer.BillAddr?.City;

        shippingAddresses.push({
          customer_id: customerId,
          address_type: 'shipping',
          street1: qboCustomer.ShipAddr.Line1 || null,
          street2: qboCustomer.ShipAddr.Line2 || null,
          city: qboCustomer.ShipAddr.City || null,
          state: qboCustomer.ShipAddr.CountrySubDivisionCode || null,
          zip: qboCustomer.ShipAddr.PostalCode || null,
          country: qboCustomer.ShipAddr.Country || 'US',
          is_same_as_billing: isSameAsBilling,
        });
      }
    }

    // Batch upsert billing addresses
    if (billingAddresses.length > 0) {
      console.log(`[QBO Sync] Upserting ${billingAddresses.length} billing addresses...`);
      for (let i = 0; i < billingAddresses.length; i += BATCH_SIZE) {
        const batch = billingAddresses.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('customer_addresses')
          .upsert(batch, { onConflict: 'customer_id,address_type' });
        if (error) {
          console.error(`[QBO Sync] Billing address batch error:`, error.message);
        }
      }
    }

    // Batch upsert shipping addresses
    if (shippingAddresses.length > 0) {
      console.log(`[QBO Sync] Upserting ${shippingAddresses.length} shipping addresses...`);
      for (let i = 0; i < shippingAddresses.length; i += BATCH_SIZE) {
        const batch = shippingAddresses.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('customer_addresses')
          .upsert(batch, { onConflict: 'customer_id,address_type' });
        if (error) {
          console.error(`[QBO Sync] Shipping address batch error:`, error.message);
        }
      }
    }

    // Add collected intuit_tids to result
    result.intuit_tids = collectedTids;
    
    console.log(`[QBO Sync] Complete! Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors.length}, Transaction IDs: ${collectedTids.length}`);

    return new Response(JSON.stringify({
      success: true,
      result,
      newRefreshToken, // Return new refresh token for storage
      usedDiscoveryDoc: cachedDiscovery !== null,
      intuit_tids: collectedTids, // Top-level for easy access
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[QBO Sync] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try to determine if reconnection is needed
    const requiresReconnect = errorMessage.toLowerCase().includes('invalid_grant') ||
                              errorMessage.toLowerCase().includes('refresh_token');
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      requiresReconnect,
      message: requiresReconnect 
        ? 'Your connection to QuickBooks has expired. Please reconnect.'
        : 'Sync failed. Please try again.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});